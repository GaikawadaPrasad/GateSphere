"""Business logic for Gate / Security Operations (FR-05).

- `gate_events` is append-only: `log_event` inserts, nothing updates or deletes.
- Roster status machine: planned -> active -> completed, or -> cancelled from planned/active.
- One `active` gate assignment per guard at a time.
- Panic alert machine: active -> acknowledged -> resolved, or -> cancelled by the trigger.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import (
    AppError,
    BusinessRuleError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.core.state_machine import ensure_transition
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.communities.repository import gate_in_scope
from app.modules.gate import schemas
from app.modules.gate.models import GateAssignment, GateEvent, GuardRoster, PanicAlert
from app.modules.gate.repository import (
    GateAssignmentRepository,
    GateEventRepository,
    GuardRosterRepository,
    PanicAlertRepository,
    enrich_alerts,
    guard_contacts,
)
from app.modules.gate.schemas import ALLOWED
from app.modules.notifications import events as notif_events
from app.modules.users.models import User

_ROSTER_TRANSITIONS = {
    "planned": {"active", "cancelled"},
    "active": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class GateService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx
        self.events = GateEventRepository(db, scope)
        self.rosters = GuardRosterRepository(db, scope)
        self.assignments = GateAssignmentRepository(db, scope)
        self.alerts = PanicAlertRepository(db, scope)

    # -- helpers ---------------------------------------------------- #
    async def _audit(
        self,
        action: str,
        community_id: uuid.UUID | None,
        entity_type: str,
        entity_id: uuid.UUID | str,
        **kw: Any,
    ) -> None:
        await record_audit_async(
            self.db,
            module="gate",
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

    async def _gate_in_scope(self, gate_id: uuid.UUID | None) -> uuid.UUID | None:
        if gate_id is None:
            return None
        gate = await gate_in_scope(self.db, self.scope, gate_id)
        if gate is None:
            raise NotFoundError("Gate not found")
        return gate.id

    async def _gate_community(self, gate_id: uuid.UUID) -> uuid.UUID:
        gate = await gate_in_scope(self.db, self.scope, gate_id)
        if gate is None:
            raise NotFoundError("Gate not found")
        return gate.community_id

    # -- gate events (append-only) -------------------------------- #
    async def log_event(self, payload: schemas.EventCreate) -> GateEvent:
        _enum("event_type", payload.event_type)
        if payload.gate_id is not None:
            community_id = await self._gate_community(payload.gate_id)
        else:
            community_id = self._one_community(None)
        obj = GateEvent(
            community_id=community_id,
            gate_id=payload.gate_id,
            actor_user_id=self.actor.id,
            event_type=payload.event_type,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            occurred_at=payload.occurred_at or datetime.now(UTC),
            event_metadata=payload.metadata,
        )
        await self.events.add(obj)
        await self._audit(
            "event.log", community_id, "gate_event", obj.id, new={"type": payload.event_type}
        )
        return obj

    async def override_checkpoint(self, payload: schemas.CheckpointOverride) -> GateEvent:
        """Supervisor manually overrides a gate checkpoint (FR-05) — append-only event
        + audit + notification to supervisors and the community admin."""
        if payload.gate_id is not None:
            community_id = await self._gate_community(payload.gate_id)
        else:
            community_id = self._one_community(payload.community_id)
        obj = GateEvent(
            community_id=community_id,
            gate_id=payload.gate_id,
            actor_user_id=self.actor.id,
            event_type="checkpoint_override",
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            occurred_at=datetime.now(UTC),
            event_metadata={"reason": payload.reason},
        )
        await self.events.add(obj)
        await self._audit(
            "checkpoint.override",
            community_id,
            "gate_event",
            obj.id,
            new={"reason": payload.reason, "gate_id": str(payload.gate_id or "")},
        )
        await self.db.flush()
        await notif_events.emit_to_roles(
            self.db,
            self.scope,
            self.actor,
            self.ctx,
            community_id=community_id,
            role_slugs=["security_supervisor", "community_admin"],
            notification_type="gate.checkpoint_override",
            title="Gate checkpoint overridden",
            message=f"{self.actor.full_name} overrode a gate checkpoint: {payload.reason}",
            reference_type="gate_event",
            reference_id=obj.id,
        )
        return obj

    async def list_events(
        self,
        *,
        community_id: uuid.UUID | None = None,
        gate_id: uuid.UUID | None = None,
        event_type: str | None = None,
        cursor: str | None = None,
        keyset: bool = False,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[GateEvent], str | int | None]:
        """Offset mode returns `(rows, total)`. Keyset mode (`keyset=True` for the first page,
        or any `cursor`) returns `(rows, next_cursor)` and never counts (AGENTS.md §4.3)."""
        import base64

        _enum("event_type", event_type)
        if community_id is not None and not self.scope.is_global and self.scope.community_ids:
            self.scope.require(community_id)
        stmt = self.events.filtered(
            community_id=community_id, gate_id=gate_id, event_type=event_type
        )

        if cursor or keyset:
            after: tuple[datetime, uuid.UUID] | None = None
            if cursor:
                try:
                    # Opaque to clients: base64("<ISO-8601 occurred_at>|<uuid>"). ISO keeps the
                    # full microsecond precision a float epoch would round away.
                    ts, last_id = base64.urlsafe_b64decode(cursor).decode("utf-8").split("|")
                    after = (datetime.fromisoformat(ts), uuid.UUID(last_id))
                except (ValueError, TypeError, UnicodeDecodeError) as exc:
                    raise AppError("Invalid cursor", code="INVALID_CURSOR") from exc
            rows = await self.events.keyset_page(stmt, after=after, limit=limit)
            next_cursor = None
            if len(rows) > limit:
                rows.pop()
                last = rows[-1]
                token = f"{last.occurred_at.isoformat()}|{last.id}".encode()
                next_cursor = base64.urlsafe_b64encode(token).decode("ascii")
            return rows, next_cursor

        stmt = stmt.order_by(GateEvent.occurred_at.desc(), GateEvent.id.desc())
        rows = await self.events.list(offset=offset, limit=limit, extra=stmt)
        total = await self.events.count(extra=stmt)
        return rows, total

    # -- guard rosters ------------------------------------------ #
    async def create_roster(
        self, payload: schemas.RosterCreate, *, community_id: uuid.UUID | None
    ) -> GuardRoster:
        cid = self._one_community(community_id)
        if payload.shift_end <= payload.shift_start:
            raise BusinessRuleError(
                "shift_end must be after shift_start", code="INVALID_TIME_RANGE"
            )
        clash = await self.rosters.find_clash(
            community_id=cid,
            guard_user_id=payload.guard_user_id,
            shift_date=payload.shift_date,
            shift_start=payload.shift_start,
        )
        if clash is not None:
            raise ConflictError("That guard already has a shift at this time", code="ROSTER_EXISTS")
        obj = GuardRoster(
            community_id=cid,
            guard_user_id=payload.guard_user_id,
            supervisor_user_id=payload.supervisor_user_id,
            shift_date=payload.shift_date,
            shift_start=payload.shift_start,
            shift_end=payload.shift_end,
            notes=payload.notes,
        )
        await self.rosters.add(obj)
        await self._audit("roster.create", cid, "guard_roster", obj.id)
        return await self._populate_guard_info(obj)

    async def list_rosters(
        self,
        *,
        community_id: uuid.UUID | None,
        guard_user_id: uuid.UUID | None,
        roster_status: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[GuardRoster], int]:
        _enum("roster_status", roster_status)
        if community_id is not None:
            self.scope.require(community_id)
        stmt = self.rosters.filtered(
            community_id=community_id, guard_user_id=guard_user_id, status=roster_status
        )
        rosters = await self.rosters.list(offset=offset, limit=limit, extra=stmt)
        total = await self.rosters.count(extra=stmt)
        user_map = await guard_contacts(
            self.db, {r.guard_user_id for r in rosters if r.guard_user_id}
        )
        for r in rosters:
            if r.guard_user_id in user_map:
                r.guard_name, r.guard_phone = user_map[r.guard_user_id]
        return rosters, total

    async def _populate_guard_info(self, obj: GuardRoster) -> GuardRoster:
        if obj and obj.guard_user_id:
            contact = (await guard_contacts(self.db, {obj.guard_user_id})).get(obj.guard_user_id)
            if contact:
                obj.guard_name, obj.guard_phone = contact
        return obj

    async def _get_roster(self, roster_id: uuid.UUID) -> GuardRoster:
        obj = await self.rosters.get(roster_id)
        if obj is None:
            raise NotFoundError("Roster not found")
        return obj

    async def update_roster(
        self, roster_id: uuid.UUID, payload: schemas.RosterUpdate
    ) -> GuardRoster:
        """Edit roster **details** only. Status is a guarded transition — see
        `transition_roster` / `POST /gate/rosters/{id}/status`."""
        obj = await self._get_roster(roster_id)
        patch = payload.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(obj, k, v)
        await self.db.flush()
        await self._audit("roster.update", obj.community_id, "guard_roster", obj.id, new=patch)
        return await self._populate_guard_info(obj)

    async def transition_roster(
        self, roster_id: uuid.UUID, new_status: str, reason: str | None = None
    ) -> GuardRoster:
        obj = await self._get_roster(roster_id)
        _enum("roster_status", new_status)
        ensure_transition(obj.status, new_status, _ROSTER_TRANSITIONS, entity="roster")
        old = obj.status
        obj.status = new_status
        await self.db.flush()
        await self._audit(
            f"roster.{new_status}",
            obj.community_id,
            "guard_roster",
            obj.id,
            old={"status": old},
            new={"status": new_status, "reason": reason},
        )
        return await self._populate_guard_info(obj)

    # -- gate assignments ----------------------------------- #
    async def create_assignment(
        self, payload: schemas.AssignmentCreate, *, community_id: uuid.UUID | None
    ) -> GateAssignment:
        gate_cid = await self._gate_community(payload.gate_id)
        if community_id is not None and community_id != gate_cid:
            raise NotFoundError("Gate not found")
        if payload.roster_id is not None:
            roster = await self.rosters.get(payload.roster_id)
            if roster is None or roster.community_id != gate_cid:
                raise NotFoundError("Roster not found")
        if await self.assignments.active_for_guard(payload.guard_user_id):
            raise ConflictError("Guard already has an active assignment", code="ASSIGNMENT_ACTIVE")
        obj = GateAssignment(
            community_id=gate_cid,
            guard_user_id=payload.guard_user_id,
            gate_id=payload.gate_id,
            roster_id=payload.roster_id,
            assigned_from=payload.assigned_from or datetime.now(UTC),
            assigned_to=payload.assigned_to,
        )
        await self.assignments.add(obj)
        await self._audit("assignment.create", gate_cid, "gate_assignment", obj.id)
        return obj

    async def list_assignments(
        self,
        *,
        community_id: uuid.UUID | None,
        gate_id: uuid.UUID | None,
        active_only: bool,
        offset: int,
        limit: int,
    ) -> tuple[list[GateAssignment], int]:
        if community_id is not None:
            self.scope.require(community_id)
        stmt = self.assignments.filtered(
            community_id=community_id, gate_id=gate_id, active_only=active_only
        )
        return await self.assignments.list(
            offset=offset, limit=limit, extra=stmt
        ), await self.assignments.count(extra=stmt)

    async def end_assignment(self, assignment_id: uuid.UUID) -> GateAssignment:
        obj = await self.assignments.get(assignment_id)
        if obj is None:
            raise NotFoundError("Assignment not found")
        if obj.status != "active":
            raise BusinessRuleError("Assignment is already ended", code="ALREADY_ENDED")
        obj.status = "ended"
        obj.assigned_to = obj.assigned_to or datetime.now(UTC)
        await self.db.flush()
        await self._audit("assignment.end", obj.community_id, "gate_assignment", obj.id)
        return obj

    # -- panic alerts -------------------------------------- #
    async def raise_alert(self, payload: schemas.AlertCreate) -> PanicAlert:
        _enum("alert_type", payload.alert_type)
        _enum("severity", payload.severity)
        if payload.gate_id is not None:
            cid = await self._gate_community(payload.gate_id)
        else:
            cid = self._one_community(payload.community_id)

        msg = payload.message or "Emergency SOS triggered by resident from portal"

        obj = PanicAlert(
            community_id=cid,
            triggered_by_user_id=self.actor.id,
            gate_id=payload.gate_id,
            alert_type=payload.alert_type,
            severity=payload.severity,
            message=msg,
        )
        await self.alerts.add(obj)
        await self._audit(
            "alert.raise", cid, "panic_alert", obj.id, new={"type": payload.alert_type}
        )
        await self.db.flush()

        # Resolve the reporter's name/phone and unit/tower/floor (GS-SOS-001/002/023/024/026)
        # so the guard/supervisor consoles have a dispatchable address rather than only the
        # free-text `message`; also fold a short location line into the message itself as a
        # legacy-compatible fallback for anything that only reads `message`.
        await enrich_alerts(self.db, [obj])
        unit_label = None
        if obj.unit_number:
            unit_label = (
                f"{obj.tower_name} - Unit {obj.unit_number}"
                if obj.tower_name
                else f"Unit {obj.unit_number}"
            )
            if "Location:" not in msg and unit_label not in msg:
                obj.message = msg = f"Location: {unit_label} — {msg}"

        notif_title = (
            f"🚨 SOS EMERGENCY: {unit_label}"
            if unit_label
            else f"PANIC: {payload.alert_type} ({payload.severity})"
        )
        notif_message = (
            f"Emergency SOS triggered from {unit_label}"
            + (f" by {obj.reporter_name}" if obj.reporter_name else "")
            + f". Details: {msg}"
            if unit_label
            else (msg or f"A {payload.alert_type} alert was raised. Respond now.")
        )

        await notif_events.emit_to_roles(
            self.db,
            self.scope,
            self.actor,
            self.ctx,
            community_id=cid,
            role_slugs=[
                "security_supervisor",
                "security_guard",
                "community_admin",
                "facility_manager",
            ],
            notification_type="gate.panic_alert",
            title=notif_title,
            message=notif_message,
            reference_type="panic_alert",
            reference_id=obj.id,
            channels=["in_app", "push", "sms", "whatsapp"],
        )
        return obj

    async def list_alerts(
        self,
        *,
        community_id: uuid.UUID | None,
        alert_status: str | None,
        offset: int,
        limit: int,
    ) -> tuple[list[PanicAlert], int]:
        _enum("alert_status", alert_status)
        if community_id is not None:
            self.scope.require(community_id)
        stmt = self.alerts.filtered(community_id=community_id, status=alert_status)
        rows = await self.alerts.list(offset=offset, limit=limit, extra=stmt)
        await enrich_alerts(self.db, rows)
        return rows, await self.alerts.count(extra=stmt)

    async def _get_alert(self, alert_id: uuid.UUID) -> PanicAlert:
        obj = await self.alerts.get(alert_id)
        if obj is None:
            raise NotFoundError("Alert not found")
        await enrich_alerts(self.db, [obj])
        return obj

    async def acknowledge_alert(self, alert_id: uuid.UUID) -> PanicAlert:
        obj = await self._get_alert(alert_id)
        if obj.status != "active":
            raise BusinessRuleError(f"Alert is already '{obj.status}'", code="INVALID_TRANSITION")
        obj.status = "acknowledged"
        obj.acknowledged_by_user_id = self.actor.id
        obj.acknowledged_at = datetime.now(UTC)
        await self.db.flush()
        await self._audit("alert.acknowledge", obj.community_id, "panic_alert", obj.id)
        return obj

    async def resolve_alert(self, alert_id: uuid.UUID, payload: schemas.AlertResolve) -> PanicAlert:
        obj = await self._get_alert(alert_id)
        if obj.status not in ("active", "acknowledged"):
            raise BusinessRuleError(f"Alert is already '{obj.status}'", code="INVALID_TRANSITION")
        obj.status = "resolved"
        obj.resolved_at = datetime.now(UTC)
        obj.resolution_summary = payload.resolution_summary
        if obj.acknowledged_at is None:
            obj.acknowledged_by_user_id = self.actor.id
            obj.acknowledged_at = obj.resolved_at
        await self.db.flush()
        await self._audit("alert.resolve", obj.community_id, "panic_alert", obj.id)
        return obj

    async def cancel_alert(self, alert_id: uuid.UUID) -> PanicAlert:
        obj = await self._get_alert(alert_id)
        if obj.status in ("resolved", "cancelled"):
            raise BusinessRuleError(f"Alert is already '{obj.status}'", code="INVALID_TRANSITION")
        if obj.triggered_by_user_id != self.actor.id:
            raise ForbiddenError(
                "Only the person who raised the alert can cancel it", code="NOT_ALERT_OWNER"
            )
        obj.status = "cancelled"
        obj.resolved_at = datetime.now(UTC)
        await self.db.flush()
        await self._audit("alert.cancel", obj.community_id, "panic_alert", obj.id)
        return obj
