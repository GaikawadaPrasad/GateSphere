interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius,
  className,
  style,
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className || ""}`}
      style={{
        width,
        height,
        borderRadius: borderRadius || "var(--radius-sm)",
        ...style,
      }}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-container" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="1.25rem" width={`${100 / cols}%`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height="1rem" width={`${100 / cols}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div
      className="card"
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem", minHeight: 140 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton width="40%" height="0.875rem" />
        <Skeleton width="2rem" height="2rem" borderRadius="50%" />
      </div>
      <Skeleton width="60%" height="2rem" />
      <Skeleton width="80%" height="0.75rem" />
    </div>
  );
}

export function MetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
        gap: "1rem",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}
