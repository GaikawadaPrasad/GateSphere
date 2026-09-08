import { cn } from "@/lib/utils";

export type StatusVariant =
  | "active"
  | "inactive"
  | "pending"
  | "resolved"
  | "reported"
  | "acknowledged"
  | "responding"
  | "closed"
  | "posted"
  | "paid"
  | "overdue"
  | "cancelled"
  | "draft"
  | "high"
  | "emergency"
  | "medium"
  | "low";

interface StatusBadgeProps {
  status: string | boolean;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  let text = label || (typeof status === "boolean" ? (status ? "Active" : "Inactive") : String(status));
  let badgeClass = "badge-neutral";

  const s = (typeof status === "boolean" ? (status ? "active" : "inactive") : String(status)).toLowerCase();

  switch (s) {
    case "active":
    case "resolved":
    case "paid":
    case "approved":
    case "completed":
    case "true":
      badgeClass = "badge-success";
      break;

    case "pending":
    case "acknowledged":
    case "responding":
    case "partially_paid":
    case "in_progress":
    case "medium":
      badgeClass = "badge-warning";
      break;

    case "inactive":
    case "reported":
    case "overdue":
    case "cancelled":
    case "high":
    case "emergency":
    case "false":
      badgeClass = "badge-danger";
      break;

    case "posted":
    case "assigned":
    case "created":
    case "open":
      badgeClass = "badge-primary";
      break;

    default:
      badgeClass = "badge-neutral";
      break;
  }

  // Format underscore texts like in_progress -> In Progress
  if (!label && typeof text === "string" && text.includes("_")) {
    text = text.replace(/_/g, " ");
  }

  return <span className={cn("badge", badgeClass, className)}>{text}</span>;
}
