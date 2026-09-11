"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { domesticStaffApi } from "@/lib/api";
import type { CheckInPayload, Staff, StaffCreate } from "@/types/staff";

export function useStaffList(params?: {
  community_id?: string;
  q?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["staff", params],
    queryFn: () => domesticStaffApi.list(params),
    staleTime: 60_000,
  });
}

export function useStaffDetails(id?: string) {
  return useQuery({
    queryKey: ["staff", id],
    queryFn: () => (id ? domesticStaffApi.get(id) : null),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useStaffAssignments(params?: {
  staff_id?: string;
  unit_id?: string;
  active_only?: boolean;
}) {
  return useQuery({
    queryKey: ["staff-assignments", params],
    queryFn: () => domesticStaffApi.assignments(params),
    enabled: Boolean(params?.staff_id || params?.unit_id),
    staleTime: 60_000,
  });
}

export function useStaffAttendance(params?: {
  community_id?: string;
  staff_id?: string;
  open_only?: boolean;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["staff-attendance", params],
    queryFn: () => domesticStaffApi.attendance(params),
    staleTime: 15_000,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, communityId }: { data: StaffCreate; communityId?: string }) =>
      domesticStaffApi.create(data, communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

export function useCheckInStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CheckInPayload) => domesticStaffApi.checkIn(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useCheckOutStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attendanceId: string) => domesticStaffApi.checkOut(attendanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}
