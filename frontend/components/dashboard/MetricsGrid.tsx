import { KpiCard } from "@/components/dashboard/KpiCard";
import { MetricsSkeleton } from "@/components/common/LoadingSkeleton";
import { formatCurrency, formatCompactNumber } from "@/lib/utils";
import type { SuperAdminDashboardMetrics } from "@/types/dashboards";

interface MetricsGridProps {
  metrics: SuperAdminDashboardMetrics | undefined;
  isLoading?: boolean;
  onCardClick?: (key: string) => void;
  activeCommunity?: {
    id: string;
    name: string;
    code: string;
    city?: string;
    state?: string;
    is_active?: boolean;
  } | null;
}

export function MetricsGrid({
  metrics,
  isLoading,
  onCardClick,
  activeCommunity,
}: MetricsGridProps) {
  if (isLoading || !metrics) {
    return <MetricsSkeleton count={6} />;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
        gap: "1.25rem",
        marginBottom: "2rem",
      }}
    >
      {/* 1. Total Communities / Scoped Community */}
      <KpiCard
        title={activeCommunity ? "Scoped Community" : "Total Communities"}
        value={
          activeCommunity ? activeCommunity.name : formatCompactNumber(metrics.totalCommunities)
        }
        subtitle={
          activeCommunity
            ? `Code: ${activeCommunity.code} · ${activeCommunity.city || activeCommunity.state || "Active"}`
            : `${metrics.activeCommunities} active · ${metrics.inactiveCommunities} inactive`
        }
        icon="🏢"
        accent="primary"
        badge={{
          text: activeCommunity ? (activeCommunity.is_active ? "Active" : "Inactive") : "Active",
          variant: (activeCommunity ? activeCommunity.is_active : true) ? "success" : "neutral",
        }}
        onClick={() => onCardClick?.("communities")}
      />

      {/* 2. Total Residents */}
      <KpiCard
        title={activeCommunity ? "Community Residents" : "Total Residents"}
        value={formatCompactNumber(metrics.totalResidents)}
        subtitle={`Across ${metrics.totalUnits} registered units`}
        icon="👥"
        accent="purple"
        badge={{ text: "Verified", variant: "primary" }}
        onClick={() => onCardClick?.("residents")}
      />

      {/* 3. Occupancy Rate */}
      <KpiCard
        title="Occupancy Rate"
        value={`${metrics.occupancyRate}%`}
        subtitle={`${metrics.totalResidents} occupied of ${metrics.totalUnits} units`}
        icon="📊"
        accent={
          metrics.occupancyRate >= 70
            ? "success"
            : metrics.occupancyRate >= 40
              ? "warning"
              : "neutral"
        }
        badge={{
          text: metrics.occupancyRate >= 70 ? "High" : "Moderate",
          variant: metrics.occupancyRate >= 70 ? "success" : "warning",
        }}
      />

      {/* 4. Active Gate Traffic */}
      <KpiCard
        title="Active Gate Traffic"
        value={formatCompactNumber(metrics.activeGateTraffic)}
        subtitle={`${metrics.visitorsInside} visitors · ${metrics.vehiclesInside} vehicles · ${metrics.staffInside} staff`}
        icon="🛡️"
        accent="warning"
        badge={{ text: "Live Inside", variant: "warning" }}
        onClick={() => onCardClick?.("gate")}
      />

      {/* 5. Open Complaints */}
      <KpiCard
        title="Open Complaints"
        value={metrics.openComplaints}
        subtitle={`${metrics.criticalComplaints} high priority / incidents`}
        icon="🎫"
        accent={
          metrics.openComplaints > 0
            ? metrics.criticalComplaints > 0
              ? "danger"
              : "warning"
            : "success"
        }
        badge={{
          text: metrics.criticalComplaints > 0 ? "Needs Action" : "In SLA",
          variant: metrics.criticalComplaints > 0 ? "danger" : "neutral",
        }}
        onClick={() => onCardClick?.("complaints")}
      />

      {/* 6. Financial Health */}
      <KpiCard
        title="Financial Health"
        value={formatCurrency(metrics.totalCollected)}
        subtitle={`Outstanding: ${formatCurrency(metrics.totalOutstanding)}`}
        icon="💳"
        accent={metrics.collectionRate >= 80 ? "success" : "danger"}
        badge={{
          text: `${metrics.collectionRate}% collected`,
          variant: metrics.collectionRate >= 80 ? "success" : "danger",
        }}
        onClick={() => onCardClick?.("billing")}
      />
    </div>
  );
}
