export default function SecuritySupervisorDashboardLoading() {
  return (
    <div>
      {/* Header Skeleton */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div className="skeleton" style={{ width: 280, height: 28, marginBottom: "0.5rem" }} />
        <div className="skeleton" style={{ width: 440, height: 16 }} />
      </div>

      {/* 6 KPI Cards Skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div className="skeleton" style={{ width: 120, height: 16 }} />
              <div className="skeleton" style={{ width: 28, height: 28, borderRadius: "50%" }} />
            </div>
            <div className="skeleton" style={{ width: 60, height: 32, marginBottom: "0.5rem" }} />
            <div className="skeleton" style={{ width: 140, height: 12 }} />
          </div>
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <div className="card" style={{ marginBottom: "1.75rem", padding: "1.25rem" }}>
        <div className="skeleton" style={{ width: 200, height: 18, marginBottom: "0.75rem" }} />
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ width: 150, height: 36, borderRadius: "var(--radius-sm)" }} />
          ))}
        </div>
      </div>

      {/* Main Grid Skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: "1.75rem",
        }}
      >
        <div className="card" style={{ minHeight: 320, padding: "1.25rem" }}>
          <div className="skeleton" style={{ width: 220, height: 20, marginBottom: "1.25rem" }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 40, width: "100%", marginBottom: "0.75rem" }} />
          ))}
        </div>

        <div style={{ maxWidth: 460, width: "100%" }}>
          <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
            <div className="skeleton" style={{ width: 160, height: 20, marginBottom: "1rem" }} />
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 48, width: "100%", marginBottom: "0.75rem" }} />
            ))}
          </div>

          <div className="card" style={{ padding: "1.25rem" }}>
            <div className="skeleton" style={{ width: 180, height: 20, marginBottom: "1rem" }} />
            <div className="skeleton" style={{ height: 60, width: "100%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
