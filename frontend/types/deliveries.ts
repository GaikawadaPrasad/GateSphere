export type DeliveryType =
  | "food"
  | "courier"
  | "grocery"
  | "medicine"
  | "ecommerce"
  | "other";

export type DeliveryStatus =
  | "expected"
  | "arrived"
  | "approved"
  | "rejected"
  | "delivered"
  | "collected_at_gate"
  | "cancelled";

export type DeliveryApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "auto_approved";

export type ProtocolType =
  | "direct_entry"
  | "collect_at_gate"
  | "leave_at_door"
  | "resident_approval_required";

export interface DeliveryProtocol {
  id: string;
  community_id: string;
  delivery_type: DeliveryType | string;
  unit_id?: string | null;
  protocol_type: ProtocolType | string;
  requires_otp: boolean;
  allow_direct_entry: boolean;
  leave_at_gate: boolean;
  allowed_start_time?: string | null;
  allowed_end_time?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryItem {
  id: string;
  community_id: string;
  unit_id: string;
  unit_number?: string | null;
  resident_user_id?: string | null;
  protocol_id?: string | null;
  delivery_type: DeliveryType | string;
  provider_name?: string | null;
  executive_name?: string | null;
  executive_phone?: string | null;
  tracking_reference?: string | null;
  approval_status: DeliveryApprovalStatus | string;
  approved_by_user_id?: string | null;
  expected_at?: string | null;
  arrived_at?: string | null;
  status: DeliveryStatus | string;
  parcel_count: number;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface DeliveryCreatePayload {
  unit_id: string;
  delivery_type: string;
  provider_name?: string;
  executive_name?: string;
  executive_phone?: string;
  tracking_reference?: string;
  expected_at?: string;
  parcel_count?: number;
  notes?: string;
}
