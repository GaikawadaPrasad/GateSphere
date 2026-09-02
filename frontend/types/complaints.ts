export type TicketPriority = "low" | "medium" | "high" | "emergency";

export type TicketStatus =
  | "created"
  | "assigned"
  | "acknowledged"
  | "in_progress"
  | "resolved"
  | "resident_confirmation"
  | "closed"
  | "reopened";

export interface ServiceCategory {
  id: string;
  community_id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface ServiceTicket {
  id: string;
  community_id: string;
  community_name?: string;
  unit_id: string;
  unit_number?: string;
  category_id: string;
  category_name?: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  raised_by_user_id: string;
  raised_by_name?: string;
  assigned_to_user_id?: string;
  assigned_to_name?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
}
