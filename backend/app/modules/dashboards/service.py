"""Business logic for Dashboards (FR-14).

Read-only aggregates. **Every query is scoped by the viewer's community before aggregation**
— there are no dashboard tables, only counts over the other modules' data. A global caller
must pass `?community_id=`; everyone else is pinned to their own community.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import BusinessRuleError, ForbiddenError
from app.core.tenancy import TenantScope
from app.modules.amenities.models import AmenityBooking
from app.modules.billing.models import MaintenanceInvoice, Payment
from app.modules.communication.models import (
    Announcement,
    AnnouncementTarget,
    ResidentGroupMember,
)
from app.modules.communities.models import Community, Tower, Unit
from app.modules.complaints.models import ServiceTicket
from app.modules.dashboards import schemas
from app.modules.deliveries.models import Delivery
from app.modules.domestic_staff.models import StaffAttendance, StaffUnitAssignment
from app.modules.gate.models import GateAssignment, PanicAlert
from app.modules.incidents.models import SecurityIncident
from app.modules.residents.access import actor_unit_scope
from app.modules.residents.models import ResidentProfile, UnitOccupancy
from app.modules.users.models import Role, User, UserRole
from app.modules.vehicles.models import VehicleEntry
from app.modules.visitors.models import VisitorEntry, VisitorRequest

_OPEN_TICKET = ("created", "assigned", "acknowledged", "in_progress", "resident_confirmation")
_OPEN_INCIDENT = ("reported", "acknowledged", "responding", "contained")


class DashboardService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx

    def _community(self, community_id: uuid.UUID | None) -> uuid.UUID:
        if community_id is not None:
            return self.scope.require(community_id)
        if not self.scope.is_global and len(self.scope.community_ids) == 1:
            return next(iter(self.scope.community_ids))
        raise BusinessRuleError(
            "Specify a community", code="COMMUNITY_REQUIRED", fields={"community_id": "required"}
        )

    async def _count(self, model, *where) -> int:
        return int(await self.db.scalar(select(func.count()).select_from(model).where(*where)) or 0)

    async def _outstanding(self, cid: uuid.UUID, *extra) -> Decimal:
        val = await self.db.scalar(
            select(func.coalesce(func.sum(MaintenanceInvoice.balance_due), 0)).where(
                MaintenanceInvoice.community_id == cid,
                MaintenanceInvoice.status.in_(("posted", "partially_paid", "overdue")),
                *extra,
            )
        )
        return Decimal(val or 0)

    # -- overview ------------------------------------------ #
    async def overview(self, community_id: uuid.UUID | None):
        cid = self._community(community_id)
        from app.modules.dashboards import schemas

        return schemas.OverviewStats(
            community_id=cid,
            residents=await self._count(ResidentProfile, ResidentProfile.community_id == cid),
            units=await self._count(Unit, Unit.community_id == cid),
            pending_visitor_requests=await self._count(
                VisitorRequest,
                VisitorRequest.community_id == cid,
                VisitorRequest.status == "pending",
            ),
            visitors_inside=await self._count(
                VisitorEntry,
                VisitorEntry.community_id == cid,
                VisitorEntry.status == "inside",
            ),
            pending_deliveries=await self._count(
                Delivery, Delivery.community_id == cid, Delivery.approval_status == "pending"
            ),
            open_tickets=await self._count(
                ServiceTicket,
                ServiceTicket.community_id == cid,
                ServiceTicket.status.in_(_OPEN_TICKET),
            ),
            open_incidents=await self._count(
                SecurityIncident,
                SecurityIncident.community_id == cid,
                SecurityIncident.status.in_(_OPEN_INCIDENT),
            ),
            active_panic_alerts=await self._count(
                PanicAlert, PanicAlert.community_id == cid, PanicAlert.status == "active"
            ),
            outstanding_balance=await self._outstanding(cid),
        )

    # -- security ----------------------------------------- #
    async def security(self, community_id: uuid.UUID | None):
        cid = self._community(community_id)
        from app.modules.dashboards import schemas

        return schemas.SecurityStats(
            community_id=cid,
            visitors_inside=await self._count(
                VisitorEntry,
                VisitorEntry.community_id == cid,
                VisitorEntry.status == "inside",
            ),
            vehicles_inside=await self._count(
                VehicleEntry,
                VehicleEntry.community_id == cid,
                VehicleEntry.status == "inside",
            ),
            staff_inside=await self._count(
                StaffAttendance,
                StaffAttendance.community_id == cid,
                StaffAttendance.check_out_at.is_(None),
            ),
            pending_visitor_approvals=await self._count(
                VisitorRequest,
                VisitorRequest.community_id == cid,
                VisitorRequest.status == "pending",
            ),
            expected_visitors=await self._count(
                VisitorRequest,
                VisitorRequest.community_id == cid,
                VisitorRequest.status == "approved",
                (VisitorRequest.valid_until.is_(None))
                | (VisitorRequest.valid_until >= datetime.now(UTC)),
            ),
            active_panic_alerts=await self._count(
                PanicAlert, PanicAlert.community_id == cid, PanicAlert.status == "active"
            ),
            open_incidents=await self._count(
                SecurityIncident,
                SecurityIncident.community_id == cid,
                SecurityIncident.status.in_(_OPEN_INCIDENT),
            ),
            guards_on_active_roster=await self._count(
                GateAssignment,
                GateAssignment.community_id == cid,
                GateAssignment.status == "active",
            ),
        )

    # -- financial --------------------------------------- #
    async def financial(self, community_id: uuid.UUID | None):
        cid = self._community(community_id)
        unit_scope = await actor_unit_scope(self.db, self.actor)
        if unit_scope is not None:
            raise ForbiddenError(
                "Residents cannot access community financial totals", code="PERMISSION_DENIED"
            )
        from app.modules.dashboards import schemas

        by_status = {
            s: int(n)
            for s, n in (
                await self.db.execute(
                    select(MaintenanceInvoice.status, func.count())
                    .where(MaintenanceInvoice.community_id == cid)
                    .group_by(MaintenanceInvoice.status)
                )
            ).all()
        }
        total_billed = await self.db.scalar(
            select(func.coalesce(func.sum(MaintenanceInvoice.total_amount), 0)).where(
                MaintenanceInvoice.community_id == cid,
                MaintenanceInvoice.status != "draft",
            )
        )
        total_collected = await self.db.scalar(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.community_id == cid, Payment.payment_status == "success"
            )
        )
        return schemas.FinancialStats(
            community_id=cid,
            invoices_by_status=by_status,
            total_billed=Decimal(total_billed or 0),
            total_collected=Decimal(total_collected or 0),
            outstanding_balance=await self._outstanding(cid),
        )

    # -- resident --------------------------------------- #
    async def resident(self, community_id: uuid.UUID | None):
        cid = self._community(community_id)
        from app.modules.dashboards import schemas

        occ = await self.db.scalar(
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
        ticket_filter = (
            (ServiceTicket.unit_id == unit_id) | (ServiceTicket.raised_by_user_id == self.actor.id)
            if unit_id
            else (ServiceTicket.raised_by_user_id == self.actor.id)
        )
        my_tickets = await self._count(
            ServiceTicket,
            ServiceTicket.community_id == cid,
            ticket_filter,
            ServiceTicket.status.in_(_OPEN_TICKET),
        )
        if unit_id:
            visitor_filter = (VisitorRequest.unit_id == unit_id) | (
                VisitorRequest.created_by_user_id == self.actor.id
            )
        else:
            visitor_filter = VisitorRequest.created_by_user_id == self.actor.id
        my_reqs = await self._count(
            VisitorRequest,
            VisitorRequest.community_id == cid,
            visitor_filter,
            VisitorRequest.status == "pending",
        )
        booking_filter = (
            (AmenityBooking.unit_id == unit_id) | (AmenityBooking.resident_user_id == self.actor.id)
            if unit_id
            else (AmenityBooking.resident_user_id == self.actor.id)
        )
        my_bookings = await self._count(
            AmenityBooking,
            AmenityBooking.community_id == cid,
            booking_filter,
            AmenityBooking.status == "confirmed",
            (AmenityBooking.end_at >= now) | (AmenityBooking.booking_date >= now.date()),
        )
        my_active_deliveries = await self._count(
            Delivery,
            Delivery.community_id == cid,
            (
                (Delivery.unit_id == unit_id)
                if unit_id
                else (Delivery.resident_user_id == self.actor.id)
            ),
            Delivery.status.in_(("expected", "at_gate", "in_transit")),
        )
        staff_on_duty = 0
        if unit_id:
            staff_on_duty = (
                await self.db.scalar(
                    select(func.count(func.distinct(StaffAttendance.staff_id)))
                    .join(
                        StaffUnitAssignment,
                        StaffUnitAssignment.staff_id == StaffAttendance.staff_id,
                    )
                    .where(
                        StaffAttendance.community_id == cid,
                        StaffAttendance.check_out_at.is_(None),
                        StaffUnitAssignment.unit_id == unit_id,
                        StaffUnitAssignment.is_active.is_(True),
                    )
                )
                or 0
            )

        balance = (
            await self._outstanding(cid, MaintenanceInvoice.unit_id == unit_id)
            if unit_id
            else Decimal(0)
        )
        tower_ids: list[uuid.UUID] = []
        if unit_id:
            t_id = await self.db.scalar(select(Unit.tower_id).where(Unit.id == unit_id))
            if t_id:
                tower_ids.append(t_id)

        grp_ids = list(
            await self.db.scalars(
                select(ResidentGroupMember.group_id).where(
                    ResidentGroupMember.user_id == self.actor.id
                )
            )
        )
        target_match = ~Announcement.targets.any() | Announcement.targets.any(
            AnnouncementTarget.target_all_community.is_(True)
        )
        if unit_id:
            target_match = target_match | Announcement.targets.any(
                AnnouncementTarget.unit_id == unit_id
            )
        if tower_ids:
            target_match = target_match | Announcement.targets.any(
                AnnouncementTarget.tower_id.in_(tower_ids)
            )
        if grp_ids:
            target_match = target_match | Announcement.targets.any(
                AnnouncementTarget.resident_group_id.in_(grp_ids)
            )

        announcements_stmt = select(func.count(Announcement.id)).where(
            Announcement.community_id == cid,
            Announcement.is_published.is_(True),
            target_match,
        )
        announcements = (await self.db.scalar(announcements_stmt)) or 0
        return schemas.ResidentStats(
            community_id=cid,
            unit_id=unit_id,
            my_open_tickets=my_tickets,
            my_pending_visitor_requests=my_reqs,
            my_upcoming_bookings=my_bookings,
            my_outstanding_balance=balance,
            published_announcements=announcements,
            pending_dues_amount=balance,
            pending_visitor_count=my_reqs,
            open_tickets_count=my_tickets,
            staff_on_duty_count=int(staff_on_duty),
            upcoming_amenity_bookings=my_bookings,
            active_deliveries_count=my_active_deliveries,
        )

    async def _resolve_role_category(self) -> str:
        if self.actor.is_superadmin or self.scope.is_global:
            return "super_admin"
        unit_scope = await actor_unit_scope(self.db, self.actor)
        if unit_scope is not None:
            return "resident"
        is_security = bool(
            await self.db.scalar(
                select(UserRole.id)
                .join(Role, Role.id == UserRole.role_id)
                .where(
                    UserRole.user_id == self.actor.id,
                    Role.slug.in_(("security_supervisor", "security_guard")),
                )
                .limit(1)
            )
        )
        if is_security:
            return "security"
        return "admin"

    async def super_admin_stats(
        self, community_id: uuid.UUID | None = None
    ) -> schemas.SuperAdminDashboardStats:
        if not (self.actor.is_superadmin or self.scope.is_global):
            raise ForbiddenError(
                "Only a platform Super Admin can access global platform statistics",
                code="GLOBAL_ONLY",
            )
        if community_id is not None:
            community = await self.db.get(Community, community_id)
            if not community:
                raise BusinessRuleError("Community not found", code="COMMUNITY_NOT_FOUND")
            communities = [community]
        else:
            communities = (
                await self.db.scalars(select(Community).order_by(Community.created_at.desc()))
            ).all()

        total_comm = len(communities)
        active_comm = [c for c in communities if c.is_active]
        active_comm_count = len(active_comm)
        inactive_comm_count = total_comm - active_comm_count

        # 1. Total units and units per community
        unit_query = select(Unit.community_id, func.count()).group_by(Unit.community_id)
        if community_id is not None:
            unit_query = unit_query.where(Unit.community_id == community_id)
        unit_counts_res = (await self.db.execute(unit_query)).all()
        units_by_comm = {str(cid): cnt for cid, cnt in unit_counts_res if cid}
        total_units = sum(units_by_comm.values())

        # 2. Total residents and residents per community
        res_query = select(ResidentProfile.community_id, func.count()).group_by(
            ResidentProfile.community_id
        )
        if community_id is not None:
            res_query = res_query.where(ResidentProfile.community_id == community_id)
        res_counts_res = (await self.db.execute(res_query)).all()
        res_by_comm = {str(cid): cnt for cid, cnt in res_counts_res if cid}
        total_residents = sum(res_by_comm.values())

        # 3. Towers per community
        tower_query = select(Tower.community_id, func.count()).group_by(Tower.community_id)
        if community_id is not None:
            tower_query = tower_query.where(Tower.community_id == community_id)
        tower_counts_res = (await self.db.execute(tower_query)).all()
        towers_by_comm = {str(cid): cnt for cid, cnt in tower_counts_res if cid}

        # 4. Open complaints / tickets per community
        ticket_query = (
            select(ServiceTicket.community_id, func.count())
            .where(ServiceTicket.status.in_(_OPEN_TICKET))
            .group_by(ServiceTicket.community_id)
        )
        if community_id is not None:
            ticket_query = ticket_query.where(ServiceTicket.community_id == community_id)
        ticket_counts_res = (await self.db.execute(ticket_query)).all()
        tickets_by_comm = {str(cid): cnt for cid, cnt in ticket_counts_res if cid}
        total_open_tickets = sum(tickets_by_comm.values())

        # 5. Critical complaints
        crit_filters = [
            ServiceTicket.status.in_(_OPEN_TICKET),
            ServiceTicket.priority == "critical",
        ]
        if community_id is not None:
            crit_filters.append(ServiceTicket.community_id == community_id)
        critical_complaints = await self._count(ServiceTicket, *crit_filters)

        # 6. Active gate traffic
        traffic_comm_filter = [VisitorEntry.community_id == community_id] if community_id else []
        veh_comm_filter = [VehicleEntry.community_id == community_id] if community_id else []
        staff_comm_filter = [StaffAttendance.community_id == community_id] if community_id else []

        visitors_inside = await self._count(
            VisitorEntry, VisitorEntry.status == "inside", *traffic_comm_filter
        )
        vehicles_inside = await self._count(
            VehicleEntry, VehicleEntry.status == "inside", *veh_comm_filter
        )
        staff_inside = await self._count(
            StaffAttendance, StaffAttendance.check_out_at.is_(None), *staff_comm_filter
        )
        active_gate_traffic = visitors_inside + vehicles_inside + staff_inside

        # 7. Open incidents and panic alerts
        inc_filters = [SecurityIncident.status.in_(_OPEN_INCIDENT)]
        if community_id is not None:
            inc_filters.append(SecurityIncident.community_id == community_id)
        open_incidents = await self._count(SecurityIncident, *inc_filters)

        panic_filters = [PanicAlert.status == "active"]
        if community_id is not None:
            panic_filters.append(PanicAlert.community_id == community_id)
        active_panic_alerts = await self._count(PanicAlert, *panic_filters)

        # 8. Financials
        billed_query = (
            select(
                MaintenanceInvoice.community_id,
                func.coalesce(func.sum(MaintenanceInvoice.total_amount), 0),
            )
            .where(MaintenanceInvoice.status != "draft")
            .group_by(MaintenanceInvoice.community_id)
        )
        if community_id is not None:
            billed_query = billed_query.where(MaintenanceInvoice.community_id == community_id)
        billed_by_comm_res = (await self.db.execute(billed_query)).all()
        billed_by_comm = {str(cid): val for cid, val in billed_by_comm_res if cid}
        total_billed = sum(billed_by_comm.values()) if billed_by_comm else Decimal(0)

        collected_query = (
            select(Payment.community_id, func.coalesce(func.sum(Payment.amount), 0))
            .where(Payment.payment_status == "success")
            .group_by(Payment.community_id)
        )
        if community_id is not None:
            collected_query = collected_query.where(Payment.community_id == community_id)
        collected_by_comm_res = (await self.db.execute(collected_query)).all()
        collected_by_comm = {str(cid): val for cid, val in collected_by_comm_res if cid}
        total_collected = sum(collected_by_comm.values()) if collected_by_comm else Decimal(0)

        out_query = (
            select(
                MaintenanceInvoice.community_id,
                func.coalesce(func.sum(MaintenanceInvoice.balance_due), 0),
            )
            .where(MaintenanceInvoice.status.in_(("posted", "partially_paid", "overdue")))
            .group_by(MaintenanceInvoice.community_id)
        )
        if community_id is not None:
            out_query = out_query.where(MaintenanceInvoice.community_id == community_id)
        outstanding_by_comm_res = (await self.db.execute(out_query)).all()
        outstanding_by_comm = {str(cid): val for cid, val in outstanding_by_comm_res if cid}
        total_outstanding = sum(outstanding_by_comm.values()) if outstanding_by_comm else Decimal(0)

        community_breakdown: dict[str, schemas.CommunityBreakdownItem] = {}
        for c in communities:
            cid_str = str(c.id)
            c_units = units_by_comm.get(cid_str, 0)
            c_res = res_by_comm.get(cid_str, 0)
            c_occ = round((c_res / c_units) * 100) if c_units > 0 else 0
            c_towers = towers_by_comm.get(cid_str, 0)
            c_tickets = tickets_by_comm.get(cid_str, 0)
            c_billed = float(billed_by_comm.get(cid_str, 0))
            c_out = float(outstanding_by_comm.get(cid_str, 0))
            fin_status = "Good"
            if c_billed > 0:
                ratio = c_out / c_billed
                if ratio > 0.4:
                    fin_status = "Critical"
                elif ratio > 0.15:
                    fin_status = "Attention"

            community_breakdown[cid_str] = schemas.CommunityBreakdownItem(
                totalUnits=c_units,
                totalResidents=c_res,
                occupancyRate=c_occ,
                totalTowers=c_towers,
                financialStatus=fin_status,
                openTickets=c_tickets,
            )

        occupancy_rate = round((total_residents / total_units) * 100) if total_units > 0 else 0
        collection_rate = (
            round((float(total_collected) / float(total_billed)) * 100) if total_billed > 0 else 0
        )

        return schemas.SuperAdminDashboardStats(
            totalCommunities=total_comm,
            activeCommunities=active_comm_count,
            inactiveCommunities=inactive_comm_count,
            totalUnits=total_units,
            totalResidents=total_residents,
            occupancyRate=occupancy_rate,
            activeGateTraffic=active_gate_traffic,
            visitorsInside=visitors_inside,
            vehiclesInside=vehicles_inside,
            staffInside=staff_inside,
            openComplaints=total_open_tickets,
            criticalComplaints=critical_complaints,
            activePanicAlerts=active_panic_alerts,
            openIncidents=open_incidents,
            totalBilled=Decimal(total_billed),
            totalCollected=Decimal(total_collected),
            totalOutstanding=Decimal(total_outstanding),
            collectionRate=collection_rate,
            communityBreakdown=community_breakdown,
        )

    # -- assistant / chatbot (backward-compatible delegate) --- #
    async def assistant_quick_actions(self, community_id: uuid.UUID | None):
        from app.modules.assistant.service import AssistantService

        svc = AssistantService(self.db, self.scope, self.actor, self.ctx)
        return await svc.quick_actions(community_id)

    async def assistant_query(self, community_id: uuid.UUID | None, query: str):
        from app.modules.assistant.service import AssistantService

        svc = AssistantService(self.db, self.scope, self.actor, self.ctx)
        return await svc.query(community_id, query)
