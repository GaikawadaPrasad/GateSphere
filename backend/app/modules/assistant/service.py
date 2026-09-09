"""Business logic for the Assistant / Chatbot module (FR-14 & FR-19).

Provides deterministic, sub-50ms conversational assistant responses, role-tailored
greetings, real-world community FAQ matching, dynamic profile lookup, and guided
navigation actions.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import structlog
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.tenancy import TenantScope
from app.modules.amenities.models import AmenityBooking
from app.modules.assistant import schemas
from app.modules.billing.models import MaintenanceInvoice, Payment
from app.modules.communication.models import Announcement
from app.modules.communities.models import Community, Unit
from app.modules.complaints.models import ServiceTicket
from app.modules.domestic_staff.models import StaffAttendance
from app.modules.gate.models import PanicAlert
from app.modules.residents.access import actor_unit_scope
from app.modules.residents.models import ResidentProfile, UnitOccupancy
from app.modules.users.models import Role, User, UserRole
from app.modules.visitors.models import VisitorBlacklist, VisitorEntry, VisitorRequest

log = structlog.get_logger(__name__)

_OPEN_TICKET = ("created", "assigned", "acknowledged", "in_progress", "resident_confirmation")

# Real, existing per-role deep links (frontend/app/**). Every role's app lives under its own
# prefix (e.g. resident -> /owner-tenant) with its own page names — there is no shared generic
# "/billing" or "/visitors" route, so a reply's action URLs must be resolved per role slug.
# `/dashboard` is a real smart-router page (frontend/app/(protected)/dashboard) that redirects
# to the caller's own portal — safe universal fallback when a role has no matching page.
_ROLE_ROUTES: dict[str, dict[str, str]] = {
    "billing": {
        "resident": "/owner-tenant/payments",
        "community_admin": "/community-admin/billing",
        "super_admin": "/super-admin/billing",
        "association_committee": "/association-committee/financial-summary",
        "auditor": "/auditor/financial-records",
    },
    "visitors": {
        "resident": "/owner-tenant/visitors",
        "security_guard": "/security-guard/visitors",
        "security_supervisor": "/security-supervisor/visitor-management",
        "auditor": "/auditor/visitor-records",
    },
    "deliveries": {
        "resident": "/owner-tenant/deliveries",
        "security_guard": "/security-guard/deliveries",
        "security_supervisor": "/security-supervisor/delivery-management",
    },
    "vehicles": {
        "resident": "/owner-tenant/vehicles",
    },
    "complaints": {
        "resident": "/owner-tenant/complaints",
        "facility_manager": "/facility-manager/service-requests",
        "vendor_technician": "/vendor-technician/assigned-tickets",
        "community_admin": "/community-admin/incidents",
        "super_admin": "/super-admin/complaints",
    },
    "amenities": {
        "resident": "/owner-tenant/amenities",
        "facility_manager": "/facility-manager/amenities",
    },
    "domestic_staff": {
        "resident": "/owner-tenant/domestic-staff",
        "security_guard": "/security-guard/staff-attendance",
        "security_supervisor": "/security-supervisor/domestic-staff",
        "domestic_staff": "/domestic-staff/dashboard",
    },
    "emergency": {
        "resident": "/owner-tenant/emergency",
        "security_guard": "/security-guard/emergency",
        "security_supervisor": "/security-supervisor/emergency-alerts",
        "domestic_staff": "/domestic-staff/emergency",
        "facility_manager": "/facility-manager/incidents",
        "community_admin": "/community-admin/incidents",
        "association_committee": "/association-committee/incidents",
        "auditor": "/auditor/incident-records",
    },
    "profile": {
        "resident": "/owner-tenant/profile",
        "vendor_technician": "/vendor-technician/profile",
        "domestic_staff": "/domestic-staff/profile",
    },
    "communication": {
        "resident": "/owner-tenant/notifications",
        "community_admin": "/community-admin/communication",
    },
    "residents_directory": {
        "resident": "/owner-tenant/property",
        "community_admin": "/community-admin/residents",
        "super_admin": "/super-admin/residents",
    },
    "gate_live": {
        "security_guard": "/security-guard/live-gate",
        "security_supervisor": "/security-supervisor/gate-operations",
    },
    "blacklist": {
        "security_guard": "/security-guard/blacklist-check",
        "security_supervisor": "/security-supervisor/blacklist",
    },
    "communities": {
        "super_admin": "/super-admin/communities",
    },
    "audit": {
        "super_admin": "/super-admin/audit-logs",
        "auditor": "/auditor/audit-logs",
        "association_committee": "/association-committee/collection-audit",
    },
}


def _role_url(role_slugs: frozenset[str], category: str, fallback: str = "/dashboard") -> str:
    routes = _ROLE_ROUTES.get(category, {})
    for slug in role_slugs:
        if slug in routes:
            return routes[slug]
    return fallback


# Intent vocabulary, in priority order for tie-breaking (declaration order wins ties).
# `_classify` scores every category by how many of its terms hit the query and returns the
# single best match, so overlapping vocabulary (e.g. "slot" belongs to both `vehicles` and
# `amenities`) is resolved by which category the query resembles *more*, not by whichever
# category happened to be checked first — see AGENTS.md discussion of the old first-match bug.
_INTENT_TERMS: dict[str, tuple[str, ...]] = {
    "payment_history": (
        "payment history", "past payments", "past payment", "receipt", "receipts",
        "transaction history", "transactions",
    ),
    "billing": (
        "due", "dues", "bill", "bills", "invoice", "invoices", "payment", "payments",
        "maintenance", "pay", "balance", "fee", "collection", "collections", "collection summary",
    ),
    "visitors": (
        "visitor", "visitors", "guest", "guests", "cab", "uber", "visitor pass", "guest pass",
        "entry pass", "traffic", "gate traffic",
    ),
    "deliveries": (
        "delivery", "deliveries", "courier", "swiggy", "zomato", "amazon", "blinkit", "parcel",
        "parcels", "gate desk", "package", "food",
    ),
    "vehicles": (
        "parking", "vehicle", "vehicles", "car", "cars", "bike", "bikes", "slot", "slots", "ev",
        "charging", "unauthorized", "wrong parking", "bay", "bays",
    ),
    "pets": ("pet", "pets", "dog", "dogs", "cat", "cats", "animal", "animals", "leash", "barking"),
    "renovation": (
        "renovation", "carpenter", "carpentry", "interior", "drilling", "noise", "construction",
        "contractor", "drill",
    ),
    "garbage": (
        "garbage", "waste", "trash", "segregation", "wet waste", "dry waste", "debris", "chute",
    ),
    "complaints": (
        "complaint", "complaints", "ticket", "tickets", "issue", "issues", "leak", "plumbing",
        "plumber", "electrical", "electrician", "lift", "repair", "service desk",
    ),
    "emergency": (
        "emergency", "security", "panic", "police", "ambulance", "fire", "contact", "contacts",
        "guard", "hotline",
    ),
    "amenities": (
        "amenity", "amenities", "gym", "pool", "swimming", "clubhouse", "tennis", "court",
        "timing", "timings", "slot", "slots", "book",
    ),
    "domestic_staff": (
        "staff", "maid", "maids", "driver", "drivers", "cook", "cooks", "cleaner", "attendance",
        "helper",
    ),
    "move": ("move", "relocation", "shifting", "furniture", "rule", "rules", "quiet", "noc"),
    "utilities": (
        "internet", "wifi", "broadband", "fiber", "cable", "gas", "electricity", "generator",
        "power backup", "dg",
    ),
    "communication": (
        "notice", "notices", "circular", "circulars", "announcement", "announcements",
        "broadcast", "meeting", "agm", "event", "events",
    ),
    "profile": (
        "profile", "my details", "who am i", "who i am", "my flat", "my unit", "flat number",
        "account details", "my phone", "my email",
    ),
    "blacklist": ("blacklist", "blacklisted", "banned visitor"),
    "communities_overview": ("communities overview", "how many communities", "communities"),
}


def _match_score(q: str, words: set[str], terms: tuple[str, ...]) -> int:
    """A multi-word phrase match is a much stronger signal than a single generic word."""
    score = 0
    for t in terms:
        if " " in t:
            if t in q:
                score += 2
        elif t in words:
            score += 1
        elif len(t) >= 5 and t in q:
            score += 1
    return score


def _classify(q: str, words: set[str]) -> str | None:
    best_cat: str | None = None
    best_score = 0
    for cat, terms in _INTENT_TERMS.items():
        s = _match_score(q, words, terms)
        if s > best_score:
            best_cat, best_score = cat, s
    return best_cat


class AssistantService:
    def __init__(
        self, db: AsyncSession, scope: TenantScope, actor: User, ctx: RequestContext | None = None
    ):
        self.db = db
        self.scope = scope
        self.actor = actor
        self.ctx = ctx
        self._role_slugs_cache: frozenset[str] | None = None
        self._role_category_cache: str | None = None

    async def _communities(self, community_id: uuid.UUID | None) -> list[uuid.UUID]:
        """Every community the query should aggregate over.

        A single explicit `community_id` (validated against the caller's scope) or a
        single-community caller's own community resolve to one id, as before. A caller with
        global scope and no explicit target (Super Admin browsing platform-wide) used to hit a
        hard `COMMUNITY_REQUIRED` error here — instead they now get every community on the
        platform, so platform-wide questions ("collection summary", "open tickets") aggregate
        sensibly instead of the assistant being unusable for that role.
        """
        if community_id is not None:
            return [self.scope.require(community_id)]
        if not self.scope.is_global and self.scope.community_ids:
            return list(self.scope.community_ids)
        rows = await self.db.scalars(select(Community.id))
        return list(rows.all())

    async def _count(self, model, *where) -> int:
        return int(await self.db.scalar(select(func.count()).select_from(model).where(*where)) or 0)

    async def _outstanding(self, cids: list[uuid.UUID], *extra) -> Decimal:
        val = await self.db.scalar(
            select(func.coalesce(func.sum(MaintenanceInvoice.balance_due), 0)).where(
                MaintenanceInvoice.community_id.in_(cids),
                MaintenanceInvoice.status.in_(("posted", "partially_paid", "overdue")),
                *extra,
            )
        )
        return Decimal(val or 0)

    @staticmethod
    def _scope_desc(cids: list[uuid.UUID]) -> str:
        """A trailing scope phrase, already including its preposition — use as `f"...{self._scope_desc(cids)}."`."""
        return "in your community" if len(cids) == 1 else f"across all {len(cids)} communities"

    async def _resolve_role_category(self) -> str:
        if self._role_category_cache is not None:
            return self._role_category_cache
        if self.actor.is_superadmin or self.scope.is_global:
            self._role_category_cache = "super_admin"
            return self._role_category_cache
        unit_scope = await actor_unit_scope(self.db, self.actor)
        if unit_scope is not None:
            self._role_category_cache = "resident"
            return self._role_category_cache
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
        self._role_category_cache = "security" if is_security else "admin"
        return self._role_category_cache

    async def _resolve_role_slugs(self) -> frozenset[str]:
        if self._role_slugs_cache is None:
            if self.actor.is_superadmin:
                self._role_slugs_cache = frozenset({"super_admin"})
            else:
                rows = await self.db.scalars(
                    select(Role.slug).join(UserRole, UserRole.role_id == Role.id).where(
                        UserRole.user_id == self.actor.id
                    )
                )
                self._role_slugs_cache = frozenset(rows.all())
        return self._role_slugs_cache

    async def _url(self, category: str, fallback: str = "/dashboard") -> str:
        return _role_url(await self._resolve_role_slugs(), category, fallback)

    # -- Quick Actions & Starter Chips ------------------------- #
    async def quick_actions(
        self, community_id: uuid.UUID | None
    ) -> schemas.AssistantQuickActionsResponse:
        cids = await self._communities(community_id)
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
            community_id=cids[0] if cids else uuid.UUID(int=0),
            greeting=greeting,
            chips=chips,
            suggested_queries=suggested,
        )

    # -- Primary Assistant Query Handler ----------------------- #
    async def query(
        self, community_id: uuid.UUID | None, query: str
    ) -> schemas.AssistantResponse:
        cids = await self._communities(community_id)

        q = query.lower().strip()
        words = set(q.split())
        intent = _classify(q, words)

        if intent == "payment_history":
            rows = await self.db.scalars(
                select(Payment)
                .where(Payment.community_id.in_(cids), Payment.payer_user_id == self.actor.id)
                .order_by(Payment.paid_at.desc())
                .limit(5)
            )
            payments = rows.all()
            if payments:
                lines = "\n".join(
                    f"• ₹{p.amount:,.2f} via {p.payment_method.upper()} on {p.paid_at.strftime('%d %b %Y')}"
                    f"{f' (Receipt {p.receipt_number})' if p.receipt_number else ''} — {p.payment_status.title()}"
                    for p in payments
                )
                reply = f"🧾 **Your Recent Payments:**\n{lines}"
            else:
                reply = "You don't have any recorded payments yet."
            return schemas.AssistantResponse(
                reply_text=reply,
                category="billing",
                actions=[
                    schemas.AssistantAction(label="View Full Invoice History", url=await self._url("billing")),
                ],
                related_faqs=[
                    "What are my outstanding maintenance dues?",
                    "What payment methods are supported?",
                ],
            )

        if intent == "billing":
            occ = await self.db.scalar(
                select(UnitOccupancy)
                .join(ResidentProfile, ResidentProfile.id == UnitOccupancy.resident_profile_id)
                .where(
                    ResidentProfile.user_id == self.actor.id,
                    ResidentProfile.community_id.in_(cids),
                    UnitOccupancy.is_active.is_(True),
                )
                .order_by(UnitOccupancy.is_primary.desc())
            )
            if occ and occ.unit_id:
                balance = await self._outstanding(cids, MaintenanceInvoice.unit_id == occ.unit_id)
                reply = (
                    f"Your current outstanding maintenance balance is ₹{balance:,.2f}. "
                    "Maintenance invoices are generated monthly on the 1st with a 15-day grace period."
                )
            else:
                total_out = await self._outstanding(cids)
                reply = (
                    f"The total outstanding maintenance balance {self._scope_desc(cids)} is ₹{total_out:,.2f}. "
                    "You can manage flat-wise invoices and payment receipts in the Billing section."
                )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="billing",
                actions=[
                    schemas.AssistantAction(label="View Invoices & Pay", url=await self._url("billing")),
                    schemas.AssistantAction(
                        label="Payment History", url="", action_type="action", query="show my payment history"
                    ),
                ],
                related_faqs=[
                    "When is maintenance due each month?",
                    "What payment methods are supported?",
                ],
            )

        if intent == "visitors":
            role_cat = await self._resolve_role_category()
            inside = await self._count(
                VisitorEntry, VisitorEntry.community_id.in_(cids), VisitorEntry.status == "inside"
            )
            if role_cat == "resident":
                pending_reqs = await self._count(
                    VisitorRequest,
                    VisitorRequest.community_id.in_(cids),
                    VisitorRequest.created_by_user_id == self.actor.id,
                    VisitorRequest.status == "pending",
                )
                pending_line = f"You have {pending_reqs} visitor request(s) awaiting approval."
            else:
                pending_reqs = await self._count(
                    VisitorRequest, VisitorRequest.community_id.in_(cids), VisitorRequest.status == "pending"
                )
                pending_line = f"There are {pending_reqs} visitor request(s) awaiting approval {self._scope_desc(cids)}."
            reply = (
                f"{pending_line} "
                f"Currently, there are {inside} visitor(s) inside the premises. "
                "You can generate time-limited OTP/QR visitor passes or approve gate arrival requests."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="visitors",
                actions=[
                    schemas.AssistantAction(label="Create Visitor Pass", url=await self._url("visitors")),
                    schemas.AssistantAction(label="View Visitor Log", url=await self._url("visitors")),
                ],
                related_faqs=[
                    "How long is a visitor pass valid?",
                    "How do delivery gate protocols work?",
                ],
            )

        if intent == "deliveries":
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
                    schemas.AssistantAction(label="Configure Delivery Rules", url=await self._url("deliveries")),
                    schemas.AssistantAction(label="View Gate Deliveries", url=await self._url("deliveries")),
                ],
                related_faqs=[
                    "How do I collect parcels left at the gate desk?",
                    "Can food delivery come directly to my door?",
                ],
            )

        if intent == "vehicles":
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
                    schemas.AssistantAction(label="My Registered Vehicles", url=await self._url("vehicles")),
                    schemas.AssistantAction(label="Report Parking Violation", url=await self._url("vehicles")),
                ],
                related_faqs=[
                    "How do I register a second car or motorcycle?",
                    "What are the rates for basement EV charging?",
                ],
            )

        if intent == "pets":
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
                    schemas.AssistantAction(label="Community Guidelines", url=await self._url("residents_directory")),
                ],
                related_faqs=[
                    "Are pets allowed in the main clubhouse area?",
                    "How to register a pet with management?",
                ],
            )

        if intent == "renovation":
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
                    schemas.AssistantAction(label="Contractor Passes", url=await self._url("visitors")),
                    schemas.AssistantAction(label="Raise Maintenance Query", url=await self._url("complaints")),
                ],
                related_faqs=[
                    "What is the refundable renovation security deposit?",
                    "How to dispose of heavy interior debris?",
                ],
            )

        if intent == "garbage":
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
                    schemas.AssistantAction(label="Report Housekeeping Issue", url=await self._url("complaints")),
                ],
                related_faqs=[
                    "Where do I dispose of old electronic items?",
                    "How to request bulk debris disposal?",
                ],
            )

        if intent == "complaints":
            role_cat = await self._resolve_role_category()
            if role_cat == "resident":
                my_tickets = await self._count(
                    ServiceTicket,
                    ServiceTicket.community_id.in_(cids),
                    ServiceTicket.raised_by_user_id == self.actor.id,
                    ServiceTicket.status.in_(_OPEN_TICKET),
                )
                reply = (
                    f"You currently have {my_tickets} active service ticket(s). "
                    "Our maintenance service desk operates with SLA-backed response times across "
                    "Plumbing, Electrical, Housekeeping, Lifts, and Common Areas."
                )
            else:
                total_tickets = await self._count(
                    ServiceTicket, ServiceTicket.community_id.in_(cids), ServiceTicket.status.in_(_OPEN_TICKET)
                )
                reply = (
                    f"There are currently {total_tickets} open service ticket(s) {self._scope_desc(cids)}. "
                    "The service desk tracks SLA-backed response times across "
                    "Plumbing, Electrical, Housekeeping, Lifts, and Common Areas."
                )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="complaints",
                actions=[
                    schemas.AssistantAction(label="Raise New Ticket", url=await self._url("complaints")),
                    schemas.AssistantAction(label="Track My Tickets", url=await self._url("complaints")),
                ],
                related_faqs=[
                    "What are the SLA turnaround times for emergency tickets?",
                    "How do I confirm ticket resolution?",
                ],
            )

        if intent == "emergency":
            active_panics = await self._count(
                PanicAlert, PanicAlert.community_id.in_(cids), PanicAlert.status == "active"
            )
            reply = (
                f"🚨 Emergency Security Contacts for your Community:\n"
                f"• Main Security Gate: +91 98765 00001 (Ext: 101)\n"
                f"• Facility Manager Desk: +91 98765 00002 (Ext: 102)\n"
                f"• National Emergency Hotline: 112 | Ambulance: 108 | Fire: 101\n"
                f"Active panic alerts {self._scope_desc(cids)}: {active_panics}."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="emergency",
                actions=[
                    schemas.AssistantAction(label="Security Gate View", url=await self._url("emergency")),
                    schemas.AssistantAction(label="Emergency Directory", url=await self._url("residents_directory")),
                ],
                related_faqs=[
                    "How does the gate panic alert work?",
                    "What to do during a fire or lift entrapment?",
                ],
            )

        if intent == "amenities":
            now = datetime.now(UTC)
            my_bookings = await self._count(
                AmenityBooking,
                AmenityBooking.community_id.in_(cids),
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
                    schemas.AssistantAction(label="Book an Amenity", url=await self._url("amenities")),
                    schemas.AssistantAction(label="My Bookings", url=await self._url("amenities")),
                ],
                related_faqs=[
                    "What is the cancellation policy for clubhouse bookings?",
                    "Can guests use the swimming pool?",
                ],
            )

        if intent == "domestic_staff":
            staff_in = await self._count(
                StaffAttendance,
                StaffAttendance.community_id.in_(cids),
                StaffAttendance.check_out_at.is_(None),
            )
            reply = (
                f"There are currently {staff_in} domestic staff member(s) on duty {self._scope_desc(cids)}. "
                "You can verify staff attendance, ratings, and multi-flat assignments in the Staff section."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="domestic_staff",
                actions=[
                    schemas.AssistantAction(label="View Domestic Staff", url=await self._url("domestic_staff")),
                ],
                related_faqs=[
                    "How do I add a new maid or driver?",
                    "How does gate attendance stamping work?",
                ],
            )

        if intent == "move":
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
                    schemas.AssistantAction(label="Request Move Clearance", url=await self._url("residents_directory")),
                ],
                related_faqs=[
                    "How to submit a Move-Out NOC request?",
                    "What are the parking rules for shifting trucks?",
                ],
            )

        if intent == "utilities":
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
                    schemas.AssistantAction(label="Emergency Desk", url=await self._url("emergency")),
                    schemas.AssistantAction(label="Report Power/Utility Issue", url=await self._url("complaints")),
                ],
                related_faqs=[
                    "What is the DG generator diesel surcharge policy?",
                    "How to setup new fiber broadband connection?",
                ],
            )

        if intent == "communication":
            latest_notices = await self._count(
                Announcement, Announcement.community_id.in_(cids), Announcement.is_published.is_(True)
            )
            reply = (
                f"📢 **Community Notices & Circulars:**\n"
                f"There are currently {latest_notices} published announcement(s) {self._scope_desc(cids)}.\n"
                "You can view official circulars, annual general body meeting (AGM) updates, festival calendars, and maintenance shutdown schedules."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="communication",
                actions=[
                    schemas.AssistantAction(label="Open Notice Board", url=await self._url("communication")),
                ],
                related_faqs=[
                    "When is the next Annual General Meeting (AGM)?",
                    "How do I submit an agenda item for committee review?",
                ],
            )

        if intent == "profile":
            role_cat = await self._resolve_role_category()
            occ = await self.db.scalar(
                select(UnitOccupancy)
                .join(ResidentProfile, ResidentProfile.id == UnitOccupancy.resident_profile_id)
                .where(
                    ResidentProfile.user_id == self.actor.id,
                    ResidentProfile.community_id.in_(cids),
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
                    schemas.AssistantAction(label="Edit Profile", url=await self._url("profile")),
                    schemas.AssistantAction(label="My Registered Vehicles", url=await self._url("vehicles")),
                    schemas.AssistantAction(label="Maintenance Invoices", url=await self._url("billing")),
                ],
                related_faqs=[
                    "What are my outstanding maintenance dues?",
                    "How do I update my phone number?",
                ],
            )

        if intent == "blacklist":
            today = datetime.now(UTC).date()
            active_count = await self._count(
                VisitorBlacklist,
                VisitorBlacklist.community_id.in_(cids),
                VisitorBlacklist.active_from <= today,
                or_(VisitorBlacklist.active_until.is_(None), VisitorBlacklist.active_until >= today),
            )
            reply = (
                f"🚫 There {'is' if active_count == 1 else 'are'} currently {active_count} active blacklist "
                f"entr{'y' if active_count == 1 else 'ies'} {self._scope_desc(cids)}."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="blacklist",
                actions=[
                    schemas.AssistantAction(label="View Blacklist", url=await self._url("blacklist")),
                ],
                related_faqs=[
                    "How do I add a visitor to the blacklist?",
                    "How long does a blacklist entry stay active?",
                ],
            )

        if intent == "communities_overview":
            total_communities = await self._count(Community)
            reply = (
                f"🏘️ GateSphere is managing {total_communities} "
                f"communit{'y' if total_communities == 1 else 'ies'} on the platform."
            )
            return schemas.AssistantResponse(
                reply_text=reply,
                category="communities",
                actions=[
                    schemas.AssistantAction(label="View All Communities", url=await self._url("communities")),
                ],
                related_faqs=[
                    "Show platform-wide collection summary",
                    "How many total visitors are active across communities?",
                ],
            )

        # Capabilities & Features Overview
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
                    schemas.AssistantAction(label="💳 Maintenance Dues", url=await self._url("billing")),
                    schemas.AssistantAction(label="👥 Create Visitor Pass", url=await self._url("visitors")),
                    schemas.AssistantAction(label="🛠️ Report Issue", url=await self._url("complaints")),
                    schemas.AssistantAction(label="🏊 Amenity Booking", url=await self._url("amenities")),
                ],
                related_faqs=[
                    "What are my outstanding maintenance dues?",
                    "How do I create a guest pass?",
                    "Where is EV charging located?",
                    "What are the swimming pool timings?",
                ],
            )

        # Polite & Warm Greetings
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
                    schemas.AssistantAction(label="👥 Gate Operations", url=await self._url("gate_live")),
                    schemas.AssistantAction(label="🚨 Incident Logs", url=await self._url("emergency")),
                    schemas.AssistantAction(label="🧹 Staff Attendance", url=await self._url("domestic_staff")),
                    schemas.AssistantAction(label="🚫 Visitor Blacklist", url=await self._url("blacklist")),
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
                    schemas.AssistantAction(label="🌐 Global Dashboard", url="/dashboard"),
                    schemas.AssistantAction(label="🏘️ Communities List", url=await self._url("communities")),
                    schemas.AssistantAction(label="💳 Financial Overview", url=await self._url("billing")),
                    schemas.AssistantAction(label="📋 Audit Logs", url=await self._url("audit")),
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
                    schemas.AssistantAction(label="🛠️ Manage Complaints", url=await self._url("complaints")),
                    schemas.AssistantAction(label="💳 Billing & Invoices", url=await self._url("billing")),
                    schemas.AssistantAction(label="📢 Broadcast Notice", url=await self._url("communication")),
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
                    schemas.AssistantAction(label="💳 Maintenance Dues", url=await self._url("billing")),
                    schemas.AssistantAction(label="👥 Create Visitor Pass", url=await self._url("visitors")),
                    schemas.AssistantAction(label="🛠️ Report Issue", url=await self._url("complaints")),
                    schemas.AssistantAction(label="🏊 Amenity Booking", url=await self._url("amenities")),
                    schemas.AssistantAction(label="🚨 Emergency Contacts", url=await self._url("emergency")),
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

        # Fallback / Unrecognized query — logged so the keyword vocabulary can be tuned from
        # real usage instead of guesswork (what are people actually asking that we can't answer).
        log.info(
            "assistant.unmatched_query",
            query=query,
            role_category=await self._resolve_role_category(),
            actor_id=str(self.actor.id),
        )
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
                schemas.AssistantAction(label="Raise Complaint", url=await self._url("complaints")),
                schemas.AssistantAction(label="Create Visitor Pass", url=await self._url("visitors")),
            ],
            related_faqs=[
                "What are my outstanding maintenance dues?",
                "How do I create a visitor pass?",
                "What are the swimming pool and gym timings?",
                "Who do I contact in an emergency?",
            ],
        )
