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
  basePath: "/auditor",
  color: "#475569",
  navItems: [
    {
      id: "overview",
      label: "Dashboard",
      href: "/auditor/dashboard",
      icon: "📊",
      accentColor: "#1D4ED8",
      description: "Audit summary & KPI drill-downs",
    },
    {
      id: "audit-logs",
      label: "Audit Logs",
      href: "/auditor/audit-logs",
      icon: "📋",
      accentColor: "#475569",
      description: "Immutable system action trail",
    },
    {
      id: "user-activity",
      label: "User Activity",
      href: "/auditor/user-activity",
      icon: "👥",
      accentColor: "#0D9488",
      description: "Reconstructed user action histories",
    },
    {
      id: "gate-activity",
      label: "Gate Activity",
      href: "/auditor/gate-activity",
      icon: "🛡️",
      accentColor: "#1D4ED8",
      description: "Live entry/exit records & anomalies",
    },
    {
      id: "visitor-records",
      label: "Visitor Records",
      href: "/auditor/visitor-records",
      icon: "🚪",
      accentColor: "#7C3AED",
      description: "Visitor lifecycle & compliance logs",
    },
    {
      id: "maintenance-records",
      label: "Maintenance Records",
      href: "/auditor/maintenance-records",
      icon: "🔧",
      accentColor: "#16A34A",
      description: "Ticket lifecycle & SLA verification",
    },
    {
      id: "vendor-activity",
      label: "Vendor Activity",
      href: "/auditor/vendor-activity",
      icon: "👷",
      accentColor: "#D97706",
      description: "Vendor passes & proof of completion",
    },
    {
      id: "incident-records",
      label: "Incident Records",
      href: "/auditor/incident-records",
      icon: "🚨",
      accentColor: "#DC2626",
      description: "Security incident trail & resolutions",
    },
    {
      id: "financial-records",
      label: "Financial Records",
      href: "/auditor/financial-records",
      icon: "💳",
      accentColor: "#D97706",
      description: "Read-only ledger & reconciliation",
    },
    {
      id: "reports",
      label: "Reports",
      href: "/auditor/reports",
      icon: "📈",
      accentColor: "#475569",
      description: "Exportable compliance summaries",
    },
    {
      id: "audit-search",
      label: "Audit Search",
      href: "/auditor/audit-search",
      icon: "🔍",
      accentColor: "#0891B2",
      description: "Cross-module historical search",
    },
  ],
};

export const DOMESTIC_STAFF_NAV: DashboardNavConfig = {
  role: "domestic_staff",
  title: "Staff Operations",
  subtitle: "Daily Work & Gate Access",
  basePath: "/domestic-staff",
  color: "#0D9488",
  navItems: [
    {
      id: "overview",
      label: "Dashboard",
      href: "/domestic-staff/dashboard",
      icon: "🏠",
      accentColor: "#0D9488",
      description: "Daily schedule & gate status",
    },
    {
      id: "profile",
      label: "My Profile",
      href: "/domestic-staff/profile",
      icon: "👤",
      accentColor: "#1D4ED8",
      description: "Contact details & police verification",
    },
    {
      id: "assigned-homes",
      label: "Assigned Homes",
      href: "/domestic-staff/assigned-homes",
      icon: "🏢",
      accentColor: "#0D9488",
      description: "Units & resident contacts",
    },
    {
      id: "schedule",
      label: "Schedule",
      href: "/domestic-staff/schedule",
      icon: "📅",
      accentColor: "#7C3AED",
      description: "Working shifts & shift alerts",
    },
    {
      id: "attendance",
      label: "Attendance",
      href: "/domestic-staff/attendance",
      icon: "⏱️",
      accentColor: "#16A34A",
      description: "Gate-synced hours & history",
    },
    {
      id: "entry-exit",
      label: "Entry / Exit",
      href: "/domestic-staff/entry-exit",
      icon: "🛡️",
      accentColor: "#1D4ED8",
      description: "Gate pass & duty check-in/out",
    },
    {
      id: "visits",
      label: "Visits",
      href: "/domestic-staff/visits",
      icon: "📋",
      accentColor: "#0891B2",
      description: "Historical visits & ratings",
    },
    {
      id: "notifications",
      label: "Notifications",
      href: "/domestic-staff/notifications",
      icon: "🔔",
      accentColor: "#EA580C",
      description: "Alerts, ratings & notices",
    },
    {
      id: "emergency",
      label: "Emergency SOS",
      href: "/domestic-staff/emergency",
      icon: "🆘",
      accentColor: "#DC2626",
      description: "One-tap guard alert",
    },
  ],
};

