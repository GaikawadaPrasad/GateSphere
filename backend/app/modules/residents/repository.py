"""Data-access for Residents (FR-03). Queries only. Async stack (ADR-010)."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import AsyncTenantRepository
from app.modules.residents.models import (
    EmergencyContact,
    FamilyMember,
    MoveRecord,
    ResidentProfile,
    UnitOccupancy,
)


class ResidentProfileRepository(AsyncTenantRepository[ResidentProfile]):
    model = ResidentProfile

    async def by_user(self, community_id: uuid.UUID, user_id: uuid.UUID) -> ResidentProfile | None:
        return await self.db.scalar(
            select(ResidentProfile).where(
                ResidentProfile.community_id == community_id, ResidentProfile.user_id == user_id
            )
        )


class OccupancyRepository(AsyncTenantRepository[UnitOccupancy]):
    model = UnitOccupancy

    async def active_for_unit(self, unit_id: uuid.UUID) -> list[UnitOccupancy]:
        return list(
            (
                await self.db.scalars(
                    select(UnitOccupancy).where(
                        UnitOccupancy.unit_id == unit_id, UnitOccupancy.is_active.is_(True)
                    )
                )
            ).all()
        )

    async def active_for_pair(
        self, unit_id: uuid.UUID, resident_profile_id: uuid.UUID
    ) -> UnitOccupancy | None:
        return await self.db.scalar(
            select(UnitOccupancy).where(
                UnitOccupancy.unit_id == unit_id,
                UnitOccupancy.resident_profile_id == resident_profile_id,
                UnitOccupancy.is_active.is_(True),
            )
        )


class FamilyMemberRepository(AsyncTenantRepository[FamilyMember]):
    model = FamilyMember


class EmergencyContactRepository(AsyncTenantRepository[EmergencyContact]):
    model = EmergencyContact


class MoveRecordRepository(AsyncTenantRepository[MoveRecord]):
    model = MoveRecord
