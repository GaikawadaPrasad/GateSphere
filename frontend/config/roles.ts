import type { RoleSlug } from "@/types/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badgeKey?: string;
}

export interface RoleConfig {
  slug: RoleSlug;
  title: string;
  defaultRoute: string;
  badgeColor: string;
  navItems: NavItem[];
}

export const ROLE_CONFIGS: Record<string, RoleConfig> = {
  super_admin: {
    slug: "super_admin",
    title: "Super Admin",
    defaultRoute: "/super-admin/dashboard",
    badgeColor: "#3b82f6",
    navItems: [
      { label: "Dashboard", href: "/super-admin/dashboard", icon: "📊" },
      { label: "Communities", href: "/super-admin/communities", icon: "🏢" },
      { label: "Residents", href: "/super-admin/residents", icon: "👥" },
      { label: "Gate Traffic", href: "/super-admin/gate-traffic", icon: "🛡️" },
      { label: "Complaints", href: "/super-admin/complaints", icon: "🎫" },
      { label: "Billing & Finance", href: "/super-admin/billing", icon: "💳" },
      { label: "Reports & Analytics", href: "/super-admin/reports", icon: "📈" },
      { label: "Audit Logs", href: "/super-admin/audit-logs", icon: "📋" },
      { label: "System Settings", href: "/super-admin/settings", icon: "⚙️" },
    ],
  },
  facility_manager: {
    slug: "facility_manager",
    title: "Facility Manager",
    defaultRoute: "/facility-manager/dashboard",
    badgeColor: "#1d4ed8",
    navItems: [
      { label: "Dashboard", href: "/facility-manager/dashboard", icon: "📊" },
      { label: "Facilities", href: "/facility-manager/facilities", icon: "🏢" },
      { label: "Maintenance", href: "/facility-manager/maintenance", icon: "🔧" },
      { label: "Service Requests", href: "/facility-manager/service-requests", icon: "📋" },
      { label: "Vendors", href: "/facility-manager/vendors", icon: "🛠️" },
      { label: "Amenities", href: "/facility-manager/amenities", icon: "🏊" },
      { label: "Complaints", href: "/facility-manager/complaints", icon: "🎫" },
      { label: "Incidents", href: "/facility-manager/incidents", icon: "⚠️" },
      { label: "Notifications", href: "/facility-manager/notifications", icon: "🔔" },
      { label: "Reports", href: "/facility-manager/reports", icon: "📈" },
    ],
  },
  security_supervisor: {
    slug: "security_supervisor",
    title: "Security Supervisor",
    defaultRoute: "/security-supervisor/dashboard",
    badgeColor: "#0d9488",
    navItems: [
      { label: "Dashboard", href: "/security-supervisor/dashboard", icon: "📊" },
      { label: "Gate Operations", href: "/security-supervisor/gate-operations", icon: "🛡️" },
      { label: "Guard Management", href: "/security-supervisor/guard-management", icon: "👮" },
      { label: "Visitor Management", href: "/security-supervisor/visitor-management", icon: "👥" },
      { label: "Delivery Management", href: "/security-supervisor/delivery-management", icon: "📦" },
      { label: "Domestic Staff", href: "/security-supervisor/domestic-staff", icon: "👔" },
      { label: "Blacklist", href: "/security-supervisor/blacklist", icon: "🚫" },
      { label: "Incidents", href: "/security-supervisor/incidents", icon: "⚠️" },
      { label: "Emergency Alerts", href: "/security-supervisor/emergency-alerts", icon: "🚨" },
      { label: "Checkpoints", href: "/security-supervisor/checkpoints", icon: "📍" },
      { label: "Reports", href: "/security-supervisor/reports", icon: "📈" },
      { label: "Audit Logs", href: "/security-supervisor/audit-logs", icon: "📋" },
    ],
  },
  security_guard: {
    slug: "security_guard",
    title: "Security Guard",
    defaultRoute: "/security-guard/dashboard",
    badgeColor: "#06b6d4",
    navItems: [
      { label: "Dashboard", href: "/security-guard/dashboard", icon: "⚡" },
      { label: "Live Gate", href: "/security-guard/live-gate", icon: "🚪" },
      { label: "Visitors", href: "/security-guard/visitors", icon: "👤" },
      { label: "Deliveries", href: "/security-guard/deliveries", icon: "📦" },
      { label: "Cab / Taxi", href: "/security-guard/cab-taxi", icon: "🚖" },
      { label: "Staff Attendance", href: "/security-guard/staff-attendance", icon: "🪪" },
      { label: "Blacklist Check", href: "/security-guard/blacklist-check", icon: "🔍" },
      { label: "Emergency", href: "/security-guard/emergency", icon: "🚨" },
      { label: "Gate History", href: "/security-guard/gate-history", icon: "📜" },
      { label: "Notifications", href: "/security-guard/notifications", icon: "🔔" },
    ],
  },
  vendor_technician: {
    slug: "vendor_technician",
    title: "Vendor / Technician",
    defaultRoute: "/vendor-technician/dashboard",
    badgeColor: "#d97706",
    navItems: [
      { label: "Dashboard", href: "/vendor-technician/dashboard", icon: "📊" },
      { label: "Assigned Tickets", href: "/vendor-technician/assigned-tickets", icon: "🎫" },
      { label: "Work Progress", href: "/vendor-technician/work-progress", icon: "⏳" },
      { label: "Entry Pass", href: "/vendor-technician/entry-pass", icon: "🪪" },
      { label: "Work Completion", href: "/vendor-technician/work-completion", icon: "✅" },
      { label: "Service History", href: "/vendor-technician/service-history", icon: "📜" },
      { label: "Notifications", href: "/vendor-technician/notifications", icon: "🔔" },
      { label: "Profile", href: "/vendor-technician/profile", icon: "👤" },
    ],
  },
};
