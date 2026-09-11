import { KpiCardSkeleton, TableSkeleton, CardSkeleton, Skeleton } from "@/components/common/LoadingSkeleton";

export default function SuperAdminDashboardLoading() {
  return (
    <div>
      {/* Header Skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
        <div>
          <Skeleton width={260} height={32} style={{ marginBottom: "0.5rem" }} />
          <Skeleton width={420} height={16} />
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Skeleton width={110} height={38} borderRadius="var(--radius-sm, 8px)" />
          <Skeleton width={150} height={38} borderRadius="var(--radius-sm, 8px)" />
        </div>
      </div>

      {/* 6-KPI Metrics Grid Skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
          gap: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      {/* Quick Actions Bar Skeleton */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <div className="card-header">
          <Skeleton width={140} height={20} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
            gap: "0.75rem",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={44} borderRadius="var(--radius-sm, 8px)" />
          ))}
        </div>
      </div>

      {/* Main Grid: Communities Table (Left) + Live Activity Feed (Right) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: "1.75rem",
          alignItems: "start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <div className="card-header">
              <Skeleton width={180} height={22} />
              <Skeleton width={200} height={36} borderRadius="var(--radius-sm, 8px)" />
            </div>
            <TableSkeleton rows={5} cols={8} />
          </div>
        </div>

        <div style={{ maxWidth: 460, width: "100%" }}>
          <CardSkeleton height={380} />
        </div>
      </div>
    </div>
  );
}
