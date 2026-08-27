"""Business logic for Dashboards (FR-14).

Read-only aggregates. **Every query is scoped by the viewer's community before aggregation**
— there are no dashboard tables, only counts over the other modules' data. A global caller
must pass `?community_id=`; everyone else is pinned to their own community.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError
from app.core.tenancy import TenantScope
from app.modules.amenities.models import AmenityBooking
from app.modules.billing.models import MaintenanceInvoice, Payment
from app.modules.communication.models import Announcement
from app.modules.communities.models import Unit
from app.modules.complaints.models import ServiceTicket
from app.modules.deliveries.models import Delivery
from app.modules.domestic_staff.models import StaffAttendance
from app.modules.gate.models import GateAssignment, PanicAlert
from app.modules.incidents.models import SecurityIncident
from app.modules.residents.models import ResidentProfile, UnitOccupancy
from app.modules.users.models import User
from app.modules.vehicles.models import VehicleEntry
from app.modules.visitors.models import VisitorEntry, VisitorRequest

_OPEN_TICKET = ("created", "assigned", "acknowledged", "in_progress", "resident_confirmation")
_OPEN_INCIDENT = ("reported", "acknowledged", "responding", "contained")


class DashboardService:
    def __init__(
        self, db: Session, scope: TenantScope, actor: User, request: Request | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.request = request

    def _community(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is not None:
            return self.scope.require(community_id)
        if not self.scope.is_global and len(self.scope.community_ids) == 1:
            return next(iter(self.scope.community_ids))
        raise BusinessRuleError(
            "Specify a community", code="COMMUNITY_REQUIRED", fields={"community_id": "required"}
        )

    def _count(self, model, *where) -> int:
        return int(self.db.scalar(select(func.count()).select_from(model).where(*where)) or 0)

    def _outstanding(self, cid: uuid.UUID, *extra) -> Decimal:
        val = self.db.scalar(
            select(func.coalesce(func.sum(MaintenanceInvoice.balance_due), 0)).where(
                MaintenanceInvoice.community_id == cid,
                MaintenanceInvoice.status.in_(("posted", "partially_paid", "overdue")),
                *extra,
            )
        )
        return Decimal(val or 0)

    # -- overview ------------------------------------------ #
    def overview(self, community_id: uuid.UUID | None):
        cid = self._community(community_id)
        from app.modules.dashboards import schemas

        return schemas.OverviewStats(
            community_id=cid,
            residents=self._count(ResidentProfile, ResidentProfile.community_id == cid),
            units=self._count(Unit, Unit.community_id == cid),
            pending_visitor_requests=self._count(
                VisitorRequest,
                VisitorRequest.community_id == cid,
                VisitorRequest.status == "pending",
            ),
            visitors_inside=self._count(
                VisitorEntry,
                VisitorEntry.community_id == cid,
                VisitorEntry.status == "inside",
            ),
            pending_deliveries=self._count(
                Delivery, Delivery.community_id == cid, Delivery.approval_status == "pending"
            ),
            open_tickets=self._count(
                ServiceTicket,
                ServiceTicket.community_id == cid,
                ServiceTicket.status.in_(_OPEN_TICKET),
            ),
            open_incidents=self._count(
                SecurityIncident,
                SecurityIncident.community_id == cid,
                SecurityIncident.status.in_(_OPEN_INCIDENT),
            ),
            active_panic_alerts=self._count(
                PanicAlert, PanicAlert.community_id == cid, PanicAlert.status == "active"
            ),
            outstanding_balance=self._outstanding(cid),
        )

    # -- security ----------------------------------------- #
    def security(self, community_id: uuid.UUID | None):
        cid = self._community(community_id)
        from app.modules.dashboards import schemas

        return schemas.SecurityStats(
            community_id=cid,
            visitors_inside=self._count(
                VisitorEntry,
                VisitorEntry.community_id == cid,
                VisitorEntry.status == "inside",
            ),
            vehicles_inside=self._count(
                VehicleEntry,
                VehicleEntry.community_id == cid,
                VehicleEntry.status == "inside",
            ),
            staff_inside=self._count(
                StaffAttendance,
                StaffAttendance.community_id == cid,
                StaffAttendance.check_out_at.is_(None),
            ),
            pending_visitor_approvals=self._count(
                VisitorRequest,
                VisitorRequest.community_id == cid,
                VisitorRequest.status == "pending",
            ),
            active_panic_alerts=self._count(
                PanicAlert, PanicAlert.community_id == cid, PanicAlert.status == "active"
            ),
            open_incidents=self._count(
                SecurityIncident,
                SecurityIncident.community_id == cid,
                SecurityIncident.status.in_(_OPEN_INCIDENT),
            ),
            guards_on_active_roster=self._count(
                GateAssignment,
                GateAssignment.community_id == cid,
                GateAssignment.status == "active",
            ),
        )

    # -- financial --------------------------------------- #
    def financial(self, community_id: uuid.UUID | None):
        cid = self._community(community_id)
        from app.modules.dashboards import schemas

        by_status = {
            s: int(n)
            for s, n in self.db.execute(
                select(MaintenanceInvoice.status, func.count())
                .where(MaintenanceInvoice.community_id == cid)
                .group_by(MaintenanceInvoice.status)
            ).all()
        }
        total_billed = self.db.scalar(
            select(func.coalesce(func.sum(MaintenanceInvoice.total_amount), 0)).where(
                MaintenanceInvoice.community_id == cid,
                MaintenanceInvoice.status != "draft",
            )
        )
        total_collected = self.db.scalar(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.community_id == cid, Payment.payment_status == "success"
            )
        )
        return schemas.FinancialStats(
            community_id=cid,
            invoices_by_status=by_status,
            total_billed=Decimal(total_billed or 0),
            total_collected=Decimal(total_collected or 0),
            outstanding_balance=self._outstanding(cid),
        )

    # -- resident --------------------------------------- #
    def resident(self, community_id: uuid.UUID | None):
        cid = self._community(community_id)
        from app.modules.dashboards import schemas

        occ = self.db.scalar(
            select(UnitOccupancy)
            .join(ResidentProfile, ResidentProfile.id == UnitOccupancy.resident_profile_id)
            .where(
                ResidentProfile.user_id == self.actor.id,
                ResidentProfile.community_id == cid,
                UnitOccupancy.is_active.is_(True),
            )
            .order_by(UnitOccupancy.is_primary.desc())
        )
        unit_id = occ.unit_id if occ else None
        now = datetime.now(UTC)
        my_tickets = self._count(
            ServiceTicket,
            ServiceTicket.community_id == cid,
            ServiceTicket.raised_by_user_id == self.actor.id,
            ServiceTicket.status.in_(_OPEN_TICKET),
        )
        my_reqs = self._count(
            VisitorRequest,
            VisitorRequest.community_id == cid,
            VisitorRequest.created_by_user_id == self.actor.id,
            VisitorRequest.status == "pending",
        )
        my_bookings = self._count(
            AmenityBooking,
            AmenityBooking.community_id == cid,
            AmenityBooking.resident_user_id == self.actor.id,
            AmenityBooking.status == "confirmed",
            AmenityBooking.start_at >= now,
        )
        return schemas.ResidentStats(
            community_id=cid,
            unit_id=unit_id,
            my_open_tickets=my_tickets,
            my_pending_visitor_requests=my_reqs,
            my_upcoming_bookings=my_bookings,
            my_outstanding_balance=(
                self._outstanding(cid, MaintenanceInvoice.unit_id == unit_id)
                if unit_id
                else Decimal(0)
            ),
            published_announcements=self._count(
                Announcement,
                Announcement.community_id == cid,
                Announcement.is_published.is_(True),
            ),
        )
