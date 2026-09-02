"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardsApi, communitiesApi } from "@/lib/api";
import type { SuperAdminDashboardMetrics } from "@/types/dashboards";

export const dashboardKeys = {
  all: ["dashboards"] as const,
  superAdmin: ["dashboards", "super-admin"] as const,
  overview: (communityId?: string) => ["dashboards", "overview", communityId || "all"] as const,
  security: (communityId?: string) => ["dashboards", "security", communityId || "all"] as const,
  financial: (communityId?: string) => ["dashboards", "financial", communityId || "all"] as const,
};

export function useOverviewStats(communityId?: string) {
  return useQuery({
    queryKey: dashboardKeys.overview(communityId),
    queryFn: () => dashboardsApi.overview(communityId),
    staleTime: 30_000,
  });
}

export function useSecurityStats(communityId?: string) {
  return useQuery({
    queryKey: dashboardKeys.security(communityId),
    queryFn: () => dashboardsApi.security(communityId),
    staleTime: 15_000,
    refetchInterval: 15_000, // Live poll for security gate
  });
}

export function useFinancialStats(communityId?: string) {
  return useQuery({
    queryKey: dashboardKeys.financial(communityId),
    queryFn: () => dashboardsApi.financial(communityId),
    staleTime: 60_000,
  });
}

/**
 * Super Admin global aggregated dashboard metrics across communities
 */
export function useSuperAdminDashboardMetrics() {
  return useQuery<SuperAdminDashboardMetrics>({
    queryKey: dashboardKeys.superAdmin,
    queryFn: async () => {
      // 1. Fetch communities list
      const communities = await communitiesApi.list();
      const activeCommunities = communities.filter((c) => c.is_active);
      const totalCommunities = communities.length;
      const inactiveCommunities = totalCommunities - activeCommunities.length;

      let totalUnits = 0;
      let totalResidents = 0;
      let visitorsInside = 0;
      let vehiclesInside = 0;
      let staffInside = 0;
      let openComplaints = 0;
      let activePanicAlerts = 0;
      let openIncidents = 0;
      let totalBilled = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;

      // 2. Fetch scoped metrics for each active community
      await Promise.allSettled(
        activeCommunities.map(async (comm) => {
          try {
            const [overview, security, financial] = await Promise.allSettled([
              dashboardsApi.overview(comm.id),
              dashboardsApi.security(comm.id),
              dashboardsApi.financial(comm.id),
            ]);

            if (overview.status === "fulfilled") {
              totalUnits += overview.value.units || 0;
              totalResidents += overview.value.residents || 0;
              openComplaints += overview.value.open_tickets || 0;
              openIncidents += overview.value.open_incidents || 0;
              activePanicAlerts += overview.value.active_panic_alerts || 0;
            }

            if (security.status === "fulfilled") {
              visitorsInside += security.value.visitors_inside || 0;
              vehiclesInside += security.value.vehicles_inside || 0;
              staffInside += security.value.staff_inside || 0;
            }

            if (financial.status === "fulfilled") {
              totalBilled += parseFloat(financial.value.total_billed || "0") || 0;
              totalCollected += parseFloat(financial.value.total_collected || "0") || 0;
              totalOutstanding += parseFloat(financial.value.outstanding_balance || "0") || 0;
            }
          } catch {
            // Gracefully handle partial community failure
          }
        })
      );

      const activeGateTraffic = visitorsInside + vehiclesInside + staffInside;
      const occupancyRate = totalUnits > 0 ? Math.min(100, Math.round((totalResidents / totalUnits) * 100)) : 0;
      const collectionRate =
        totalBilled > 0 ? Math.min(100, Math.round((totalCollected / totalBilled) * 100)) : totalCollected > 0 ? 100 : 0;

      return {
        totalCommunities,
        activeCommunities: activeCommunities.length,
        inactiveCommunities,
        totalUnits,
        totalResidents,
        occupancyRate,
        activeGateTraffic,
        visitorsInside,
        vehiclesInside,
        staffInside,
        openComplaints,
        criticalComplaints: openIncidents + activePanicAlerts,
        activePanicAlerts,
        openIncidents,
        totalBilled,
        totalCollected,
        totalOutstanding,
        collectionRate,
      };
    },
    staleTime: 20_000,
  });
}
