export default function VendorTechnicianLoading() {
  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: "1rem" }}>
      {/* Header Skeleton */}
      <div style={{ marginBottom: "1.75rem" }}>
        <div className="skeleton" style={{ width: 280, height: 28, marginBottom: "0.5rem" }} />
        <div className="skeleton" style={{ width: 420, height: 16 }} />
      </div>

      {/* KPI Cards Skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card" style={{ padding: "1.25rem", minHeight: 120 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div className="skeleton" style={{ width: 100, height: 14 }} />
              <div className="skeleton" style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)" }} />
            </div>
            <div className="skeleton" style={{ width: 50, height: 28, marginBottom: "0.5rem" }} />
            <div className="skeleton" style={{ width: 120, height: 12 }} />
          </div>
        ))}
      </div>

      {/* QR Code / Entry Pass Skeleton */}
      <div className="card" style={{ marginBottom: "1.75rem", padding: "1.25rem" }}>
        <div className="skeleton" style={{ width: 200, height: 20, marginBottom: "1rem" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div className="skeleton" style={{ width: 120, height: 120, borderRadius: "var(--radius)" }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ width: "60%", height: 14, marginBottom: "0.5rem" }} />
            <div className="skeleton" style={{ width: "40%", height: 14, marginBottom: "0.5rem" }} />
            <div className="skeleton" style={{ width: "50%", height: 14 }} />
          </div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div className="skeleton" style={{ width: 220, height: 20, marginBottom: "1rem" }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton" style={{ height: 40, width: "100%", marginBottom: "0.75rem" }} />
        ))}
      </div>
    </div>
  );
}
