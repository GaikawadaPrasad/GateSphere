"""Business logic for Visitor Management (FR-04).

Lifecycle: create request -> blacklist check -> (policy or pass says no approval -> approved)
else pending -> resident/guard approves or rejects -> gate entry -> gate exit -> audit.
A blacklisted visitor is intercepted before any entry is recorded (policy `blacklist_mode`).
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.hashing import digest, digest_opt
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit
from app.modules.communities.models import Gate, Unit
from app.modules.notifications import events as notif_events
from app.modules.residents.models import UnitOccupancy
from app.modules.uploads.guard import ensure_confirmed
from app.modules.users.models import User
from app.modules.visitors import schemas
from app.modules.visitors.models import (
    Visitor,
    VisitorApproval,
    VisitorBlacklist,
    VisitorEntry,
    VisitorPass,
    VisitorPolicy,
    VisitorRequest,
    VisitorRequestMember,
)
from app.modules.visitors.repository import (
    BlacklistRepository,
    EntryRepository,
    PolicyRepository,
    RequestRepository,
    VisitorRepository,
    approval_row,
    pass_by_hash,
)
from app.modules.visitors.schemas import ALLOWED

_DEFAULT_POLICY = {
    "approval_required": True,
    "photo_required": True,
    "otp_required": False,
    "pass_ttl_minutes": 240,
    "blacklist_mode": "block",
}


def _enum(field: str, value: str | None) -> None:
    if value is not None and value not in ALLOWED[field]:
        raise BusinessRuleError(
            f"Invalid {field}",
            code="INVALID_ENUM",
            fields={field: f"one of {sorted(ALLOWED[field])}"},
        )


class VisitorService:
    def __init__(
        self, db: Session, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request
        self.visitors = VisitorRepository(db, scope)
        self.blacklist = BlacklistRepository(db, scope)
        self.requests = RequestRepository(db, scope)
        self.entries = EntryRepository(db, scope)
        self.policies = PolicyRepository(db, scope)

    def _audit(self, action, community_id, entity_type, entity_id, **kw):
        record_audit(
            self.db,
            module="visitors",
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

    def _unit_in_scope(self, unit_id: uuid.UUID) -> Unit:
        stmt = select(Unit).where(Unit.id == unit_id)
        if not self.scope.is_global:
            stmt = stmt.where(Unit.community_id.in_(self.scope.community_ids))
        unit = self.db.scalar(stmt)
        if unit is None:
            raise NotFoundError("Unit not found")
        return unit

    def _policy(self, community_id: uuid.UUID) -> VisitorPolicy:
        p = self.policies.for_community(community_id)
        if p is None:
            p = VisitorPolicy(community_id=community_id, **_DEFAULT_POLICY)
            self.policies.add(p)
        return p

    # -- policy ------------------------------------------------------- #
    def get_policy(self, *, community_id: uuid.UUID | None) -> VisitorPolicy:
        return self._policy(self._one_community(community_id))

    def update_policy(
        self, payload: schemas.PolicyUpdate, *, community_id: uuid.UUID | None
    ) -> VisitorPolicy:
        p = self._policy(self._one_community(community_id))
        patch = payload.model_dump(exclude_unset=True)
        for k, v in patch.items():
            setattr(p, k, v)
        self.db.flush()
        self._audit("policy.update", p.community_id, "visitor_policy", p.id, new=patch)
        return p

    # -- visitors --------------------------------------------------- #
    def upsert_visitor(self, community_id: uuid.UUID, data: schemas.VisitorCreate) -> Visitor:
        existing = self.visitors.by_phone(community_id, data.phone)
        if existing:
            return existing
        ensure_confirmed(self.db, data.photo_url)
        obj = Visitor(
            community_id=community_id,
            full_name=data.full_name,
            phone=data.phone,
            id_type=data.id_type,
            id_number_hash=digest_opt(data.id_number),
            vehicle_number=data.vehicle_number,
            photo_url=data.photo_url,
        )
        self.visitors.add(obj)
        return obj

    def list_visitors(
        self, *, community_id: uuid.UUID | None, q: str | None, offset: int, limit: int
    ):
        cid = self._one_community(community_id)
        stmt = select(Visitor).where(Visitor.community_id == cid)
        if q:
            stmt = stmt.where(Visitor.full_name.ilike(f"%{q}%") | Visitor.phone.ilike(f"%{q}%"))
        stmt = stmt.order_by(Visitor.last_visit_at.desc().nulls_last(), Visitor.full_name)
        return self.visitors.list(offset=offset, limit=limit, extra=stmt), self.visitors.count(
            extra=stmt
        )

    # -- blacklist ------------------------------------------------ #
    def list_blacklist(self, *, community_id: uuid.UUID | None, offset: int, limit: int):
        cid = self._one_community(community_id)
        stmt = (
            select(VisitorBlacklist)
            .where(VisitorBlacklist.community_id == cid)
            .order_by(VisitorBlacklist.created_at.desc())
        )
        return self.blacklist.list(offset=offset, limit=limit, extra=stmt), self.blacklist.count(
            extra=stmt
        )

    def add_blacklist(self, payload: schemas.BlacklistCreate, *, community_id: uuid.UUID | None):
        cid = self._one_community(community_id)
        _enum("risk_level", payload.risk_level)
        obj = VisitorBlacklist(
            community_id=cid,
            visitor_id=payload.visitor_id,
            phone_hash=digest(payload.phone),
            id_number_hash=digest_opt(payload.id_number),
            reason=payload.reason,
            risk_level=payload.risk_level,
            active_until=payload.active_until.date() if payload.active_until else None,
            created_by_user_id=self.actor.id,
        )
        self.blacklist.add(obj)
        self._audit(
            "blacklist.add", cid, "visitor_blacklist", obj.id, new={"reason": payload.reason}
        )
        return obj

    def _blacklist_hit(
        self, community_id: uuid.UUID, phone: str, id_number: str | None
    ) -> VisitorBlacklist | None:
        return self.blacklist.match(community_id, digest(phone), digest_opt(id_number))

    # -- requests ----------------------------------------------- #
    def list_requests(
        self,
        *,
        community_id: uuid.UUID | None,
        status: str | None,
        unit_id: uuid.UUID | None,
        offset: int,
        limit: int,
    ):
        _enum("status", status)
        stmt = select(VisitorRequest)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(VisitorRequest.community_id == community_id)
        if status:
            stmt = stmt.where(VisitorRequest.status == status)
        if unit_id:
            stmt = stmt.where(VisitorRequest.unit_id == unit_id)
        stmt = stmt.order_by(VisitorRequest.created_at.desc())
        return self.requests.list(offset=offset, limit=limit, extra=stmt), self.requests.count(
            extra=stmt
        )

    def get_request(self, request_id: uuid.UUID) -> VisitorRequest:
        obj = self.requests.get(request_id)
        if obj is None:
            raise NotFoundError("Visitor request not found")
        return obj

    def create_request(self, payload: schemas.RequestCreate) -> VisitorRequest:
        unit = self._unit_in_scope(payload.unit_id)
        _enum("visitor_type", payload.visitor_type)
        policy = self._policy(unit.community_id)

        if payload.visitor_id is not None:
            visitor = self.visitors.get(payload.visitor_id)
            if visitor is None or visitor.community_id != unit.community_id:
                raise NotFoundError("Visitor not found")
        elif payload.visitor is not None:
            visitor = self.upsert_visitor(unit.community_id, payload.visitor)
        else:
            raise BusinessRuleError(
                "Provide `visitor` or `visitor_id`",
                code="VISITOR_REQUIRED",
                fields={"visitor": "required"},
            )

        # Blacklist screening happens before the request is usable.
        hit = self._blacklist_hit(unit.community_id, visitor.phone, None)
        if hit and policy.blacklist_mode == "block":
            self._audit(
                "request.blacklisted",
                unit.community_id,
                "visitor",
                visitor.id,
                new={"blacklist_id": str(hit.id)},
            )
            raise ForbiddenError("Visitor is blacklisted", code="VISITOR_BLACKLISTED")

        approval_required = policy.approval_required and payload.visitor_type != "recurring"
        obj = VisitorRequest(
            community_id=unit.community_id,
            visitor_id=visitor.id,
            unit_id=unit.id,
            host_user_id=self._primary_host(unit.id),
            created_by_user_id=self.actor.id,
            visitor_type=payload.visitor_type,
            purpose=payload.purpose,
            expected_at=payload.expected_at,
            valid_until=payload.valid_until,
            vehicle_number=payload.vehicle_number,
            group_label=payload.group_label,
            party_size=payload.party_size,
            approval_required=approval_required,
            status="pending" if approval_required else "approved",
        )
        self.requests.add(obj)
        self.db.flush()
        # the request's own visitor is always the primary group member
        self._add_member(obj, visitor.id, is_primary=True)
        for extra_id in dict.fromkeys(payload.additional_visitor_ids or []):
            if extra_id == visitor.id:
                continue
            mv = self.visitors.get(extra_id)
            if mv is None or mv.community_id != unit.community_id:
                raise NotFoundError("Additional visitor not found")
            hit_m = self._blacklist_hit(unit.community_id, mv.phone, None)
            if hit_m and policy.blacklist_mode == "block":
                raise ForbiddenError(
                    f"Visitor {mv.full_name} is blacklisted", code="VISITOR_BLACKLISTED"
                )
            self._add_member(obj, mv.id, is_primary=False)
        self._audit(
            "request.create",
            unit.community_id,
            "visitor_request",
            obj.id,
            new={"visitor_type": payload.visitor_type, "status": obj.status},
        )
        if approval_required and obj.host_user_id:
            notif_events.emit(
                self.db,
                self.scope,
                self.actor,
                self.request,
                recipient_user_id=obj.host_user_id,
                community_id=unit.community_id,
                notification_type="visitor.approval_needed",
                title="Visitor approval needed",
                message=f"{visitor.full_name} is requesting to visit your unit.",
                reference_type="visitor_request",
                reference_id=obj.id,
            )
        return obj

    def _primary_host(self, unit_id: uuid.UUID) -> uuid.UUID | None:
        occ = self.db.scalar(
            select(UnitOccupancy).where(
                UnitOccupancy.unit_id == unit_id,
                UnitOccupancy.is_primary.is_(True),
                UnitOccupancy.is_active.is_(True),
            )
        )
        if occ is None:
            return None
        from app.modules.residents.models import ResidentProfile

        profile = self.db.get(ResidentProfile, occ.resident_profile_id)
        return profile.user_id if profile else None

    def decide_request(
        self, request_id: uuid.UUID, payload: schemas.RequestDecision
    ) -> VisitorRequest:
        req = self.get_request(request_id)
        _enum("decision", payload.decision)
        if req.status != "pending":
            raise BusinessRuleError(
                f"Request is already '{req.status}'",
                code="INVALID_TRANSITION",
                fields={"status": "must be pending"},
            )
        if approval_row(self.db, req.id, self.actor.id):
            raise ConflictError("You have already decided on this request", code="ALREADY_DECIDED")
        self.db.add(
            VisitorApproval(
                request_id=req.id,
                approver_user_id=self.actor.id,
                decision=payload.decision,
                remarks=payload.remarks,
            )
        )
        req.status = "approved" if payload.decision == "approved" else "rejected"
        self.db.flush()
        self._audit(
            f"request.{payload.decision}",
            req.community_id,
            "visitor_request",
            req.id,
            new={"decision": payload.decision},
        )
        visitor = self.db.get(Visitor, req.visitor_id)
        notif_events.emit(
            self.db,
            self.scope,
            self.actor,
            self.request,
            recipient_user_id=req.created_by_user_id,
            community_id=req.community_id,
            notification_type=f"visitor.{req.status}",
            title=f"Visitor request {req.status}",
            message=f"Your visitor request for "
            f"{visitor.full_name if visitor else 'a guest'} was {req.status}.",
            reference_type="visitor_request",
            reference_id=req.id,
        )
        return req

    def cancel_request(self, request_id: uuid.UUID) -> VisitorRequest:
        req = self.get_request(request_id)
        if req.status not in ("pending", "approved"):
            raise BusinessRuleError(
                f"Cannot cancel a '{req.status}' request", code="INVALID_TRANSITION"
            )
        req.status = "cancelled"
        self.db.flush()
        self._audit("request.cancel", req.community_id, "visitor_request", req.id)
        return req

    # -- passes ----------------------------------------------- #
    # -- group members (FR-04 multi-visitor grouping) ----- #
    def _add_member(
        self, req: VisitorRequest, visitor_id: uuid.UUID, *, is_primary: bool
    ) -> VisitorRequestMember:
        row = VisitorRequestMember(
            community_id=req.community_id,
            request_id=req.id,
            visitor_id=visitor_id,
            is_primary=is_primary,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def list_group_members(self, request_id: uuid.UUID) -> list[VisitorRequestMember]:
        req = self.get_request(request_id)  # scope check
        return list(
            self.db.scalars(
                select(VisitorRequestMember)
                .where(VisitorRequestMember.request_id == req.id)
                .order_by(VisitorRequestMember.is_primary.desc(), VisitorRequestMember.added_at)
            )
        )

    def add_group_member(
        self, request_id: uuid.UUID, payload: schemas.GroupMemberCreate
    ) -> VisitorRequestMember:
        req = self.get_request(request_id)
        if req.status in ("rejected", "cancelled", "expired", "completed"):
            raise BusinessRuleError(
                f"Cannot add a visitor to a '{req.status}' request", code="INVALID_STATE"
            )
        if payload.visitor_id is not None:
            visitor = self.visitors.get(payload.visitor_id)
            if visitor is None or visitor.community_id != req.community_id:
                raise NotFoundError("Visitor not found")
        elif payload.visitor is not None:
            visitor = self.upsert_visitor(req.community_id, payload.visitor)
        else:
            raise BusinessRuleError("Provide `visitor` or `visitor_id`", code="VISITOR_REQUIRED")
        if self.db.scalar(
            select(VisitorRequestMember).where(
                VisitorRequestMember.request_id == req.id,
                VisitorRequestMember.visitor_id == visitor.id,
            )
        ):
            raise ConflictError("Visitor already in this group", code="MEMBER_EXISTS")
        hit = self._blacklist_hit(req.community_id, visitor.phone, None)
        policy = self._policy(req.community_id)
        if hit and policy.blacklist_mode == "block":
            raise ForbiddenError("Visitor is blacklisted", code="VISITOR_BLACKLISTED")
        row = self._add_member(req, visitor.id, is_primary=False)
        req.party_size = max(req.party_size, len(self.list_group_members(req.id)))
        self.db.flush()
        self._audit(
            "request.add_member",
            req.community_id,
            "visitor_request",
            req.id,
            new={"visitor_id": str(visitor.id)},
        )
        return row

    def create_pass(
        self, request_id: uuid.UUID, payload: schemas.PassCreate
    ) -> tuple[VisitorPass, str, str | None]:
        req = self.get_request(request_id)
        _enum("pass_type", payload.pass_type)
        if req.status not in ("approved", "pending"):
            raise BusinessRuleError(
                f"Cannot issue a pass for a '{req.status}' request", code="INVALID_STATE"
            )
        policy = self._policy(req.community_id)
        now = datetime.now(UTC)
        token = secrets.token_urlsafe(18)
        pin: str | None = None
        if payload.with_pin or payload.pass_type in ("pin", "otp"):
            pin = f"{secrets.randbelow(1_000_000):06d}"
        obj = VisitorPass(
            request_id=req.id,
            pass_type=payload.pass_type,
            token_hash=digest(token),
            pin_hash=digest(pin) if pin else None,
            valid_from=payload.valid_from or now,
            valid_to=payload.valid_to or (now + timedelta(minutes=policy.pass_ttl_minutes)),
            max_entries=payload.max_entries,
        )
        if obj.valid_to <= obj.valid_from:
            raise BusinessRuleError("valid_to must be after valid_from", code="INVALID_DATE_RANGE")
        self.db.add(obj)
        # a valid pass pre-approves the request
        if req.approval_required and req.status == "pending":
            req.status = "approved"
        self.db.flush()
        self._audit(
            "pass.create",
            req.community_id,
            "visitor_pass",
            obj.id,
            new={"pass_type": payload.pass_type, "with_pin": pin is not None},
        )
        return obj, token, pin

    def revoke_pass(self, pass_id: uuid.UUID) -> None:
        obj = self.db.get(VisitorPass, pass_id)
        if obj is None:
            raise NotFoundError("Pass not found")
        req = self.get_request(obj.request_id)  # scope check via the request
        obj.is_revoked = True
        obj.revoked_at = datetime.now(UTC)
        self.db.flush()
        self._audit("pass.revoke", req.community_id, "visitor_pass", obj.id)

    # -- gate entries -------------------------------------- #
    def record_entry(self, payload: schemas.EntryCreate) -> VisitorEntry:
        ensure_confirmed(self.db, payload.entry_photo_url)
        req: VisitorRequest | None = None
        if payload.pass_token:
            vpass = pass_by_hash(self.db, digest(payload.pass_token))
            if vpass is None:
                raise NotFoundError("Pass not found")
            req = self.get_request(vpass.request_id)
            now = datetime.now(UTC)
            if vpass.is_revoked:
                raise BusinessRuleError("Pass is revoked", code="PASS_REVOKED")
            if not (vpass.valid_from <= now <= vpass.valid_to):
                raise BusinessRuleError("Pass is not valid at this time", code="PASS_EXPIRED")
            if vpass.entry_count >= vpass.max_entries:
                raise BusinessRuleError("Pass has no entries left", code="PASS_EXHAUSTED")
            vpass.entry_count += 1
        elif payload.pin:
            now = datetime.now(UTC)
            candidates = list(
                self.db.scalars(
                    select(VisitorPass).where(
                        VisitorPass.pin_hash == digest(payload.pin),
                        VisitorPass.is_revoked.is_(False),
                    )
                )
            )
            if payload.request_id:
                candidates = [c for c in candidates if c.request_id == payload.request_id]
            usable = [
                c
                for c in candidates
                if c.valid_from <= now <= c.valid_to and c.entry_count < c.max_entries
            ]
            if not usable:
                raise NotFoundError("No valid pass for that PIN")
            if len(usable) > 1:
                raise ConflictError(
                    "PIN matches several passes — also send request_id", code="PIN_AMBIGUOUS"
                )
            vpass = usable[0]
            vpass.entry_count += 1
            req = self.get_request(vpass.request_id)
        elif payload.request_id:
            req = self.get_request(payload.request_id)
        else:
            raise BusinessRuleError(
                "Provide `request_id`, `pass_token` or `pin`", code="REQUEST_REQUIRED"
            )

        if req.status not in ("approved", "entered"):
            raise BusinessRuleError(f"Request is '{req.status}', not approved", code="NOT_APPROVED")

        visitor_id = req.visitor_id
        if payload.visitor_id and payload.visitor_id != req.visitor_id:
            in_group = self.db.scalar(
                select(VisitorRequestMember).where(
                    VisitorRequestMember.request_id == req.id,
                    VisitorRequestMember.visitor_id == payload.visitor_id,
                )
            )
            if in_group is None:
                raise BusinessRuleError(
                    "Visitor is not part of this request's group", code="NOT_IN_GROUP"
                )
            visitor_id = payload.visitor_id
        # blacklist re-check at the gate
        visitor = self.db.get(Visitor, visitor_id)
        policy = self._policy(req.community_id)
        hit = self._blacklist_hit(req.community_id, visitor.phone, None) if visitor else None
        if hit and policy.blacklist_mode == "block":
            entry = VisitorEntry(
                community_id=req.community_id,
                request_id=req.id,
                visitor_id=visitor_id,
                gate_id=self._gate_in_scope(payload.gate_id),
                status="denied",
                denial_reason="blacklisted",
                entry_at=datetime.now(UTC),
            )
            self.entries.add(entry)
            self._audit(
                "entry.denied",
                req.community_id,
                "visitor_entry",
                entry.id,
                new={"reason": "blacklisted"},
            )
            raise ForbiddenError("Visitor is blacklisted", code="VISITOR_BLACKLISTED")

        if self.entries.open_for_visitor(req.community_id, visitor_id):
            raise ConflictError("Visitor is already inside", code="ALREADY_INSIDE")

        entry = VisitorEntry(
            community_id=req.community_id,
            request_id=req.id,
            visitor_id=visitor_id,
            gate_id=self._gate_in_scope(payload.gate_id),
            entry_guard_user_id=self.actor.id,
            entry_at=datetime.now(UTC),
            vehicle_number=payload.vehicle_number or req.vehicle_number,
            entry_photo_url=payload.entry_photo_url,
            status="inside",
        )
        self.entries.add(entry)
        req.status = "entered"
        if visitor:
            visitor.visit_count += 1
            visitor.last_visit_at = entry.entry_at
            visitor.frequent_visitor_flag = visitor.visit_count >= 5
        self.db.flush()
        self._audit("entry.create", req.community_id, "visitor_entry", entry.id)
        return entry

    def record_exit(self, entry_id: uuid.UUID) -> VisitorEntry:
        entry = self.entries.get(entry_id)
        if entry is None:
            raise NotFoundError("Entry not found")
        if entry.status != "inside":
            raise BusinessRuleError("Entry is not open", code="NOT_INSIDE")
        entry.exit_at = datetime.now(UTC)
        entry.exit_guard_user_id = self.actor.id
        entry.status = "exited"
        if entry.request_id:
            req = self.db.get(VisitorRequest, entry.request_id)
            still_inside = self.db.scalar(
                select(VisitorEntry.id).where(
                    VisitorEntry.request_id == entry.request_id,
                    VisitorEntry.status == "inside",
                    VisitorEntry.id != entry.id,
                )
            )
            if req and req.status == "entered" and still_inside is None:
                req.status = "completed"
        self.db.flush()
        self._audit("entry.exit", entry.community_id, "visitor_entry", entry.id)
        return entry

    def list_entries(
        self, *, community_id: uuid.UUID | None, status: str | None, offset: int, limit: int
    ):
        stmt = select(VisitorEntry)
        if community_id is not None:
            self.scope.require(community_id)
            stmt = stmt.where(VisitorEntry.community_id == community_id)
        if status:
            stmt = stmt.where(VisitorEntry.status == status)
        stmt = stmt.order_by(VisitorEntry.entry_at.desc().nulls_last())
        return self.entries.list(offset=offset, limit=limit, extra=stmt), self.entries.count(
            extra=stmt
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
