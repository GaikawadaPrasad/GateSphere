export type ResidentType = "owner" | "tenant" | "family_member";
export type ResidentStatus = "active" | "pending" | "moved_out";

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
  occupancy_type: ResidentType;
  is_primary: boolean;
  is_active: boolean;
  start_date: string;
  end_date?: string;
}
