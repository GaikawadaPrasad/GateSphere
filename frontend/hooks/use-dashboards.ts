"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardsApi } from "@/lib/api";
import type {
  OverviewStats,
  SecurityStats,
  FinancialStats,
  ResidentStats,
  SuperAdminDashboardMetrics,
} from "@/types/dashboards";

export const dashboardKeys = {
  all: ["dashboards"] as const,
  overview: (communityId?: string | null) =>
    [...dashboardKeys.all, "overview", communityId] as const,
  security: (communityId?: string | null) =>
    [...dashboardKeys.all, "security", communityId] as const,
  financial: (communityId?: string | null) =>
    [...dashboardKeys.all, "financial", communityId] as const,
  resident: (communityId?: string | null) =>
    [...dashboardKeys.all, "resident", communityId] as const,
  superAdmin: (communityId?: string | null) =>
    [...dashboardKeys.all, "super-admin", communityId || "global"] as const,
};

/**
 * Super Admin dashboard metrics across all communities or scoped to a specific community
 */
export function useSuperAdminDashboardMetrics(communityId?: string | null) {
  return useQuery<SuperAdminDashboardMetrics>({
    queryKey: dashboardKeys.superAdmin(communityId),
    queryFn: () => dashboardsApi.superAdmin(communityId || undefined),
    staleTime: 5_000,
  });
}

export function useOverviewStats(communityId?: string | null) {
  return useQuery<OverviewStats>({
    queryKey: dashboardKeys.overview(communityId),
    queryFn: () => dashboardsApi.overview(communityId || undefined),
    staleTime: 5_000,
  });
}

export function useSecurityStats(communityId?: string | null) {
  return useQuery<SecurityStats>({
    queryKey: dashboardKeys.security(communityId),
    queryFn: () => dashboardsApi.security(communityId || undefined),
    staleTime: 5_000,
  });
}

export function useFinancialStats(communityId?: string | null) {
  return useQuery<FinancialStats>({
    queryKey: dashboardKeys.financial(communityId),
    queryFn: () => dashboardsApi.financial(communityId || undefined),
    staleTime: 5_000,
  });
}

export function useResidentStats(communityId?: string | null) {
  return useQuery<ResidentStats>({
    queryKey: dashboardKeys.resident(communityId),
    queryFn: () => dashboardsApi.resident(communityId || undefined),
    staleTime: 5_000,
  });
}
