export interface OverviewStats {
  community_id: string;
  residents: number;
  units: number;
  pending_visitor_requests: number;
  visitors_inside: number;
  pending_deliveries: number;
  open_tickets: number;
  open_incidents: number;
  active_panic_alerts: number;
  outstanding_balance: string; // decimal string
}

export interface SecurityStats {
  community_id: string;
  visitors_inside: number;
  vehicles_inside: number;
  staff_inside: number;
  pending_visitor_approvals: number;
  expected_visitors: number;
  active_panic_alerts: number;
  open_incidents: number;
  guards_on_active_roster: number;
}

export interface FinancialStats {
  community_id: string;
  invoices_by_status: Record<string, number>;
  total_billed: string; // decimal string
  total_collected: string; // decimal string
  outstanding_balance: string; // decimal string
}

export interface ResidentStats {
  community_id: string;
  unit_id: string | null;
  my_open_tickets: number;
  my_pending_visitor_requests: number;
  my_upcoming_bookings: number;
  my_outstanding_balance: string;
  published_announcements: number;
}

export interface CommunityMetricsBreakdown {
  totalUnits: number;
  totalResidents: number;
  occupancyRate: number;
  totalTowers?: number;
  financialStatus: "Good" | "Attention" | "Critical";
  openTickets: number;
}

export interface SuperAdminDashboardMetrics {
  totalCommunities: number;
  activeCommunities: number;
  inactiveCommunities: number;
  totalUnits: number;
  totalResidents: number;
  occupancyRate: number; // percentage (0-100)
  activeGateTraffic: number; // visitors + vehicles + staff inside
  visitorsInside: number;
  vehiclesInside: number;
  staffInside: number;
  openComplaints: number;
  criticalComplaints: number;
  activePanicAlerts: number;
  openIncidents: number;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number; // percentage (0-100)
  communityBreakdown?: Record<string, CommunityMetricsBreakdown>;
}

