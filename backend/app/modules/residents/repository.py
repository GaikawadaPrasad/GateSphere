"""Data-access for Residents (FR-03). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import TenantRepository
from app.modules.residents.models import (
    EmergencyContact,
    FamilyMember,
    MoveRecord,
    ResidentProfile,
    UnitOccupancy,
)


class ResidentProfileRepository(TenantRepository[ResidentProfile]):
    model = ResidentProfile

    def by_user(self, community_id: uuid.UUID, user_id: uuid.UUID) -> ResidentProfile | None:
        return self.db.scalar(
            select(ResidentProfile).where(
                ResidentProfile.community_id == community_id, ResidentProfile.user_id == user_id
            )
        )


class OccupancyRepository(TenantRepository[UnitOccupancy]):
    model = UnitOccupancy

    def active_for_unit(self, unit_id: uuid.UUID) -> list[UnitOccupancy]:
        return list(
            self.db.scalars(
                select(UnitOccupancy).where(
                    UnitOccupancy.unit_id == unit_id, UnitOccupancy.is_active.is_(True)
                )
            ).all()
        )

    def active_for_pair(
        self, unit_id: uuid.UUID, resident_profile_id: uuid.UUID
    ) -> UnitOccupancy | None:
        return self.db.scalar(
            select(UnitOccupancy).where(
                UnitOccupancy.unit_id == unit_id,
                UnitOccupancy.resident_profile_id == resident_profile_id,
                UnitOccupancy.is_active.is_(True),
            )
        )


class FamilyMemberRepository(TenantRepository[FamilyMember]):
    model = FamilyMember


class EmergencyContactRepository(TenantRepository[EmergencyContact]):
    model = EmergencyContact


class MoveRecordRepository(TenantRepository[MoveRecord]):
    model = MoveRecord
