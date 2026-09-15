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
        gap: "0.35rem",
        minWidth: 0,
        maxWidth: "100%",
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
      <div style={{ position: "relative", display: "inline-block", minWidth: 0, maxWidth: "100%" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SortPreset)}
          className="select-field"
          style={{
            height: isSm ? "34px" : "38px",
            fontSize: isSm ? "12px" : "13px",
            paddingLeft: "0.5rem",
            paddingRight: "1.5rem",
            borderRadius: "var(--radius-sm, 6px)",
            border: "1px solid var(--border, #cbd5e1)",
            background: "#ffffff",
            color: "var(--fg, #0f172a)",
            fontWeight: 500,
            cursor: "pointer",
            width: "auto",
            maxWidth: "100%",
            minWidth: 0,
          }}
          aria-label="Sort Order"
        >
          <option value="newest">🕒 Newest</option>
          <option value="oldest">⏳ Oldest</option>
          <option value="a-z">🔤 A to Z</option>
          <option value="z-a">🔡 Z to A</option>
        </select>
      </div>
    </div>
  );
}
