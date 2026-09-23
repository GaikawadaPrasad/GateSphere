"use client";

import { useQuery } from "@tanstack/react-query";
import { gateApi, visitorsApi, deliveriesApi, dashboardsApi } from "@/lib/api";
import type { PanicAlert, GuardRoster } from "@/types/gate";
import type { SecurityStats } from "@/types/dashboards";

export interface SecurityGuardLiveData {
  activeSos: PanicAlert | null;
  pendingVisitors: any[];
  pendingDeliveryCount: number;
  activeRoster: GuardRoster | null;
  securityStats: SecurityStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refetchAll: () => Promise<void>;
}

/**
 * Production-Grade Adaptive Real-Time Sync Hook for Security Guard Live Gate.
 * 
 * Features:
 * - Tiered polling intervals (Emergency SOS: 4s, Visitor/Deliveries: 10s, Overview: 30s)
 * - Battery & bandwidth protection: stops polling when tab is hidden or tablet is locked (refetchIntervalInBackground: false)
 * - Request deduplication: TanStack Query prevents overlapping request pile-up
 */
export function useSecurityGuardLive(communityId?: string): SecurityGuardLiveData {
  // 1. EMERGENCY TIER: Panic SOS Alerts (4-second polling)
  const alertsQuery = useQuery<PanicAlert[]>({
    queryKey: ["gate", "alerts", communityId || "all"],
    queryFn: async () => {
      const res = await gateApi.alerts();
      return (res || []) as PanicAlert[];
    },
    refetchInterval: 4_000,
    refetchIntervalInBackground: false,
    staleTime: 2_000,
  });

  // 2. QUEUE OPERATIONS TIER: Pending Visitors (10-second polling)
  const visitorsQuery = useQuery<any[]>({
    queryKey: ["visitors", "pending", communityId || "all"],
    queryFn: async () => {
      const res = await visitorsApi.requests();
      if (!Array.isArray(res)) return [];
      return res.filter((v: any) => v.status === "pending");
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  // 3. QUEUE OPERATIONS TIER: Expected Deliveries (10-second polling)
  const deliveriesQuery = useQuery<any[]>({
    queryKey: ["deliveries", "active", communityId || "all"],
    queryFn: async () => {
      const res = await deliveriesApi.list();
      if (!Array.isArray(res)) return [];
      return res.filter((d: any) => d.status === "expected" || d.status === "at_gate");
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  // 4. METRICS TIER: Security Operations Stats (30-second polling)
  const statsQuery = useQuery<SecurityStats>({
    queryKey: ["dashboards", "security", communityId || "default"],
    queryFn: () => dashboardsApi.security(communityId || undefined),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  });

  // 5. ROSTER TIER: Active Guard Rosters (30-second polling)
  const rostersQuery = useQuery<GuardRoster[]>({
    queryKey: ["gate", "rosters", communityId || "all"],
    queryFn: async () => {
      const res = await gateApi.rosters();
      return (res || []) as GuardRoster[];
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  });

  const activeSos =
    alertsQuery.data?.find((a) => a.status === "active" || a.status === "acknowledged") || null;

  const activeRoster =
    rostersQuery.data?.find((r) => r.status === "active") || null;

  const refetchAll = async () => {
    await Promise.allSettled([
      alertsQuery.refetch(),
      visitorsQuery.refetch(),
      deliveriesQuery.refetch(),
      statsQuery.refetch(),
      rostersQuery.refetch(),
    ]);
  };

  const isLoading =
    alertsQuery.isLoading ||
    visitorsQuery.isLoading ||
    deliveriesQuery.isLoading ||
    statsQuery.isLoading;

  const isRefreshing =
    alertsQuery.isFetching ||
    visitorsQuery.isFetching ||
    deliveriesQuery.isFetching ||
    statsQuery.isFetching;

  return {
    activeSos,
    pendingVisitors: visitorsQuery.data || [],
    pendingDeliveryCount: deliveriesQuery.data?.length || 0,
    activeRoster,
    securityStats: statsQuery.data || null,
    isLoading,
    isRefreshing,
    refetchAll,
  };
}
