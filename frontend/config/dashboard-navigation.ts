/**
 * Navigation configurations for GateSphere Role Dashboards
 * - Auditor (11 Modules)
 * - Domestic Staff (9 Modules)
 * - Owner / Tenant (14 Modules)
 */

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
  accentColor?: string;
  description?: string;
}

export interface DashboardNavConfig {
  role: string;
  title: string;
  subtitle: string;
  basePath: string;
  color: string;
  navItems: NavItem[];
}

export const AUDITOR_NAV: DashboardNavConfig = {
  role: "auditor",
  title: "Compliance & Audit",
  subtitle: "Read-Only System Oversight",
  basePath: "/dashboard/auditor",
  color: "#475569",
  navItems: [
    { id: "overview", label: "Dashboard", href: "/dashboard/auditor", icon: "📊", accentColor: "#1D4ED8", description: "Audit summary & KPI drill-downs" },
    { id: "audit-logs", label: "Audit Logs", href: "/dashboard/auditor/audit-logs", icon: "📋", accentColor: "#475569", description: "Immutable system action trail" },
    { id: "user-activity", label: "User Activity", href: "/dashboard/auditor/user-activity", icon: "👥", accentColor: "#0D9488", description: "Reconstructed user action histories" },
    { id: "gate-activity", label: "Gate Activity", href: "/dashboard/auditor/gate-activity", icon: "🛡️", accentColor: "#1D4ED8", description: "Live entry/exit records & anomalies" },
    { id: "visitor-records", label: "Visitor Records", href: "/dashboard/auditor/visitor-records", icon: "🚪", accentColor: "#7C3AED", description: "Visitor lifecycle & compliance logs" },
    { id: "maintenance-records", label: "Maintenance Records", href: "/dashboard/auditor/maintenance-records", icon: "🔧", accentColor: "#16A34A", description: "Ticket lifecycle & SLA verification" },
    { id: "vendor-activity", label: "Vendor Activity", href: "/dashboard/auditor/vendor-activity", icon: "👷", accentColor: "#D97706", description: "Vendor passes & proof of completion" },
    { id: "incident-records", label: "Incident Records", href: "/dashboard/auditor/incident-records", icon: "🚨", accentColor: "#DC2626", description: "Security incident trail & resolutions" },
    { id: "financial-records", label: "Financial Records", href: "/dashboard/auditor/financial-records", icon: "💳", accentColor: "#D97706", description: "Read-only ledger & reconciliation" },
    { id: "reports", label: "Reports", href: "/dashboard/auditor/reports", icon: "📈", accentColor: "#475569", description: "Exportable compliance summaries" },
    { id: "audit-search", label: "Audit Search", href: "/dashboard/auditor/audit-search", icon: "🔍", accentColor: "#0891B2", description: "Cross-module historical search" },
  ],
};

export const DOMESTIC_STAFF_NAV: DashboardNavConfig = {
  role: "domestic_staff",
  title: "Staff Operations",
  subtitle: "Daily Work & Gate Access",
  basePath: "/dashboard/domestic-staff",
  color: "#0D9488",
  navItems: [
    { id: "overview", label: "Dashboard", href: "/dashboard/domestic-staff", icon: "🏠", accentColor: "#0D9488", description: "Daily schedule & gate status" },
    { id: "profile", label: "My Profile", href: "/dashboard/domestic-staff/profile", icon: "👤", accentColor: "#1D4ED8", description: "Contact details & police verification" },
    { id: "assigned-homes", label: "Assigned Homes", href: "/dashboard/domestic-staff/assigned-homes", icon: "🏢", accentColor: "#0D9488", description: "Units & resident contacts" },
    { id: "schedule", label: "Schedule", href: "/dashboard/domestic-staff/schedule", icon: "📅", accentColor: "#7C3AED", description: "Working shifts & shift alerts" },
    { id: "attendance", label: "Attendance", href: "/dashboard/domestic-staff/attendance", icon: "⏱️", accentColor: "#16A34A", description: "Gate-synced hours & history" },
    { id: "entry-exit", label: "Entry / Exit", href: "/dashboard/domestic-staff/entry-exit", icon: "🛡️", accentColor: "#1D4ED8", description: "Gate pass & duty check-in/out" },
    { id: "visits", label: "Visits", href: "/dashboard/domestic-staff/visits", icon: "📋", accentColor: "#0891B2", description: "Historical visits & ratings" },
    { id: "notifications", label: "Notifications", href: "/dashboard/domestic-staff/notifications", icon: "🔔", accentColor: "#EA580C", description: "Alerts, ratings & notices" },
    { id: "emergency", label: "Emergency SOS", href: "/dashboard/domestic-staff/emergency", icon: "🆘", accentColor: "#DC2626", description: "One-tap guard alert" },
  ],
};

