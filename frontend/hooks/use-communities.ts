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

export function useCommunity(id: string) {
  return useQuery({
    queryKey: communityKeys.detail(id),
    queryFn: () => communitiesApi.get(id),
    enabled: Boolean(id),
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
