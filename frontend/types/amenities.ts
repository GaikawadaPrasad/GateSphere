export interface Amenity {
  id: string;
  community_id: string;
  code: string;
  name: string;
  amenity_type: string;
  type?: string;
  location_text?: string | null;
  location?: string | null;
  capacity: number;
  booking_required: boolean;
  is_active: boolean;
  status?: string;
  last_maintenance?: string;
  created_at?: string;
  updated_at?: string;
}

export type Facility = Amenity;

export interface AmenityCreate {
  code: string;
  name: string;
  amenity_type?: string;
  location_text?: string | null;
  capacity?: number;
  booking_required?: boolean;
}

export interface AmenityUpdate {
  name?: string;
  amenity_type?: string;
  location_text?: string | null;
  capacity?: number;
  booking_required?: boolean;
  is_active?: boolean;
}

export interface AmenitySlot {
  id: string;
  community_id: string;
  amenity_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity?: number | null;
  fee: number | string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "rejected"
  | "completed";

export interface AmenityBooking {
  id: string;
  community_id: string;
  amenity_id: string;
  slot_id?: string | null;
  unit_id: string;
  resident_user_id?: string | null;
  booking_date: string;
  start_at: string;
  end_at: string;
  participant_count: number;
  status: BookingStatus | string;
  amount: number | string;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  resident_name?: string | null;
  resident_phone?: string | null;
  unit_number?: string | null;
  tower_name?: string | null;
  unit_label?: string | null;
  amenity_name?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface AmenityBlock {
  id: string;
  community_id: string;
  amenity_id: string;
  blocked_from: string;
  blocked_to: string;
  reason?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
  updated_at?: string;
}
