"""Business logic for Gate / Security Operations (FR-05).

- `gate_events` is append-only: `log_event` inserts, nothing updates or deletes.
- Roster status machine: planned -> active -> completed, or -> cancelled from planned/active.
- One `active` gate assignment per guard at a time.
- Panic alert machine: active -> acknowledged -> resolved, or -> cancelled by the trigger.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.state_machine import ensure_transition
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit
from app.modules.communities.models import Gate
from app.modules.gate.models import GateAssignment, GateEvent, GuardRoster, PanicAlert
from app.modules.gate.repository import (
    GateAssignmentRepository,
    GateEventRepository,
    GuardRosterRepository,
    PanicAlertRepository,
)
from app.modules.gate.schemas import ALLOWED
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
        self, db: Session, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request
        self.events = GateEventRepository(db, scope)
        self.rosters = GuardRosterRepository(db, scope)
        self.assignments = GateAssignmentRepository(db, scope)
        self.alerts = PanicAlertRepository(db, scope)

    # -- helpers ---------------------------------------------------- #
    def _audit(self, action, community_id, entity_type, entity_id, **kw):
        record_audit(
            self.db,
            module="gate",
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

    def _gate_in_scope(self, gate_id: uuid.UUID | None) -> uuid.UUID | None:
        if gate_id is None:
            return None
        stmt = select(Gate).where(Gate.id == gate_id)
        if not self.scope.is_global:
            stmt = stmt.where(Gate.community_id.in_(self.scope.community_ids))
        gate = self.db.scalar(stmt)
        if gate is None:
            raise NotFoundError("Gate not found")
        return gate.id

    def _gate_community(self, gate_id: uuid.UUID) -> uuid.UUID:
        stmt = select(Gate).where(Gate.id == gate_id)
        if not self.scope.is_global:
            stmt = stmt.where(Gate.community_id.in_(self.scope.community_ids))
        gate = self.db.scalar(stmt)
        if gate is None:
            raise NotFoundError("Gate not found")
        return gate.community_id

    # -- gate events (append-only) -------------------------------- #
    def log_event(self, payload) -> GateEvent:
        _enum("event_type", payload.event_type)
        if payload.gate_id is not None:
            community_id = self._gate_community(payload.gate_id)
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
        self.events.add(obj)
        self._audit(
            "event.log", community_id, "gate_event", obj.id, new={"type": payload.event_type}
        )
        return obj

    def list_events(
        self,
        *,
        community_id: uuid.UUID | None,
        gate_id: uuid.UUID | None,
        event_type: str | None,
        offset: int,
        limit: int,
    ):
        _enum("event_type", event_type)
        stmt = select(GateEvent)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(GateEvent.community_id == community_id)
        if gate_id:
            stmt = stmt.where(GateEvent.gate_id == gate_id)
        if event_type:
            stmt = stmt.where(GateEvent.event_type == event_type)
        stmt = stmt.order_by(GateEvent.occurred_at.desc())
        return self.events.list(offset=offset, limit=limit, extra=stmt), self.events.count(
            extra=stmt
        )

    # -- guard rosters ------------------------------------------ #
    def create_roster(self, payload, *, community_id: uuid.UUID | None) -> GuardRoster:
        cid = self._one_community(community_id)
        if payload.shift_end <= payload.shift_start:
            raise BusinessRuleError(
                "shift_end must be after shift_start", code="INVALID_TIME_RANGE"
            )
        clash = self.db.scalar(
            select(GuardRoster).where(
                GuardRoster.community_id == cid,
                GuardRoster.guard_user_id == payload.guard_user_id,
                GuardRoster.shift_date == payload.shift_date,
                GuardRoster.shift_start == payload.shift_start,
            )
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
        self.rosters.add(obj)
        self._audit("roster.create", cid, "guard_roster", obj.id)
        return obj

    def list_rosters(
        self,
        *,
        community_id: uuid.UUID | None,
        guard_user_id: uuid.UUID | None,
        roster_status: str | None,
        offset: int,
        limit: int,
    ):
        _enum("roster_status", roster_status)
        stmt = select(GuardRoster)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(GuardRoster.community_id == community_id)
        if guard_user_id:
            stmt = stmt.where(GuardRoster.guard_user_id == guard_user_id)
        if roster_status:
            stmt = stmt.where(GuardRoster.status == roster_status)
        stmt = stmt.order_by(GuardRoster.shift_date.desc(), GuardRoster.shift_start)
        return self.rosters.list(offset=offset, limit=limit, extra=stmt), self.rosters.count(
            extra=stmt
        )

    def _get_roster(self, roster_id: uuid.UUID) -> GuardRoster:
        obj = self.rosters.get(roster_id)
        if obj is None:
            raise NotFoundError("Roster not found")
        return obj

    def update_roster(self, roster_id: uuid.UUID, payload) -> GuardRoster:
        """Edit roster **details** only. Status is a guarded transition — see
        `transition_roster` / `POST /gate/rosters/{id}/status`."""
        obj = self._get_roster(roster_id)
        patch = payload.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(obj, k, v)
        self.db.flush()
        self._audit("roster.update", obj.community_id, "guard_roster", obj.id, new=patch)
        return obj

    def transition_roster(self, roster_id: uuid.UUID, new_status: str, reason=None) -> GuardRoster:
        obj = self._get_roster(roster_id)
        _enum("roster_status", new_status)
        ensure_transition(obj.status, new_status, _ROSTER_TRANSITIONS, entity="roster")
        old = obj.status
        obj.status = new_status
        self.db.flush()
        self._audit(
            f"roster.{new_status}",
            obj.community_id,
            "guard_roster",
            obj.id,
            old={"status": old},
            new={"status": new_status, "reason": reason},
        )
        return obj

    # -- gate assignments ----------------------------------- #
    def create_assignment(self, payload, *, community_id: uuid.UUID | None) -> GateAssignment:
        gate_cid = self._gate_community(payload.gate_id)
        if community_id is not None and community_id != gate_cid:
            raise NotFoundError("Gate not found")
        if payload.roster_id is not None:
            roster = self.rosters.get(payload.roster_id)
            if roster is None or roster.community_id != gate_cid:
                raise NotFoundError("Roster not found")
        if self.assignments.active_for_guard(payload.guard_user_id):
            raise ConflictError("Guard already has an active assignment", code="ASSIGNMENT_ACTIVE")
        obj = GateAssignment(
            community_id=gate_cid,
            guard_user_id=payload.guard_user_id,
            gate_id=payload.gate_id,
            roster_id=payload.roster_id,
            assigned_from=payload.assigned_from or datetime.now(UTC),
            assigned_to=payload.assigned_to,
        )
        self.assignments.add(obj)
        self._audit("assignment.create", gate_cid, "gate_assignment", obj.id)
        return obj

    def list_assignments(
        self,
        *,
        community_id: uuid.UUID | None,
        gate_id: uuid.UUID | None,
        active_only: bool,
        offset: int,
        limit: int,
    ):
        stmt = select(GateAssignment)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(GateAssignment.community_id == community_id)
        if gate_id:
            stmt = stmt.where(GateAssignment.gate_id == gate_id)
        if active_only:
            stmt = stmt.where(GateAssignment.status == "active")
        stmt = stmt.order_by(GateAssignment.assigned_from.desc())
        return self.assignments.list(
            offset=offset, limit=limit, extra=stmt
        ), self.assignments.count(extra=stmt)

    def end_assignment(self, assignment_id: uuid.UUID) -> GateAssignment:
        obj = self.assignments.get(assignment_id)
        if obj is None:
            raise NotFoundError("Assignment not found")
        if obj.status != "active":
            raise BusinessRuleError("Assignment is already ended", code="ALREADY_ENDED")
        obj.status = "ended"
        obj.assigned_to = obj.assigned_to or datetime.now(UTC)
        self.db.flush()
        self._audit("assignment.end", obj.community_id, "gate_assignment", obj.id)
        return obj

    # -- panic alerts -------------------------------------- #
    def raise_alert(self, payload) -> PanicAlert:
        _enum("alert_type", payload.alert_type)
        _enum("severity", payload.severity)
        if payload.gate_id is not None:
            cid = self._gate_community(payload.gate_id)
        else:
            cid = self._one_community(payload.community_id)
        obj = PanicAlert(
            community_id=cid,
            triggered_by_user_id=self.actor.id,
            gate_id=payload.gate_id,
            alert_type=payload.alert_type,
            severity=payload.severity,
            message=payload.message,
        )
        self.alerts.add(obj)
        self._audit("alert.raise", cid, "panic_alert", obj.id, new={"type": payload.alert_type})
        return obj

    def list_alerts(
        self,
        *,
        community_id: uuid.UUID | None,
        alert_status: str | None,
        offset: int,
        limit: int,
    ):
        _enum("alert_status", alert_status)
        stmt = select(PanicAlert)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(PanicAlert.community_id == community_id)
        if alert_status:
            stmt = stmt.where(PanicAlert.status == alert_status)
        stmt = stmt.order_by(PanicAlert.triggered_at.desc())
        return self.alerts.list(offset=offset, limit=limit, extra=stmt), self.alerts.count(
            extra=stmt
        )

    def _get_alert(self, alert_id: uuid.UUID) -> PanicAlert:
        obj = self.alerts.get(alert_id)
        if obj is None:
            raise NotFoundError("Alert not found")
        return obj

    def acknowledge_alert(self, alert_id: uuid.UUID) -> PanicAlert:
        obj = self._get_alert(alert_id)
        if obj.status != "active":
            raise BusinessRuleError(f"Alert is already '{obj.status}'", code="INVALID_TRANSITION")
        obj.status = "acknowledged"
        obj.acknowledged_by_user_id = self.actor.id
        obj.acknowledged_at = datetime.now(UTC)
        self.db.flush()
        self._audit("alert.acknowledge", obj.community_id, "panic_alert", obj.id)
        return obj

    def resolve_alert(self, alert_id: uuid.UUID, payload) -> PanicAlert:
        obj = self._get_alert(alert_id)
        if obj.status not in ("active", "acknowledged"):
            raise BusinessRuleError(f"Alert is already '{obj.status}'", code="INVALID_TRANSITION")
        obj.status = "resolved"
        obj.resolved_at = datetime.now(UTC)
        obj.resolution_summary = payload.resolution_summary
        if obj.acknowledged_at is None:
            obj.acknowledged_by_user_id = self.actor.id
            obj.acknowledged_at = obj.resolved_at
        self.db.flush()
        self._audit("alert.resolve", obj.community_id, "panic_alert", obj.id)
        return obj

    def cancel_alert(self, alert_id: uuid.UUID) -> PanicAlert:
        obj = self._get_alert(alert_id)
        if obj.status in ("resolved", "cancelled"):
            raise BusinessRuleError(f"Alert is already '{obj.status}'", code="INVALID_TRANSITION")
        if obj.triggered_by_user_id != self.actor.id:
            raise ForbiddenError(
                "Only the person who raised the alert can cancel it", code="NOT_ALERT_OWNER"
            )
        obj.status = "cancelled"
        obj.resolved_at = datetime.now(UTC)
        self.db.flush()
        self._audit("alert.cancel", obj.community_id, "panic_alert", obj.id)
        return obj