export const OWNER_TENANT_NAV: DashboardNavConfig = {
  role: "resident",
  title: "Resident Portal",
  subtitle: "Home & Community Self-Service",
  basePath: "/owner-tenant",
  color: "#1D4ED8",
  navItems: [
    {
      id: "overview",
      label: "Dashboard",
      href: "/owner-tenant/dashboard",
      icon: "📊",
      accentColor: "#1D4ED8",
      description: "Overview, dues & approvals",
    },
    {
      id: "profile",
      label: "My Profile",
      href: "/owner-tenant/profile",
      icon: "👤",
      accentColor: "#0D9488",
      description: "Personal info & emergency contacts",
    },
    {
      id: "property",
      label: "My Property",
      href: "/owner-tenant/property",
      icon: "🏢",
      accentColor: "#0891B2",
      description: "Unit details & documents",
    },
    {
      id: "family-members",
      label: "Family Members",
      href: "/owner-tenant/family-members",
      icon: "👨‍👩‍👧‍👦",
      accentColor: "#7C3AED",
      description: "Gate pre-approvals & whitelist",
    },
    {
      id: "visitors",
      label: "Visitors",
      href: "/owner-tenant/visitors",
      icon: "🚪",
      accentColor: "#7C3AED",
      description: "Real-time approvals & QR passes",
    },
    {
      id: "deliveries",
      label: "Deliveries",
      href: "/owner-tenant/deliveries",
      icon: "📦",
      accentColor: "#EA580C",
      description: "Gate protocols & delivery history",
    },
    {
      id: "amenities",
      label: "Amenities",
      href: "/owner-tenant/amenities",
      icon: "🏊",
      accentColor: "#9333EA",
      description: "Browse & book community facilities",
    },
    {
      id: "maintenance",
      label: "Maintenance",
      href: "/owner-tenant/maintenance",
      icon: "🔨",
      accentColor: "#16A34A",
      description: "Community upkeep & scheduled work",
    },
    {
      id: "complaints",
      label: "Complaints & Service",
      href: "/owner-tenant/complaints",
      icon: "🎫",
      accentColor: "#DC2626",
      description: "Service tickets & technician chat",
    },
    {
      id: "vehicles",
      label: "Vehicles & Parking",
      href: "/owner-tenant/vehicles",
      icon: "🚗",
      accentColor: "#0891B2",
      description: "Registered vehicles & parking spots",
    },
    {
      id: "domestic-staff",
      label: "Domestic Staff",
      href: "/owner-tenant/domestic-staff",
      icon: "🧹",
      accentColor: "#0D9488",
      description: "Assigned staff, entry logs & ratings",
    },
    {
      id: "payments",
      label: "Payments & Ledger",
      href: "/owner-tenant/payments",
      icon: "💳",
      accentColor: "#D97706",
      description: "Maintenance dues & receipts",
    },
    {
      id: "notifications",
      label: "Notifications",
      href: "/owner-tenant/notifications",
      icon: "🔔",
      accentColor: "#EA580C",
      description: "Community alerts & messages",
    },
    {
      id: "emergency",
      label: "Emergency SOS",
      href: "/owner-tenant/emergency",
      icon: "🆘",
      accentColor: "#DC2626",
      description: "One-tap security dispatch",
    },
  ],
};

