"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { communitiesApi } from "@/lib/api";
import type { Community, CommunityCreate } from "@/types/communities";

export const communityKeys = {
  all: ["communities"] as const,
  lists: () => [...communityKeys.all, "list"] as const,
  list: (params?: { active?: boolean; page_size?: number; page?: number }) =>
    [...communityKeys.lists(), params] as const,
  details: () => [...communityKeys.all, "detail"] as const,
  detail: (id: string) => [...communityKeys.details(), id] as const,
};

export function useCommunities(
  params?: { active?: boolean; page_size?: number; page?: number },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: communityKeys.list(params),
    queryFn: () => communitiesApi.list({ page_size: 100, ...params }),
    staleTime: 120_000,
    enabled: options?.enabled !== undefined ? options.enabled : true,
  });
}

export function useCommunity(id?: string) {
  return useQuery({
    queryKey: communityKeys.detail(id || ""),
    queryFn: async () => {
      if (!id) return null;
      try {
        return await communitiesApi.get(id);
      } catch {
        return null;
      }
    },
    enabled: Boolean(id),
    staleTime: 120_000,
    retry: false,
  });
}

export const useCommunityDetails = useCommunity;

export function useTowers(communityId?: string) {
  return useQuery({
    queryKey: ["towers", communityId],
    queryFn: () => (communityId ? communitiesApi.towers(communityId) : []),
    enabled: Boolean(communityId),
    staleTime: 120_000,
  });
}

export function useFloors(towerId?: string) {
  return useQuery({
    queryKey: ["floors", towerId],
    queryFn: () => (towerId ? communitiesApi.floors(towerId) : []),
    enabled: Boolean(towerId),
    staleTime: 120_000,
  });
}

export function useUnits(floorId?: string) {
  return useQuery({
    queryKey: ["units", floorId],
    queryFn: () => (floorId ? communitiesApi.units(floorId) : []),
    enabled: Boolean(floorId),
    staleTime: 120_000,
  });
}

export function useCommunityUnits(communityId?: string) {
  return useQuery({
    queryKey: ["community-units", communityId],
    queryFn: () => (communityId ? communitiesApi.communityUnits(communityId) : []),
    enabled: Boolean(communityId),
    staleTime: 120_000,
  });
}

export function useGates(communityId?: string) {
  return useQuery({
    queryKey: ["gates", communityId],
    queryFn: () => (communityId ? communitiesApi.gates(communityId) : []),
    enabled: Boolean(communityId),
    staleTime: 120_000,
  });
}

export function useCreateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Community> | CommunityCreate) => communitiesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityKeys.all, refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
    },
  });
}

export function useUpdateCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Community> }) =>
      communitiesApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: communityKeys.detail(id), refetchType: "all" });
      qc.invalidateQueries({ queryKey: communityKeys.all, refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
    },
  });
}

export function useDeleteCommunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => communitiesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityKeys.all, refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
    },
  });
}

export function useCreateTower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      communityId,
      data,
    }: {
      communityId: string;
      data: { name: string; code: string; structure_type?: string; total_floors?: number };
    }) => communitiesApi.createTower(communityId, data),
    onSuccess: (_, { communityId }) => {
      qc.invalidateQueries({ queryKey: ["towers", communityId], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["towers"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: communityKeys.all, refetchType: "all" });
    },
  });
}

export function useUpdateTower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      communityId?: string;
      data: {
        name?: string;
        code?: string;
        structure_type?: string;
        total_floors?: number;
        is_active?: boolean;
      };
    }) => communitiesApi.updateTower(id, data),
    onSuccess: (_, { communityId }) => {
      if (communityId) {
        qc.invalidateQueries({ queryKey: ["towers", communityId], refetchType: "all" });
      }
      qc.invalidateQueries({ queryKey: ["towers"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: communityKeys.all, refetchType: "all" });
    },
  });
}

