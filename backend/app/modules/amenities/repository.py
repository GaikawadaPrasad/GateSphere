"""Data-access for Amenity Booking (FR-11). Queries only."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select

from app.db.repository import TenantRepository
from app.modules.amenities.models import (
    Amenity,
    AmenityBlock,
    AmenityBooking,
    AmenityRule,
    AmenitySlot,
)


class AmenityRepository(TenantRepository[Amenity]):
    model = Amenity

    def by_code(self, community_id: uuid.UUID, code: str) -> Amenity | None:
        return self.db.scalar(
            select(Amenity).where(Amenity.community_id == community_id, Amenity.code == code)
        )

    def lock(self, amenity_id: uuid.UUID) -> Amenity | None:
        return self.db.scalar(select(Amenity).where(Amenity.id == amenity_id).with_for_update())


class SlotRepository(TenantRepository[AmenitySlot]):
    model = AmenitySlot


class RuleRepository(TenantRepository[AmenityRule]):
    model = AmenityRule

    def for_amenity(self, amenity_id: uuid.UUID) -> list[AmenityRule]:
        return list(
            self.db.scalars(
                select(AmenityRule).where(
                    AmenityRule.amenity_id == amenity_id, AmenityRule.is_active.is_(True)
                )
            ).all()
        )

    def match(self, amenity_id: uuid.UUID, rule_type: str) -> AmenityRule | None:
        return self.db.scalar(
            select(AmenityRule).where(
                AmenityRule.amenity_id == amenity_id, AmenityRule.rule_type == rule_type
            )
        )


class BlockRepository(TenantRepository[AmenityBlock]):
    model = AmenityBlock

    def overlapping(
        self, amenity_id: uuid.UUID, start: datetime, end: datetime
    ) -> AmenityBlock | None:
        return self.db.scalar(
            select(AmenityBlock).where(
                AmenityBlock.amenity_id == amenity_id,
                AmenityBlock.blocked_from < end,
                AmenityBlock.blocked_to > start,
            )
        )


class BookingRepository(TenantRepository[AmenityBooking]):
    model = AmenityBooking

    def overlapping_confirmed(
        self, amenity_id: uuid.UUID, start: datetime, end: datetime
    ) -> list[AmenityBooking]:
        return list(
            self.db.scalars(
                select(AmenityBooking).where(
                    AmenityBooking.amenity_id == amenity_id,
                    AmenityBooking.status == "confirmed",
                    AmenityBooking.start_at < end,
                    AmenityBooking.end_at > start,
                )
            ).all()
        )

    def active_count_for_unit(self, amenity_id: uuid.UUID, unit_id: uuid.UUID) -> int:
        return len(
            list(
                self.db.scalars(
                    select(AmenityBooking).where(
                        AmenityBooking.amenity_id == amenity_id,
                        AmenityBooking.unit_id == unit_id,
                        AmenityBooking.status == "confirmed",
                    )
                ).all()
            )
        )
