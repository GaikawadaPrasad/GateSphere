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
        my_tickets = await self._count(
            ServiceTicket,
            ServiceTicket.community_id == cid,
            ServiceTicket.raised_by_user_id == self.actor.id,
            ServiceTicket.status.in_(_OPEN_TICKET),
        )
        my_reqs = await self._count(
            VisitorRequest,
            VisitorRequest.community_id == cid,
            VisitorRequest.created_by_user_id == self.actor.id,
            VisitorRequest.status == "pending",
        )
        my_bookings = await self._count(
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
                await self._outstanding(cid, MaintenanceInvoice.unit_id == unit_id)
                if unit_id
                else Decimal(0)
            ),
            published_announcements=await self._count(
                Announcement,
                Announcement.community_id == cid,
                Announcement.is_published.is_(True),
            ),
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

    # -- assistant / chatbot ----------------------------- #
    async def assistant_quick_actions(
        self, community_id: uuid.UUID | None
    ) -> schemas.AssistantQuickActionsResponse:
        cid = self._community(community_id)
        from app.modules.dashboards import schemas

        role_cat = await self._resolve_role_category()

        if role_cat == "resident":
            chips = [
                schemas.AssistantQuickChip(
                    id="dues", icon="credit-card", label="My Maintenance Dues", query="my dues"
                ),
                schemas.AssistantQuickChip(
                    id="pass", icon="user-plus", label="Create Visitor Pass", query="visitor pass"
                ),
                schemas.AssistantQuickChip(
                    id="complaint", icon="tool", label="Report Issue / Leak", query="raise complaint"
                ),
                schemas.AssistantQuickChip(
                    id="amenities", icon="calendar", label="Gym & Pool Timings", query="pool gym timings"
                ),
                schemas.AssistantQuickChip(
                    id="emergency", icon="phone", label="Emergency Contacts", query="emergency security contact"
                ),
            ]
            suggested = [
                "What are my outstanding dues?",
                "How do I create a guest pass?",
                "How do I report a plumbing issue?",
                "What are the swimming pool timings?",
            ]
            greeting = f"👋 Hello {self.actor.full_name}! Hope you're having a wonderful day. I am your Resident Assistant. How can I help you today?"
        elif role_cat == "security":
            chips = [
                schemas.AssistantQuickChip(
                    id="gate", icon="shield", label="Live Gate Traffic", query="gate traffic"
                ),
                schemas.AssistantQuickChip(
                    id="panic", icon="alert-triangle", label="Active Panic Alerts", query="panic alerts"
                ),
                schemas.AssistantQuickChip(
                    id="staff", icon="users", label="Staff Attendance", query="staff attendance"
                ),
                schemas.AssistantQuickChip(
                    id="blacklist", icon="slash", label="Visitor Blacklist", query="blacklist"
                ),
                schemas.AssistantQuickChip(
                    id="emergency", icon="phone", label="Gate Checkpoints", query="emergency security contact"
                ),
            ]
            suggested = [
                "How many visitors and vehicles are inside?",
                "Are there any active panic alerts?",
                "How many domestic staff are on-duty?",
                "Show gate emergency contacts",
            ]
            greeting = f"🛡️ Welcome Officer {self.actor.full_name}! GateSphere Security Assistant at your service. How can I assist gate operations today?"
        elif role_cat == "super_admin":
            chips = [
                schemas.AssistantQuickChip(
                    id="communities", icon="grid", label="Communities Overview", query="communities overview"
                ),
                schemas.AssistantQuickChip(
                    id="financial", icon="dollar-sign", label="Global Financials", query="collection summary"
                ),
                schemas.AssistantQuickChip(
                    id="traffic", icon="activity", label="Platform Gate Traffic", query="gate traffic"
                ),
                schemas.AssistantQuickChip(
                    id="tickets", icon="tool", label="Open Complaints", query="open tickets"
                ),
            ]
            suggested = [
                "Show platform-wide collection summary",
                "How many total visitors are active across communities?",
                "Show total open complaints across platform",
            ]
            greeting = f"🌐 Welcome Super Admin {self.actor.full_name}! GateSphere Global Platform Assistant at your service."
        else:
            chips = [
                schemas.AssistantQuickChip(
                    id="tickets", icon="tool", label="Open Complaints", query="open tickets"
                ),
                schemas.AssistantQuickChip(
                    id="financial", icon="dollar-sign", label="Financial Overview", query="collection summary"
                ),
                schemas.AssistantQuickChip(
                    id="gate", icon="shield", label="Live Gate Traffic", query="gate traffic"
                ),
                schemas.AssistantQuickChip(
                    id="staff", icon="users", label="Staff Attendance", query="staff attendance"
                ),
                schemas.AssistantQuickChip(
                    id="panic", icon="alert-triangle", label="Active Panic Alerts", query="panic alerts"
                ),
            ]
            suggested = [
                "Show open complaints by priority",
                "Show collection and dues summary",
                "How many visitors are inside right now?",
                "Are there any active panic alerts?",
            ]
            greeting = f"🏢 Welcome {self.actor.full_name}! GateSphere Community Admin Assistant at your service. How can I assist your community management today?"

        return schemas.AssistantQuickActionsResponse(
            community_id=cid, greeting=greeting, chips=chips, suggested_queries=suggested
        )


    async def assistant_query(
        self, community_id: uuid.UUID | None, query: str
    ) -> schemas.AssistantResponse:
        cid = self._community(community_id)
        from app.modules.dashboards import schemas

        q = query.lower().strip()
        words = set(q.split())

        def match(terms: tuple[str, ...]) -> bool:
            for t in terms:
                if " " in t and t in q:
                    return True
                if t in words:
                    return True
                if len(t) >= 5 and t in q:
                    return True
            return False

        # 1. Billing / Maintenance Dues
        if match(("due", "dues", "bill", "bills", "invoice", "invoices", "payment", "payments", "maintenance", "pay", "balance", "fee")):
            # check resident unit balance
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
            if occ and occ.unit_id:
                balance = await self._outstanding(cid, MaintenanceInvoice.unit_id == occ.unit_id)
                reply = (
                    f"Your current outstanding maintenance balance is ₹{balance:,.2f}. "
                    "Maintenance invoices are generated monthly on the 1st with a 15-day grace period."
                )
            else:
                total_out = await self._outstanding(cid)
                reply = (
                    f"The total outstanding maintenance balance for this community is ₹{total_out:,.2f}. "
                    "You can manage flat-wise invoices and payment receipts in the Billing section."
                )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="billing",
                actions=[
                    schemas.AssistantAction(label="View Invoices & Pay", url="/billing"),
                    schemas.AssistantAction(label="Payment History", url="/billing/payments"),
                ],
                related_faqs=[
                    "When is maintenance due each month?",
                    "What payment methods are supported?",
                ],
            )

        # 2. Visitors / Passes / Guests / Cab
        if match(("visitor", "visitors", "guest", "guests", "cab", "uber", "visitor pass", "guest pass", "entry pass")):
            pending_reqs = await self._count(
                VisitorRequest,
                VisitorRequest.community_id == cid,
                VisitorRequest.created_by_user_id == self.actor.id,
                VisitorRequest.status == "pending",
            )
            inside = await self._count(
                VisitorEntry,
                VisitorEntry.community_id == cid,
                VisitorEntry.status == "inside",
            )
            reply = (
                f"You have {pending_reqs} visitor request(s) awaiting approval. "
                f"Currently, there are {inside} visitor(s) inside the premises. "
                "You can generate time-limited OTP/QR visitor passes or approve gate arrival requests."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="visitors",
                actions=[
                    schemas.AssistantAction(label="Create Visitor Pass", url="/visitors/new"),
                    schemas.AssistantAction(label="View Visitor Log", url="/visitors"),
                ],
                related_faqs=[
                    "How long is a visitor pass valid?",
                    "How do delivery gate protocols work?",
                ],
            )

        # 3. Deliveries & Gate Delivery Protocols
        if match(("delivery", "deliveries", "courier", "swiggy", "zomato", "amazon", "blinkit", "parcel", "parcels", "gate desk", "package", "food")):
            reply = (
                "📦 **Delivery Management & Gate Protocols:**\n"
                "You can configure how delivery executives are handled for your unit:\n"
                "1. **Allow at Gate**: Guard sends you an instant mobile approval prompt.\n"
                "2. **Leave at Gate Desk**: Parcel is safely tagged and kept at the main gate desk for collection.\n"
                "3. **Pre-Approved**: Executive is allowed direct doorstep access.\n"
                "4. **Direct Rejection**: Delivery is turned away without disturbing you.\n\n"
                "Gate desk collection hours: 7:00 AM – 11:00 PM daily."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="deliveries",
                actions=[
                    schemas.AssistantAction(label="Configure Delivery Rules", url="/deliveries"),
                    schemas.AssistantAction(label="View Gate Deliveries", url="/deliveries"),
                ],
                related_faqs=[
                    "How do I collect parcels left at the gate desk?",
                    "Can food delivery come directly to my door?",
                ],
            )

        # 4. Vehicles, Parking & EV Charging
        if match(("parking", "vehicle", "vehicles", "car", "cars", "bike", "bikes", "slot", "slots", "ev", "charging", "unauthorized", "wrong parking", "bay", "bays")):
            reply = (
                "🚗 **Vehicles, Parking & EV Charging Guidelines:**\n"
                "• **Resident Parking**: Each unit is allocated designated numbered bay(s). Ensure your RFID/fast-tag sticker is affixed.\n"
                "• **Guest Parking**: Free visitor parking bays are available near Tower A & B basements (Max stay: 8 hours).\n"
                "• **EV Charging**: 6 fast EV charging points are operational in Basement 1 (B1-EV01 to B1-EV06).\n"
                "• **Unauthorized Parking**: If an unknown vehicle is parked in your slot, report it immediately to security."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="vehicles",
                actions=[
                    schemas.AssistantAction(label="My Registered Vehicles", url="/vehicles"),
                    schemas.AssistantAction(label="Report Parking Violation", url="/vehicles/violations"),
                ],
                related_faqs=[
                    "How do I register a second car or motorcycle?",
                    "What are the rates for basement EV charging?",
                ],
            )

        # 5. Pet Policies & Guidelines
        if match(("pet", "pets", "dog", "dogs", "cat", "cats", "animal", "animals", "leash", "barking")):
            reply = (
                "🐾 **Community Pet Policy & Guidelines:**\n"
                "• All resident pets must be registered with the estate management office.\n"
                "• Dogs must be on a leash at all times when in common areas, corridors, and gardens.\n"
                "• Please use the designated Service Elevators when taking pets up or down.\n"
                "• Designated pet walking zone is located behind the Central Clubhouse lawn. Pet parents must scoop the poop."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="rules",
                actions=[
                    schemas.AssistantAction(label="Community Guidelines", url="/residents"),
                ],
                related_faqs=[
                    "Are pets allowed in the main clubhouse area?",
                    "How to register a pet with management?",
                ],
            )

        # 6. Renovation, Carpentry & Interior Work
        if match(("renovation", "carpenter", "carpentry", "interior", "drilling", "noise", "construction", "contractor", "drill")):
            reply = (
                "🔨 **Interior Work & Renovation Policy:**\n"
                "• **Permitted Working Hours**: 10:00 AM – 6:00 PM (Monday to Saturday only).\n"
                "• **Strictly Prohibited**: Heavy drilling, hammering, and tile cutting on Sundays and Public Holidays.\n"
                "• Interior contractors and carpenters must obtain temporary daily ID passes from the main gate.\n"
                "• Debris & construction waste must not be dumped in regular garbage chutes."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="rules",
                actions=[
                    schemas.AssistantAction(label="Contractor Passes", url="/visitors/new"),
                    schemas.AssistantAction(label="Raise Maintenance Query", url="/complaints/new"),
                ],
                related_faqs=[
                    "What is the refundable renovation security deposit?",
                    "How to dispose of heavy interior debris?",
                ],
            )

        # 7. Garbage Collection & Waste Segregation
        if match(("garbage", "waste", "trash", "segregation", "wet waste", "dry waste", "debris", "chute")):
            reply = (
                "♻️ **Doorstep Waste Collection & Segregation:**\n"
                "• Daily Collection Schedule: **8:00 AM – 10:00 AM** at your apartment door.\n"
                "• **3-Way Mandatory Segregation**:\n"
                "  - 🟢 Green Bin: Organic / Kitchen / Wet waste\n"
                "  - 🔵 Blue Bin: Paper / Plastic / Dry recyclables\n"
                "  - 🔴 Red Bin / Bag: Sanitary and hazardous waste\n"
                "• E-waste drop box is located near the Tower Clubhouse reception."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="housekeeping",
                actions=[
                    schemas.AssistantAction(label="Report Housekeeping Issue", url="/complaints/new"),
                ],
                related_faqs=[
                    "Where do I dispose of old electronic items?",
                    "How to request bulk debris disposal?",
                ],
            )

        # 8. Complaints / Service Desk / Issues / Plumbing / Electrical
        if match(("complaint", "complaints", "ticket", "tickets", "issue", "issues", "leak", "plumbing", "plumber", "electrical", "electrician", "lift", "repair", "service desk")):
            my_tickets = await self._count(
                ServiceTicket,
                ServiceTicket.community_id == cid,
                ServiceTicket.raised_by_user_id == self.actor.id,
                ServiceTicket.status.in_(_OPEN_TICKET),
            )
            reply = (
                f"You currently have {my_tickets} active service ticket(s). "
                "Our maintenance service desk operates with SLA-backed response times across "
                "Plumbing, Electrical, Housekeeping, Lifts, and Common Areas."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="complaints",
                actions=[
                    schemas.AssistantAction(label="Raise New Ticket", url="/complaints/new"),
                    schemas.AssistantAction(label="Track My Tickets", url="/complaints"),
                ],
                related_faqs=[
                    "What are the SLA turnaround times for emergency tickets?",
                    "How do I confirm ticket resolution?",
                ],
            )

        # 9. Emergency / Security / Panic / Police / Ambulance / Contacts
        if match(("emergency", "security", "panic", "police", "ambulance", "fire", "contact", "contacts", "guard", "hotline")):
            active_panics = await self._count(
                PanicAlert, PanicAlert.community_id == cid, PanicAlert.status == "active"
            )
            reply = (
                f"🚨 Emergency Security Contacts for your Community:\n"
                f"• Main Security Gate: +91 98765 00001 (Ext: 101)\n"
                f"• Facility Manager Desk: +91 98765 00002 (Ext: 102)\n"
                f"• National Emergency Hotline: 112 | Ambulance: 108 | Fire: 101\n"
                f"Active panic alerts in community: {active_panics}."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="emergency",
                actions=[
                    schemas.AssistantAction(label="Security Gate View", url="/gate/live"),
                    schemas.AssistantAction(label="Emergency Directory", url="/residents"),
                ],
                related_faqs=[
                    "How does the gate panic alert work?",
                    "What to do during a fire or lift entrapment?",
                ],
            )

        # 10. Amenities / Gym / Swimming Pool / Clubhouse / Sports
        if match(("amenity", "amenities", "gym", "pool", "swimming", "clubhouse", "tennis", "court", "timing", "timings", "slot", "slots", "book")):
            now = datetime.now(UTC)
            my_bookings = await self._count(
                AmenityBooking,
                AmenityBooking.community_id == cid,
                AmenityBooking.resident_user_id == self.actor.id,
                AmenityBooking.status == "confirmed",
                AmenityBooking.start_at >= now,
            )
            reply = (
                f"🏊 Community Amenities & Operating Timings:\n"
                f"• Swimming Pool: 6:00 AM – 9:00 PM (Closed Mondays for cleaning)\n"
                f"• Fitness Gym: 6:00 AM – 10:00 PM daily\n"
                f"• Clubhouse & Banquet: 7:00 AM – 11:00 PM (Prior reservation required)\n"
                f"You have {my_bookings} upcoming amenity reservation(s)."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="amenities",
                actions=[
                    schemas.AssistantAction(label="Book an Amenity", url="/amenities"),
                    schemas.AssistantAction(label="My Bookings", url="/amenities"),
                ],
                related_faqs=[
                    "What is the cancellation policy for clubhouse bookings?",
                    "Can guests use the swimming pool?",
                ],
            )

        # 11. Domestic Staff / Maid / Driver / Cook
        if match(("staff", "maid", "maids", "driver", "drivers", "cook", "cooks", "cleaner", "attendance", "helper")):
            staff_in = await self._count(
                StaffAttendance,
                StaffAttendance.community_id == cid,
                StaffAttendance.check_out_at.is_(None),
            )
            reply = (
                f"There are currently {staff_in} domestic staff member(s) checked in at the community. "
                "You can verify staff attendance, ratings, and multi-flat assignments in the Staff section."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="domestic_staff",
                actions=[
                    schemas.AssistantAction(label="View Domestic Staff", url="/domestic-staff"),
                ],
                related_faqs=[
                    "How do I add a new maid or driver?",
                    "How does gate attendance stamping work?",
                ],
            )

        # 12. Move-in / Move-out / Relocation / Rules
        if match(("move", "relocation", "shifting", "furniture", "rule", "rules", "quiet", "noc")):
            reply = (
                "📦 **Move-In / Move-Out & Shifting Guidelines:**\n"
                "• Permitted Hours: 9:00 AM to 7:00 PM (Mon–Sat only; strictly prohibited on Sundays).\n"
                "• Service elevator padding is mandatory during furniture shifting.\n"
                "• Move-Out clearance (NOC) must be submitted at least 48 hours in advance via the Residents portal.\n"
                "• Quiet hours are enforced across all towers between 10:00 PM and 7:00 AM."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="rules",
                actions=[
                    schemas.AssistantAction(label="Request Move Clearance", url="/residents"),
                ],
                related_faqs=[
                    "How to submit a Move-Out NOC request?",
                    "What are the parking rules for shifting trucks?",
                ],
            )

        # 13. Internet, Utilities & Power Backup
        if match(("internet", "wifi", "broadband", "fiber", "cable", "gas", "electricity", "generator", "power backup", "dg")):
            reply = (
                "⚡ **Utilities & Fiber Internet Services:**\n"
                "• **Approved Broadband Providers**: Airtel Xstream Fiber, JioFiber, and ACT Fibernet (intercom extensions: 201–203).\n"
                "• **DG Power Backup**: 100% backup for all common lifts/pumps + 1.5 kVA automatic cut-in per residential unit.\n"
                "• **Piped Gas Pipeline**: Managed by City Gas. Gas helpline: 1800-22-2255 (or contact facility desk Ext: 102)."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="utilities",
                actions=[
                    schemas.AssistantAction(label="Emergency Desk", url="/gate/live"),
                    schemas.AssistantAction(label="Report Power/Utility Issue", url="/complaints/new"),
                ],
                related_faqs=[
                    "What is the DG generator diesel surcharge policy?",
                    "How to setup new fiber broadband connection?",
                ],
            )

        # 14. Notices, Circulars & Community Announcements
        if match(("notice", "notices", "circular", "circulars", "announcement", "announcements", "broadcast", "meeting", "agm", "event", "events")):
            latest_notices = await self._count(
                Announcement,
                Announcement.community_id == cid,
                Announcement.is_published.is_(True),
            )
            reply = (
                f"📢 **Community Notices & Circulars:**\n"
                f"There are currently {latest_notices} published announcement(s) on the community notice board.\n"
                "You can view official circulars, annual general body meeting (AGM) updates, festival calendars, and maintenance shutdown schedules."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="communication",
                actions=[
                    schemas.AssistantAction(label="Open Notice Board", url="/communications"),
                ],
                related_faqs=[
                    "When is the next Annual General Meeting (AGM)?",
                    "How do I submit an agenda item for committee review?",
                ],
            )

        # 15. Profile & Account Details
        if match(("profile", "my details", "who am i", "who i am", "my flat", "my unit", "flat number", "account details", "my phone", "my email")):
            role_cat = await self._resolve_role_category()
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
            unit_str = "Not assigned"
            res_type = "Resident"
            if occ and occ.unit_id:
                unit_row = await self.db.scalar(select(Unit).where(Unit.id == occ.unit_id))
                if unit_row:
                    unit_str = f"Unit {unit_row.unit_number}"
                if occ.occupancy_role:
                    res_type = occ.occupancy_role.replace("_", " ").title()

            reply = (
                f"👤 **Your GateSphere Profile Details:**\n"
                f"• **Full Name**: {self.actor.full_name}\n"
                f"• **Email**: {self.actor.email}\n"
                f"• **Phone**: {self.actor.phone or 'Not registered'}\n"
                f"• **Role**: {role_cat.replace('_', ' ').title()}\n"
                f"• **Assigned Unit**: {unit_str} ({res_type})\n"
                f"• **Account Status**: Active & Verified"
            )


            return schemas.AssistantResponse(
                reply_text=reply,
                category="profile",
                actions=[
                    schemas.AssistantAction(label="Edit Profile", url="/profile"),
                    schemas.AssistantAction(label="My Registered Vehicles", url="/vehicles"),
                    schemas.AssistantAction(label="Maintenance Invoices", url="/billing"),
                ],
                related_faqs=[
                    "What are my outstanding maintenance dues?",
                    "How do I update my phone number?",
                ],
            )

        # 16. Capabilities & Features Overview (What can you do / What I get from you)
        if any(
            phrase in q
            for phrase in (
                "what i get from u",
                "what i get from you",
                "what do i get",
                "what can you do",
                "what do you do",
                "what can i ask",
                "how can you help",
                "capabilities",
                "features",
                "help me",
                "what you can do",
            )
        ) or q in ("help", "about", "what"):
            reply = (
                "🤖 **Here is everything I can do for you in GateSphere:**\n\n"
                "1. 💳 **Maintenance & Dues**: Instant checks of current outstanding balances, breakdown of maintenance bills, and payment links.\n"
                "2. 👥 **Visitors & Passes**: Pre-approve guests, generate OTP/QR guest passes, and track entry history.\n"
                "3. 📦 **Deliveries & Couriers**: Configure delivery protocols (Leave at Gate Desk vs Allow Inside) for Swiggy, Zomato, and Amazon.\n"
                "4. 🚗 **Vehicles & Parking**: Check assigned parking bay, locate basement EV charging stations, and report unauthorized parking.\n"
                "5. 🛠️ **Service Desk & Complaints**: Guided troubleshooting for plumbing, electrical, and lift issues, plus live ticket status.\n"
                "6. 🏊 **Amenities & Bookings**: Operating hours for Swimming Pool (6 AM–9 PM) and Gym (6 AM–10 PM), and clubhouse banquet bookings.\n"
                "7. 🚨 **Emergency Hotlines**: Direct intercom numbers for Security Gate (Ext 101), Facility Office (Ext 102), and Emergency (112).\n"
                "8. 🧹 **Domestic Staff Attendance**: Live on-duty attendance and check-in status for your maid, cook, and driver.\n"
                "9. 📜 **Society Policies & Shifting**: Moving truck hours (9 AM–7 PM Mon–Sat), Move-Out NOC, building quiet hours (10 PM–7 AM), and pet rules.\n"
                "10. 👤 **Profile & Unit Info**: Instant lookup of your registered contact details and flat occupancy."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="capabilities",
                actions=[
                    schemas.AssistantAction(label="💳 Maintenance Dues", url="/billing"),
                    schemas.AssistantAction(label="👥 Create Visitor Pass", url="/visitors/new"),
                    schemas.AssistantAction(label="🛠️ Report Issue", url="/complaints/new"),
                    schemas.AssistantAction(label="🏊 Amenity Booking", url="/amenities"),
                ],
                related_faqs=[
                    "What are my outstanding maintenance dues?",
                    "How do I create a guest pass?",
                    "Where is EV charging located?",
                    "What are the swimming pool timings?",
                ],
            )




        # 8. Polite & Warm Greetings
        if any(
            q == k or q.startswith(f"{k} ") or f" {k}" in q
            for k in ("hi", "hello", "hey", "good morning", "good evening", "good afternoon", "namaste", "greetings")
        ):
            role_cat = await self._resolve_role_category()
            if role_cat == "security":
                reply = (
                    f"🛡️ Welcome Officer {self.actor.full_name}! GateSphere Security Assistant at your service.\n\n"
                    "How can I assist gate operations today?\n\n"
                    "Quick gate commands you can ask me:\n"
                    "• 👥 Check active visitors & vehicles inside\n"
                    "• 🚨 Review active emergency panic alerts\n"
                    "• 🧹 Check on-duty domestic staff attendance\n"
                    "• 🚫 Look up blacklisted visitor entries\n"
                    "• 📞 View emergency gate checkpoints & contacts"
                )
                actions = [
                    schemas.AssistantAction(label="👥 Gate Operations", url="/gate/live"),
                    schemas.AssistantAction(label="🚨 Incident Logs", url="/incidents"),
                    schemas.AssistantAction(label="🧹 Staff Attendance", url="/domestic-staff"),
                    schemas.AssistantAction(label="🚫 Visitor Blacklist", url="/visitors/blacklist"),
                ]
                faqs = [
                    "How many visitors and vehicles are inside?",
                    "Are there any active panic alerts?",
                    "How many domestic staff are on-duty?",
                ]
            elif role_cat == "super_admin":
                reply = (
                    f"🌐 Welcome Super Admin {self.actor.full_name}! GateSphere Global Platform Assistant at your service.\n\n"
                    "Here are your platform management shortcuts:\n"
                    "• 🏘️ Cross-community occupancy & unit statistics\n"
                    "• 💳 Global billing collections & outstanding dues\n"
                    "• 👥 Platform-wide gate traffic & visitor volume\n"
                    "• 🛠️ Cross-community service tickets & SLA health"
                )
                actions = [
                    schemas.AssistantAction(label="🌐 Global Dashboard", url="/admin/global"),
                    schemas.AssistantAction(label="🏘️ Communities List", url="/communities"),
                    schemas.AssistantAction(label="💳 Financial Overview", url="/billing"),
                    schemas.AssistantAction(label="📋 Audit Logs", url="/audit"),
                ]
                faqs = [
                    "Show platform-wide collection summary",
                    "How many total visitors are active across communities?",
                    "Show total open complaints across platform",
                ]
            elif role_cat == "admin":
                reply = (
                    f"🏢 Welcome {self.actor.full_name}! GateSphere Community Admin Assistant at your service.\n\n"
                    "How can I assist your community management today?\n\n"
                    "Quick administrative commands you can ask:\n"
                    "• 🛠️ View open complaints by SLA status\n"
                    "• 💳 Review billing & collection status\n"
                    "• 👥 Monitor live gate occupancy & visitors\n"
                    "• 🧹 View domestic staff attendance\n"
                    "• 📢 Broadcast notices & announcements"
                )
                actions = [
                    schemas.AssistantAction(label="📊 Admin Dashboard", url="/dashboard"),
                    schemas.AssistantAction(label="🛠️ Manage Complaints", url="/complaints"),
                    schemas.AssistantAction(label="💳 Billing & Invoices", url="/billing"),
                    schemas.AssistantAction(label="📢 Broadcast Notice", url="/communications/new"),
                ]
                faqs = [
                    "Show open complaints by priority",
                    "Show collection and dues summary",
                    "How many visitors are inside right now?",
                ]
            else:
                reply = (
                    f"👋 Hello {self.actor.full_name}! Hope you're having a wonderful day.\n\n"
                    "I am your GateSphere Resident Assistant. How can I help you today?\n\n"
                    "Here are a few things you can ask me:\n"
                    "• 💳 Check maintenance dues & payment options\n"
                    "• 👥 Create visitor passes & pre-approve guests\n"
                    "• 🛠️ Raise service complaints (plumbing, electrical, lifts)\n"
                    "• 🏊 Check pool/gym hours & book amenities\n"
                    "• 🚨 View emergency security gate contacts"
                )
                actions = [
                    schemas.AssistantAction(label="💳 Maintenance Dues", url="/billing"),
                    schemas.AssistantAction(label="👥 Create Visitor Pass", url="/visitors/new"),
                    schemas.AssistantAction(label="🛠️ Report Issue", url="/complaints/new"),
                    schemas.AssistantAction(label="🏊 Amenity Booking", url="/amenities"),
                    schemas.AssistantAction(label="🚨 Emergency Contacts", url="/gate/live"),
                ]
                faqs = [
                    "What are my outstanding maintenance dues?",
                    "How do I create a guest pass?",
                    "How do I report a plumbing issue?",
                    "What are the swimming pool timings?",
                ]

            return schemas.AssistantResponse(
                reply_text=reply,
                category="greeting",
                actions=actions,
                related_faqs=faqs,
            )


        # 9. Fallback / Unrecognized query
        reply = (
            f"I couldn't find a direct policy match for \"{query}\".\n\n"
            "You can ask me about:\n"
            "• Maintenance Dues & Invoices\n"
            "• Visitor & Delivery Gate Passes\n"
            "• Service Desk Complaints (Plumbing, Electrical, Lifts)\n"
            "• Swimming Pool, Gym, and Clubhouse Hours\n"
            "• Emergency Contacts & Gate Hotlines\n"
            "• Move-In / Move-Out Guidelines"
        )
        return schemas.AssistantResponse(
            reply_text=reply,
            category="general",
            actions=[
                schemas.AssistantAction(label="View Dashboard", url="/dashboard"),
                schemas.AssistantAction(label="Raise Complaint", url="/complaints/new"),
                schemas.AssistantAction(label="Create Visitor Pass", url="/visitors/new"),
            ],
            related_faqs=[
                "What are my outstanding maintenance dues?",
                "How do I create a visitor pass?",
                "What are the swimming pool and gym timings?",
                "Who do I contact in an emergency?",
            ],
        )



