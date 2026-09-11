"use client";

import { MetricsSkeleton, CardSkeleton, Skeleton } from "@/components/common/LoadingSkeleton";

export default function CommunityAdminLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Page Header Skeleton */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Skeleton width={240} height={28} style={{ marginBottom: "0.5rem" }} />
          <Skeleton width={380} height={16} />
        </div>
        <Skeleton width={180} height={38} borderRadius="var(--radius-sm, 8px)" />
      </div>

      {/* 6-Card KPI Grid Skeleton */}
      <MetricsSkeleton count={6} />

      {/* 2-Column Middle Grid Widgets Skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          gap: "1.25rem",
        }}
      >
        <CardSkeleton height={280} />
        <CardSkeleton height={280} />
      </div>

      {/* Bottom Grid Skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          gap: "1.25rem",
        }}
      >
        <CardSkeleton height={300} />
        <CardSkeleton height={300} />
      </div>
    </div>
  );
}

