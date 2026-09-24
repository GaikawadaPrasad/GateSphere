"""Data-access for Gate / Security Operations (FR-05). Queries only."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time

from sqlalchemy import Select, literal, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repository import AsyncTenantRepository
from app.modules.gate.models import GateAssignment, GateEvent, GuardRoster, PanicAlert
from app.modules.users.models import User


class GateEventRepository(AsyncTenantRepository[GateEvent]):
    model = GateEvent

    def filtered(
        self,
        *,
        community_id: uuid.UUID | None,
        gate_id: uuid.UUID | None,
        event_type: str | None,
    ) -> Select:
        stmt = select(GateEvent)
        if community_id is not None:
            stmt = stmt.where(GateEvent.community_id == community_id)
        if gate_id:
            stmt = stmt.where(GateEvent.gate_id == gate_id)
        if event_type:
            stmt = stmt.where(GateEvent.event_type == event_type)
        return stmt

    async def keyset_page(
        self, stmt: Select, *, after: tuple[datetime, uuid.UUID] | None, limit: int
    ) -> list[GateEvent]:
        """Newest first; rows strictly after the `(occurred_at, id)` cursor. Fetches one extra
        row so the caller can tell whether another page exists."""
        if after is not None:
            stmt = stmt.where(
                tuple_(GateEvent.occurred_at, GateEvent.id)
                < tuple_(literal(after[0]), literal(after[1]))
            )
        stmt = stmt.order_by(GateEvent.occurred_at.desc(), GateEvent.id.desc())
        return list((await self.db.scalars(self._scoped(stmt).limit(limit + 1))).all())


class GuardRosterRepository(AsyncTenantRepository[GuardRoster]):
    model = GuardRoster

    async def find_clash(
        self,
        *,
        community_id: uuid.UUID,
        guard_user_id: uuid.UUID,
        shift_date: date,
        shift_start: time,
    ) -> GuardRoster | None:
        return await self.db.scalar(
            select(GuardRoster).where(
                GuardRoster.community_id == community_id,
                GuardRoster.guard_user_id == guard_user_id,
                GuardRoster.shift_date == shift_date,
                GuardRoster.shift_start == shift_start,
            )
        )

    def filtered(
        self,
        *,
        community_id: uuid.UUID | None,
        guard_user_id: uuid.UUID | None,
        status: str | None,
    ) -> Select:
        stmt = select(GuardRoster)
        if community_id is not None:
            stmt = stmt.where(GuardRoster.community_id == community_id)
        if guard_user_id:
            stmt = stmt.where(GuardRoster.guard_user_id == guard_user_id)
        if status:
            stmt = stmt.where(GuardRoster.status == status)
        return stmt.order_by(GuardRoster.shift_date.desc(), GuardRoster.shift_start)


class GateAssignmentRepository(AsyncTenantRepository[GateAssignment]):
    model = GateAssignment

    def filtered(
        self, *, community_id: uuid.UUID | None, gate_id: uuid.UUID | None, active_only: bool
    ) -> Select:
        stmt = select(GateAssignment)
        if community_id is not None:
            stmt = stmt.where(GateAssignment.community_id == community_id)
        if gate_id:
            stmt = stmt.where(GateAssignment.gate_id == gate_id)
        if active_only:
            stmt = stmt.where(GateAssignment.status == "active")
        return stmt.order_by(GateAssignment.assigned_from.desc())

    async def active_for_guard(self, guard_user_id: uuid.UUID) -> GateAssignment | None:
        return await self.db.scalar(
            self._scoped(select(GateAssignment)).where(
                GateAssignment.guard_user_id == guard_user_id,
                GateAssignment.status == "active",
            )
        )


class PanicAlertRepository(AsyncTenantRepository[PanicAlert]):
    model = PanicAlert

    def filtered(self, *, community_id: uuid.UUID | None, status: str | None) -> Select:
        stmt = select(PanicAlert)
        if community_id is not None:
            stmt = stmt.where(PanicAlert.community_id == community_id)
        if status:
            stmt = stmt.where(PanicAlert.status == status)
        return stmt.order_by(PanicAlert.triggered_at.desc())


async def guard_contacts(
    db: AsyncSession, user_ids: set[uuid.UUID]
) -> dict[uuid.UUID, tuple[str | None, str | None]]:
    """`{user_id: (full_name, phone)}` for display on rosters (one bulk query, no N+1)."""
    if not user_ids:
        return {}
    rows = (
        await db.execute(select(User.id, User.full_name, User.phone).where(User.id.in_(user_ids)))
    ).all()
    return {uid: (name, phone) for uid, name, phone in rows}


async def enrich_alerts(db: AsyncSession, alerts: list[PanicAlert]) -> None:
    """Resolve each alert's reporter name/phone and their active unit (tower, floor, unit
    number) so the guard/supervisor consoles and the resident's own confirmation can show a
    dispatchable address instead of only the free-text `message` (GS-SOS-001/002/003/004).
    Two bulk queries, no N+1; missing/unresolvable data leaves the field `None`.
    """
    if not alerts:
        return
    from app.modules.communities.models import Floor, Tower, Unit
    from app.modules.residents.models import ResidentProfile, UnitOccupancy

    user_ids = {a.triggered_by_user_id for a in alerts if a.triggered_by_user_id}
    contacts = await guard_contacts(db, user_ids)

    unit_by_user: dict[uuid.UUID, tuple[str | None, str | None, int | None]] = {}
    if user_ids:
        rows = (
            await db.execute(
                select(
                    ResidentProfile.user_id,
                    Unit.unit_number,
                    Tower.name,
                    Floor.floor_number,
                )
                .select_from(UnitOccupancy)
                .join(ResidentProfile, ResidentProfile.id == UnitOccupancy.resident_profile_id)
                .join(Unit, Unit.id == UnitOccupancy.unit_id)
                .outerjoin(Tower, Tower.id == Unit.tower_id)
                .outerjoin(Floor, Floor.id == Unit.floor_id)
                .where(
                    ResidentProfile.user_id.in_(user_ids),
                    UnitOccupancy.is_active.is_(True),
                )
                .order_by(UnitOccupancy.is_primary.desc())
            )
        ).all()
        for uid, unit_number, tower_name, floor_number in rows:
            if uid not in unit_by_user:
                unit_by_user[uid] = (unit_number, tower_name, floor_number)

    for a in alerts:
        name, phone = contacts.get(a.triggered_by_user_id, (None, None))
        unit_number, tower_name, floor_number = unit_by_user.get(
            a.triggered_by_user_id, (None, None, None)
        )
        a.reporter_name = name
        a.reporter_phone = phone
        a.unit_number = unit_number
        a.tower_name = tower_name
        a.floor_number = floor_number
