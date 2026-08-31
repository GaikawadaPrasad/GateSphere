"""Business logic for Delivery Management (FR-07).

Protocols are **config-as-data** — the per-community `delivery_protocols` row for a
`delivery_type` decides whether a delivery is auto-approved and whether the executive may
enter. Lifecycle: logged -> (auto_approved | pending -> approved/rejected) -> arrived
(at_gate) -> delivered/collected, or cancelled.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, NotFoundError
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.communities.models import Gate, Unit
from app.modules.deliveries import schemas
from app.modules.deliveries.models import Delivery, DeliveryEvent, DeliveryProtocol
from app.modules.deliveries.repository import (
    DeliveryRepository,
    ProtocolRepository,
    delivery_events,
)
from app.modules.deliveries.schemas import ALLOWED
from app.modules.residents.access import UnitScopedAccess
from app.modules.residents.models import ResidentProfile, UnitOccupancy
from app.modules.users.models import User

_DEFAULT_PROTOCOL = {
    "protocol_type": "collect_at_gate",
    "requires_otp": False,
    "allow_direct_entry": False,
    "leave_at_gate": True,
    "is_active": True,
}


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class DeliveryService(UnitScopedAccess):
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx
        self.protocols = ProtocolRepository(db, scope)
        self.deliveries = DeliveryRepository(db, scope)

    async def _audit(self, action, community_id, entity_type, entity_id, **kw):
        await record_audit_async(
            self.db,
            module="deliveries",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type=entity_type,
            entity_id=entity_id,
            ctx=self.ctx,
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

    async def _unit_in_scope(self, unit_id: uuid.UUID) -> Unit:
        stmt = select(Unit).where(Unit.id == unit_id)
        if not self.scope.is_global:
            stmt = stmt.where(Unit.community_id.in_(self.scope.community_ids))
        unit = await self.db.scalar(stmt)
        if unit is None:
            raise NotFoundError("Unit not found")
        return unit

    async def _gate_in_scope(self, gate_id: uuid.UUID | None) -> uuid.UUID | None:
        if gate_id is None:
            return None
        stmt = select(Gate).where(Gate.id == gate_id)
        if not self.scope.is_global:
            stmt = stmt.where(Gate.community_id.in_(self.scope.community_ids))
        gate = await self.db.scalar(stmt)
        if gate is None:
            raise NotFoundError("Gate not found")
        return gate.id

    async def _primary_resident(self, unit_id: uuid.UUID) -> uuid.UUID | None:
        occ = await self.db.scalar(
            select(UnitOccupancy).where(
                UnitOccupancy.unit_id == unit_id,
                UnitOccupancy.is_primary.is_(True),
                UnitOccupancy.is_active.is_(True),
            )
        )
        if occ is None:
            return None
        profile = await self.db.get(ResidentProfile, occ.resident_profile_id)
        return profile.user_id if profile else None

    async def _event(
        self, delivery: Delivery, event_type: str, *, gate_id=None, remarks=None
    ) -> None:
        self.db.add(
            DeliveryEvent(
                delivery_id=delivery.id,
                gate_id=gate_id,
                actor_user_id=self.actor.id,
                event_type=event_type,
                remarks=remarks,
            )
        )

    # -- protocols --------------------------------------------- #
    async def list_protocols(self, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        stmt = (
            select(DeliveryProtocol)
            .where(DeliveryProtocol.community_id == cid)
            .order_by(DeliveryProtocol.delivery_type)
        )
        return list((await self.db.scalars(stmt)).all())

    async def upsert_protocol(
        self, payload: schemas.ProtocolUpsert, *, community_id: uuid.UUID | None
    ):
        cid = self._one_community(community_id)
        _enum("delivery_type", payload.delivery_type)
        _enum("protocol_type", payload.protocol_type)
        obj = await self.protocols.for_type(cid, payload.delivery_type)
        data = payload.model_dump()
        if obj is None:
            obj = DeliveryProtocol(community_id=cid, **data)
            await self.protocols.add(obj)
            action = "protocol.create"
        else:
            for k, v in data.items():
                setattr(obj, k, v)
            await self.db.flush()
            action = "protocol.update"
        await self._audit(action, cid, "delivery_protocol", obj.id, new=data)
        return obj

    async def _protocol_for(self, community_id: uuid.UUID, delivery_type: str) -> DeliveryProtocol:
        obj = await self.protocols.for_type(community_id, delivery_type)
        if obj is None:
            obj = DeliveryProtocol(
                community_id=community_id, delivery_type=delivery_type, **_DEFAULT_PROTOCOL
            )
            await self.protocols.add(obj)
        return obj

    # -- deliveries ------------------------------------------- #
    async def create_delivery(self, payload: schemas.DeliveryCreate) -> Delivery:
        unit = await self._unit_in_scope(payload.unit_id)
        await self._assert_unit_visible(unit.id)  # a resident logs deliveries for their own unit
        _enum("delivery_type", payload.delivery_type)
        protocol = await self._protocol_for(unit.community_id, payload.delivery_type)
        auto = protocol.allow_direct_entry and not protocol.requires_otp
        obj = Delivery(
            community_id=unit.community_id,
            unit_id=unit.id,
            resident_user_id=await self._primary_resident(unit.id),
            protocol_id=protocol.id,
            delivery_type=payload.delivery_type,
            provider_name=payload.provider_name,
            executive_name=payload.executive_name,
            executive_phone=payload.executive_phone,
            tracking_reference=payload.tracking_reference,
            expected_at=payload.expected_at,
            parcel_count=payload.parcel_count,
            notes=payload.notes,
            approval_status="auto_approved" if auto else "pending",
            status="expected",
        )
        await self.deliveries.add(obj)
        await self._event(obj, "logged")
        await self._audit(
            "delivery.create",
            unit.community_id,
            "delivery",
            obj.id,
            new={"delivery_type": payload.delivery_type, "approval_status": obj.approval_status},
        )
        return obj

    async def get_delivery(self, delivery_id: uuid.UUID) -> Delivery:
        obj = await self.deliveries.get(delivery_id)
        if obj is None:
            raise NotFoundError("Delivery not found")
        await self._assert_unit_visible(obj.unit_id)
        return obj

    async def list_deliveries(
        self,
        *,
        community_id: uuid.UUID | None,
        unit_id: uuid.UUID | None,
        status: str | None,
        approval_status: str | None,
        offset: int,
        limit: int,
    ):
        _enum("status", status)
        _enum("approval_status", approval_status)
        stmt = select(Delivery)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(Delivery.community_id == community_id)
        if unit_id:
            stmt = stmt.where(Delivery.unit_id == unit_id)
        if status:
            stmt = stmt.where(Delivery.status == status)
        if approval_status:
            stmt = stmt.where(Delivery.approval_status == approval_status)
        stmt = stmt.order_by(Delivery.created_at.desc())
        stmt = await self._scope_unit_column(stmt, Delivery.unit_id)
        return await self.deliveries.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.deliveries.count(extra=stmt)

    async def decide_delivery(
        self, delivery_id: uuid.UUID, payload: schemas.DeliveryDecision
    ) -> Delivery:
        obj = await self.get_delivery(delivery_id)
        if payload.decision not in ("approved", "rejected"):
            raise BusinessRuleError("decision must be approved|rejected", code="INVALID_ENUM")
        if obj.approval_status not in ("pending",):
            raise BusinessRuleError(
                f"Delivery is already '{obj.approval_status}'", code="INVALID_TRANSITION"
            )
        obj.approval_status = payload.decision
        obj.approved_by_user_id = self.actor.id
        if payload.decision == "rejected":
            obj.status = "cancelled"
        await self._event(obj, payload.decision, remarks=payload.remarks)
        await self.db.flush()
        await self._audit(f"delivery.{payload.decision}", obj.community_id, "delivery", obj.id)
        return obj

    async def record_arrival(
        self, delivery_id: uuid.UUID, payload: schemas.DeliveryArrival
    ) -> Delivery:
        obj = await self.get_delivery(delivery_id)
        if obj.approval_status not in ("approved", "auto_approved"):
            raise BusinessRuleError("Delivery is not approved", code="NOT_APPROVED")
        if obj.status not in ("expected", "at_gate"):
            raise BusinessRuleError(
                f"Delivery is '{obj.status}', cannot arrive", code="INVALID_TRANSITION"
            )
        gate_id = await self._gate_in_scope(payload.gate_id)
        obj.status = "at_gate"
        obj.arrived_at = obj.arrived_at or datetime.now(UTC)
        if payload.executive_name:
            obj.executive_name = payload.executive_name
        if payload.executive_phone:
            obj.executive_phone = payload.executive_phone
        await self._event(obj, "arrived", gate_id=gate_id)
        await self.db.flush()
        await self._audit("delivery.arrived", obj.community_id, "delivery", obj.id)
        return obj

    async def mark_delivered(self, delivery_id: uuid.UUID) -> Delivery:
        obj = await self.get_delivery(delivery_id)
        if obj.status not in ("at_gate", "in_transit"):
            raise BusinessRuleError(
                f"Delivery is '{obj.status}', cannot complete", code="INVALID_TRANSITION"
            )
        protocol = await self.db.get(DeliveryProtocol, obj.protocol_id) if obj.protocol_id else None
        obj.status = "delivered" if (protocol and not protocol.leave_at_gate) else "collected"
        await self._event(obj, "delivered")
        await self.db.flush()
        await self._audit("delivery.delivered", obj.community_id, "delivery", obj.id)
        return obj

    async def cancel_delivery(self, delivery_id: uuid.UUID) -> Delivery:
        obj = await self.get_delivery(delivery_id)
        if obj.status in ("delivered", "collected", "returned", "cancelled"):
            raise BusinessRuleError(f"Delivery is '{obj.status}'", code="INVALID_TRANSITION")
        obj.status = "cancelled"
        await self._event(obj, "rejected", remarks="cancelled")
        await self.db.flush()
        await self._audit("delivery.cancel", obj.community_id, "delivery", obj.id)
        return obj

    async def list_events(self, delivery_id: uuid.UUID) -> list[DeliveryEvent]:
        await self.get_delivery(delivery_id)  # scope check
        return await delivery_events(self.db, delivery_id)
