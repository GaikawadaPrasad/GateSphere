export type ResidentType = "owner" | "tenant" | "family_member";
export type ResidentStatus = "active" | "pending" | "moved_out";
export type MoveType = "move_in" | "move_out";
export type MoveStatus =
  | "requested"
  | "scheduled"
  | "approved"
  | "completed"
  | "rejected"
  | "cancelled";

export interface ResidentProfile {
  id: string;
  user_id: string;
  community_id: string;
  community_name?: string;
  full_name: string;
  email?: string;
  phone?: string;
  resident_type: ResidentType;
  status: ResidentStatus;
  primary_occupant: boolean;
  unit_number?: string;
  tower_name?: string;
  created_at: string;
}

export interface UnitOccupancy {
  id: string;
  unit_id: string;
  user_id: string;
  occupant_name?: string;
  occupancy_type: ResidentType;
  is_primary: boolean;
  is_active: boolean;
  start_date: string;
  end_date?: string | null;
}

export interface FamilyMember {
  id: string;
  unit_id: string;
  full_name: string;
  relationship: string;
  phone?: string | null;
  email?: string | null;
  is_child: boolean;
  is_emergency_contact: boolean;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  resident_profile_id: string;
  name: string;
  relationship: string;
  phone: string;
  is_primary: boolean;
}

export interface MoveRecord {
  id: string;
  created_at: string;
  updated_at: string;
  community_id: string;
  unit_id: string;
  resident_profile_id: string;
  unit_number?: string;
  tower_name?: string;
  user_id?: string;
  resident_name?: string;
  move_type: MoveType;
  requested_at?: string;
  scheduled_at?: string | null;
  scheduled_date?: string;
  approved_at?: string | null;
  approved_by_user_id?: string | null;
  status: MoveStatus;
  clearance_notes?: string | null;
  admin_notes?: string | null;
  security_cleared?: boolean;
}
