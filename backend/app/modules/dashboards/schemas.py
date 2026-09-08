"""Dashboards schemas (FR-14)."""

from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel


class OverviewStats(BaseModel):
    community_id: uuid.UUID
    residents: int
    units: int
    pending_visitor_requests: int
    visitors_inside: int
    pending_deliveries: int
    open_tickets: int
    open_incidents: int
    outstanding_balance: Decimal


class AdminStats(BaseModel):
    community_id: uuid.UUID
    open_tickets: int
    open_incidents: int
    pending_deliveries: int
    active_panic_alerts: int
    units_occupied: int
    units_vacant: int


class SecurityStats(BaseModel):
    community_id: uuid.UUID
    visitors_inside: int
    vehicles_inside: int
    staff_inside: int
    active_panic_alerts: int
    expected_visitors: int


class FinancialStats(BaseModel):
    community_id: uuid.UUID
    invoices_by_status: dict[str, int]
    total_billed: Decimal
    total_collected: Decimal
    outstanding_balance: Decimal


class ResidentStats(BaseModel):
    community_id: uuid.UUID
    unit_id: uuid.UUID | None
    my_open_tickets: int
    my_pending_visitor_requests: int
    my_upcoming_bookings: int
    my_outstanding_balance: Decimal
    published_announcements: int


# Re-export assistant schemas for backward compatibility
from app.modules.assistant.schemas import (
    AssistantAction,
    AssistantQuickChip,
    AssistantQueryRequest,
    AssistantResponse,
    AssistantQuickActionsResponse,
)

__all__ = [
    "OverviewStats",
    "AdminStats",
    "SecurityStats",
    "FinancialStats",
    "ResidentStats",
    "AssistantAction",
    "AssistantQuickChip",
    "AssistantQueryRequest",
    "AssistantResponse",
    "AssistantQuickActionsResponse",
]
