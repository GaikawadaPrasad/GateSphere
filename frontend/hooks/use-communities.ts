"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { communitiesApi } from "@/lib/api";
import type { Community } from "@/types/communities";

export const communityKeys = {
  all: ["communities"] as const,
  lists: () => [...communityKeys.all, "list"] as const,
  list: (params?: { active?: boolean }) => [...communityKeys.lists(), params] as const,
  details: () => [...communityKeys.all, "detail"] as const,
  detail: (id: string) => [...communityKeys.details(), id] as const,
};

export function useCommunities(params?: { active?: boolean }) {
  return useQuery({
    queryKey: communityKeys.list(params),
    queryFn: () => communitiesApi.list(params),
    staleTime: 60_000,
  });
}

export function useCommunity(id?: string) {
  return useQuery({
    queryKey: communityKeys.detail(id || ""),
    queryFn: () => (id ? communitiesApi.get(id) : null),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export const useCommunityDetails = useCommunity;

export function useTowers(communityId?: string) {
  return useQuery({
    queryKey: ["towers", communityId],
    queryFn: () => (communityId ? communitiesApi.towers(communityId) : []),
    enabled: Boolean(communityId),
    staleTime: 60_000,
  });
}

export function useFloors(towerId?: string) {
  return useQuery({
    queryKey: ["floors", towerId],
    queryFn: () => (towerId ? communitiesApi.floors(towerId) : []),
    enabled: Boolean(towerId),
    staleTime: 60_000,
  });
}

export function useUnits(floorId?: string) {
  return useQuery({
    queryKey: ["units", floorId],
    queryFn: () => (floorId ? communitiesApi.units(floorId) : []),
    enabled: Boolean(floorId),
    staleTime: 60_000,
  });
}

export function useGates(communityId?: string) {
  return useQuery({
    queryKey: ["gates", communityId],
    queryFn: () => (communityId ? communitiesApi.gates(communityId) : []),
    enabled: Boolean(communityId),
    staleTime: 60_000,
  });
}

export function useCreateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Community>) => communitiesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityKeys.all });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useUpdateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Community> }) => communitiesApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: communityKeys.detail(id) });
      qc.invalidateQueries({ queryKey: communityKeys.all });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useDeleteCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => communitiesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityKeys.all });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useCreateTower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ communityId, data }: { communityId: string; data: { name: string; code: string; structure_type?: string; total_floors?: number } }) =>
      communitiesApi.createTower(communityId, data),
    onSuccess: (_, { communityId }) => {
      qc.invalidateQueries({ queryKey: ["towers", communityId] });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      qc.invalidateQueries({ queryKey: communityKeys.all });
    },
  });
}

export function useCreateFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { tower_id: string; floor_number: number; label?: string }) =>
      communitiesApi.createFloor(data),
    onSuccess: (_, { tower_id }) => {
      qc.invalidateQueries({ queryKey: ["floors", tower_id] });
      qc.invalidateQueries({ queryKey: ["towers"] });
    },
  });
}

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { floor_id: string; unit_number: string; unit_type?: string; bedrooms?: number; area_sqft?: number }) =>
      communitiesApi.createUnit(data),
    onSuccess: (_, { floor_id }) => {
      qc.invalidateQueries({ queryKey: ["units", floor_id] });
      qc.invalidateQueries({ queryKey: ["floors"] });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useCreateGate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ communityId, data }: { communityId: string; data: { name: string; code: string; gate_type: string } }) =>
      communitiesApi.createGate(communityId, data),
    onSuccess: (_, { communityId }) => {
      qc.invalidateQueries({ queryKey: ["gates", communityId] });
    },
  });
}
