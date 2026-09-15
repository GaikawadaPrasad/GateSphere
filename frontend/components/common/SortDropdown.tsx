"use client";

import React from "react";

export type SortPreset = "newest" | "oldest" | "a-z" | "z-a";

export interface SortDropdownProps {
  value: SortPreset;
  onChange: (preset: SortPreset) => void;
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function SortDropdown({
  value,
  onChange,
  className = "",
  size = "sm",
  showLabel = true,
}: SortDropdownProps) {
  const isSm = size === "sm";

  return (
    <div
      className={`sort-dropdown-container ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
      }}
    >
      {showLabel && (
        <span
          style={{
            fontSize: isSm ? "12px" : "13px",
            color: "var(--muted, #64748b)",
            fontWeight: 500,
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <span>Sort:</span>
        </span>
      )}
      <div style={{ position: "relative", display: "inline-block" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SortPreset)}
          className="select-field"
          style={{
            height: isSm ? "34px" : "38px",
            fontSize: isSm ? "12.5px" : "13.5px",
            paddingLeft: "0.65rem",
            paddingRight: "1.75rem",
            borderRadius: "var(--radius-sm, 6px)",
            border: "1px solid var(--border, #cbd5e1)",
            background: "#ffffff",
            color: "var(--fg, #0f172a)",
            fontWeight: 500,
            cursor: "pointer",
            minWidth: isSm ? "145px" : "165px",
          }}
          aria-label="Sort Order"
        >
          <option value="newest">🕒 Newly Added (Newest)</option>
          <option value="oldest">⏳ Oldest First</option>
          <option value="a-z">🔤 A to Z</option>
          <option value="z-a">🔡 Z to A</option>
        </select>
      </div>
    </div>
  );
}
