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
        gap: "0.75rem",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1rem",
        marginBottom: "1rem",
        background: "#ffffff",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          flex: "1 1 auto",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        {children}
      </div>
      {onReset && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onReset}
          style={{ height: "34px", fontSize: "0.785rem", padding: "0 0.75rem" }}
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}
