"use client";

import { MetricsSkeleton, TableSkeleton } from "@/components/common/LoadingSkeleton";

export default function CommunityAdminLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="skeleton" style={{ width: 220, height: 32 }} />
        <div className="skeleton" style={{ width: 140, height: 36 }} />
      </div>
      <MetricsSkeleton count={4} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div className="skeleton" style={{ height: 260, borderRadius: "var(--radius)" }} />
        <div className="skeleton" style={{ height: 260, borderRadius: "var(--radius)" }} />
      </div>
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
