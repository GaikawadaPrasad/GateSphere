"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { residentsApi } from "@/lib/api";
import type { ListQueryParams } from "@/types/api";
import type { ResidentProfile } from "@/types/residents";

export function useResidents(params?: ListQueryParams) {
  return useQuery({
    queryKey: ["residents", params],
    queryFn: () => residentsApi.list(params),
    staleTime: 30_000,
  });
}

export function useResidentDetails(id?: string) {
  return useQuery({
    queryKey: ["residents", id],
    queryFn: () => (id ? residentsApi.get(id) : null),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useUnitOccupancies(unitId?: string) {
  return useQuery({
    queryKey: ["occupancies", unitId],
    queryFn: () => (unitId ? residentsApi.occupancies(unitId) : []),
    enabled: Boolean(unitId),
    staleTime: 30_000,
  });
}

export function useFamilyMembers(unitId?: string) {
  return useQuery({
    queryKey: ["family-members", unitId],
    queryFn: () => (unitId ? residentsApi.family(unitId) : []),
    enabled: Boolean(unitId),
    staleTime: 30_000,
  });
}

export function useEmergencyContacts(profileId?: string) {
  return useQuery({
    queryKey: ["emergency-contacts", profileId],
    queryFn: () => (profileId ? residentsApi.contacts(profileId) : []),
    enabled: Boolean(profileId),
    staleTime: 60_000,
  });
}

export function useMoveRecords(params?: {
  community_id?: string;
  move_status?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["move-records", params],
    queryFn: () => residentsApi.moveRecords(params),
    staleTime: 15_000,
  });
}

export function useTransitionMoveRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      moveId,
      data,
    }: {
      moveId: string;
      data: { status: string; clearance_notes?: string; scheduled_at?: string };
    }) => residentsApi.transitionMove(moveId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["move-records"] });
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useCreateResidentProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, communityId }: { data: Partial<ResidentProfile>; communityId?: string }) =>
      residentsApi.create(data, communityId),
    onSuccess: (newResident) => {
      queryClient.setQueriesData({ queryKey: ["residents"] }, (old: any) => {
        if (Array.isArray(old)) {
          return [newResident, ...old];
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
  });
}

export function useAddResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      communityId,
      data,
    }: {
      communityId: string;
      data: {
        email: string;
        full_name: string;
        phone?: string;
        password?: string;
        unit_id: string;
        occupancy_role?: string;
        is_primary?: boolean;
        agreement_reference?: string;
      };
    }) => residentsApi.addResident(communityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      queryClient.invalidateQueries({ queryKey: ["community-units"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}
