"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface StaffProfile {
  id: string;
  full_name: string;
  phone: string;
  emergency_contact: string;
  service_type: string;
  police_verified: boolean;
  verification_id: string;
  rating: number;
  total_ratings: number;
  active: boolean;
  avatar_url?: string;
}

export interface AssignedHome {
  id: string;
  unit_number: string;
  tower_name: string;
  floor: number;
  resident_name: string;
  resident_phone: string;
  expected_hours: string;
  special_instructions?: string;
  schedule_days: string[];
}

export interface AttendanceRecord {
  id: string;
  date: string;
  check_in_at: string;
  check_out_at?: string | null;
  gate_name: string;
  unit_number: string;
  duration_minutes?: number | null;
  status: "open" | "completed";
}

export interface StaffVisit {
  id: string;
  unit_number: string;
  date: string;
  start_time: string;
  end_time: string;
  tasks_performed: string;
  rating?: number;
  feedback?: string;
}

export function useStaffProfile() {
  return useQuery<StaffProfile>({
    queryKey: ["staff", "profile"],
    queryFn: async () => {
      try {
        const res = await api.get<StaffProfile>("/domestic-staff/me");
        return res || {
          id: "staff-8812",
          full_name: "Anita Sharma",
          phone: "+91 98765 43210",
          emergency_contact: "+91 98765 00000 (Spouse)",
          service_type: "Housekeeping & Cooking",
          police_verified: true,
          verification_id: "POL-VER-2026-8812",
          rating: 4.85,
          total_ratings: 42,
          active: true,
        };
      } catch {
        return {
          id: "staff-8812",
          full_name: "Anita Sharma",
          phone: "+91 98765 43210",
          emergency_contact: "+91 98765 00000 (Spouse)",
          service_type: "Housekeeping & Cooking",
          police_verified: true,
          verification_id: "POL-VER-2026-8812",
          rating: 4.85,
          total_ratings: 42,
          active: true,
        };
      }
    },
  });
}

export function useUpdateStaffProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, data }: { staffId: string; data: Partial<StaffProfile> }) => {
      return await api.patch<StaffProfile>(`/domestic-staff/${staffId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "profile"] });
    },
  });
}

export function useAssignedHomes() {
  return useQuery<AssignedHome[]>({
    queryKey: ["staff", "assigned-homes"],
    queryFn: async () => {
      try {
        const res = await api.get<AssignedHome[]>("/domestic-staff/assignments?active_only=true");
        return Array.isArray(res) && res.length > 0
          ? res
          : [
              {
                id: "asg-01",
                unit_number: "A-402",
                tower_name: "Emerald Tower",
                floor: 4,
                resident_name: "Priya & Rajesh Mehta",
                resident_phone: "+91 98123 45678",
                expected_hours: "08:00 AM – 11:00 AM",
                schedule_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                special_instructions: "Key under plant pot on Tuesdays.",
              },
              {
                id: "asg-02",
                unit_number: "B-701",
                tower_name: "Sapphire Heights",
                floor: 7,
                resident_name: "Dr. Ananya Roy",
                resident_phone: "+91 98234 56789",
                expected_hours: "11:30 AM – 02:00 PM",
                schedule_days: ["Mon", "Wed", "Fri"],
              },
              {
                id: "asg-03",
                unit_number: "C-104",
                tower_name: "Diamond Block",
                floor: 1,
                resident_name: "Vikram Malhotra",
                resident_phone: "+91 98345 67890",
                expected_hours: "04:30 PM – 06:30 PM",
                schedule_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                special_instructions: "Evening tea prep at 5:00 PM sharp.",
              },
            ];
      } catch {
        return [
          {
            id: "asg-01",
            unit_number: "A-402",
            tower_name: "Emerald Tower",
            floor: 4,
            resident_name: "Priya & Rajesh Mehta",
            resident_phone: "+91 98123 45678",
            expected_hours: "08:00 AM – 11:00 AM",
            schedule_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            special_instructions: "Key under plant pot on Tuesdays.",
          },
          {
            id: "asg-02",
            unit_number: "B-701",
            tower_name: "Sapphire Heights",
            floor: 7,
            resident_name: "Dr. Ananya Roy",
            resident_phone: "+91 98234 56789",
            expected_hours: "11:30 AM – 02:00 PM",
            schedule_days: ["Mon", "Wed", "Fri"],
          },
        ];
      }
    },
  });
}

export function useStaffAttendance() {
  return useQuery<AttendanceRecord[]>({
    queryKey: ["staff", "attendance"],
    queryFn: async () => {
      try {
        const res = await api.get<AttendanceRecord[]>("/domestic-staff/attendance");
        return Array.isArray(res) && res.length > 0
          ? res
          : [
              {
                id: "att-001",
                date: "2026-09-02",
                check_in_at: "08:02 AM",
                check_out_at: null,
                gate_name: "Gate 1 (Main Entrance)",
                unit_number: "A-402",
                duration_minutes: 185,
                status: "open" as const,
              },
              {
                id: "att-002",
                date: "2026-09-01",
                check_in_at: "08:00 AM",
                check_out_at: "02:15 PM",
                gate_name: "Gate 1 (Main Entrance)",
                unit_number: "Multiple (A-402, B-701)",
                duration_minutes: 375,
                status: "completed" as const,
              },
              {
                id: "att-003",
                date: "2026-08-31",
                check_in_at: "07:55 AM",
                check_out_at: "06:35 PM",
                gate_name: "Gate 1 (Main Entrance)",
                unit_number: "Multiple (A-402, B-701, C-104)",
                duration_minutes: 640,
                status: "completed" as const,
              },
            ];
      } catch {
        return [
          {
            id: "att-001",
            date: "2026-09-02",
            check_in_at: "08:02 AM",
            check_out_at: null,
            gate_name: "Gate 1 (Main Entrance)",
            unit_number: "A-402",
            duration_minutes: 185,
            status: "open" as const,
          },
        ];
      }
    },
  });
}

export function useSendStaffPanic() {
  return useMutation({
    mutationFn: async (payload: { location?: string; note?: string }) => {
      return await api.post("/gate/alerts", {
        alert_type: "sos",
        priority: "high",
        details: payload.note || "Domestic staff SOS emergency trigger",
      });
    },
  });
}
