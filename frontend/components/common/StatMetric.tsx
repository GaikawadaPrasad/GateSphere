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
        padding: "1.35rem 1.5rem",
        position: "relative",
        overflow: "hidden",
        borderTop: `3px solid ${accentColor}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
        <span
          style={{
            fontSize: "11.5px",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--muted)",
          }}
        >
          {label}
        </span>
        {icon && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: `${accentColor}12`,
              border: `1px solid ${accentColor}25`,
              color: accentColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.15rem",
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "0.2rem", margin: "0.15rem 0" }}>
        {prefix && (
          <span style={{ fontSize: "1.4rem", fontWeight: 800, color: accentColor, marginRight: "0.15rem" }}>
            {prefix}
          </span>
        )}
        <span className="stat-number" style={{ color: "#0F172A" }}>
          {isNumber ? animatedValue.toLocaleString() : value}
        </span>
        {suffix && (
          <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--muted)", marginLeft: "0.3rem" }}>
            {suffix}
          </span>
        )}
      </div>

      {trend && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.5rem", fontSize: "12px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.15rem 0.45rem",
              borderRadius: "9999px",
              background: trend.isPositive ? "#ECFDF5" : "#FEF2F2",
              color: trend.isPositive ? "#059669" : "#DC2626",
              fontWeight: 700,
              fontSize: "11px",
            }}
          >
            {trend.isPositive ? "↑" : "↓"} {trend.value}
          </span>
          {trend.label && <span style={{ color: "var(--muted)", fontSize: "11.5px" }}>{trend.label}</span>}
        </div>
      )}

      {description && (
        <p style={{ fontSize: "12px", color: "var(--brand-body)", marginTop: "0.4rem", lineHeight: 1.4 }}>
          {description}
        </p>
      )}
    </div>
  );
}
