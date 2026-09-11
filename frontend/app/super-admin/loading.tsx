import { TableSkeleton, Skeleton } from "@/components/common/LoadingSkeleton";

export default function SuperAdminGenericLoading() {
  return (
    <div>
      {/* Header Skeleton */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.75rem",
        }}
      >
        <div>
          <Skeleton width={260} height={32} style={{ marginBottom: "0.5rem" }} />
          <Skeleton width={380} height={16} />
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Skeleton width={120} height={38} borderRadius="var(--radius-sm, 8px)" />
        </div>
      </div>

      {/* Main Content / Table Skeleton Card */}
      <div className="card">
        <div
          className="card-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <Skeleton width={200} height={24} />
          <Skeleton width={240} height={36} borderRadius="var(--radius-sm, 8px)" />
        </div>
        <TableSkeleton rows={6} cols={6} />
      </div>
    </div>
  );
}


