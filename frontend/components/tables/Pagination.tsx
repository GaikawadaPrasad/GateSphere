interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1rem",
        borderTop: "1px solid var(--border)",
        background: "#ffffff",
        flexWrap: "wrap",
        gap: "0.75rem",
        fontSize: "0.875rem",
      }}
    >
      <div style={{ color: "var(--muted)" }}>
        Showing <strong style={{ color: "var(--fg)" }}>{startItem}</strong> to{" "}
        <strong style={{ color: "var(--fg)" }}>{endItem}</strong> of{" "}
        <strong style={{ color: "var(--fg)" }}>{total}</strong> results
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {onPageSizeChange && (
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginRight: "1rem" }}
          >
            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Per page:</span>
            <select
              className="select-field"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{ width: "auto", padding: "0.25rem 0.5rem", height: 32 }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}

        <button
          type="button"
          className="btn btn-secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          style={{ padding: "0.35rem 0.75rem", height: 32, fontSize: "0.8rem" }}
        >
          Previous
        </button>

        <span style={{ padding: "0 0.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          className="btn btn-secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          style={{ padding: "0.35rem 0.75rem", height: 32, fontSize: "0.8rem" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
