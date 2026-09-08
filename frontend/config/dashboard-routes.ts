export interface RouteBreadcrumb {
  label: string;
  href?: string;
}

export const ROUTE_TITLE_MAP: Record<string, { title: string; subtitle: string }> = {
  "/facility-manager": {
    title: "Facility Manager Dashboard",
    subtitle: "Operational facilities, preventive maintenance, vendor activity & SLA oversight",
  },
  "/facility-manager/dashboard": {
    title: "Facility Manager Dashboard",
    subtitle: "Operational facilities, preventive maintenance, vendor activity & SLA oversight",
  },
  "/facility-manager/facilities": {
    title: "Facility Management",
    subtitle: "Real-time facility status, availability schedules, and maintenance records",
  },
  "/facility-manager/maintenance": {
    title: "Maintenance Management",
    subtitle: "Schedule, track, and complete preventive and emergency maintenance work",
  },
  "/facility-manager/service-requests": {
    title: "Service Requests",
    subtitle: "Resident & property service ticket triage, vendor assignment, and SLA tracking",
  },
  "/facility-manager/vendors": {
    title: "Vendor Directory & Work Assignment",
    subtitle: "Manage service contracts, active jobs, and completion reviews",
  },
  "/facility-manager/amenities": {
    title: "Amenities & Slot Management",
    subtitle: "Capacity management, booking schedules, and slot maintenance blocks",
  },
  "/facility-manager/complaints": {
    title: "Complaints Triage & SLA Tracking",
    subtitle: "Track, assign, and resolve resident complaints with SLA monitoring",
  },
  "/facility-manager/incidents": {
    title: "Facility Incidents",
    subtitle: "Log, investigate, and resolve operational facility incidents",
  },
  "/facility-manager/notifications": {
    title: "Facility Notifications",
    subtitle: "Operational alerts, ticket notifications, and emergency broadcasts",
  },
  "/facility-manager/reports": {
    title: "Facility & Maintenance Reports",
    subtitle: "Exportable reports for facility utilization, SLA compliance, and vendor performance",
  },

  "/security-supervisor": {
    title: "Security Supervisor Dashboard",
    subtitle: "Live security monitoring, guard roster management, and gate traffic oversight",
  },
  "/security-supervisor/dashboard": {
    title: "Security Supervisor Dashboard",
    subtitle: "Live security monitoring, guard roster management, and gate traffic oversight",
  },
  "/security-supervisor/gate-operations": {
    title: "Gate Operations Supervision",
    subtitle: "Real-time monitoring of entry/exit activity, gate throughput, and overrides",
  },
  "/security-supervisor/guard-management": {
    title: "Guard Roster & Duty Assignment",
    subtitle: "Manage on-duty personnel, shift schedules, and gate assignments",
  },
  "/security-supervisor/visitor-management": {
    title: "Visitor Lifecycle Management",
    subtitle: "Visitor approvals, pass verification history, and frequent visitor logs",
  },
  "/security-supervisor/delivery-management": {
    title: "Delivery Protocols & Oversight",
    subtitle: "Monitor gate delivery logs, protocol decisions, and courier verification",
  },
  "/security-supervisor/domestic-staff": {
    title: "Domestic Staff Monitoring",
    subtitle: "Staff attendance, registered access permissions, and check-in logs",
  },
  "/security-supervisor/blacklist": {
    title: "Blacklist Management",
    subtitle: "Restricted entry registry, violation tracking, and attempted entry alerts",
  },
  "/security-supervisor/incidents": {
    title: "Security Incident Management",
    subtitle: "Security breach investigation, guard actions, and incident logs",
  },
  "/security-supervisor/emergency-alerts": {
    title: "Emergency Alert Command",
    subtitle: "Live panic alerts, response team dispatch, and status resolution",
  },
  "/security-supervisor/checkpoints": {
    title: "Perimeter Checkpoint Management",
    subtitle: "Checkpoint status monitoring, guard duty assignments, and patrol logs",
  },
  "/security-supervisor/reports": {
    title: "Security & Gate Analytics",
    subtitle: "Comprehensive gate traffic, visitor volume, and incident reports",
  },
  "/security-supervisor/audit-logs": {
    title: "Security Audit Trail",
    subtitle: "Immutable read-only log of all security system actions and overrides",
  },

  "/security-guard": {
    title: "Security Guard Gate Console",
    subtitle: "Rapid-action gate operations, visitor verification, and instant emergency alerts",
  },
  "/security-guard/dashboard": {
    title: "Security Guard Gate Console",
    subtitle: "Rapid-action gate operations, visitor verification, and instant emergency alerts",
  },
  "/security-guard/live-gate": {
    title: "Live Gate Verification",
    subtitle: "Instant QR/PIN pass check, blacklist verification, and entry/exit logging",
  },
  "/security-guard/visitors": {
    title: "Visitor Verification",
    subtitle: "Check resident approvals, active passes, and visitor entry status",
  },
  "/security-guard/deliveries": {
    title: "Delivery Check",
    subtitle: "Verify courier, check resident protocol, or mark left at gate desk",
  },
  "/security-guard/cab-taxi": {
    title: "Cab & Taxi Verification",
    subtitle: "Log cab arrival, passenger verification, and gate exit timestamp",
  },
  "/security-guard/staff-attendance": {
    title: "Domestic Staff Check-In / Check-Out",
    subtitle: "Verify staff ID, apartment access permissions, and record attendance",
  },
  "/security-guard/blacklist-check": {
    title: "Instant Blacklist Verification",
    subtitle: "Immediate identity & vehicle plate lookup against restricted entry list",
  },
  "/security-guard/emergency": {
    title: "Emergency Alert Trigger",
    subtitle: "One-tap panic alert dispatch for fire, medical, or security breaches",
  },
  "/security-guard/gate-history": {
    title: "Gate Movement History",
    subtitle: "Read-only log of recent entry and exit gate records",
  },
  "/security-guard/notifications": {
    title: "Gate Notifications",
    subtitle: "Real-time gate notifications and resident visitor approval updates",
  },

  "/vendor-technician": {
    title: "Vendor / Technician Dashboard",
    subtitle: "Active service jobs, assigned work tickets, and gate entry pass status",
  },
  "/vendor-technician/dashboard": {
    title: "Vendor / Technician Dashboard",
    subtitle: "Active service jobs, assigned work tickets, and gate entry pass status",
  },
  "/vendor-technician/assigned-tickets": {
    title: "Assigned Work Tickets",
    subtitle: "Review new service tickets, accepted work orders, and job locations",
  },
  "/vendor-technician/work-progress": {
    title: "Work Status Progression",
    subtitle: "Update real-time job status (On The Way -> Arrived -> In Progress -> Completed)",
  },
  "/vendor-technician/entry-pass": {
    title: "Digital Entry Pass",
    subtitle: "Digital gate entry pass & QR code for security guard verification at community gate",
  },
  "/vendor-technician/work-completion": {
    title: "Work Completion Submission",
    subtitle: "Submit completed work details, proof, materials used, and completion summary",
  },
  "/vendor-technician/service-history": {
    title: "Service Record History",
    subtitle: "Historical record of all completed service contracts and approved work",
  },
  "/vendor-technician/notifications": {
    title: "Vendor Notifications",
    subtitle: "Updates on new job assignments, gate pass approvals, and rework requests",
  },
  "/vendor-technician/profile": {
    title: "Vendor / Technician Profile",
    subtitle: "Manage company details, contact information, and service specializations",
  },
};
