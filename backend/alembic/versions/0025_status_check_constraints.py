"""Data integrity: CHECK constraints pinning every lifecycle status column to its
enumerated value set (AGENTS.md §8 — "encode invariants as DB constraints too").

Before this, only `community_invitations.status` had a CHECK; a bug or bad migration
could persist an impossible state on any of ~25 other status columns. Values are the
`ALLOWED`/`*_STATUS` sets the service layer already enforces.

Revision ID: 0025_status_check_constraints
Revises: 0024_multi_role_sessions
Create Date: 2026-08-31
"""

from __future__ import annotations

from alembic import op

revision = "0025_status_check_constraints"
down_revision = "0024_multi_role_sessions"
branch_labels = None
depends_on = None

# table -> (column, {allowed values})
_CHECKS: dict[str, tuple[str, tuple[str, ...]]] = {
    "visitor_requests": (
        "status",
        ("pending", "approved", "rejected", "cancelled", "expired", "entered", "completed"),
    ),
    "visitor_entries": ("status", ("inside", "exited", "denied")),
    "guard_rosters": ("status", ("planned", "active", "completed", "cancelled")),
    "gate_assignments": ("status", ("active", "ended")),
    "panic_alerts": ("status", ("active", "acknowledged", "resolved", "cancelled")),
    "deliveries": (
        "status",
        ("expected", "in_transit", "at_gate", "delivered", "collected", "returned", "cancelled"),
    ),
    "amenity_bookings": ("status", ("confirmed", "cancelled", "completed", "no_show")),
    "maintenance_invoices": (
        "status",
        ("draft", "posted", "partially_paid", "paid", "overdue", "cancelled"),
    ),
    "payments": ("payment_status", ("pending", "success", "failed", "refunded")),
    "service_tickets": (
        "status",
        (
            "created",
            "assigned",
            "acknowledged",
            "in_progress",
            "resolved",
            "resident_confirmation",
            "closed",
            "reopened",
            "cancelled",
        ),
    ),
    "security_incidents": (
        "status",
        (
            "reported",
            "acknowledged",
            "responding",
            "contained",
            "resolved",
            "closed",
            "false_alarm",
        ),
    ),
    "parking_slots": ("status", ("available", "allocated", "reserved", "blocked")),
    "parking_allocations": ("status", ("active", "released")),
    "parking_violations": ("status", ("open", "acknowledged", "resolved", "waived")),
    "staff_attendance": ("attendance_status", ("inside", "left", "absent")),
    "domestic_staff": (
        "police_verification_status",
        ("not_started", "pending", "verified", "rejected", "expired"),
    ),
    "resident_profiles": ("profile_status", ("pending", "active", "suspended", "moved_out")),
    "move_records": (
        "status",
        ("requested", "scheduled", "approved", "completed", "rejected", "cancelled"),
    ),
    "polls": ("status", ("draft", "open", "closed")),
    "managed_files": ("status", ("pending", "confirmed", "rejected")),
    "notification_deliveries": (
        "status",
        ("queued", "sent", "delivered", "failed", "skipped"),
    ),
    "vehicle_entries": ("status", ("inside", "exited")),
}

# separate columns on service_tickets / resident_profiles
_EXTRA: list[tuple[str, str, tuple[str, ...]]] = [
    ("service_tickets", "resident_confirmation_status", ("pending", "confirmed", "disputed")),
    ("service_tickets", "escalation_state", ("on_track", "at_risk", "breached", "escalated")),
    ("resident_profiles", "kyc_status", ("not_started", "submitted", "verified", "rejected")),
    ("deliveries", "approval_status", ("pending", "approved", "auto_approved", "rejected")),
]


def _name(table: str, col: str) -> str:
    return f"ck_{table}_{col}_valid"


def upgrade() -> None:
    items = [(t, c, vals) for t, (c, vals) in _CHECKS.items()] + _EXTRA
    for table, col, vals in items:
        listed = ", ".join(f"'{v}'" for v in vals)
        op.create_check_constraint(_name(table, col), table, f"{col} IN ({listed})")


def downgrade() -> None:
    items = [(t, c) for t, (c, _v) in _CHECKS.items()] + [(t, c) for t, c, _v in _EXTRA]
    for table, col in items:
        op.drop_constraint(_name(table, col), table, type_="check")