export function useDeleteTower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; communityId?: string }) => communitiesApi.deleteTower(id),
    onSuccess: (_, { communityId }) => {
      if (communityId) {
        qc.invalidateQueries({ queryKey: ["towers", communityId], refetchType: "all" });
      }
      qc.invalidateQueries({ queryKey: ["towers"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["floors"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["units"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["community-units"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: communityKeys.all, refetchType: "all" });
    },
  });
}

export function useCreateFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { tower_id: string; floor_number: number; label?: string }) =>
      communitiesApi.createFloor(data),
    onSuccess: (_, { tower_id }) => {
      qc.invalidateQueries({ queryKey: ["floors", tower_id], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["floors"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["towers"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
    },
  });
}

export function useUpdateFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      tower_id?: string;
      data: { floor_number?: number; label?: string; is_active?: boolean };
    }) => communitiesApi.updateFloor(id, data),
    onSuccess: (_, { tower_id }) => {
      if (tower_id) {
        qc.invalidateQueries({ queryKey: ["floors", tower_id], refetchType: "all" });
      }
      qc.invalidateQueries({ queryKey: ["floors"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["towers"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
    },
  });
}

export function useDeleteFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; tower_id?: string }) => communitiesApi.deleteFloor(id),
    onSuccess: (_, { tower_id }) => {
      if (tower_id) {
        qc.invalidateQueries({ queryKey: ["floors", tower_id], refetchType: "all" });
      }
      qc.invalidateQueries({ queryKey: ["floors"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["towers"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["units"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["community-units"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
    },
  });
}

export function useCreateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      floor_id: string;
      unit_number: string;
      unit_type?: string;
      bedrooms?: number;
      area_sqft?: number;
    }) => communitiesApi.createUnit(data),
    onSuccess: (_, { floor_id }) => {
      qc.invalidateQueries({ queryKey: ["units", floor_id], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["units"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["community-units"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["floors"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: communityKeys.all, refetchType: "all" });
    },
  });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      floor_id?: string;
      data: {
        unit_number?: string;
        unit_type?: string;
        bedrooms?: number;
        area_sqft?: number;
        is_active?: boolean;
      };
    }) => communitiesApi.updateUnit(id, data),
    onSuccess: (_, { floor_id }) => {
      if (floor_id) {
        qc.invalidateQueries({ queryKey: ["units", floor_id], refetchType: "all" });
      }
      qc.invalidateQueries({ queryKey: ["units"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["community-units"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["floors"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: communityKeys.all, refetchType: "all" });
    },
  });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; floor_id?: string }) => communitiesApi.deleteUnit(id),
    onSuccess: (_, { floor_id }) => {
      if (floor_id) {
        qc.invalidateQueries({ queryKey: ["units", floor_id], refetchType: "all" });
      }
      qc.invalidateQueries({ queryKey: ["units"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["community-units"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["floors"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: communityKeys.all, refetchType: "all" });
    },
  });
}

export function useCreateGate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      communityId,
      data,
    }: {
      communityId: string;
      data: { name: string; code: string; gate_type: string };
    }) => communitiesApi.createGate(communityId, data),
    onSuccess: (_, { communityId }) => {
      qc.invalidateQueries({ queryKey: ["gates", communityId], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
    },
  });
}

export function useUpdateGate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      communityId?: string;
      data: { name?: string; code?: string; gate_type?: string; is_active?: boolean };
    }) => communitiesApi.updateGate(id, data),
    onSuccess: (_, { communityId }) => {
      if (communityId) {
        qc.invalidateQueries({ queryKey: ["gates", communityId], refetchType: "all" });
      }
      qc.invalidateQueries({ queryKey: ["gates"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
    },
  });
}

export function useDeleteGate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; communityId?: string }) => communitiesApi.deleteGate(id),
    onSuccess: (_, { communityId }) => {
      if (communityId) {
        qc.invalidateQueries({ queryKey: ["gates", communityId], refetchType: "all" });
      }
      qc.invalidateQueries({ queryKey: ["gates"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" });
    },
  });
}
