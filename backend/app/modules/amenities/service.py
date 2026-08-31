"""Business logic for Amenity Booking (FR-11).

- Slots define weekly availability; a booking's `start_at`/`end_at` come from the slot times
  on `booking_date` (whose weekday must match the slot).
- Booking rules are config-as-data (`amenity_rules`): `max_advance_days`, `max_active_per_unit`,
  `min_cancel_hours`, `max_hours_per_booking`.
- The conflict check locks the amenity row, rejects maintenance-block overlaps, and enforces
  capacity across overlapping confirmed bookings.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.security import user_permissions_async
from app.core.tenancy import TenantScope
from app.modules.amenities import schemas
from app.modules.amenities.models import (
    Amenity,
    AmenityBlock,
    AmenityBooking,
    AmenityRule,
    AmenitySlot,
)
from app.modules.amenities.repository import (
    AmenityRepository,
    BlockRepository,
    BookingRepository,
    RuleRepository,
    SlotRepository,
)
from app.modules.amenities.schemas import ALLOWED
from app.modules.audit.service import record_audit_async
from app.modules.residents.access import UnitScopedAccess
from app.modules.residents.models import ResidentProfile, UnitOccupancy
from app.modules.users.models import User


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class AmenityService(UnitScopedAccess):
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request
        self.amenities = AmenityRepository(db, scope)
        self.slots = SlotRepository(db, scope)
        self.rules = RuleRepository(db, scope)
        self.blocks = BlockRepository(db, scope)
        self.bookings = BookingRepository(db, scope)

    async def _audit(self, action, community_id, entity_type, entity_id, **kw):
        await record_audit_async(
            self.db,
            module="amenities",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type=entity_type,
            entity_id=entity_id,
            request=self.request,
            **kw,
        )

    def _one_community(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is not None:
            return self.scope.require(community_id)
        if not self.scope.is_global and len(self.scope.community_ids) == 1:
            return next(iter(self.scope.community_ids))
        raise BusinessRuleError(
            "Specify a community", code="COMMUNITY_REQUIRED", fields={"community_id": "required"}
        )

    async def _amenity_in_scope(self, amenity_id: uuid.UUID) -> Amenity:
        obj = await self.amenities.get(amenity_id)
        if obj is None:
            raise NotFoundError("Amenity not found")
        return obj

    async def get_amenity(self, amenity_id: uuid.UUID) -> Amenity:
        return await self._amenity_in_scope(amenity_id)

    async def _actor_unit(self) -> uuid.UUID:
        occ = await self.db.scalar(
            select(UnitOccupancy)
            .join(ResidentProfile, ResidentProfile.id == UnitOccupancy.resident_profile_id)
            .where(
                ResidentProfile.user_id == self.actor.id,
                UnitOccupancy.is_active.is_(True),
            )
            .order_by(UnitOccupancy.is_primary.desc())
        )
        if occ is None:
            raise BusinessRuleError(
                "No unit is linked to your account", code="NO_UNIT", fields={"unit": "required"}
            )
        return occ.unit_id

    # -- amenities ------------------------------------------- #
    async def list_amenities(self, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        stmt = select(Amenity).where(Amenity.community_id == cid).order_by(Amenity.code)
        return list((await self.db.scalars(stmt)).all())

    async def create_amenity(
        self, payload: schemas.AmenityCreate, *, community_id: uuid.UUID | None
    ):
        cid = self._one_community(community_id)
        _enum("amenity_type", payload.amenity_type)
        if await self.amenities.by_code(cid, payload.code):
            raise ConflictError("That code exists", code="AMENITY_EXISTS")
        obj = Amenity(community_id=cid, **payload.model_dump())
        await self.amenities.add(obj)
        await self._audit("amenity.create", cid, "amenity", obj.id)
        return obj

    async def update_amenity(self, amenity_id: uuid.UUID, payload: schemas.AmenityUpdate):
        obj = await self._amenity_in_scope(amenity_id)
        patch = payload.model_dump(exclude_unset=True)
        _enum("amenity_type", patch.get("amenity_type"))
        for k, v in patch.items():
            setattr(obj, k, v)
        await self.db.flush()
        await self._audit("amenity.update", obj.community_id, "amenity", obj.id, new=patch)
        return obj

    # -- slots ------------------------------------------- #
    async def list_slots(self, amenity_id: uuid.UUID):
        await self._amenity_in_scope(amenity_id)
        return list(
            (
                await self.db.scalars(
                    select(AmenitySlot)
                    .where(AmenitySlot.amenity_id == amenity_id)
                    .order_by(AmenitySlot.day_of_week, AmenitySlot.start_time)
                )
            ).all()
        )

    async def create_slot(self, amenity_id: uuid.UUID, payload: schemas.SlotCreate):
        amenity = await self._amenity_in_scope(amenity_id)
        if payload.end_time <= payload.start_time:
            raise BusinessRuleError("end_time must be after start_time", code="INVALID_TIME_RANGE")
        obj = AmenitySlot(
            community_id=amenity.community_id,
            amenity_id=amenity.id,
            day_of_week=payload.day_of_week,
            start_time=payload.start_time,
            end_time=payload.end_time,
            capacity=payload.capacity,
            fee=payload.fee,
        )
        await self.slots.add(obj)
        await self._audit("slot.create", amenity.community_id, "amenity_slot", obj.id)
        return obj

    async def delete_slot(self, slot_id: uuid.UUID) -> None:
        obj = await self.slots.get(slot_id)
        if obj is None:
            raise NotFoundError("Slot not found")
        obj.is_active = False
        await self.db.flush()
        await self._audit("slot.disable", obj.community_id, "amenity_slot", obj.id)

    # -- rules ------------------------------------------ #
    async def list_rules(self, amenity_id: uuid.UUID):
        await self._amenity_in_scope(amenity_id)
        return await self.rules.for_amenity(amenity_id)

    async def upsert_rule(self, amenity_id: uuid.UUID, payload: schemas.RuleUpsert):
        amenity = await self._amenity_in_scope(amenity_id)
        _enum("rule_type", payload.rule_type)
        obj = await self.rules.match(amenity_id, payload.rule_type)
        if obj is None:
            obj = AmenityRule(
                community_id=amenity.community_id,
                amenity_id=amenity.id,
                rule_type=payload.rule_type,
                rule_value=payload.rule_value,
            )
            await self.rules.add(obj)
            action = "rule.create"
        else:
            obj.rule_value = payload.rule_value
            obj.is_active = True
            await self.db.flush()
            action = "rule.update"
        await self._audit(
            action, amenity.community_id, "amenity_rule", obj.id, new=payload.rule_value
        )
        return obj

    async def _rule_int(self, amenity_id: uuid.UUID, rule_type: str) -> int | None:
        rule = await self.rules.match(amenity_id, rule_type)
        if rule is None or not rule.is_active:
            return None
        raw = rule.rule_value.get("value")
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None

    # -- blocks ---------------------------------------- #
    async def list_blocks(self, amenity_id: uuid.UUID):
        await self._amenity_in_scope(amenity_id)
        return list(
            (
                await self.db.scalars(
                    select(AmenityBlock)
                    .where(AmenityBlock.amenity_id == amenity_id)
                    .order_by(AmenityBlock.blocked_from.desc())
                )
            ).all()
        )

    async def create_block(self, amenity_id: uuid.UUID, payload: schemas.BlockCreate):
        amenity = await self._amenity_in_scope(amenity_id)
        if payload.blocked_to <= payload.blocked_from:
            raise BusinessRuleError(
                "blocked_to must be after blocked_from", code="INVALID_TIME_RANGE"
            )
        obj = AmenityBlock(
            community_id=amenity.community_id,
            amenity_id=amenity.id,
            blocked_from=payload.blocked_from,
            blocked_to=payload.blocked_to,
            reason=payload.reason,
            created_by_user_id=self.actor.id,
        )
        await self.blocks.add(obj)
        await self._audit("block.create", amenity.community_id, "amenity_block", obj.id)
        return obj

    # -- bookings ------------------------------------- #
    async def list_bookings(
        self,
        *,
        community_id: uuid.UUID | None,
        amenity_id: uuid.UUID | None,
        booking_status: str | None,
        mine: bool,
        offset: int,
        limit: int,
    ):
        _enum("booking_status", booking_status)
        stmt = select(AmenityBooking)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(AmenityBooking.community_id == community_id)
        if amenity_id:
            stmt = stmt.where(AmenityBooking.amenity_id == amenity_id)
        if booking_status:
            stmt = stmt.where(AmenityBooking.status == booking_status)
        if mine:
            stmt = stmt.where(AmenityBooking.resident_user_id == self.actor.id)
        stmt = stmt.order_by(AmenityBooking.start_at.desc())
        # a plain resident only sees their own bookings (amenities themselves stay community-wide)
        stmt = await self._scope_owned(stmt, AmenityBooking.resident_user_id)
        return await self.bookings.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.bookings.count(extra=stmt)

    async def get_booking(self, booking_id: uuid.UUID) -> AmenityBooking:
        obj = await self.bookings.get(booking_id)
        if obj is None:
            raise NotFoundError("Booking not found")
        if (await self.is_unit_restricted()) and obj.resident_user_id != self.actor.id:
            raise NotFoundError("Booking not found")
        return obj

    async def book(self, payload: schemas.BookingCreate) -> AmenityBooking:
        amenity = await self._amenity_in_scope(payload.amenity_id)
        if not amenity.is_active:
            raise BusinessRuleError("Amenity is not bookable", code="AMENITY_INACTIVE")
        slot = await self.slots.get(payload.slot_id)
        if slot is None or slot.amenity_id != amenity.id:
            raise NotFoundError("Slot not found")
        if not slot.is_active:
            raise BusinessRuleError("Slot is not active", code="SLOT_INACTIVE")
        if payload.booking_date.weekday() != slot.day_of_week:
            raise BusinessRuleError(
                "booking_date does not fall on the slot's weekday", code="SLOT_WEEKDAY_MISMATCH"
            )
        today = date.today()
        if payload.booking_date < today:
            raise BusinessRuleError("booking_date is in the past", code="DATE_IN_PAST")

        max_adv = await self._rule_int(amenity.id, "max_advance_days")
        if max_adv is not None and (payload.booking_date - today).days > max_adv:
            raise BusinessRuleError(
                f"Bookings open only {max_adv} days ahead", code="TOO_FAR_AHEAD"
            )

        start_at = datetime.combine(payload.booking_date, slot.start_time, tzinfo=UTC)
        end_at = datetime.combine(payload.booking_date, slot.end_time, tzinfo=UTC)

        max_hours = await self._rule_int(amenity.id, "max_hours_per_booking")
        if max_hours is not None and (end_at - start_at).total_seconds() > max_hours * 3600:
            raise BusinessRuleError("Slot exceeds the per-booking limit", code="TOO_LONG")

        unit_id = await self._actor_unit()
        max_active = await self._rule_int(amenity.id, "max_active_per_unit")
        if max_active is not None and (
            await self.bookings.active_count_for_unit(amenity.id, unit_id) >= max_active
        ):
            raise BusinessRuleError(
                "Your unit has reached its active-booking limit", code="UNIT_BOOKING_LIMIT"
            )

        # atomic conflict check
        await self.amenities.lock(amenity.id)
        if await self.blocks.overlapping(amenity.id, start_at, end_at):
            raise ConflictError("Amenity is blocked for maintenance", code="AMENITY_BLOCKED")
        cap = slot.capacity or amenity.capacity
        used = sum(
            b.participant_count
            for b in await self.bookings.overlapping_confirmed(amenity.id, start_at, end_at)
        )
        if used + payload.participant_count > cap:
            raise ConflictError("No capacity left for that slot", code="SLOT_FULL")

        obj = AmenityBooking(
            community_id=amenity.community_id,
            amenity_id=amenity.id,
            slot_id=slot.id,
            unit_id=unit_id,
            resident_user_id=self.actor.id,
            booking_date=payload.booking_date,
            start_at=start_at,
            end_at=end_at,
            participant_count=payload.participant_count,
            status="confirmed",
            amount=slot.fee,
        )
        await self.bookings.add(obj)
        await self._audit(
            "booking.create",
            amenity.community_id,
            "amenity_booking",
            obj.id,
            new={"amenity": amenity.code, "date": payload.booking_date.isoformat()},
        )
        return obj

    async def cancel_booking(self, booking_id: uuid.UUID, payload: schemas.BookingCancel):
        obj = await self.get_booking(booking_id)
        if obj.status != "confirmed":
            raise BusinessRuleError(f"Booking is '{obj.status}'", code="INVALID_TRANSITION")
        is_owner = obj.resident_user_id == self.actor.id
        pset = await user_permissions_async(self.db, self.actor)
        perms = "*" in pset or "amenities:update" in pset
        if not (is_owner or perms):
            raise ForbiddenError("Not your booking", code="NOT_BOOKING_OWNER")
        if is_owner and not perms:
            min_hours = await self._rule_int(obj.amenity_id, "min_cancel_hours")
            if min_hours is not None and (
                (obj.start_at - datetime.now(UTC)).total_seconds() < min_hours * 3600
            ):
                raise BusinessRuleError(
                    f"Cancel at least {min_hours}h before start", code="TOO_LATE_TO_CANCEL"
                )
        obj.status = "cancelled"
        obj.cancelled_at = datetime.now(UTC)
        obj.cancellation_reason = payload.reason
        await self.db.flush()
        await self._audit("booking.cancel", obj.community_id, "amenity_booking", obj.id)
        return obj

    async def mark_booking(self, booking_id: uuid.UUID, new_status: str):
        obj = await self.get_booking(booking_id)
        _enum("booking_status", new_status)
        if new_status not in ("completed", "no_show"):
            raise BusinessRuleError("Only completed / no_show here", code="INVALID_TRANSITION")
        if obj.status != "confirmed":
            raise BusinessRuleError(f"Booking is '{obj.status}'", code="INVALID_TRANSITION")
        obj.status = new_status
        await self.db.flush()
        await self._audit(f"booking.{new_status}", obj.community_id, "amenity_booking", obj.id)
        return obj
