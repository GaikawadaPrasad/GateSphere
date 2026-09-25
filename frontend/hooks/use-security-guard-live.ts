"use client";

import { useQuery } from "@tanstack/react-query";
import { gateApi, visitorsApi, deliveriesApi, dashboardsApi } from "@/lib/api";
import { useLivePollInterval } from "@/hooks/use-realtime";
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
 * - Realtime-first: while the WebSocket is open, changes arrive as hints and refresh only the
 *   affected queries — no polling (SOS keeps a 60 s safety net).
 * - Fallback when the socket is down: tiered polling (SOS 4 s, visitors/deliveries 10 s,
 *   overview/rosters 30 s), paused while the tab is hidden (refetchIntervalInBackground: false).
 */
export function useSecurityGuardLive(communityId?: string): SecurityGuardLiveData {
  const sosPoll = useLivePollInterval(4_000, 60_000);
  const queuePoll = useLivePollInterval(10_000);
  const slowPoll = useLivePollInterval(30_000);

  // 1. EMERGENCY TIER: Panic SOS Alerts
  const alertsQuery = useQuery<PanicAlert[]>({
    queryKey: ["gate", "alerts", communityId || "all"],
    queryFn: async () => {
      const res = await gateApi.alerts();
      return (res || []) as PanicAlert[];
    },
    refetchInterval: sosPoll,
    refetchIntervalInBackground: false,
    staleTime: 2_000,
  });

  // 2. QUEUE OPERATIONS TIER: Pending Visitors
  const visitorsQuery = useQuery<any[]>({
    queryKey: ["visitors", "pending", communityId || "all"],
    queryFn: async () => {
      const res = await visitorsApi.requests();
      if (!Array.isArray(res)) return [];
      return res.filter((v: any) => v.status === "pending");
    },
    refetchInterval: queuePoll,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  // 3. QUEUE OPERATIONS TIER: Expected Deliveries
  const deliveriesQuery = useQuery<any[]>({
    queryKey: ["deliveries", "active", communityId || "all"],
    queryFn: async () => {
      const res = await deliveriesApi.list();
      if (!Array.isArray(res)) return [];
      return res.filter((d: any) => d.status === "expected" || d.status === "at_gate");
    },
    refetchInterval: queuePoll,
    refetchIntervalInBackground: false,
    staleTime: 5_000,
  });

  // 4. METRICS TIER: Security Operations Stats
  const statsQuery = useQuery<SecurityStats>({
    queryKey: ["dashboards", "security", communityId || "default"],
    queryFn: () => dashboardsApi.security(communityId || undefined),
    refetchInterval: slowPoll,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  });

  // 5. ROSTER TIER: Active Guard Rosters
  const rostersQuery = useQuery<GuardRoster[]>({
    queryKey: ["gate", "rosters", communityId || "all"],
    queryFn: async () => {
      const res = await gateApi.rosters();
      return (res || []) as GuardRoster[];
    },
    refetchInterval: slowPoll,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  });

  const activeSos =
    alertsQuery.data?.find((a) => a.status === "active" || a.status === "acknowledged") || null;

  const activeRoster = rostersQuery.data?.find((r) => r.status === "active") || null;

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
