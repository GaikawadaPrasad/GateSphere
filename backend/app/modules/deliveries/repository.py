"""Data-access for Delivery Management (FR-07). Queries only."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.db.repository import TenantRepository
from app.modules.deliveries.models import Delivery, DeliveryEvent, DeliveryProtocol


class ProtocolRepository(TenantRepository[DeliveryProtocol]):
    model = DeliveryProtocol

    def for_type(self, community_id: uuid.UUID, delivery_type: str) -> DeliveryProtocol | None:
        return self.db.scalar(
            select(DeliveryProtocol).where(
                DeliveryProtocol.community_id == community_id,
                DeliveryProtocol.delivery_type == delivery_type,
            )
        )


class DeliveryRepository(TenantRepository[Delivery]):
    model = Delivery


def delivery_events(db, delivery_id: uuid.UUID) -> list[DeliveryEvent]:
    return list(
        db.scalars(
            select(DeliveryEvent)
            .where(DeliveryEvent.delivery_id == delivery_id)
            .order_by(DeliveryEvent.occurred_at)
        ).all()
    )