export const OWNER_TENANT_NAV: DashboardNavConfig = {
  role: "resident",
  title: "Resident Portal",
  subtitle: "Home & Community Self-Service",
  basePath: "/dashboard/owner-tenant",
  color: "#1D4ED8",
  navItems: [
    { id: "overview", label: "Dashboard", href: "/dashboard/owner-tenant", icon: "📊", accentColor: "#1D4ED8", description: "Overview, dues & approvals" },
    { id: "profile", label: "My Profile", href: "/dashboard/owner-tenant/profile", icon: "👤", accentColor: "#0D9488", description: "Personal info & emergency contacts" },
    { id: "property", label: "My Property", href: "/dashboard/owner-tenant/property", icon: "🏢", accentColor: "#0891B2", description: "Unit details & documents" },
    { id: "family-members", label: "Family Members", href: "/dashboard/owner-tenant/family-members", icon: "👨‍👩‍👧‍👦", accentColor: "#7C3AED", description: "Gate pre-approvals & whitelist" },
    { id: "visitors", label: "Visitors", href: "/dashboard/owner-tenant/visitors", icon: "🚪", accentColor: "#7C3AED", description: "Real-time approvals & QR passes" },
    { id: "deliveries", label: "Deliveries", href: "/dashboard/owner-tenant/deliveries", icon: "📦", accentColor: "#EA580C", description: "Gate protocols & delivery history" },
    { id: "amenities", label: "Amenities", href: "/dashboard/owner-tenant/amenities", icon: "🏊", accentColor: "#9333EA", description: "Browse & book community facilities" },
    { id: "maintenance", label: "Maintenance", href: "/dashboard/owner-tenant/maintenance", icon: "🔨", accentColor: "#16A34A", description: "Community upkeep & scheduled work" },
    { id: "complaints", label: "Complaints & Service", href: "/dashboard/owner-tenant/complaints", icon: "🎫", accentColor: "#DC2626", description: "Service tickets & technician chat" },
    { id: "vehicles", label: "Vehicles & Parking", href: "/dashboard/owner-tenant/vehicles", icon: "🚗", accentColor: "#0891B2", description: "Registered vehicles & parking spots" },
    { id: "domestic-staff", label: "Domestic Staff", href: "/dashboard/owner-tenant/domestic-staff", icon: "🧹", accentColor: "#0D9488", description: "Assigned staff, entry logs & ratings" },
    { id: "payments", label: "Payments & Ledger", href: "/dashboard/owner-tenant/payments", icon: "💳", accentColor: "#D97706", description: "Maintenance dues & receipts" },
    { id: "notifications", label: "Notifications", href: "/dashboard/owner-tenant/notifications", icon: "🔔", accentColor: "#EA580C", description: "Community alerts & messages" },
    { id: "emergency", label: "Emergency SOS", href: "/dashboard/owner-tenant/emergency", icon: "🆘", accentColor: "#DC2626", description: "One-tap security dispatch" },
  ],
};

export const AUDITOR_NAV_ITEMS = AUDITOR_NAV.navItems;
export const DOMESTIC_STAFF_NAV_ITEMS = DOMESTIC_STAFF_NAV.navItems;
export const RESIDENT_NAV_ITEMS = OWNER_TENANT_NAV.navItems;

export function getDashboardNavForRole(roleSlug: string): DashboardNavConfig {
  if (roleSlug === "auditor") return AUDITOR_NAV;
  if (roleSlug === "domestic_staff") return DOMESTIC_STAFF_NAV;
  return OWNER_TENANT_NAV;
}
