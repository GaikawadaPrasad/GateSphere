/** Matches backend StaffRead schema exactly */
export type StaffType =
  | "maid"
  | "cook"
  | "driver"
  | "nanny"
  | "caretaker"
  | "gardener"
  | "nurse"
  | "other";
export type VerificationStatus = "not_started" | "pending" | "verified" | "rejected" | "expired";

export interface Staff {
  id: string;
  created_at: string;
  updated_at: string;
  community_id: string;
  user_id?: string | null;
  full_name: string;
  staff_type: StaffType;
  phone: string;
  photo_url?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  police_verification_status: VerificationStatus;
  verification_expiry?: string | null;
  emergency_address?: string | null;
  is_active: boolean;
}

/** Matches backend StaffCreate schema — extra="forbid" */
export interface StaffCreate {
  full_name: string;
  staff_type: StaffType;
  phone: string;
  email?: string | null;
  password?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  police_verification_status?: VerificationStatus;
}

export interface StaffAssignment {
  id: string;
  created_at: string;
  staff_id: string;
  unit_id: string;
  unit_number?: string;
  tower_name?: string;
  work_type: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
}

export interface StaffAttendance {
  id: string;
  created_at: string;
  community_id: string;
  staff_id: string;
  staff_name?: string;
  staff_type?: string;
  photo_url?: string | null;
  check_in_at: string;
  check_out_at?: string | null;
  gate_id?: string | null;
  attendance_status?: string;
}

/** Matches backend CheckInCreate schema — extra="forbid" */
export interface CheckInPayload {
  staff_id: string;
  gate_id?: string | null;
}
