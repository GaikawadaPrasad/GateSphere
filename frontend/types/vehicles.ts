/** Vehicle & Parking (FR-08) — mirrors the `/api/v1/vehicles` *Read schemas. */

export type VehicleType =
  | "car"
  | "bike"
  | "scooter"
  | "bicycle"
  | "ev_car"
  | "ev_bike"
  | "commercial"
  | "other";
export type EntrySource = "resident" | "visitor" | "delivery" | "staff" | "unknown";
export type ViolationType =
  | "wrong_slot"
  | "no_sticker"
  | "blocking"
  | "unauthorized"
  | "expired_pass"
  | "other";
export type ViolationStatus = "open" | "acknowledged" | "resolved" | "waived";
export type SlotStatus = "available" | "allocated" | "reserved" | "blocked";

export interface Vehicle {
  id: string;
  community_id: string;
  resident_profile_id: string | null;
  visitor_id: string | null;
  unit_id: string | null;
  vehicle_type: VehicleType;
  registration_number: string;
  make: string | null;
  model: string | null;
  color: string | null;
  sticker_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VehicleEntry {
  id: string;
  community_id: string;
  vehicle_id: string | null;
  registration_number: string;
  gate_id: string | null;
  entry_at: string;
  exit_at: string | null;
  source_type: EntrySource;
  status: "inside" | "exited";
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParkingSlot {
  id: string;
  community_id: string;
  tower_id: string | null;
  slot_code: string;
  slot_type: string;
  level: string | null;
  status: SlotStatus;
  is_guest_slot: boolean;
  reserved_for_unit_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParkingAllocation {
  id: string;
  community_id: string;
  slot_id: string;
  vehicle_id: string;
  unit_id: string | null;
  allocated_from: string;
  allocated_to: string | null;
  status: "active" | "released";
  created_at: string;
  updated_at: string;
}

export interface ParkingViolation {
  id: string;
  community_id: string;
  vehicle_id: string | null;
  registration_number: string | null;
  parking_slot_id: string | null;
  reported_by_user_id: string | null;
  violation_type: ViolationType;
  description: string | null;
  occurred_at: string;
  evidence_url: string | null;
  fine_amount: string | number | null;
  status: ViolationStatus;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  rows: T[];
  total: number;
}

export interface EntryFilters {
  openOnly?: boolean;
  flaggedOnly?: boolean;
  plate?: string;
  page?: number;
  pageSize?: number;
}

export interface ViolationFilters {
  status?: ViolationStatus | "";
  plate?: string;
  page?: number;
  pageSize?: number;
}

export interface RecordEntryPayload {
  registration_number: string;
  gate_id?: string;
  source_type?: EntrySource;
}

export interface ReportViolationPayload {
  violation_type: ViolationType;
  registration_number?: string;
  vehicle_id?: string;
  parking_slot_id?: string;
  description?: string;
  fine_amount?: number;
}

/** Violation lifecycle — mirrors the service `_VIOLATION_TRANSITIONS` map (UX only). */
export const VIOLATION_NEXT: Record<ViolationStatus, ViolationStatus[]> = {
  open: ["acknowledged", "resolved", "waived"],
  acknowledged: ["resolved", "waived"],
  resolved: [],
  waived: [],
};

export const VIOLATION_TYPE_LABELS: Record<ViolationType, string> = {
  unauthorized: "Unauthorized parking",
  wrong_slot: "Wrong slot",
  blocking: "Blocking / obstruction",
  no_sticker: "No sticker",
  expired_pass: "Expired pass",
  other: "Other",
};

export const ENTRY_SOURCE_LABELS: Record<EntrySource, string> = {
  resident: "Resident",
  visitor: "Visitor",
  delivery: "Delivery",
  staff: "Staff",
  unknown: "Unknown",
};

/** Same canonical form the backend stores (`schemas.normalize_plate`). */
export function normalizePlate(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export const PLATE_PATTERN = /^[A-Z0-9]{3,15}$/;
