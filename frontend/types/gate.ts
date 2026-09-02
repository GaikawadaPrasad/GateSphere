export interface GateEvent {
  id: string;
  community_id: string;
  gate_id: string;
  event_type: "visitor_entry" | "visitor_exit" | "vehicle_entry" | "vehicle_exit" | "staff_entry" | "staff_exit" | "checkpoint_override";
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  occurred_at: string;
  metadata?: Record<string, unknown>;
}

export interface PanicAlert {
  id: string;
  community_id: string;
  user_id: string;
  user_name?: string;
  unit_number?: string;
  status: "reported" | "acknowledged" | "responding" | "resolved" | "cancelled";
  created_at: string;
  resolved_at?: string;
  resolution_notes?: string;
}

export interface GuardRoster {
  id: string;
  community_id: string;
  guard_user_id: string;
  guard_name?: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  status: "planned" | "active" | "completed" | "cancelled";
}
