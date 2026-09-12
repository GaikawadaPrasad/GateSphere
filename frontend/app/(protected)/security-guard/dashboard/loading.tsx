export default function SecurityGuardDashboardLoading() {
  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: "1rem" }}>
      {/* Header Skeleton */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div className="skeleton" style={{ width: 280, height: 28, marginBottom: "0.5rem" }} />
        <div className="skeleton" style={{ width: 440, height: 16 }} />
      </div>

      {/* KPI Counters Skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card" style={{ padding: "1.25rem", minHeight: 120 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div className="skeleton" style={{ width: 110, height: 14 }} />
              <div className="skeleton" style={{ width: 30, height: 30, borderRadius: "var(--radius-sm)" }} />
            </div>
            <div className="skeleton" style={{ width: 50, height: 30, marginBottom: "0.5rem" }} />
            <div className="skeleton" style={{ width: 130, height: 12 }} />
          </div>
        ))}
      </div>

      {/* High-Speed Action Buttons Skeleton */}
      <div className="card" style={{ marginBottom: "1.75rem", padding: "1.25rem" }}>
        <div className="skeleton" style={{ width: 200, height: 16, marginBottom: "1rem" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ height: 44, borderRadius: "var(--radius)" }} />
          ))}
        </div>
      </div>

      {/* Main Grid Skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          gap: "1.75rem",
        }}
      >
        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="skeleton" style={{ width: 220, height: 20, marginBottom: "1rem" }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 40, width: "100%", marginBottom: "0.75rem" }} />
          ))}
        </div>
        <div className="card" style={{ padding: "1.25rem" }}>
          <div className="skeleton" style={{ width: 180, height: 20, marginBottom: "1rem" }} />
          <div className="skeleton" style={{ height: 60, width: "100%" }} />
        </div>
      </div>
    </div>
  );
}
