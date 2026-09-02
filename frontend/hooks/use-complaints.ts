"use client";

import { useQuery } from "@tanstack/react-query";
import { complaintsApi } from "@/lib/api";
import type { ListQueryParams } from "@/types/api";

export const complaintKeys = {
  all: ["complaints"] as const,
  tickets: (params?: ListQueryParams) => [...complaintKeys.all, "tickets", params] as const,
  categories: (communityId?: string) => [...complaintKeys.all, "categories", communityId] as const,
};

export function useComplaints(params?: ListQueryParams) {
  return useQuery({
    queryKey: complaintKeys.tickets(params),
    queryFn: () => complaintsApi.tickets(params),
    staleTime: 20_000,
  });
}

export function useComplaintCategories(communityId?: string) {
  return useQuery({
    queryKey: complaintKeys.categories(communityId),
    queryFn: () => complaintsApi.categories(communityId),
    staleTime: 60_000,
  });
}
