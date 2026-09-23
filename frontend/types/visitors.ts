export interface Visitor {
  id: string;
  community_id: string;
  full_name: string;
  phone: string;
  photo_url?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  vehicle_number?: string | null;
  frequent_visitor_flag?: boolean;
  visit_count?: number;
  last_visit_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type VisitorRecord = Visitor & {
  status?: string;
  entry_at?: string | null;
  exit_at?: string | null;
  purpose?: string | null;
  unit_number?: string | null;
  visitor_type?: string | null;
  visitor_name?: string | null;
  host_name?: string | null;
  gate_name?: string | null;
  vehicle_plate?: string | null;
  notes?: string | null;
  pass_code?: string | null;
};

export interface VisitorPass {
  id: string;
  request_id: string;
  pass_type: string;
  valid_from: string;
  valid_to: string;
  max_entries: number;
  entry_count: number;
  is_revoked: boolean;
  token?: string | null;
  pin?: string | null;
  created_at?: string;
}

export interface VisitorRequest {
  id: string;
  community_id: string;
  visitor_id: string;
  unit_id: string;
  host_user_id?: string | null;
  visitor_type: string;
  purpose?: string | null;
  expected_at?: string | null;
  valid_until?: string | null;
  status: string;
  approval_required: boolean;
  vehicle_number?: string | null;
  group_label?: string | null;
  party_size: number;
  visitor?: Visitor | null;
  visitor_name?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  passes?: VisitorPass[];
  created_at: string;
  updated_at?: string;
}

export interface VisitorEntry {
  id: string;
  community_id: string;
  request_id?: string | null;
  visitor_id: string;
  gate_id?: string | null;
  entry_at?: string | null;
  exit_at?: string | null;
  entry_photo_url?: string | null;
  vehicle_number?: string | null;
  status: string;
  denial_reason?: string | null;
  created_at?: string;
  visitor_name?: string | null;
  phone?: string | null;
}

export interface BlacklistEntry {
  id: string;
  community_id?: string;
  visitor_id?: string | null;
  name?: string;
  phone?: string;
  phone_hash?: string;
  id_type?: string;
  id_number?: string;
  id_number_hash?: string;
  vehicle_number?: string;
  reason?: string;
  risk_level?: string;
  active_from?: string;
  active_until?: string;
  created_at?: string;
  date_added?: string;
  status?: string;
  is_active?: boolean;
}
