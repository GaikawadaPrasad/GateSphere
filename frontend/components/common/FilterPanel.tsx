"use client";

import type { ReactNode } from "react";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterPanelProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: FilterOption[];
  filterLabel?: string;
  actions?: ReactNode;
  secondaryFilterValue?: string;
  onSecondaryFilterChange?: (value: string) => void;
  secondaryFilterOptions?: FilterOption[];
  secondaryFilterLabel?: string;
}

export function FilterPanel({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterValue,
  onFilterChange,
  filterOptions,
  filterLabel,
  actions,
  secondaryFilterValue,
  onSecondaryFilterChange,
  secondaryFilterOptions,
  secondaryFilterLabel,
}: FilterPanelProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        marginBottom: "1.25rem",
        background: "#ffffff",
        padding: "0.85rem 1.25rem",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 260 }}>
        {onSearchChange && (
          <div style={{ position: "relative", minWidth: 220, maxWidth: 360, flex: 1 }}>
            <span
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
                fontSize: "0.9rem",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              className="input-field"
              value={searchValue || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              style={{ paddingLeft: "2.25rem", height: 38 }}
            />
          </div>
        )}

        {filterOptions && onFilterChange && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {filterLabel && <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500 }}>{filterLabel}:</span>}
            <select
              className="select-field"
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              style={{ height: 38, width: "auto", minWidth: 140 }}
            >
              <option value="">All</option>
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {secondaryFilterOptions && onSecondaryFilterChange && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {secondaryFilterLabel && <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500 }}>{secondaryFilterLabel}:</span>}
            <select
              className="select-field"
              value={secondaryFilterValue || ""}
              onChange={(e) => onSecondaryFilterChange(e.target.value)}
              style={{ height: 38, width: "auto", minWidth: 140 }}
            >
              <option value="">All</option>
              {secondaryFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {actions && <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>{actions}</div>}
    </div>
  );
}
