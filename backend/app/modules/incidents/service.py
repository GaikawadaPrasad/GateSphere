"""Business logic for Emergency & Incident Management (FR-13).

Lifecycle: reported -> acknowledged -> responding -> contained -> resolved -> closed;
`false_alarm` is reachable from the early states. `resolved` needs a `resolution_summary`.
Status history and the action log are append-only.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, ConflictError, NotFoundError
from app.core.state_machine import ensure_transition
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit
from app.modules.communities.models import Gate, Tower, Unit
from app.modules.gate.models import PanicAlert
from app.modules.incidents import schemas
from app.modules.incidents.models import (
    IncidentAction,
    IncidentAssignment,
    IncidentAttachment,
    IncidentStatusHistory,
    SecurityIncident,
)
from app.modules.incidents.repository import (
    IncidentRepository,
    assignment_for,
)
from app.modules.incidents.schemas import ALLOWED
from app.modules.users.models import User

_TRANSITIONS: dict[str, set[str]] = {
    "reported": {"acknowledged", "false_alarm"},
    "acknowledged": {"responding", "false_alarm"},
    "responding": {"contained", "resolved", "false_alarm"},
    "contained": {"resolved", "responding"},
    "resolved": {"closed", "responding"},
    "closed": set(),
    "false_alarm": set(),
}


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class IncidentService:
    def __init__(
        self, db: Session, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request
        self.incidents = IncidentRepository(db, scope)

    def _audit(self, action, community_id, entity_type, entity_id, **kw):
        record_audit(
            self.db,
            module="incidents",
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

    def _belongs(self, model, obj_id: uuid.UUID | None, community_id: uuid.UUID, label: str):
        if obj_id is None:
            return
        obj = self.db.get(model, obj_id)
        if obj is None or getattr(obj, "community_id", None) != community_id:
            raise NotFoundError(f"{label} not found")

    def _history(self, incident: SecurityIncident, old, new, reason=None) -> None:
        self.db.add(
            IncidentStatusHistory(
                community_id=incident.community_id,
                incident_id=incident.id,
                old_status=old,
                new_status=new,
                changed_by_user_id=self.actor.id,
                reason=reason,
            )
        )

    # -- incidents --------------------------------------- #
    def create_incident(self, payload: schemas.IncidentCreate) -> SecurityIncident:
        cid = self._one_community(payload.community_id)
        _enum("incident_type", payload.incident_type)
        _enum("severity", payload.severity)
        self._belongs(Tower, payload.tower_id, cid, "Tower")
        self._belongs(Unit, payload.unit_id, cid, "Unit")
        self._belongs(Gate, payload.gate_id, cid, "Gate")
        if payload.panic_alert_id is not None:
            alert = self.db.get(PanicAlert, payload.panic_alert_id)
            if alert is None or alert.community_id != cid:
                raise NotFoundError("Panic alert not found")
        now = datetime.now(UTC)
        seq = self.incidents.next_sequence(cid)
        inc = SecurityIncident(
            community_id=cid,
            incident_number=f"INC-{now.year}-{seq:05d}",
            incident_type=payload.incident_type,
            severity=payload.severity,
            status="reported",
            tower_id=payload.tower_id,
            unit_id=payload.unit_id,
            gate_id=payload.gate_id,
            panic_alert_id=payload.panic_alert_id,
            location_text=payload.location_text,
            reporter_user_id=self.actor.id,
            description=payload.description,
        )
        self.incidents.add(inc)
        self._history(inc, None, "reported")
        self._audit(
            "incident.create",
            cid,
            "security_incident",
            inc.id,
            new={"type": payload.incident_type, "severity": payload.severity},
        )
        return inc

    def get_incident(self, incident_id: uuid.UUID) -> SecurityIncident:
        obj = self.incidents.get(incident_id)
        if obj is None:
            raise NotFoundError("Incident not found")
        return obj

    def list_incidents(
        self,
        *,
        community_id: uuid.UUID | None,
        incident_status: str | None,
        severity: str | None,
        offset: int,
        limit: int,
    ):
        _enum("status", incident_status)
        _enum("severity", severity)
        stmt = select(SecurityIncident)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(SecurityIncident.community_id == community_id)
        if incident_status:
            stmt = stmt.where(SecurityIncident.status == incident_status)
        if severity:
            stmt = stmt.where(SecurityIncident.severity == severity)
        stmt = stmt.order_by(SecurityIncident.reported_at.desc())
        return self.incidents.list(offset=offset, limit=limit, extra=stmt), self.incidents.count(
            extra=stmt
        )

    def update_incident(
        self, incident_id: uuid.UUID, payload: schemas.IncidentUpdate
    ) -> SecurityIncident:
        inc = self.get_incident(incident_id)
        if inc.status in ("closed", "false_alarm"):
            raise BusinessRuleError(f"Incident is '{inc.status}'", code="INVALID_TRANSITION")
        patch = payload.model_dump(exclude_unset=True)
        _enum("severity", patch.get("severity"))
        for k, v in patch.items():
            setattr(inc, k, v)
        self.db.flush()
        self._audit("incident.update", inc.community_id, "security_incident", inc.id, new=patch)
        return inc

    def transition_incident(
        self, incident_id: uuid.UUID, payload: schemas.IncidentTransition
    ) -> SecurityIncident:
        inc = self.get_incident(incident_id)
        _enum("status", payload.status)
        target = payload.status
        ensure_transition(inc.status, target, _TRANSITIONS, entity="incident")
        if target == "resolved":
            if not (payload.resolution_summary or inc.resolution_summary):
                raise BusinessRuleError(
                    "resolution_summary is required to resolve", code="SUMMARY_REQUIRED"
                )
            inc.resolution_summary = payload.resolution_summary or inc.resolution_summary
            inc.resolved_at = datetime.now(UTC)
        old = inc.status
        inc.status = target
        self._history(inc, old, target, payload.reason)
        self.db.flush()
        self._audit(f"incident.{target}", inc.community_id, "security_incident", inc.id)
        return inc

    # -- assignments ------------------------------------ #
    def assign(self, incident_id: uuid.UUID, payload: schemas.AssignIn) -> IncidentAssignment:
        inc = self.get_incident(incident_id)
        if inc.status in ("closed", "false_alarm"):
            raise BusinessRuleError(f"Incident is '{inc.status}'", code="INVALID_TRANSITION")
        if self.db.get(User, payload.assigned_user_id) is None:
            raise NotFoundError("Responder not found")
        if assignment_for(self.db, inc.id, payload.assigned_user_id) is not None:
            raise ConflictError("Already assigned", code="ALREADY_ASSIGNED")
        obj = IncidentAssignment(
            incident_id=inc.id,
            assigned_user_id=payload.assigned_user_id,
            assigned_by_user_id=self.actor.id,
        )
        self.db.add(obj)
        self.db.flush()
        self._audit("incident.assign", inc.community_id, "incident_assignment", obj.id)
        return obj

    def release(self, assignment_id: uuid.UUID) -> IncidentAssignment:
        obj = self.db.get(IncidentAssignment, assignment_id)
        if obj is None:
            raise NotFoundError("Assignment not found")
        self.get_incident(obj.incident_id)  # scope check
        if not obj.is_active:
            raise BusinessRuleError("Already released", code="ALREADY_RELEASED")
        obj.is_active = False
        obj.released_at = datetime.now(UTC)
        self.db.flush()
        inc = self.db.get(SecurityIncident, obj.incident_id)
        self._audit("incident.release", inc.community_id, "incident_assignment", obj.id)
        return obj

    def list_assignments(self, incident_id: uuid.UUID) -> list[IncidentAssignment]:
        self.get_incident(incident_id)
        return list(
            self.db.scalars(
                select(IncidentAssignment)
                .where(IncidentAssignment.incident_id == incident_id)
                .order_by(IncidentAssignment.assigned_at)
            ).all()
        )

    # -- actions --------------------------------------- #
    def add_action(self, incident_id: uuid.UUID, payload: schemas.ActionIn) -> IncidentAction:
        inc = self.get_incident(incident_id)
        _enum("action_type", payload.action_type)
        obj = IncidentAction(
            incident_id=inc.id,
            actor_user_id=self.actor.id,
            action_type=payload.action_type,
            details=payload.details,
        )
        self.db.add(obj)
        self.db.flush()
        self._audit("incident.action", inc.community_id, "incident_action", obj.id)
        return obj

    def list_actions(self, incident_id: uuid.UUID) -> list[IncidentAction]:
        self.get_incident(incident_id)
        return list(
            self.db.scalars(
                select(IncidentAction)
                .where(IncidentAction.incident_id == incident_id)
                .order_by(IncidentAction.action_at)
            ).all()
        )

    def add_attachment(self, incident_id: uuid.UUID, payload) -> IncidentAttachment:
        inc = self.get_incident(incident_id)
        obj = IncidentAttachment(
            incident_id=inc.id,
            uploaded_by_user_id=self.actor.id,
            file_url=payload.file_url,
            file_name=payload.file_name,
            mime_type=payload.mime_type,
            file_size_bytes=payload.file_size_bytes,
        )
        self.db.add(obj)
        self.db.flush()
        self._audit("incident.attachment", inc.community_id, "incident_attachment", obj.id)
        return obj

    def list_attachments(self, incident_id: uuid.UUID) -> list[IncidentAttachment]:
        self.get_incident(incident_id)
        return list(
            self.db.scalars(
                select(IncidentAttachment)
                .where(IncidentAttachment.incident_id == incident_id)
                .order_by(IncidentAttachment.created_at)
            ).all()
        )

    def list_history(self, incident_id: uuid.UUID) -> list[IncidentStatusHistory]:
        self.get_incident(incident_id)
        return list(
            self.db.scalars(
                select(IncidentStatusHistory)
                .where(IncidentStatusHistory.incident_id == incident_id)
                .order_by(IncidentStatusHistory.changed_at)
            ).all()
        )
