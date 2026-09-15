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
      className="pagination-container"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.65rem 0.85rem",
        borderTop: "1px solid var(--border)",
        background: "#ffffff",
        flexWrap: "wrap",
        gap: "0.5rem",
        fontSize: "0.85rem",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div className="pagination-info" style={{ color: "var(--muted)", fontSize: "0.8rem", minWidth: 0 }}>
        Showing <strong style={{ color: "var(--fg)" }}>{startItem}</strong>–
        <strong style={{ color: "var(--fg)" }}>{endItem}</strong> of{" "}
        <strong style={{ color: "var(--fg)" }}>{total}</strong>
      </div>

      <div
        className="pagination-controls"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        {onPageSizeChange && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              marginRight: "0.35rem",
            }}
          >
            <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Per page:</span>
            <select
              className="select-field"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                width: "auto",
                padding: "0.15rem 0.4rem",
                height: 30,
                fontSize: "0.75rem",
                minHeight: 30,
              }}
              aria-label="Items per page"
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
          style={{ padding: "0.25rem 0.6rem", height: 30, fontSize: "0.775rem" }}
        >
          Previous
        </button>

        <span
          style={{
            padding: "0 0.35rem",
            color: "var(--muted)",
            fontSize: "0.8rem",
            whiteSpace: "nowrap",
          }}
        >
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          className="btn btn-secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          style={{ padding: "0.25rem 0.6rem", height: 30, fontSize: "0.775rem" }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
