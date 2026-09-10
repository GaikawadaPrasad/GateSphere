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
  current_status?: string;
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
  duration_minutes?: number | null;
  tasks_performed: string;
  rating?: number;
  feedback?: string;
}

export function useStaffProfile() {
  return useQuery<StaffProfile>({
    queryKey: ["staff", "profile"],
    queryFn: async () => {
      const res = await api.get<any>("/domestic-staff/me");
      if (!res) {
        throw new Error("Staff profile not found");
      }
      return {
        id: res.id,
        full_name: res.full_name || "Domestic Staff Member",
        phone: res.phone || "",
        emergency_contact: res.emergency_address || "None specified",
        service_type: res.staff_type ? `${res.staff_type.toUpperCase()} Services` : "General Help",
        police_verified: res.police_verification_status === "verified",
        verification_id: res.id_type ? `${res.id_type.toUpperCase()}` : "",
        rating: Number(res.rating_avg ?? 5.0),
        total_ratings: Number(res.ratings_count ?? 0),
        active: res.is_active ?? true,
        avatar_url: res.photo_url,
        current_status: res.current_status || "outside",
      };
    },
  });
}

export function useUpdateStaffProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, data }: { staffId?: string; data: Partial<StaffProfile> }) => {
      return await api.patch<any>("/domestic-staff/me", {
        phone: data.phone,
        emergency_address: data.emergency_contact,
        photo_url: data.avatar_url,
      });
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
      const res = await api.get<any[]>("/domestic-staff/me/assignments");
      if (!Array.isArray(res)) return [];
      return res.map((a: any) => ({
        id: a.id,
        unit_number: a.unit_number || "Unit",
        tower_name: a.tower_name || "Main Tower",
        floor: a.floor_number || 1,
        resident_name: a.resident_name || "Resident",
        resident_phone: a.resident_phone || "+919800000000",
        expected_hours:
          a.time_from && a.time_to ? `${a.time_from} – ${a.time_to}` : "08:00 AM – 11:00 AM",
        special_instructions: a.work_type
          ? `${a.work_type.replace("_", " ").toUpperCase()} duty`
          : undefined,
        schedule_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      }));
    },
  });
}

export function useStaffAttendance() {
  return useQuery<AttendanceRecord[]>({
    queryKey: ["staff", "attendance"],
    queryFn: async () => {
      const res = await api.get<any[]>("/domestic-staff/me/attendance");
      if (!Array.isArray(res)) return [];
      return res.map((att: any) => ({
        id: att.id,
        date: att.check_in_at ? att.check_in_at.split("T")[0] : "",
        check_in_at: att.check_in_at
          ? new Date(att.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "",
        check_out_at: att.check_out_at
          ? new Date(att.check_out_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
        gate_name: att.gate_id ? "Main Gate 1" : "Gate Operations",
        unit_number: "Assigned Units",
        duration_minutes:
          att.check_out_at && att.check_in_at
            ? Math.round(
                (new Date(att.check_out_at).getTime() - new Date(att.check_in_at).getTime()) /
                  60000,
              )
            : null,
        status: att.check_out_at ? ("completed" as const) : ("open" as const),
      }));
    },
  });
}

export function useStaffVisits() {
  return useQuery<StaffVisit[]>({
    queryKey: ["staff", "visits"],
    queryFn: async () => {
      const res = await api.get<any[]>("/domestic-staff/me/visits");
      if (!Array.isArray(res)) return [];
      return res.map((v: any) => ({
        id: v.id,
        unit_number: v.unit_number || "Assigned Unit",
        date: v.date || (v.check_in_at ? v.check_in_at.split("T")[0] : ""),
        start_time: v.check_in_at
          ? new Date(v.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "",
        end_time: v.check_out_at
          ? new Date(v.check_out_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "In Progress",
        duration_minutes:
          v.duration_minutes ||
          (v.check_out_at && v.check_in_at
            ? Math.round(
                (new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 60000,
              )
            : null),
        tasks_performed: v.tasks_performed || "Domestic Service",
        rating: v.rating ? Number(v.rating) : 5,
        feedback: v.feedback || "Good service provided.",
      }));
    },
  });
}

export function useStaffCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, gateId }: { staffId: string; gateId?: string }) => {
      return await api.post("/domestic-staff/attendance/check-in", {
        staff_id: staffId,
        gate_id: gateId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "attendance"] });
      queryClient.invalidateQueries({ queryKey: ["staff", "profile"] });
    },
  });
}

export function useStaffCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ attendanceId }: { attendanceId: string }) => {
      return await api.patch(`/domestic-staff/attendance/${attendanceId}/check-out`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "attendance"] });
      queryClient.invalidateQueries({ queryKey: ["staff", "profile"] });
    },
  });
}

export function useSendStaffPanic() {
  return useMutation({
    mutationFn: async (payload: { location?: string; note?: string }) => {
      return await api.post("/gate/alerts", {
        alert_type: "medical",
        severity: "high",
        message: payload.note || "Domestic staff SOS emergency trigger",
      });
    },
  });
}
