import type { ReactNode } from "react";

interface FilterPanelProps {
  children: ReactNode;
  onReset?: () => void;
  className?: string;
}

export function FilterPanel({ children, onReset, className = "" }: FilterPanelProps) {
  return (
    <div
      className={`card ${className}`}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        alignItems: "flex-end",
        padding: "1rem 1.25rem",
        marginBottom: "1.25rem",
        background: "#ffffff",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", flex: 1, alignItems: "center" }}>{children}</div>
      {onReset && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onReset}
          style={{ height: "36px", fontSize: "0.8rem", padding: "0 0.75rem" }}
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}
