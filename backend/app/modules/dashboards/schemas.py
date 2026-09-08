"""Pydantic response models for Dashboards (FR-14). Read-only aggregates."""

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
    active_panic_alerts: int
    outstanding_balance: Decimal


class SecurityStats(BaseModel):
    community_id: uuid.UUID
    visitors_inside: int
    vehicles_inside: int
    staff_inside: int
    pending_visitor_approvals: int
    expected_visitors: int  # approved, still valid, not yet entered (FR-14)
    active_panic_alerts: int
    open_incidents: int
    guards_on_active_roster: int


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
<<<<<<< Updated upstream
=======


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


<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
