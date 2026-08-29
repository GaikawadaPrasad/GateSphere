"""Tenant onboarding (FR-03): URL invitations + direct add / remove of tenants.

Flows
-----
* **Invite** — a community admin/owner issues an invitation for one unit. The invitee
  opens `accept_url`, authenticates (logs in, or sets a password if the email has no
  account), and submits the remaining profile fields. Accepting creates, in one
  transaction: a `ResidentProfile` (status ``active``), a `UnitOccupancy`, an optional
  set of `EmergencyContact` rows, and a community-scoped ``resident`` role grant.
* **Add directly** — same end state, no invitation round-trip.
* **Remove** — end every active occupancy, mark the profile ``moved_out`` and revoke the
  community ``resident`` grant (which bumps ``permission_version`` + kills live sessions).

Authenticated methods are community-scoped via `TenantScope`. The two public methods
(`public_view`, `accept`) run without a scope; RLS stays permissive because no
`app.community_ids` GUC is bound on those requests.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import Request, Response
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import BusinessRuleError, ConflictError, ForbiddenError, NotFoundError
from app.core.security import (
    create_session,
    hash_password,
    invalidate_user_permissions_async,
    verify_password,
)
from app.core.tenancy import TenantScope
from app.modules.audit.service import record_audit_async
from app.modules.communities.models import Community, Floor, Tower, Unit
from app.modules.notifications.events import emit
from app.modules.onboarding import schemas
from app.modules.onboarding.models import CommunityInvitation
from app.modules.residents.models import (
    EmergencyContact,
    ResidentProfile,
    UnitOccupancy,
)
from app.modules.users.models import Role, User, UserRole

_TOKEN_BYTES = 32


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


class OnboardingService:
    def __init__(
        self,
        db: AsyncSession,
        scope: TenantScope | None = None,
        actor: User | None = None,
        request: Request | None = None,
    ) -> None:
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request

    # ------------------------------------------------------------------ #
    # shared helpers
    # ------------------------------------------------------------------ #
    async def _audit(self, action: str, entity_id, *, community_id=None, **kw) -> None:
        await record_audit_async(
            self.db,
            module="onboarding",
            action=action,
            actor=self.actor,
            community_id=community_id,
            entity_type="resident_profile",
            entity_id=str(entity_id),
            request=self.request,
            **kw,
        )

    def _require_scope(self, community_id: uuid.UUID) -> None:
        if self.scope is None:
            raise ForbiddenError("Not authorized", code="FORBIDDEN")
        self.scope.require(community_id)

    async def _community(self, community_id: uuid.UUID) -> Community:
        c = await self.db.scalar(select(Community).where(Community.id == community_id))
        if c is None:
            raise NotFoundError("Community not found")
        return c

    async def _unit_ctx(self, unit_id: uuid.UUID, community_id: uuid.UUID) -> tuple[Unit, str]:
        row = (
            await self.db.execute(
                select(Unit, Floor, Tower)
                .join(
                    Floor,
                    (Floor.id == Unit.floor_id) & (Floor.community_id == Unit.community_id),
                )
                .join(
                    Tower,
                    (Tower.id == Unit.tower_id) & (Tower.community_id == Unit.community_id),
                )
                .where(Unit.id == unit_id, Unit.community_id == community_id)
            )
        ).first()
        if row is None:
            raise NotFoundError("Unit not found")
        unit, floor, tower = row
        floor_label = floor.label or f"Floor {floor.floor_number}"
        return unit, f"{tower.name} / {floor_label} / {unit.unit_number}"

    async def _role(self, slug: str) -> Role:
        role = await self.db.scalar(select(Role).where(Role.slug == slug))
        if role is None:
            raise NotFoundError(f"Role '{slug}' not found")
        return role

    async def _user_by_email(self, email: str) -> User | None:
        return await self.db.scalar(select(User).where(User.email == email.lower()))

    async def _assert_phone_free(
        self, phone: str | None, *, exclude_user_id: uuid.UUID | None = None
    ) -> None:
        """`users.phone` is UNIQUE — reject a collision as a clean 409, not a raw IntegrityError."""
        if not phone:
            return
        stmt = select(User.id).where(User.phone == phone)
        if exclude_user_id is not None:
            stmt = stmt.where(User.id != exclude_user_id)
        if await self.db.scalar(stmt) is not None:
            raise ConflictError(
                "That phone number is already registered to another account",
                code="PHONE_TAKEN",
            )

    async def _ensure_primary_free(self, unit_id: uuid.UUID, community_id: uuid.UUID) -> None:
        clash = await self.db.scalar(
            select(UnitOccupancy.id).where(
                UnitOccupancy.unit_id == unit_id,
                UnitOccupancy.community_id == community_id,
                UnitOccupancy.is_primary.is_(True),
                UnitOccupancy.is_active.is_(True),
            )
        )
        if clash is not None:
            raise ConflictError(
                "This unit already has a primary occupant", code="PRIMARY_OCCUPANT_EXISTS"
            )

    async def _grant_resident_role(
        self, user_id: uuid.UUID, community_id: uuid.UUID, slug: str = "resident"
    ) -> None:
        role = await self._role(slug)
        exists = await self.db.scalar(
            select(UserRole.id).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role.id,
                UserRole.community_id == community_id,
            )
        )
        if exists is None:
            self.db.add(UserRole(user_id=user_id, role_id=role.id, community_id=community_id))
            await self.db.flush()
        await invalidate_user_permissions_async(self.db, [user_id])

    async def _get_or_create_profile(
        self, user_id: uuid.UUID, community_id: uuid.UUID, *, move_in: date | None
    ) -> ResidentProfile:
        profile = await self.db.scalar(
            select(ResidentProfile).where(
                ResidentProfile.user_id == user_id,
                ResidentProfile.community_id == community_id,
            )
        )
        if profile is None:
            profile = ResidentProfile(
                user_id=user_id,
                community_id=community_id,
                profile_status="active",
                move_in_date=move_in,
            )
            self.db.add(profile)
            await self.db.flush()
        else:
            profile.profile_status = "active"
            if move_in and not profile.move_in_date:
                profile.move_in_date = move_in
            await self.db.flush()
        return profile

    async def _occupancies_for(self, profile_id: uuid.UUID) -> list[UnitOccupancy]:
        return list(
            (
                await self.db.scalars(
                    select(UnitOccupancy)
                    .where(UnitOccupancy.resident_profile_id == profile_id)
                    .order_by(UnitOccupancy.start_date.desc())
                    # refresh column values — a preceding bulk UPDATE does not sync the
                    # identity map, so identity-mapped rows would otherwise read stale.
                    .execution_options(populate_existing=True)
                )
            ).all()
        )

    async def _tenant_out(
        self,
        profile: ResidentProfile,
        user: User,
        *,
        account_created: bool = False,
        logged_in: bool = False,
    ) -> schemas.TenantOut:
        occ = await self._occupancies_for(profile.id)
        return schemas.TenantOut(
            resident_profile_id=profile.id,
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            community_id=profile.community_id,
            profile_status=profile.profile_status,
            occupancies=[schemas.OccupancyOut.model_validate(o) for o in occ],
            account_created=account_created,
            logged_in=logged_in,
        )

    # ------------------------------------------------------------------ #
    # invitations — authenticated
    # ------------------------------------------------------------------ #
    async def create_invitation(
        self, community_id: uuid.UUID, payload: schemas.InvitationCreate
    ) -> schemas.InvitationCreated:
        self._require_scope(community_id)
        await self._community(community_id)
        await self._unit_ctx(payload.unit_id, community_id)
        await self._role(payload.role_slug)
        if payload.occupancy_role not in schemas._OCCUPANCY_ROLES:
            raise BusinessRuleError("Unknown occupancy role", code="INVALID_OCCUPANCY_ROLE")
        if payload.is_primary:
            await self._ensure_primary_free(payload.unit_id, community_id)

        email = payload.invited_email.lower()
        dupe = await self.db.scalar(
            select(CommunityInvitation.id).where(
                CommunityInvitation.community_id == community_id,
                CommunityInvitation.unit_id == payload.unit_id,
                CommunityInvitation.invited_email == email,
                CommunityInvitation.status == "pending",
            )
        )
        if dupe is not None:
            raise ConflictError(
                "A pending invitation for this email and unit already exists",
                code="INVITATION_EXISTS",
            )

        token = secrets.token_urlsafe(_TOKEN_BYTES)
        inv = CommunityInvitation(
            community_id=community_id,
            unit_id=payload.unit_id,
            invited_email=email,
            invited_phone=payload.invited_phone,
            full_name=payload.full_name,
            role_slug=payload.role_slug,
            occupancy_role=payload.occupancy_role,
            is_primary=payload.is_primary,
            agreement_reference=payload.agreement_reference,
            message=payload.message,
            token_hash=_hash(token),
            status="pending",
            invited_by_user_id=self.actor.id if self.actor else None,
            expires_at=_now() + timedelta(days=payload.expires_in_days),
        )
        self.db.add(inv)
        await self.db.flush()
        await self._audit(
            "invitation.create",
            inv.id,
            community_id=community_id,
            new={"email": email, "unit_id": str(payload.unit_id)},
        )
        data = schemas.InvitationCreated.model_validate(
            {
                **schemas.InvitationRead.model_validate(inv).model_dump(),
                "token": token,
                "accept_url": f"{settings.FRONTEND_ORIGIN}/invite/{token}",
            }
        )
        return data

    async def list_invitations(
        self, community_id: uuid.UUID, *, status: str | None, offset: int, limit: int
    ) -> tuple[list[CommunityInvitation], int]:
        self._require_scope(community_id)
        stmt = select(CommunityInvitation).where(CommunityInvitation.community_id == community_id)
        if status:
            stmt = stmt.where(CommunityInvitation.status == status)
        total = int(
            await self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
            or 0
        )
        rows = list(
            (
                await self.db.scalars(
                    stmt.order_by(CommunityInvitation.created_at.desc()).offset(offset).limit(limit)
                )
            ).all()
        )
        return rows, total

    async def revoke_invitation(
        self, community_id: uuid.UUID, invitation_id: uuid.UUID
    ) -> CommunityInvitation:
        self._require_scope(community_id)
        inv = await self.db.scalar(
            select(CommunityInvitation).where(
                CommunityInvitation.id == invitation_id,
                CommunityInvitation.community_id == community_id,
            )
        )
        if inv is None:
            raise NotFoundError("Invitation not found")
        if inv.status != "pending":
            raise BusinessRuleError(
                f"Invitation is already {inv.status}", code="INVITATION_NOT_PENDING"
            )
        inv.status = "revoked"
        await self.db.flush()
        await self._audit("invitation.revoke", inv.id, community_id=community_id)
        return inv

    # ------------------------------------------------------------------ #
    # invitations — public (token)
    # ------------------------------------------------------------------ #
    async def _load_token(self, token: str, *, for_update: bool = False) -> CommunityInvitation:
        stmt = select(CommunityInvitation).where(CommunityInvitation.token_hash == _hash(token))
        if for_update:
            stmt = stmt.with_for_update()  # serialise concurrent accepts of the same token
        inv = await self.db.scalar(stmt)
        if inv is None:
            raise NotFoundError("Invitation not found")
        if inv.status == "pending" and inv.expires_at <= _now():
            inv.status = "expired"
            await self.db.flush()
        return inv

    async def public_view(self, token: str) -> schemas.InvitationPublic:
        inv = await self._load_token(token)
        community = await self._community(inv.community_id)
        _unit, label = await self._unit_ctx(inv.unit_id, inv.community_id)
        inviter = None
        if inv.invited_by_user_id:
            u = await self.db.get(User, inv.invited_by_user_id)
            inviter = u.full_name if u else None
        account = await self._user_by_email(inv.invited_email)
        return schemas.InvitationPublic(
            community_id=inv.community_id,
            community_name=community.name,
            unit_label=label,
            invited_email=inv.invited_email,
            invited_name=inv.full_name,
            occupancy_role=inv.occupancy_role,
            is_primary=inv.is_primary,
            invited_by=inviter,
            status=inv.status,
            expires_at=inv.expires_at,
            account_exists=account is not None,
        )

    async def accept(
        self,
        token: str,
        payload: schemas.InvitationAccept,
        *,
        current_user: User | None,
        response: Response,
    ) -> schemas.TenantOut:
        inv = await self._load_token(token, for_update=True)
        if inv.status != "pending":
            raise BusinessRuleError(f"Invitation is {inv.status}", code="INVITATION_NOT_PENDING")

        account = await self._user_by_email(inv.invited_email)
        account_created = False
        logged_in = False

        if current_user is not None and current_user.email == inv.invited_email:
            user = current_user
        elif account is not None:
            # existing account, but the caller isn't signed in as them
            if payload.password and verify_password(payload.password, account.password_hash):
                user = account
                await create_session(self.db, response, user, self.request)
                logged_in = True
            else:
                raise ForbiddenError(
                    "Sign in as the invited user to accept this invitation",
                    code="LOGIN_REQUIRED",
                )
        else:
            if not payload.password:
                raise BusinessRuleError(
                    "A password is required to create your account",
                    code="PASSWORD_REQUIRED",
                )
            new_phone = payload.phone or inv.invited_phone
            await self._assert_phone_free(new_phone)
            user = User(
                email=inv.invited_email,
                full_name=payload.full_name or inv.full_name or inv.invited_email,
                phone=new_phone,
                password_hash=hash_password(payload.password),
            )
            self.db.add(user)
            await self.db.flush()
            account_created = True
            await create_session(self.db, response, user, self.request)
            logged_in = True

        if payload.full_name and user.full_name != payload.full_name:
            user.full_name = payload.full_name
        if payload.phone and not user.phone:
            await self._assert_phone_free(payload.phone, exclude_user_id=user.id)
            user.phone = payload.phone

        if inv.is_primary:
            await self._ensure_primary_free(inv.unit_id, inv.community_id)

        profile = await self._get_or_create_profile(
            user.id, inv.community_id, move_in=payload.move_in_date or date.today()
        )
        if payload.id_type and payload.id_number:
            profile.kyc_status = "submitted"

        dupe_occ = await self.db.scalar(
            select(UnitOccupancy.id).where(
                UnitOccupancy.unit_id == inv.unit_id,
                UnitOccupancy.resident_profile_id == profile.id,
                UnitOccupancy.is_active.is_(True),
            )
        )
        if dupe_occ is None:
            self.db.add(
                UnitOccupancy(
                    community_id=inv.community_id,
                    unit_id=inv.unit_id,
                    resident_profile_id=profile.id,
                    occupancy_role=inv.occupancy_role,
                    is_primary=inv.is_primary,
                    agreement_reference=inv.agreement_reference,
                    start_date=payload.move_in_date or date.today(),
                )
            )

        for i, ec in enumerate(payload.emergency_contacts):
            self.db.add(
                EmergencyContact(
                    community_id=inv.community_id,
                    resident_profile_id=profile.id,
                    name=ec.name,
                    relationship_type=ec.relationship_type,
                    phone=ec.phone,
                    alternate_phone=ec.alternate_phone,
                    priority=ec.priority or (i + 1),
                )
            )

        await self.db.flush()
        await self._grant_resident_role(user.id, inv.community_id, inv.role_slug)

        inv.status = "accepted"
        inv.accepted_at = _now()
        inv.accepted_user_id = user.id
        inv.resident_profile_id = profile.id
        await self.db.flush()

        await self._audit(
            "invitation.accept",
            profile.id,
            community_id=inv.community_id,
            new={"invitation_id": str(inv.id), "user_id": str(user.id)},
        )
        if inv.invited_by_user_id:
            await emit(
                self.db,
                TenantScope(user.id, is_global=False, community_ids=frozenset({inv.community_id})),
                user,
                self.request,
                recipient_user_id=inv.invited_by_user_id,
                community_id=inv.community_id,
                notification_type="onboarding.invitation_accepted",
                title="Invitation accepted",
                message=f"{user.full_name} accepted the invitation to join the community.",
                reference_type="resident_profile",
                reference_id=profile.id,
            )
        return await self._tenant_out(
            profile, user, account_created=account_created, logged_in=logged_in
        )

    # ------------------------------------------------------------------ #
    # direct add / remove — authenticated
    # ------------------------------------------------------------------ #
    async def add_tenant(
        self, community_id: uuid.UUID, payload: schemas.TenantAdd
    ) -> schemas.TenantOut:
        self._require_scope(community_id)
        await self._community(community_id)
        await self._unit_ctx(payload.unit_id, community_id)
        await self._role(payload.role_slug)
        if payload.occupancy_role not in schemas._OCCUPANCY_ROLES:
            raise BusinessRuleError("Unknown occupancy role", code="INVALID_OCCUPANCY_ROLE")
        if payload.is_primary:
            await self._ensure_primary_free(payload.unit_id, community_id)

        user = await self._user_by_email(payload.email)
        account_created = False
        if user is None:
            await self._assert_phone_free(payload.phone)
            user = User(
                email=payload.email.lower(),
                full_name=payload.full_name,
                phone=payload.phone,
                password_hash=hash_password(
                    payload.password or secrets.token_urlsafe(_TOKEN_BYTES)
                ),
            )
            self.db.add(user)
            await self.db.flush()
            account_created = True

        profile = await self._get_or_create_profile(
            user.id, community_id, move_in=payload.move_in_date or date.today()
        )
        dupe_occ = await self.db.scalar(
            select(UnitOccupancy.id).where(
                UnitOccupancy.unit_id == payload.unit_id,
                UnitOccupancy.resident_profile_id == profile.id,
                UnitOccupancy.is_active.is_(True),
            )
        )
        if dupe_occ is not None:
            raise ConflictError("This resident already occupies the unit", code="OCCUPANCY_EXISTS")
        self.db.add(
            UnitOccupancy(
                community_id=community_id,
                unit_id=payload.unit_id,
                resident_profile_id=profile.id,
                occupancy_role=payload.occupancy_role,
                is_primary=payload.is_primary,
                agreement_reference=payload.agreement_reference,
                start_date=payload.move_in_date or date.today(),
            )
        )
        await self.db.flush()
        await self._grant_resident_role(user.id, community_id, payload.role_slug)
        await self._audit(
            "tenant.add",
            profile.id,
            community_id=community_id,
            new={"user_id": str(user.id), "unit_id": str(payload.unit_id)},
        )
        return await self._tenant_out(profile, user, account_created=account_created)

    async def _profile_in(self, community_id: uuid.UUID, profile_id: uuid.UUID) -> ResidentProfile:
        profile = await self.db.scalar(
            select(ResidentProfile).where(
                ResidentProfile.id == profile_id,
                ResidentProfile.community_id == community_id,
            )
        )
        if profile is None:
            raise NotFoundError("Resident profile not found")
        return profile

    async def remove_tenant(
        self, community_id: uuid.UUID, profile_id: uuid.UUID
    ) -> schemas.TenantOut:
        self._require_scope(community_id)
        profile = await self._profile_in(community_id, profile_id)

        await self.db.execute(
            update(UnitOccupancy)
            .where(
                UnitOccupancy.resident_profile_id == profile.id,
                UnitOccupancy.is_active.is_(True),
            )
            .values(is_active=False, end_date=date.today())
        )
        profile.profile_status = "moved_out"
        profile.move_out_date = date.today()

        grant = await self.db.scalar(
            select(UserRole)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                UserRole.user_id == profile.user_id,
                UserRole.community_id == community_id,
                Role.slug == "resident",
            )
        )
        if grant is not None:
            await self.db.delete(grant)
        await self.db.flush()
        await invalidate_user_permissions_async(self.db, [profile.user_id])
        await self._audit("tenant.remove", profile.id, community_id=community_id)
        user = await self.db.get(User, profile.user_id)
        return await self._tenant_out(profile, user)

    async def remove_occupancy(
        self,
        community_id: uuid.UUID,
        unit_id: uuid.UUID,
        occupancy_id: uuid.UUID,
    ) -> schemas.OccupancyOut:
        self._require_scope(community_id)
        occ = await self.db.scalar(
            select(UnitOccupancy).where(
                UnitOccupancy.id == occupancy_id,
                UnitOccupancy.unit_id == unit_id,
                UnitOccupancy.community_id == community_id,
            )
        )
        if occ is None:
            raise NotFoundError("Occupancy not found")
        if not occ.is_active:
            raise BusinessRuleError("Occupancy already ended", code="OCCUPANCY_ENDED")
        occ.is_active = False
        occ.end_date = date.today()
        await self.db.flush()

        # If the resident has no remaining active occupancy in this community, drop the grant.
        remaining = await self.db.scalar(
            select(UnitOccupancy.id).where(
                UnitOccupancy.resident_profile_id == occ.resident_profile_id,
                UnitOccupancy.community_id == community_id,
                UnitOccupancy.is_active.is_(True),
            )
        )
        profile = await self.db.get(ResidentProfile, occ.resident_profile_id)
        if remaining is None and profile is not None:
            profile.profile_status = "moved_out"
            profile.move_out_date = date.today()
            grant = await self.db.scalar(
                select(UserRole)
                .join(Role, Role.id == UserRole.role_id)
                .where(
                    UserRole.user_id == profile.user_id,
                    UserRole.community_id == community_id,
                    Role.slug == "resident",
                )
            )
            if grant is not None:
                await self.db.delete(grant)
            await self.db.flush()
            await invalidate_user_permissions_async(self.db, [profile.user_id])
        await self._audit(
            "occupancy.remove",
            occ.resident_profile_id,
            community_id=community_id,
            new={"occupancy_id": str(occ.id), "unit_id": str(unit_id)},
        )
        return schemas.OccupancyOut.model_validate(occ)
