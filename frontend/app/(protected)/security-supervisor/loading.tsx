export default function SecuritySupervisorLoading() {
  return (
    <div>
      <div style={{ marginBottom: "1.75rem" }}>
        <div className="skeleton" style={{ width: 280, height: 28, marginBottom: "0.5rem" }} />
        <div className="skeleton" style={{ width: 420, height: 16 }} />
      </div>

      <div className="card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <div className="skeleton" style={{ width: 200, height: 24 }} />
          <div className="skeleton" style={{ width: 220, height: 36, borderRadius: "var(--radius-sm)" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton" style={{ height: 44, width: "100%", borderRadius: "var(--radius-sm)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
