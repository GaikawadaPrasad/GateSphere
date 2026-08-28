"""Data-access for Delivery Management (FR-07). Queries only. Async (ADR-010)."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import AsyncTenantRepository
from app.modules.deliveries.models import Delivery, DeliveryEvent, DeliveryProtocol


class ProtocolRepository(AsyncTenantRepository[DeliveryProtocol]):
    model = DeliveryProtocol

    async def for_type(
        self, community_id: uuid.UUID, delivery_type: str
    ) -> DeliveryProtocol | None:
        return await self.db.scalar(
            select(DeliveryProtocol).where(
                DeliveryProtocol.community_id == community_id,
                DeliveryProtocol.delivery_type == delivery_type,
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
