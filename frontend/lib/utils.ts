/**
 * GateSphere Frontend — UI & Formatting Utilities
 */

export function cn(...inputs: (string | boolean | null | undefined)[]): string {
  return inputs.filter(Boolean).join(" ");
}

export function formatCurrency(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "$0.00";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0m";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "just now";
  const timestamp = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  if (isNaN(timestamp)) return "just now";
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return `${Math.max(1, diffSec)}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) {
    return `${diffHrs}h ago`;
  }
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  }
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

export function formatCompactNumber(num: number): string {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
}

export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str || "";
  return str.slice(0, maxLength) + "…";
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
