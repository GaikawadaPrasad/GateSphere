"""Business logic for Residents (FR-03). Async stack (ADR-010).

Rules:
  * All entities live in the caller's active community (from `TenantScope.require()`).
  * A resident profile links one `user` to one community (unique). The user and the unit are
    resolved within scope — a cross-tenant reference is a 404.
  * A unit has at most **one primary active occupant** (also enforced by a partial unique index).
  * Occupancy `end_date` must be after `start_date`; ending an occupancy sets `is_active=False`.
  * Move records follow `requested -> scheduled -> approved -> completed`, or `-> rejected` /
    `-> cancelled`. `approve` stamps `approved_by` + `approved_at`.
  * Every write emits an audit row in the same transaction.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.core.state_machine import ensure_transition
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.communities.models import Unit
from app.modules.residents import schemas
from app.modules.residents.models import (
    EmergencyContact,
    FamilyMember,
    MoveRecord,
    ResidentProfile,
    UnitOccupancy,
)
from app.modules.residents.repository import (
    EmergencyContactRepository,
    FamilyMemberRepository,
    MoveRecordRepository,
    OccupancyRepository,
    ResidentProfileRepository,
)
from app.modules.residents.schemas import ALLOWED
from app.modules.users.models import User

_MOVE_TRANSITIONS: dict[str, set[str]] = {
    "requested": {"scheduled", "rejected", "cancelled"},
    "scheduled": {"approved", "rejected", "cancelled"},
    "approved": {"completed", "cancelled"},
    "completed": set(),
    "rejected": set(),
    "cancelled": set(),
}
_PROFILE_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"active", "suspended"},
    "active": {"suspended", "moved_out"},
    "suspended": {"active", "moved_out"},
    "moved_out": {"active"},  # a returning resident
}
_KYC_TRANSITIONS: dict[str, set[str]] = {
    "not_started": {"submitted"},
    "submitted": {"verified", "rejected"},
    "rejected": {"submitted"},
    "verified": {"submitted"},  # re-KYC on document expiry
}


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


def _apply(obj: object, patch: dict) -> None:
    for k, v in patch.items():
        setattr(obj, k, v)


class ResidentService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx
        self.profiles = ResidentProfileRepository(db, scope)
        self.occupancies = OccupancyRepository(db, scope)
        self.family = FamilyMemberRepository(db, scope)
        self.contacts = EmergencyContactRepository(db, scope)
        self.moves = MoveRecordRepository(db, scope)

    async def _audit(
        self, action: str, community_id: uuid.UUID, entity_type: str, entity_id, **kw
    ) -> None:
        await record_audit_async(
            self.db,
            module="residents",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type=entity_type,
            entity_id=entity_id,
            ctx=self.ctx,
            **kw,
        )

    async def _unit_in_scope(self, unit_id: uuid.UUID) -> Unit:
        stmt = select(Unit).where(Unit.id == unit_id)
        if not self.scope.is_global:
            stmt = stmt.where(Unit.community_id.in_(self.scope.community_ids))
        unit = await self.db.scalar(stmt)
        if unit is None:
            raise NotFoundError("Unit not found")
        return unit

    async def _user_exists(self, user_id: uuid.UUID) -> User:
        user = await self.db.get(User, user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    def _active_community(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is not None:
            return self.scope.require(community_id)
        if not self.scope.is_global and len(self.scope.community_ids) == 1:
            return next(iter(self.scope.community_ids))
        raise BusinessRuleError(
            "Specify a community", code="COMMUNITY_REQUIRED", fields={"community_id": "required"}
        )

    # -- resident profiles --------------------------------------------- #
    async def list_profiles(self, *, community_id: uuid.UUID | None, offset: int, limit: int):
        stmt = select(ResidentProfile)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(ResidentProfile.community_id == community_id)
        stmt = stmt.order_by(ResidentProfile.created_at.desc())
        return (
            await self.profiles.list(offset=offset, limit=limit, extra=stmt),
            await self.profiles.count(extra=stmt),
        )

    async def get_profile(self, profile_id: uuid.UUID) -> ResidentProfile:
        obj = await self.profiles.get(profile_id)
        if obj is None:
            raise NotFoundError("Resident profile not found")
        return obj

    async def create_profile(
        self, payload: schemas.ResidentProfileCreate, *, community_id: uuid.UUID | None
    ):
        cid = self._active_community(community_id)
        _enum("profile_status", payload.profile_status)
        _enum("kyc_status", payload.kyc_status)
        await self._user_exists(payload.user_id)
        if await self.profiles.by_user(cid, payload.user_id):
            raise ConflictError(
                "This user already has a profile in this community",
                code="PROFILE_EXISTS",
                fields={"user_id": "already has a profile"},
            )
        obj = ResidentProfile(community_id=cid, **payload.model_dump())
        await self.profiles.add(obj)
        await self._audit(
            "profile.create", cid, "resident_profile", obj.id, new=payload.model_dump()
        )
        return obj

    async def update_profile(self, profile_id: uuid.UUID, payload: schemas.ResidentProfileUpdate):
        obj = await self.get_profile(profile_id)
        patch = payload.model_dump(exclude_unset=True)
        _enum("profile_status", patch.get("profile_status"))
        _enum("kyc_status", patch.get("kyc_status"))
        if "profile_status" in patch and patch["profile_status"] != obj.profile_status:
            ensure_transition(
                obj.profile_status, patch["profile_status"], _PROFILE_TRANSITIONS, entity="profile"
            )
        if "kyc_status" in patch and patch["kyc_status"] != obj.kyc_status:
            ensure_transition(obj.kyc_status, patch["kyc_status"], _KYC_TRANSITIONS, entity="KYC")
        before = {k: getattr(obj, k, None) for k in patch}
        _apply(obj, patch)
        await self.db.flush()
        await self._audit(
            "profile.update", obj.community_id, "resident_profile", obj.id, old=before, new=patch
        )
        return obj

    # -- occupancies ------------------------------------------------ #
    async def list_occupancies(self, *, unit_id: uuid.UUID, offset: int, limit: int):
        await self._unit_in_scope(unit_id)
        stmt = (
            select(UnitOccupancy)
            .where(UnitOccupancy.unit_id == unit_id)
            .order_by(UnitOccupancy.is_active.desc(), UnitOccupancy.start_date.desc())
        )
        return (
            await self.occupancies.list(offset=offset, limit=limit, extra=stmt),
            await self.occupancies.count(extra=stmt),
        )

    async def create_occupancy(self, payload: schemas.OccupancyCreate) -> UnitOccupancy:
        unit = await self._unit_in_scope(payload.unit_id)
        _enum("occupancy_role", payload.occupancy_role)
        profile = await self.profiles.get(payload.resident_profile_id)
        if profile is None or profile.community_id != unit.community_id:
            raise NotFoundError("Resident profile not found")
        if await self.occupancies.active_for_pair(unit.id, profile.id):
            raise ConflictError(
                "That resident already has an active occupancy on this unit",
                code="OCCUPANCY_EXISTS",
            )
        if payload.is_primary:
            existing_primary = [
                o for o in await self.occupancies.active_for_unit(unit.id) if o.is_primary
            ]
            if existing_primary:
                raise ConflictError(
                    "This unit already has a primary occupant", code="PRIMARY_OCCUPANT_EXISTS"
                )
        obj = UnitOccupancy(
            community_id=unit.community_id,
            unit_id=unit.id,
            resident_profile_id=profile.id,
            occupancy_role=payload.occupancy_role,
            is_primary=payload.is_primary,
            agreement_reference=payload.agreement_reference,
        )
        if payload.start_date is not None:
            obj.start_date = payload.start_date
        await self.occupancies.add(obj)
        await self._audit(
            "occupancy.create",
            unit.community_id,
            "unit_occupancy",
            obj.id,
            new=payload.model_dump(),
        )
        return obj

    async def end_occupancy(
        self, occupancy_id: uuid.UUID, payload: schemas.OccupancyEnd
    ) -> UnitOccupancy:
        obj = await self.occupancies.get(occupancy_id)
        if obj is None:
            raise NotFoundError("Occupancy not found")
        if payload.end_date <= obj.start_date:
            raise BusinessRuleError(
                "end_date must be after start_date",
                code="INVALID_DATE_RANGE",
                fields={"end_date": "must be after start_date"},
            )
        obj.end_date = payload.end_date
        obj.is_active = payload.is_active
        await self.db.flush()
        await self._audit(
            "occupancy.end",
            obj.community_id,
            "unit_occupancy",
            obj.id,
            new={"end_date": str(payload.end_date), "is_active": payload.is_active},
        )
        return obj

    # -- family members ------------------------------------------ #
    async def list_family(self, *, unit_id: uuid.UUID, offset: int, limit: int):
        await self._unit_in_scope(unit_id)
        stmt = (
            select(FamilyMember)
            .where(FamilyMember.unit_id == unit_id)
            .order_by(FamilyMember.full_name)
        )
        return (
            await self.family.list(offset=offset, limit=limit, extra=stmt),
            await self.family.count(extra=stmt),
        )

    async def create_family(self, payload: schemas.FamilyMemberCreate) -> FamilyMember:
        unit = await self._unit_in_scope(payload.unit_id)
        _enum("relationship_type", payload.relationship_type)
        profile = await self.profiles.get(payload.primary_resident_profile_id)
        if profile is None or profile.community_id != unit.community_id:
            raise NotFoundError("Primary resident profile not found")
        if payload.user_id is not None:
            await self._user_exists(payload.user_id)
        obj = FamilyMember(
            community_id=unit.community_id,
            unit_id=unit.id,
            primary_resident_profile_id=profile.id,
            user_id=payload.user_id,
            full_name=payload.full_name,
            relationship_type=payload.relationship_type,
            date_of_birth=payload.date_of_birth,
            phone=payload.phone,
        )
        await self.family.add(obj)
        await self._audit(
            "family.create",
            unit.community_id,
            "family_member",
            obj.id,
            new=payload.model_dump(by_alias=False),
        )
        return obj

    # -- emergency contacts ------------------------------------ #
    async def list_contacts(self, *, profile_id: uuid.UUID, offset: int, limit: int):
        await self.get_profile(profile_id)
        stmt = (
            select(EmergencyContact)
            .where(EmergencyContact.resident_profile_id == profile_id)
            .order_by(EmergencyContact.priority)
        )
        return (
            await self.contacts.list(offset=offset, limit=limit, extra=stmt),
            await self.contacts.count(extra=stmt),
        )

    async def create_contact(self, profile_id: uuid.UUID, payload: schemas.EmergencyContactCreate):
        profile = await self.get_profile(profile_id)
        obj = EmergencyContact(
            community_id=profile.community_id,
            resident_profile_id=profile.id,
            name=payload.name,
            relationship_type=payload.relationship_type,
            phone=payload.phone,
            alternate_phone=payload.alternate_phone,
            priority=payload.priority,
        )
        await self.contacts.add(obj)
        await self._audit("contact.create", profile.community_id, "emergency_contact", obj.id)
        return obj

    async def delete_contact(self, contact_id: uuid.UUID) -> None:
        obj = await self.contacts.get(contact_id)
        if obj is None:
            raise NotFoundError("Emergency contact not found")
        cid = obj.community_id
        await self.db.delete(obj)
        await self.db.flush()
        await self._audit("contact.delete", cid, "emergency_contact", contact_id)

    # -- move records ------------------------------------- #
    async def list_moves(
        self, *, community_id: uuid.UUID | None, status: str | None, offset: int, limit: int
    ):
        _enum("move_status", status)
        stmt = select(MoveRecord)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(MoveRecord.community_id == community_id)
        if status is not None:
            stmt = stmt.where(MoveRecord.status == status)
        stmt = stmt.order_by(MoveRecord.requested_at.desc())
        return (
            await self.moves.list(offset=offset, limit=limit, extra=stmt),
            await self.moves.count(extra=stmt),
        )

    async def get_move(self, move_id: uuid.UUID) -> MoveRecord:
        obj = await self.moves.get(move_id)
        if obj is None:
            raise NotFoundError("Move record not found")
        return obj

    async def create_move(self, payload: schemas.MoveRecordCreate) -> MoveRecord:
        unit = await self._unit_in_scope(payload.unit_id)
        _enum("move_type", payload.move_type)
        profile = await self.profiles.get(payload.resident_profile_id)
        if profile is None or profile.community_id != unit.community_id:
            raise NotFoundError("Resident profile not found")
        obj = MoveRecord(
            community_id=unit.community_id,
            unit_id=unit.id,
            resident_profile_id=profile.id,
            move_type=payload.move_type,
            scheduled_at=payload.scheduled_at,
            clearance_notes=payload.clearance_notes,
            status="scheduled" if payload.scheduled_at else "requested",
        )
        await self.moves.add(obj)
        await self._audit(
            "move.create", unit.community_id, "move_record", obj.id, new=payload.model_dump()
        )
        return obj

    async def transition_move(
        self, move_id: uuid.UUID, payload: schemas.MoveRecordTransition
    ) -> MoveRecord:
        obj = await self.get_move(move_id)
        _enum("move_status", payload.status)
        ensure_transition(obj.status, payload.status, _MOVE_TRANSITIONS, entity="move record")
        before = obj.status
        obj.status = payload.status
        if payload.scheduled_at is not None:
            obj.scheduled_at = payload.scheduled_at
        if payload.clearance_notes is not None:
            obj.clearance_notes = payload.clearance_notes
        if payload.status == "approved":
            obj.approved_by_user_id = self.actor.id
            obj.approved_at = datetime.now(UTC)
        if payload.status == "completed" and obj.move_type == "move_out":
            for occ in await self.occupancies.active_for_unit(obj.unit_id):
                if occ.resident_profile_id == obj.resident_profile_id:
                    occ.is_active = False
        await self.db.flush()
        await self._audit(
            "move.transition",
            obj.community_id,
            "move_record",
            obj.id,
            old={"status": before},
            new={"status": payload.status},
        )
        return obj
