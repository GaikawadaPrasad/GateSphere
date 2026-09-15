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
      className="filter-panel-container"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        marginBottom: "1rem",
        background: "#ffffff",
        padding: "0.75rem 1rem",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
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
          alignItems: "center",
          gap: "0.5rem",
          flex: "1 1 auto",
          minWidth: 0,
          width: "100%",
        }}
      >
        {onSearchChange && (
          <div style={{ position: "relative", minWidth: 0, flex: "1 1 160px", width: "100%" }}>
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
              style={{ paddingLeft: "2.25rem", height: 36, width: "100%" }}
            />
          </div>
        )}

        {filterOptions && onFilterChange && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              minWidth: 0,
              flex: "0 1 auto",
            }}
          >
            {filterLabel && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {filterLabel}:
              </span>
            )}
            <select
              className="select-field"
              value={filterValue || ""}
              onChange={(e) => onFilterChange(e.target.value)}
              style={{ height: 36, width: "auto", minWidth: 0 }}
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              minWidth: 0,
              flex: "0 1 auto",
            }}
          >
            {secondaryFilterLabel && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {secondaryFilterLabel}:
              </span>
            )}
            <select
              className="select-field"
              value={secondaryFilterValue || ""}
              onChange={(e) => onSecondaryFilterChange(e.target.value)}
              style={{ height: 36, width: "auto", minWidth: 0 }}
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

      {actions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
