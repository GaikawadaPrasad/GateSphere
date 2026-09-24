"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { useSuperAdminDashboardMetrics } from "@/hooks/use-dashboards";
import { formatCurrency } from "@/lib/utils";
import { useUiStore } from "@/store/ui";
import { ScopeBanner } from "@/components/common/ScopeBanner";
import { Skeleton } from "@/components/common/LoadingSkeleton";

export default function ReportsPage() {
  const { activeCommunityId } = useUiStore();
  const { data: metrics, isLoading } = useSuperAdminDashboardMetrics(activeCommunityId);

  return (
    <div>
      <PageHeader
        title="Reports & Platform Analytics"
        subtitle={
          activeCommunityId
            ? "Operational summaries and KPI aggregates for selected community"
            : "Comprehensive operational summaries and platform KPI aggregates"
        }
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Reports & Analytics" },
        ]}
      />

      {/* Active Scope Banner */}
      <ScopeBanner entityName="analytics & summaries" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* Community & Occupancy Summary */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🏢 Community Occupancy Summary</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-light)",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Total Communities</span>
              <span style={{ fontWeight: 600 }}>
                {isLoading ? (
                  <Skeleton width={45} height={18} />
                ) : (
                  (metrics?.totalCommunities ?? "–")
                )}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-light)",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Active Units</span>
              <span style={{ fontWeight: 600 }}>
                {isLoading ? <Skeleton width={45} height={18} /> : (metrics?.totalUnits ?? "–")}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-light)",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Total Verified Residents</span>
              <span style={{ fontWeight: 600 }}>
                {isLoading ? <Skeleton width={45} height={18} /> : (metrics?.totalResidents ?? "–")}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Global Occupancy Rate</span>
              <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                {isLoading ? (
                  <Skeleton width={45} height={18} />
                ) : (
                  `${metrics?.occupancyRate ?? 0}%`
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Security & Gate SLA Summary */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🛡️ Security & Incident Rollup</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-light)",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Current Visitors Inside</span>
              <span style={{ fontWeight: 600 }}>
                {isLoading ? <Skeleton width={45} height={18} /> : (metrics?.visitorsInside ?? 0)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-light)",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Vehicles on Premises</span>
              <span style={{ fontWeight: 600 }}>
                {isLoading ? <Skeleton width={45} height={18} /> : (metrics?.vehiclesInside ?? 0)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-light)",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Domestic Staff Inside</span>
              <span style={{ fontWeight: 600 }}>
                {isLoading ? <Skeleton width={45} height={18} /> : (metrics?.staffInside ?? 0)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Active Panic Alerts</span>
              <span
                style={{
                  fontWeight: 700,
                  color: (metrics?.activePanicAlerts ?? 0) > 0 ? "var(--danger)" : "var(--success)",
                }}
              >
                {isLoading ? (
                  <Skeleton width={45} height={18} />
                ) : (
                  (metrics?.activePanicAlerts ?? 0)
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Collection Rollup */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">💳 Financial & Collection Rollup</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-light)",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Total Billed (Maintenance)</span>
              <span style={{ fontWeight: 600 }}>
                {isLoading ? (
                  <Skeleton width={80} height={18} />
                ) : (
                  formatCurrency(metrics?.totalBilled)
                )}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-light)",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Total Collected</span>
              <span style={{ fontWeight: 600, color: "var(--success)" }}>
                {isLoading ? (
                  <Skeleton width={80} height={18} />
                ) : (
                  formatCurrency(metrics?.totalCollected)
                )}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border-light)",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Total Outstanding Balance</span>
              <span style={{ fontWeight: 600, color: "var(--danger)" }}>
                {isLoading ? (
                  <Skeleton width={80} height={18} />
                ) : (
                  formatCurrency(metrics?.totalOutstanding)
                )}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingBottom: "0.5rem",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Collection Efficiency</span>
              <span style={{ fontWeight: 700, color: "var(--primary)" }}>
                {isLoading ? (
                  <Skeleton width={45} height={18} />
                ) : (
                  `${metrics?.collectionRate ?? 0}%`
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
