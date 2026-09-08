import { KpiCardSkeleton, TableSkeleton } from "@/components/common/LoadingSkeleton";

export default function OwnerTenantLoading() {
  return (
    <div>
      <div style={{ marginBottom: "1.75rem" }}>
        <div className="skeleton" style={{ width: 240, height: 32, marginBottom: "0.5rem" }} />
        <div className="skeleton" style={{ width: 360, height: 16 }} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>

      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
