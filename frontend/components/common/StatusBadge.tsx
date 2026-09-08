import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string | boolean;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  let text = label || (typeof status === "boolean" ? (status ? "Active" : "Inactive") : String(status));
  let bg = "#F1F5F9";
  let color = "#475569";
  let border = "#E2E8F0";

  const s = (typeof status === "boolean" ? (status ? "active" : "inactive") : String(status)).toLowerCase();

  switch (s) {
    case "active":
    case "resolved":
    case "paid":
    case "approved":
    case "completed":
    case "checked_in":
    case "on_track":
    case "verified":
    case "true":
      bg = "#F0FDF4";
      color = "#166534";
      border = "#BBF7D0";
      break;

    case "pending":
    case "acknowledged":
    case "responding":
    case "partially_paid":
    case "in_progress":
    case "at_risk":
    case "assigned":
    case "warning":
    case "medium":
      bg = "#FFFBEB";
      color = "#92400E";
      border = "#FDE68A";
      break;

    case "inactive":
    case "reported":
    case "overdue":
    case "cancelled":
    case "rejected":
    case "breached":
    case "escalated":
    case "emergency":
    case "sos":
    case "high":
    case "critical":
    case "false":
      bg = "#FEF2F2";
      color = "#991B1B";
      border = "#FECACA";
      break;

    case "posted":
    case "created":
    case "open":
    case "checked_out":
    case "info":
    case "low":
      bg = "#EFF6FF";
      color = "#1E40AF";
      border = "#BFDBFE";
      break;

    default:
      bg = "#F8FAFC";
      color = "#64748B";
      border = "#E2E8F0";
      break;
  }

  if (!label && typeof text === "string" && text.includes("_")) {
    text = text.replace(/_/g, " ");
  }

  return (
    <span
      className={cn("badge", className)}
      style={{
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
      }}
    >
      {text}
    </span>
  );
}
