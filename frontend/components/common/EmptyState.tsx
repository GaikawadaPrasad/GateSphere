import type { ReactNode } from "react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({
  title = "No data found",
  description = "There are no records matching your current filter criteria.",
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3.5rem 1.5rem",
        textAlign: "center",
        background: "white",
        borderRadius: "var(--radius)",
        border: "1px dashed var(--border)",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--panel-hover)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1rem",
          color: "var(--muted)",
          fontSize: "1.25rem",
        }}
      >
        {icon || "📭"}
      </div>
      <h3
        style={{ fontSize: "1rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.25rem" }}
      >
        {title}
      </h3>
      <p style={{ maxWidth: 400, color: "var(--muted)", marginBottom: action ? "1.25rem" : 0 }}>
        {description}
      </p>
      {action}
    </div>
  );
}
