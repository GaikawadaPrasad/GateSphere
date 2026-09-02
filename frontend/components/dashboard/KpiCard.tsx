import type { ReactNode } from "react";

export type KpiAccent = "primary" | "success" | "warning" | "danger" | "purple" | "neutral";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: ReactNode;
  icon: string | ReactNode;
  accent?: KpiAccent;
  badge?: {
    text: string;
    variant?: "success" | "warning" | "danger" | "primary" | "neutral";
  };
  onClick?: () => void;
}

export function KpiCard({ title, value, subtitle, icon, accent = "primary", badge, onClick }: KpiCardProps) {
  let iconBg = "#eff6ff";
  let iconColor = "#2563eb";
  let borderTop = "3px solid #3b82f6";

  switch (accent) {
    case "success":
      iconBg = "#ecfdf5";
      iconColor = "#059669";
      borderTop = "3px solid #10b981";
      break;
    case "warning":
      iconBg = "#fffbeb";
      iconColor = "#d97706";
      borderTop = "3px solid #f59e0b";
      break;
    case "danger":
      iconBg = "#fef2f2";
      iconColor = "#dc2626";
      borderTop = "3px solid #ef4444";
      break;
    case "purple":
      iconBg = "#f5f3ff";
      iconColor = "#7c3aed";
      borderTop = "3px solid #8b5cf6";
      break;
    case "neutral":
      iconBg = "#f1f5f9";
      iconColor = "#475569";
      borderTop = "3px solid #94a3b8";
      break;
    default:
      iconBg = "#eff6ff";
      iconColor = "#2563eb";
      borderTop = "3px solid #3b82f6";
      break;
  }

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderTop,
        cursor: onClick ? "pointer" : "default",
        padding: "1.25rem 1.35rem",
        minHeight: 140,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.025em" }}>
          {title}
        </span>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "var(--radius-sm)",
            background: iconBg,
            color: iconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>

      <div style={{ margin: "0.5rem 0 0.25rem" }}>
        <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--fg)", lineHeight: 1.1 }}>
          {value}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.25rem" }}>
        <span>{subtitle}</span>
        {badge && (
          <span className={`badge badge-${badge.variant || "neutral"}`} style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }}>
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}
