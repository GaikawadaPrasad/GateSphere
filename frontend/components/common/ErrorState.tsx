interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Failed to load data",
  message = "An error occurred while fetching information from the server.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.5rem",
        textAlign: "center",
        background: "var(--danger-light)",
        border: "1px solid var(--danger-border)",
        borderRadius: "var(--radius)",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#fee2e2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "0.75rem",
          color: "var(--danger)",
          fontSize: "1.25rem",
        }}
      >
        ⚠️
      </div>
      <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#991b1b", marginBottom: "0.25rem" }}>
        {title}
      </h3>
      <p
        style={{
          maxWidth: 420,
          color: "#b91c1c",
          fontSize: "0.875rem",
          marginBottom: onRetry ? "1.25rem" : 0,
        }}
      >
        {message}
      </p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
