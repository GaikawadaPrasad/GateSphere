import type React from "react";

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
        borderRadius: borderRadius || "var(--radius-sm, 6px)",
        backgroundColor: "#e2e8f0",
        backgroundImage: "linear-gradient(90deg, #e2e8f0 0%, #cbd5e1 50%, #e2e8f0 100%)",
        backgroundSize: "200% 100%",
        display: "block",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

/**
 * Table-shaped skeleton that matches what the real `DataTable` renders at each width:
 * header + rows on desktop, the mobile card layout (title + badge, 2-column fields, actions)
 * at ≤768px. Switched by CSS (`.gs-skel-table` / `.gs-skel-cards`), so it never flickers
 * between layouts during hydration.
 */
export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  const cardCount = Math.min(rows, 4);
  return (
    <div role="status" aria-busy="true" aria-live="polite" style={{ minWidth: 0 }}>
      <span className="sr-only">Loading records…</span>
      <div className="table-container gs-skel-table" style={{ padding: "1.25rem" }}>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginBottom: "1.25rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid var(--border, #e2e8f0)",
          }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} height="1.25rem" width={`${100 / cols}%`} borderRadius={4} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            style={{ display: "flex", gap: "1rem", marginBottom: "0.85rem", alignItems: "center" }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} height="1.1rem" width={`${100 / cols}%`} borderRadius={4} />
            ))}
          </div>
        ))}
      </div>
      <div className="data-table-cards-list gs-skel-cards">
        {Array.from({ length: cardCount }).map((_, i) => (
          <div key={i} className="data-table-mobile-card" aria-hidden="true">
            <div className="data-table-card-top">
              <Skeleton width="55%" height="1rem" borderRadius={4} />
              <Skeleton width={64} height="1.25rem" borderRadius={999} />
            </div>
            <div className="data-table-card-grid">
              {Array.from({ length: Math.min(Math.max(cols - 2, 2), 4) }).map((_, f) => (
                <div key={f} className="data-table-card-field">
                  <Skeleton width="45%" height="0.6rem" borderRadius={3} />
                  <Skeleton width="80%" height="0.9rem" borderRadius={4} />
                </div>
              ))}
            </div>
            <div className="data-table-card-footer-actions">
              <Skeleton width="100%" height="2rem" borderRadius={8} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Route-level skeleton shaped like the page that is about to render (used by every
 * `loading.tsx`). `dashboard`: title, KPI tiles, two panels. `list`: title + action,
 * filter bar, table/cards. All widths are relative, so nothing overflows a 320px phone.
 */
export function PageSkeleton({
  variant = "dashboard",
  kpis = 4,
  rows = 6,
  cols = 6,
}: {
  variant?: "dashboard" | "list";
  kpis?: number;
  rows?: number;
  cols?: number;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="gs-page-skeleton">
      <span className="sr-only">Loading page…</span>
      <div className="gs-page-skeleton__header" aria-hidden="true">
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <Skeleton width="min(70%, 280px)" height={28} style={{ marginBottom: "0.55rem" }} />
          <Skeleton width="min(95%, 440px)" height={14} />
        </div>
        <Skeleton width={120} height={38} borderRadius="var(--radius-sm, 8px)" />
      </div>
      {variant === "dashboard" ? (
        <>
          <MetricsSkeleton count={kpis} />
          <div className="gs-page-skeleton__panels" aria-hidden="true">
            <CardSkeleton height={260} />
            <ActivityFeedSkeleton rows={4} />
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="gs-page-skeleton__filters" aria-hidden="true">
            <Skeleton width="min(100%, 260px)" height={38} borderRadius={8} />
            <Skeleton width={140} height={38} borderRadius={8} />
          </div>
          <TableSkeleton rows={rows} cols={cols} />
        </div>
      )}
    </div>
  );
}

export function KpiCardSkeleton({ borderTop = "3px solid #3b82f6" }: { borderTop?: string }) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderTop,
        padding: "1.25rem 1.35rem",
        minHeight: 140,
        background: "#ffffff",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Skeleton width="48%" height="0.875rem" borderRadius={4} />
        <Skeleton width={38} height={38} borderRadius="var(--radius-sm, 8px)" />
      </div>

      <div style={{ margin: "0.75rem 0 0.35rem" }}>
        <Skeleton width="55%" height="1.85rem" borderRadius={6} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "0.25rem",
        }}
      >
        <Skeleton width="60%" height="0.75rem" borderRadius={4} />
        <Skeleton width="22%" height="1.1rem" borderRadius="var(--radius-full, 999px)" />
      </div>
    </div>
  );
}

export function MetricsSkeleton({ count = 6 }: { count?: number }) {
  const accents = [
    "3px solid #3b82f6",
    "3px solid #8b5cf6",
    "3px solid #10b981",
    "3px solid #f59e0b",
    "3px solid #ef4444",
    "3px solid #10b981",
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
        gap: "1.25rem",
        marginBottom: "2rem",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} borderTop={accents[i % accents.length]} />
      ))}
    </div>
  );
}

export function ActivityFeedSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: "1rem" }}>
        <Skeleton width="min(55%, 160px)" height={20} borderRadius={4} />
        <Skeleton width={60} height={14} borderRadius={4} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.65rem 0.75rem",
              borderBottom: "1px solid var(--border-light, #f1f5f9)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "70%" }}>
              <Skeleton width={32} height={32} borderRadius="50%" />
              <div
                style={{ display: "flex", flexDirection: "column", gap: "0.35rem", width: "80%" }}
              >
                <Skeleton width="75%" height="0.85rem" borderRadius={4} />
                <Skeleton width="45%" height="0.65rem" borderRadius={4} />
              </div>
            </div>
            <Skeleton width="20%" height="0.75rem" borderRadius={4} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ height = 240, lines }: { height?: number; lines?: number }) {
  const effectiveHeight = lines ? Math.max(80, lines * 40 + 40) : height;
  return (
    <div
      className="card"
      style={{ minHeight: effectiveHeight, display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton width="min(60%, 180px)" height={20} borderRadius={4} />
        <Skeleton width={60} height={16} borderRadius={4} />
      </div>
      <Skeleton width="100%" height={Math.max(40, effectiveHeight - 80)} borderRadius={8} />
    </div>
  );
}

/** Compact list placeholder for a panel/card body (instead of a bare "Loading…" line). */
export function LinesSkeleton({ rows = 3, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", gap: "0.65rem", padding: "0.5rem 0" }}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
        >
          <Skeleton width={32} height={32} borderRadius="50%" />
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <Skeleton width={`${80 - i * 12}%`} height="0.8rem" borderRadius={4} />
            <Skeleton width={`${50 - i * 8}%`} height="0.65rem" borderRadius={4} />
          </div>
        </div>
      ))}
    </div>
  );
}