export const SECURITY_GUARD_NAV: DashboardNavConfig = {
  role: "security_guard",
  title: "Security Guard",
  subtitle: "Gate Operations & Access Verification",
  basePath: "/security-guard",
  color: "#DC2626",
  navItems: [
    {
      id: "dashboard",
      label: "Gate Console",
      href: "/security-guard/dashboard",
      icon: "🛡️",
      accentColor: "#DC2626",
      description: "Live gate operations & KPIs",
    },
    {
      id: "live-gate",
      label: "Pass / PIN Verify",
      href: "/security-guard/live-gate",
      icon: "🚪",
      accentColor: "#2563EB",
      description: "Instant QR / Pass code verification",
    },
    {
      id: "visitors",
      label: "Visitor Management",
      href: "/security-guard/visitors",
      icon: "👤",
      accentColor: "#7C3AED",
      description: "Daily visitor entry & exit check",
    },
    {
      id: "deliveries",
      label: "Delivery Desk",
      href: "/security-guard/deliveries",
      icon: "📦",
      accentColor: "#D97706",
      description: "Courier arrival & handoff logging",
    },
    {
      id: "cab-taxi",
      label: "Cab / Taxi Verify",
      href: "/security-guard/cab-taxi",
      icon: "🚖",
      accentColor: "#059669",
      description: "Cab license & driver verification",
    },
    {
      id: "staff-attendance",
      label: "Staff Attendance",
      href: "/security-guard/staff-attendance",
      icon: "🪪",
      accentColor: "#0D9488",
      description: "Domestic staff check-in & check-out",
    },
    {
      id: "blacklist-check",
      label: "Blacklist Lookup",
      href: "/security-guard/blacklist-check",
      icon: "🔍",
      accentColor: "#DC2626",
      description: "Real-time security registry search",
    },
    {
      id: "emergency",
      label: "SOS & Emergency",
      href: "/security-guard/emergency",
      icon: "🚨",
      accentColor: "#EF4444",
      description: "Panic alarm & emergency broadcast",
    },
    {
      id: "gate-history",
      label: "Gate History",
      href: "/security-guard/gate-history",
      icon: "📜",
      accentColor: "#475569",
      description: "Read-only gate event logs",
    },
    {
      id: "notifications",
      label: "Notifications",
      href: "/security-guard/notifications",
      icon: "🔔",
      accentColor: "#3B82F6",
      description: "Gate notifications & alerts",
    },
  ],
};

export const VENDOR_TECHNICIAN_NAV: DashboardNavConfig = {
  role: "vendor_technician",
  title: "Vendor / Technician",
  subtitle: "Service Operations & Digital Passes",
  basePath: "/vendor-technician",
  color: "#D97706",
  navItems: [
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/vendor-technician/dashboard",
      icon: "📊",
      accentColor: "#2563EB",
      description: "Work console, active job & KPI metrics",
    },
    {
      id: "assigned-tickets",
      label: "Assigned Tickets",
      href: "/vendor-technician/assigned-tickets",
      icon: "🎫",
      accentColor: "#F59E0B",
      description: "Assigned work orders & job acceptance",
    },
    {
      id: "work-progress",
      label: "Work Progress",
      href: "/vendor-technician/work-progress",
      icon: "⏳",
      accentColor: "#3B82F6",
      description: "Update step-by-step job execution status",
    },
    {
      id: "entry-pass",
      label: "Entry Pass",
      href: "/vendor-technician/entry-pass",
      icon: "🪪",
      accentColor: "#10B981",
      description: "Digital QR gate pass for security scanning",
    },
    {
      id: "work-completion",
      label: "Work Completion",
      href: "/vendor-technician/work-completion",
      icon: "✅",
      accentColor: "#059669",
      description: "Submit materials, remarks & completion proof",
    },
    {
      id: "service-history",
      label: "Service History",
      href: "/vendor-technician/service-history",
      icon: "📜",
      accentColor: "#6B7280",
      description: "Historical archive of completed work orders",
    },
    {
      id: "notifications",
      label: "Notifications",
      href: "/vendor-technician/notifications",
      icon: "🔔",
      accentColor: "#8B5CF6",
      description: "Assignment alerts & signoff updates",
    },
    {
      id: "profile",
      label: "Profile",
      href: "/vendor-technician/profile",
      icon: "👤",
      accentColor: "#4B5563",
      description: "Technician credentials & service details",
    },
  ],
};

export const AUDITOR_NAV_ITEMS = AUDITOR_NAV.navItems;
export const DOMESTIC_STAFF_NAV_ITEMS = DOMESTIC_STAFF_NAV.navItems;
export const RESIDENT_NAV_ITEMS = OWNER_TENANT_NAV.navItems;
export const SECURITY_GUARD_NAV_ITEMS = SECURITY_GUARD_NAV.navItems;
export const VENDOR_TECHNICIAN_NAV_ITEMS = VENDOR_TECHNICIAN_NAV.navItems;

export function getDashboardNavForRole(roleSlug: string): DashboardNavConfig {
  if (roleSlug === "auditor") return AUDITOR_NAV;
  if (roleSlug === "domestic_staff") return DOMESTIC_STAFF_NAV;
  if (roleSlug === "security_guard") return SECURITY_GUARD_NAV;
  if (roleSlug === "vendor_technician") return VENDOR_TECHNICIAN_NAV;
  return OWNER_TENANT_NAV;
}

