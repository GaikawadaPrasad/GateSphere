"""Data-access for Delivery Management (FR-07). Queries only. Async (ADR-010)."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import AsyncTenantRepository
from app.modules.deliveries.models import Delivery, DeliveryEvent, DeliveryProtocol


class ProtocolRepository(AsyncTenantRepository[DeliveryProtocol]):
    model = DeliveryProtocol

    async def for_type(
        self, community_id: uuid.UUID, delivery_type: str, unit_id: uuid.UUID | None = None
    ) -> DeliveryProtocol | None:
        if unit_id is not None:
            unit_proto = await self.db.scalar(
                select(DeliveryProtocol).where(
                    DeliveryProtocol.community_id == community_id,
                    DeliveryProtocol.delivery_type == delivery_type,
                    DeliveryProtocol.unit_id == unit_id,
                )
            )
            if unit_proto is not None:
                return unit_proto
        return await self.db.scalar(
            select(DeliveryProtocol).where(
                DeliveryProtocol.community_id == community_id,
                DeliveryProtocol.delivery_type == delivery_type,
                DeliveryProtocol.unit_id.is_(None),
            )
        )


class DeliveryRepository(AsyncTenantRepository[Delivery]):
    model = Delivery


async def delivery_events(db, delivery_id: uuid.UUID) -> list[DeliveryEvent]:
    return list(
        (
            await db.scalars(
                select(DeliveryEvent)
                .where(DeliveryEvent.delivery_id == delivery_id)
                .order_by(DeliveryEvent.occurred_at)
            )
        ).all()
    )
