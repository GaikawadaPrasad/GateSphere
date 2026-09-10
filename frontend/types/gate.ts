export interface GateEvent {
  id: string;
  created_at: string;
  community_id: string;
  gate_id: string | null;
  actor_user_id?: string | null;
  event_type:
    | "visitor_entry"
    | "visitor_exit"
    | "vehicle_entry"
    | "vehicle_exit"
    | "staff_entry"
    | "staff_exit"
    | "checkpoint_override"
    | string;
  reference_type?: string | null;
  reference_id?: string | null;
  occurred_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface PanicAlert {
  id: string;
  created_at: string;
  community_id: string;
  triggered_by_user_id?: string | null;
  gate_id?: string | null;
  alert_type: "medical" | "fire" | "security" | "intrusion" | "other" | string;
  severity: "low" | "medium" | "high" | "critical" | string;
  message?: string | null;
  status: "active" | "acknowledged" | "resolved" | "cancelled" | string;
  triggered_at: string;
  acknowledged_by_user_id?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  resolution_summary?: string | null;
}

export interface GuardRoster {
  id: string;
  community_id: string;
  guard_user_id: string;
  supervisor_user_id?: string | null;
  shift_date: string;
  shift_start: string;
  shift_end: string;
  status: "planned" | "active" | "completed" | "cancelled";
  notes?: string | null;
}
