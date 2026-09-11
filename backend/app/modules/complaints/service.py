"""Business logic for Complaint & Service Desk (FR-10).

- SLA policies are config-as-data: the `(category, priority)` policy sets the response /
  resolution / escalation clocks stamped on the ticket at creation.
- Lifecycle: created -> assigned -> acknowledged -> in_progress -> resolved
  -> resident_confirmation -> closed. A ticket is **never closed without resident
  confirmation** (only `confirm("confirmed")` sets `closed`).
- `ticket_status_history` is append-only. One active assignment per ticket (internal user
  XOR vendor). One feedback per ticket.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.state_machine import ensure_transition
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.communities.models import Unit
from app.modules.complaints import schemas
from app.modules.complaints.models import (
    ServiceCategory,
    ServiceTicket,
    SlaPolicy,
    TicketAssignment,
    TicketAttachment,
    TicketFeedback,
    TicketMessage,
    TicketStatusHistory,
)
from app.modules.complaints.repository import (
    CategoryRepository,
    SlaRepository,
    TicketRepository,
    active_assignment,
)
from app.modules.complaints.schemas import ALLOWED
from app.modules.notifications import events as notif_events
from app.modules.residents.access import UnitScopedAccess, user_in_community
from app.modules.uploads.guard import ensure_confirmed_async
from app.modules.users.models import User

# Full lifecycle (docs/backend/state-machines.md). `closed` / `reopened` are reachable ONLY
# via confirm_ticket (resident confirmation) — never through the generic transition endpoint.
_TRANSITIONS: dict[str, set[str]] = {
    "created": {"assigned", "cancelled"},
    "assigned": {"acknowledged", "in_progress", "cancelled"},
    "acknowledged": {"in_progress", "cancelled"},
    "in_progress": {"resolved", "cancelled"},
    "resolved": {"resident_confirmation"},
    "resident_confirmation": {"closed", "reopened"},
    "reopened": {"assigned", "in_progress", "cancelled"},
    "closed": set(),
    "cancelled": set(),
}
# The subset the `/transition` endpoint may drive (created..resolved + cancel).
_TICKET_ACTIONS: dict[str, set[str]] = {
    "created": {"assigned", "cancelled"},
    "assigned": {"acknowledged", "in_progress", "cancelled"},
    "acknowledged": {"in_progress", "cancelled"},
    "in_progress": {"resolved", "cancelled"},
    "reopened": {"assigned", "in_progress", "cancelled"},
    "resolved": set(),
    "resident_confirmation": set(),
    "closed": set(),
    "cancelled": set(),
}


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class ComplaintService(UnitScopedAccess):
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx
        self.categories = CategoryRepository(db, scope)
        self.slas = SlaRepository(db, scope)
        self.tickets = TicketRepository(db, scope)

    async def _audit(self, action, community_id, entity_type, entity_id, **kw):
        await record_audit_async(
            self.db,
            module="complaints",
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

    # -- categories ------------------------------------------- #
    async def list_categories(self, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        stmt = (
            select(ServiceCategory)
            .where(ServiceCategory.community_id == cid)
            .order_by(ServiceCategory.code)
        )
        cats = list((await self.db.scalars(stmt)).all())
        if not cats:
            default_cats = [
                ("PLUMB", "Plumbing & Water", "high"),
                ("ELEC", "Electrical & Power", "high"),
                ("HVAC", "Air Conditioning / HVAC", "medium"),
                ("CARP", "Carpentry & Hardware", "medium"),
                ("HOUSE", "Housekeeping", "low"),
                ("LIFT", "Common Area & Lift", "critical"),
                ("GEN", "General Maintenance", "medium"),
            ]
            for code, name, prio in default_cats:
                cat = ServiceCategory(
                    community_id=cid,
                    code=code,
                    name=name,
                    default_priority=prio,
                )
                self.db.add(cat)
            await self.db.flush()
            cats = list((await self.db.scalars(stmt)).all())
        return cats

    async def create_category(
        self, payload: schemas.CategoryCreate, *, community_id: uuid.UUID | None
    ):
        cid = self._one_community(community_id)
        _enum("priority", payload.default_priority)
        if await self.categories.by_code(cid, payload.code):
            raise ConflictError("That code exists", code="CATEGORY_EXISTS")
        obj = ServiceCategory(community_id=cid, **payload.model_dump())
        await self.categories.add(obj)
        await self._audit("category.create", cid, "service_category", obj.id)
        return obj

    async def update_category(self, category_id: uuid.UUID, payload: schemas.CategoryUpdate):
        obj = await self.categories.get(category_id)
        if obj is None:
            raise NotFoundError("Category not found")
        patch = payload.model_dump(exclude_unset=True)
        _enum("priority", patch.get("default_priority"))
        for k, v in patch.items():
            setattr(obj, k, v)
        await self.db.flush()
        await self._audit(
            "category.update", obj.community_id, "service_category", obj.id, new=patch
        )
        return obj

    # -- SLA policies --------------------------------------- #
    async def list_slas(self, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        stmt = select(SlaPolicy).where(SlaPolicy.community_id == cid)
        return list((await self.db.scalars(stmt)).all())

    async def upsert_sla(self, payload: schemas.SlaCreate, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        _enum("priority", payload.priority)
        cat = await self.categories.get(payload.category_id)
        if cat is None or cat.community_id != cid:
            raise NotFoundError("Category not found")
        obj = await self.slas.match(cid, payload.category_id, payload.priority)
        data = payload.model_dump()
        if obj is None:
            obj = SlaPolicy(community_id=cid, **data)
            await self.slas.add(obj)
            action = "sla.create"
        else:
            for k, v in data.items():
                setattr(obj, k, v)
            await self.db.flush()
            action = "sla.update"
        await self._audit(action, cid, "sla_policy", obj.id, new=data)
        return obj

    # -- tickets ------------------------------------------- #
    async def _record_history(
        self, ticket: ServiceTicket, from_status, to_status, remarks=None
    ) -> None:
        self.db.add(
            TicketStatusHistory(
                ticket_id=ticket.id,
                from_status=from_status,
                to_status=to_status,
                changed_by_user_id=self.actor.id,
                remarks=remarks,
            )
        )

    async def create_ticket(self, payload: schemas.TicketCreate) -> ServiceTicket:
        unit = await self._unit_in_scope(payload.unit_id)
        await self._assert_unit_visible(unit.id)  # a resident raises tickets for their own unit
        cat = await self.categories.get(payload.category_id)
        if cat is None or cat.community_id != unit.community_id:
            cats = await self.list_categories(community_id=unit.community_id)
            cat = cats[0] if cats else None
            if cat is None:
                raise NotFoundError("Category not found")
        priority = payload.priority or cat.default_priority
        _enum("priority", priority)
        sla = await self.slas.match(unit.community_id, cat.id, priority)
        now = datetime.now(UTC)
        seq = await self.tickets.next_sequence(unit.community_id)
        ticket = ServiceTicket(
            community_id=unit.community_id,
            unit_id=unit.id,
            ticket_number=f"TKT-{now.year}-{seq:05d}",
            raised_by_user_id=self.actor.id,
            category_id=cat.id,
            sla_policy_id=sla.id if sla else None,
            subject=payload.subject,
            description=payload.description,
            priority=priority,
            status="created",
            first_response_due_at=(now + timedelta(minutes=sla.response_minutes) if sla else None),
            resolution_due_at=(now + timedelta(minutes=sla.resolution_minutes) if sla else None),
            escalation_due_at=(now + timedelta(minutes=sla.escalation_minutes) if sla else None),
        )
        await self.tickets.add(ticket)
        await self._record_history(ticket, None, "created")
        await self._audit(
            "ticket.create",
            unit.community_id,
            "service_ticket",
            ticket.id,
            new={"ticket_number": ticket.ticket_number, "priority": priority},
        )
        return ticket

    async def get_ticket(self, ticket_id: uuid.UUID) -> ServiceTicket:
        obj = await self.tickets.get(ticket_id)
        if obj is None:
            raise NotFoundError("Ticket not found")
        await self._assert_unit_visible(obj.unit_id)
        return obj

    async def list_tickets(
        self,
        *,
        community_id: uuid.UUID | None,
        unit_id: uuid.UUID | None,
        ticket_status: str | None,
        q: str | None = None,
        offset: int,
        limit: int,
    ):
        _enum("status", ticket_status)
        stmt = select(ServiceTicket)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(ServiceTicket.community_id == community_id)
        if unit_id:
            stmt = stmt.where(ServiceTicket.unit_id == unit_id)
        if ticket_status:
            stmt = stmt.where(ServiceTicket.status == ticket_status)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                ServiceTicket.ticket_number.ilike(like) | ServiceTicket.subject.ilike(like)
            )
        stmt = await self._scope_unit_column(
            stmt,
            ServiceTicket.unit_id,
            or_owned=ServiceTicket.raised_by_user_id == self.actor.id,
        )
        return await self.tickets.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.tickets.count(extra=stmt)

    async def _mark_first_response(self, ticket: ServiceTicket) -> None:
        if ticket.first_responded_at is None:
            now = datetime.now(UTC)
            ticket.first_responded_at = now
            if ticket.first_response_due_at and now > ticket.first_response_due_at:
                ticket.sla_breached_at = ticket.sla_breached_at or now

    async def assign_ticket(
        self, ticket_id: uuid.UUID, payload: schemas.TicketAssign
    ) -> ServiceTicket:
        ticket = await self.get_ticket(ticket_id)
        if ticket.status in ("closed", "cancelled"):
            raise BusinessRuleError(f"Ticket is '{ticket.status}'", code="INVALID_TRANSITION")
        if payload.assigned_to_user_id is not None and not await user_in_community(
            self.db, payload.assigned_to_user_id, ticket.community_id
        ):
            raise NotFoundError("Assignee not found")
        prev = await active_assignment(self.db, ticket.id)
        if prev is not None:
            prev.is_active = False
            prev.unassigned_at = datetime.now(UTC)
        self.db.add(
            TicketAssignment(
                ticket_id=ticket.id,
                assigned_to_user_id=payload.assigned_to_user_id,
                vendor_name=payload.vendor_name,
                assigned_by_user_id=self.actor.id,
            )
        )
        from_status = ticket.status
        if ticket.status in ("created", "reopened"):
            ticket.status = "assigned"
            await self._record_history(ticket, from_status, "assigned", payload.remarks)
        await self._mark_first_response(ticket)
        await self.db.flush()
        await self._audit("ticket.assign", ticket.community_id, "service_ticket", ticket.id)
        return ticket

    async def transition_ticket(
        self, ticket_id: uuid.UUID, payload: schemas.TicketTransition
    ) -> ServiceTicket:
        ticket = await self.get_ticket(ticket_id)
        _enum("status", payload.status)
        target = payload.status
        if target in ("closed", "reopened"):
            raise BusinessRuleError(
                "Use the resident-confirmation endpoint to close or reopen a ticket",
                code="INVALID_TRANSITION",
            )
        # the transition endpoint drives created..resolved only
        ensure_transition(ticket.status, target, _TICKET_ACTIONS, entity="ticket")
        if target == "resolved":
            now = datetime.now(UTC)
            ticket.resolved_at = now
            if ticket.resolution_due_at and now > ticket.resolution_due_at:
                ticket.sla_breached_at = ticket.sla_breached_at or now
            ticket.status = "resident_confirmation"
            ticket.resident_confirmation_status = "pending"
            await self._record_history(ticket, "in_progress", "resolved", payload.remarks)
            await self._record_history(ticket, "resolved", "resident_confirmation")
        else:
            from_status = ticket.status
            ticket.status = target
            if target == "cancelled":
                ticket.closed_at = datetime.now(UTC)
            await self._record_history(ticket, from_status, target, payload.remarks)
        if target in ("acknowledged", "in_progress"):
            await self._mark_first_response(ticket)
        await self.db.flush()
        await self._audit(f"ticket.{target}", ticket.community_id, "service_ticket", ticket.id)
        final = ticket.status  # may be resident_confirmation after a 'resolved' request
        await notif_events.emit(
            self.db,
            self.scope,
            self.actor,
            self.ctx,
            recipient_user_id=ticket.raised_by_user_id,
            community_id=ticket.community_id,
            notification_type=f"ticket.{final}",
            title=f"Ticket {ticket.ticket_number}: {final.replace('_', ' ')}",
            message=(
                f"Your ticket '{ticket.subject}' is now '{final.replace('_', ' ')}'."
                + (" Please confirm the fix." if final == "resident_confirmation" else "")
            ),
            reference_type="service_ticket",
            reference_id=ticket.id,
        )
        return ticket

    async def confirm_ticket(
        self, ticket_id: uuid.UUID, payload: schemas.TicketConfirm
    ) -> ServiceTicket:
        ticket = await self.get_ticket(ticket_id)
        _enum("confirmation_status", payload.confirmation_status)
        if ticket.status != "resident_confirmation":
            raise BusinessRuleError(
                "Ticket is not awaiting resident confirmation", code="INVALID_TRANSITION"
            )
        if payload.confirmation_status == "confirmed":
            ticket.resident_confirmation_status = "confirmed"
            ticket.status = "closed"
            ticket.closed_at = datetime.now(UTC)
            await self._record_history(ticket, "resident_confirmation", "closed", payload.remarks)
        else:
            ticket.resident_confirmation_status = "disputed"
            ticket.status = "reopened"
            await self._record_history(ticket, "resident_confirmation", "reopened", payload.remarks)
        await self.db.flush()
        await self._audit(
            "ticket.confirm",
            ticket.community_id,
            "service_ticket",
            ticket.id,
            new={"confirmation": payload.confirmation_status},
        )
        return ticket

    # -- messages / feedback / reads ---------------------- #
    async def add_message(
        self, ticket_id: uuid.UUID, payload: schemas.MessageCreate
    ) -> TicketMessage:
        ticket = await self.get_ticket(ticket_id)
        if payload.is_internal and await self.is_unit_restricted():
            raise ForbiddenError(
                "Residents cannot post internal notes", code="INTERNAL_NOTE_FORBIDDEN"
            )
        msg = TicketMessage(
            ticket_id=ticket.id,
            sender_user_id=self.actor.id,
            message=payload.message,
            is_internal=payload.is_internal,
        )
        self.db.add(msg)
        if not payload.is_internal and ticket.raised_by_user_id != self.actor.id:
            await self._mark_first_response(ticket)
        await self.db.flush()
        await self._audit("ticket.message", ticket.community_id, "ticket_message", msg.id)
        return msg

    async def list_messages(self, ticket_id: uuid.UUID) -> list[TicketMessage]:
        await self.get_ticket(ticket_id)
        stmt = select(TicketMessage).where(TicketMessage.ticket_id == ticket_id)
        if await self.is_unit_restricted():
            stmt = stmt.where(TicketMessage.is_internal.is_(False))  # hide staff-only notes
        return list((await self.db.scalars(stmt.order_by(TicketMessage.created_at))).all())

    async def list_history(self, ticket_id: uuid.UUID) -> list[TicketStatusHistory]:
        await self.get_ticket(ticket_id)
        return list(
            (
                await self.db.scalars(
                    select(TicketStatusHistory)
                    .where(TicketStatusHistory.ticket_id == ticket_id)
                    .order_by(TicketStatusHistory.changed_at)
                )
            ).all()
        )

    async def add_feedback(
        self, ticket_id: uuid.UUID, payload: schemas.FeedbackCreate
    ) -> TicketFeedback:
        ticket = await self.get_ticket(ticket_id)
        if ticket.status != "closed":
            raise BusinessRuleError("Ticket is not closed", code="TICKET_NOT_CLOSED")
        existing = await self.db.scalar(
            select(TicketFeedback).where(TicketFeedback.ticket_id == ticket_id)
        )
        if existing is not None:
            raise ConflictError("Feedback already given", code="FEEDBACK_EXISTS")
        fb = TicketFeedback(
            ticket_id=ticket.id,
            resident_user_id=self.actor.id,
            rating=payload.rating,
            comments=payload.comments,
        )
        self.db.add(fb)
        await self.db.flush()
        await self._audit("ticket.feedback", ticket.community_id, "ticket_feedback", fb.id)
        return fb

    async def add_attachment(self, ticket_id: uuid.UUID, payload) -> TicketAttachment:
        ticket = await self.get_ticket(ticket_id)
        await ensure_confirmed_async(self.db, payload.file_url)
        if payload.message_id is not None:
            msg = await self.db.get(TicketMessage, payload.message_id)
            if msg is None or msg.ticket_id != ticket.id:
                raise NotFoundError("Message not found")
        obj = TicketAttachment(
            ticket_id=ticket.id,
            message_id=payload.message_id,
            uploaded_by_user_id=self.actor.id,
            file_url=payload.file_url,
            file_name=payload.file_name,
            mime_type=payload.mime_type,
            file_size_bytes=payload.file_size_bytes,
        )
        self.db.add(obj)
        await self.db.flush()
        await self._audit("ticket.attachment", ticket.community_id, "ticket_attachment", obj.id)
        return obj

    async def list_attachments(self, ticket_id: uuid.UUID) -> list[TicketAttachment]:
        await self.get_ticket(ticket_id)
        return list(
            (
                await self.db.scalars(
                    select(TicketAttachment)
                    .where(TicketAttachment.ticket_id == ticket_id)
                    .order_by(TicketAttachment.created_at)
                )
            ).all()
        )
