export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus =
  | "reported"
  | "acknowledged"
  | "responding"
  | "contained"
  | "resolved"
  | "closed"
  | "false_alarm";

export type IncidentType =
  | "medical"
  | "fire"
  | "theft"
  | "suspicious"
  | "breach"
  | "vandalism"
  | "noise"
  | "parking"
  | "other";

export type ActionType =
  | "note"
  | "dispatch"
  | "escalation"
  | "authority_contacted"
  | "evacuation"
  | "medical_aid"
  | "update";

export interface Incident {
  id: string;
  created_at: string;
  updated_at: string;
  community_id: string;
  incident_number: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  tower_id?: string | null;
  unit_id?: string | null;
  gate_id?: string | null;
  location_text?: string | null;
  reporter_user_id?: string | null;
  panic_alert_id?: string | null;
  description?: string | null;
  reported_at: string;
  resolved_at?: string | null;
  resolution_summary?: string | null;
}

export interface IncidentCreate {
  incident_type: IncidentType;
  severity?: IncidentSeverity;
  location_text?: string | null;
  description?: string | null;
  community_id?: string | null;
}

export interface IncidentTransition {
  status: IncidentStatus;
  reason?: string | null;
  resolution_summary?: string | null;
}

export interface IncidentAction {
  id: string;
  incident_id: string;
  actor_user_id?: string | null;
  action_type: ActionType;
  details?: string | null;
  action_at: string;
  created_at: string;
}

export interface IncidentHistory {
  id: string;
  incident_id: string;
  old_status?: string | null;
  new_status: string;
  changed_by_user_id?: string | null;
  reason?: string | null;
  changed_at: string;
  created_at: string;
}
