"use client";

import React from "react";
import { useCountUp } from "@/hooks/use-count-up";

interface StatMetricProps {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive: boolean;
    label?: string;
  };
  accentColor?: string;
  description?: string;
  onClick?: () => void;
  className?: string;
}

export function StatMetric({
  label,
  value,
  prefix = "",
  suffix = "",
  icon,
  trend,
  accentColor = "#1D4ED8",
  description,
  onClick,
  className = "",
}: StatMetricProps) {
  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]+/g, ""));
  const isNumber = !isNaN(numericValue);
  const countUpValue = useCountUp(isNumber ? numericValue : 0);
  const animatedValue = isNumber ? countUpValue : value;

  return (
    <div
      onClick={onClick}
      className={`gs-card card-hover ${onClick ? "clickable" : ""} ${className}`}
      style={{
        cursor: onClick ? "pointer" : "default",
        borderTop: `3px solid ${accentColor}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--brand-body)" }}>
          {label}
        </span>
        {icon && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "8px",
              background: `${accentColor}15`,
              color: accentColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", margin: "0.25rem 0" }}>
        {prefix && <span style={{ fontSize: "1.5rem", fontWeight: 800, color: accentColor }}>{prefix}</span>}
        <span className="stat-number">
          {isNumber ? animatedValue.toLocaleString() : value}
        </span>
        {suffix && <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--brand-body)", marginLeft: "0.25rem" }}>{suffix}</span>}
      </div>

      {trend && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.5rem", fontSize: "12px" }}>
          <span
            style={{
              color: trend.isPositive ? "#16A34A" : "#DC2626",
              fontWeight: 700,
            }}
          >
            {trend.isPositive ? "↑" : "↓"} {trend.value}
          </span>
          {trend.label && <span style={{ color: "var(--text-muted)" }}>{trend.label}</span>}
        </div>
      )}

      {description && (
        <p style={{ fontSize: "12px", color: "var(--brand-body)", marginTop: "0.5rem" }}>
          {description}
        </p>
      )}
    </div>
  );
}
