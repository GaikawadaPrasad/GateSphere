"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardsApi, communitiesApi } from "@/lib/api";
import type { OverviewStats, SecurityStats, FinancialStats, ResidentStats, SuperAdminDashboardMetrics } from "@/types/dashboards";
import type { Community } from "@/types/communities";

export const dashboardKeys = {
  all: ["dashboards"] as const,
  overview: (communityId?: string | null) => [...dashboardKeys.all, "overview", communityId] as const,
  security: (communityId?: string | null) => [...dashboardKeys.all, "security", communityId] as const,
  financial: (communityId?: string | null) => [...dashboardKeys.all, "financial", communityId] as const,
  resident: (communityId?: string | null) => [...dashboardKeys.all, "resident", communityId] as const,
  superAdmin: ["dashboards", "super-admin"] as const,
};

/**
 * Super Admin global aggregated dashboard metrics across communities
 */
export function useSuperAdminDashboardMetrics() {
  return useQuery<SuperAdminDashboardMetrics>({
    queryKey: dashboardKeys.superAdmin,
    queryFn: async () => {
      // 1. Fetch communities list
      const communities = await communitiesApi.list();
      const activeCommunities = (communities || []).filter((c: Community) => c.is_active);
      const totalCommunities = communities?.length || 0;
      const inactiveCommunities = totalCommunities - activeCommunities.length;

      let totalUnits = 0;
      let totalResidents = 0;
      let visitorsInside = 0;
      let vehiclesInside = 0;
      let staffInside = 0;
      let openComplaints = 0;
      let criticalComplaints = 0;
      let activePanicAlerts = 0;
      let openIncidents = 0;
      let totalBilled = 0;
      let totalCollected = 0;
      let totalOutstanding = 0;

      // 2. Fetch scoped metrics for each active community
      await Promise.allSettled(
        activeCommunities.map(async (comm: Community) => {
          try {
            const [overview, security, financial] = await Promise.allSettled([
              dashboardsApi.overview(comm.id),
              dashboardsApi.security(comm.id),
              dashboardsApi.financial(comm.id),
            ]);

            if (overview.status === "fulfilled") {
              totalUnits += Number(overview.value?.units || 0);
              totalResidents += Number(overview.value?.residents || 0);
              openComplaints += Number(overview.value?.open_tickets || 0);
              openIncidents += Number(overview.value?.open_incidents || 0);
              activePanicAlerts += Number(overview.value?.active_panic_alerts || 0);
            }

            if (security.status === "fulfilled") {
              visitorsInside += Number(security.value?.visitors_inside || 0);
              vehiclesInside += Number(security.value?.vehicles_inside || 0);
              staffInside += Number(security.value?.staff_inside || 0);
            }

            if (financial.status === "fulfilled") {
              totalBilled += parseFloat(String(financial.value?.total_billed || "0")) || 0;
              totalCollected += parseFloat(String(financial.value?.total_collected || "0")) || 0;
              totalOutstanding += parseFloat(String(financial.value?.outstanding_balance || "0")) || 0;
            }
          } catch {
            // best-effort per community aggregation
          }
        })
      );

      const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;
      const occupancyRate = totalUnits > 0 ? Math.round((totalResidents / totalUnits) * 100) : 0;
      const activeGateTraffic = visitorsInside + vehiclesInside + staffInside;

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
        criticalComplaints,
        activePanicAlerts,
        openIncidents,
        totalBilled,
        totalCollected,
        totalOutstanding,
        collectionRate,
      };
    },
    staleTime: 60_000,
  });
}

export function useOverviewStats(communityId?: string | null) {
  return useQuery<OverviewStats>({
    queryKey: dashboardKeys.overview(communityId),
    queryFn: () => dashboardsApi.overview(communityId || undefined),
    staleTime: 30_000,
  });
}

export function useSecurityStats(communityId?: string | null) {
  return useQuery<SecurityStats>({
    queryKey: dashboardKeys.security(communityId),
    queryFn: () => dashboardsApi.security(communityId || undefined),
    staleTime: 10_000,
  });
}

export function useFinancialStats(communityId?: string | null) {
  return useQuery<FinancialStats>({
    queryKey: dashboardKeys.financial(communityId),
    queryFn: () => dashboardsApi.financial(communityId || undefined),
    staleTime: 60_000,
  });
}

export function useResidentStats(communityId?: string | null) {
  return useQuery<ResidentStats>({
    queryKey: dashboardKeys.resident(communityId),
    queryFn: () => dashboardsApi.resident(communityId || undefined),
    staleTime: 30_000,
  });
}
