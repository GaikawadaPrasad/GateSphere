/**
 * GateSphere Frontend — UI & Formatting Utilities
 */

export function cn(...inputs: (string | boolean | null | undefined)[]): string {
  return inputs.filter(Boolean).join(" ");
}

export function formatCurrency(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "₹0.00";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
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

/**
 * Derives a complaint/service ticket's SLA escalation state client-side from its
 * timestamps. `TicketRead` (backend/app/modules/complaints/schemas.py) does not
 * serialize an `escalation_state` field, so this must be computed rather than read.
 */
export function deriveTicketEscalationState(ticket: {
  status: string;
  created_at: string;
  resolution_due_at?: string | null;
  sla_breached_at?: string | null;
}): "on_track" | "at_risk" | "breached" | "escalated" {
  if (ticket.status === "resolved" || ticket.status === "closed") return "on_track";
  if (ticket.sla_breached_at) return "breached";
  if (!ticket.resolution_due_at) return "on_track";

  const due = new Date(ticket.resolution_due_at).getTime();
  const now = Date.now();
  if (now >= due) return "breached";

  const created = new Date(ticket.created_at).getTime();
  const totalWindow = due - created;
  const remaining = due - now;
  if (totalWindow > 0 && remaining / totalWindow < 0.25) return "at_risk";
  return "on_track";
}

/**
 * Auto-generates a user-friendly default initial password from a user's full name,
 * matching GateSphere's standard pattern (e.g. "Ananya Patel" -> "ananya@Gate2026!").
 */
export function generateInitialPassword(fullName: string, defaultPrefix = "user"): string {
  const cleanName = fullName.trim().replace(/[^a-zA-Z0-9]/g, "");
  const firstName = cleanName.length > 0 ? cleanName.toLowerCase() : defaultPrefix;
  return `${firstName}@Gate2026!`;
}

/**
 * Returns an appropriate emoji icon based on facility / amenity name, category, or description.
 */
export function getAmenityIcon(
  name?: string | null,
  category?: string | null,
  description?: string | null,
): string {
  const text = `${name || ""} ${category || ""} ${description || ""}`.toLowerCase();

  // Swimming / Aquatics
  if (text.includes("swim") || text.includes("pool") || text.includes("aqua") || text.includes("jacuzzi")) {
    return "🏊";
  }

  // Gym / Fitness
  if (
    text.includes("gym") ||
    text.includes("fitness") ||
    text.includes("workout") ||
    text.includes("cardio") ||
    text.includes("crossfit") ||
    text.includes("weights") ||
    text.includes("bodybuilding")
  ) {
    return "🏋️";
  }

  // Children / Kids / Play Area / Park
  if (
    text.includes("child") ||
    text.includes("kid") ||
    text.includes("park") ||
    text.includes("playground") ||
    text.includes("play area") ||
    text.includes("toddler") ||
    text.includes("creche")
  ) {
    return "🛝";
  }

  // Racquet / Ball Sports & Courts
  if (text.includes("badminton") || text.includes("shuttle")) {
    return "🏸";
  }
  if (text.includes("tennis")) {
    return "🎾";
  }
  if (text.includes("table tennis") || text.includes("ping pong") || text.includes(" tt")) {
    return "🏓";
  }
  if (text.includes("squash")) {
    return "🎾";
  }
  if (text.includes("basketball") || text.includes("hoop")) {
    return "🏀";
  }
  if (text.includes("cricket") || text.includes("pitch") || text.includes("nets")) {
    return "🏏";
  }
  if (
    text.includes("football") ||
    text.includes("soccer") ||
    text.includes("turf") ||
    text.includes("futsal")
  ) {
    return "⚽";
  }
  if (text.includes("court")) {
    return "🎾";
  }

  // Clubhouse / Lounge / Community Center
  if (text.includes("clubhouse") || text.includes("club house") || text.includes("club")) {
    return "🏛️";
  }
  if (text.includes("lounge") || text.includes("lobby")) {
    return "🛋️";
  }

  // Halls, Events & Banquets
  if (
    text.includes("banquet") ||
    text.includes("party") ||
    text.includes("hall") ||
    text.includes("celebration") ||
    text.includes("event")
  ) {
    return "🎉";
  }
  if (
    text.includes("amphitheater") ||
    text.includes("amphitheatre") ||
    text.includes("auditorium") ||
    text.includes("stage")
  ) {
    return "🎭";
  }
  if (
    text.includes("theater") ||
    text.includes("theatre") ||
    text.includes("cinema") ||
    text.includes("movie") ||
    text.includes("av room") ||
    text.includes("screening")
  ) {
    return "🎬";
  }

  // Wellness, Yoga & Spa
  if (text.includes("yoga") || text.includes("meditation") || text.includes("zen")) {
    return "🧘";
  }
  if (
    text.includes("spa") ||
    text.includes("sauna") ||
    text.includes("steam") ||
    text.includes("massage")
  ) {
    return "🧖";
  }

  // Indoor Games & Recreation
  if (text.includes("billiard") || text.includes("snooker") || text.includes("8 ball")) {
    return "🎱";
  }
  if (
    text.includes("game") ||
    text.includes("arcade") ||
    text.includes("gaming") ||
    text.includes("playstation") ||
    text.includes("xbox") ||
    text.includes("board game")
  ) {
    return "🎮";
  }
  if (text.includes("skat") || text.includes("roller") || text.includes("rink")) {
    return "🛼";
  }

  // Nature, Gardens & Outdoor
  if (
    text.includes("garden") ||
    text.includes("lawn") ||
    text.includes("green") ||
    text.includes("botanical") ||
    text.includes("flora")
  ) {
    return "🌳";
  }
  if (
    text.includes("terrace") ||
    text.includes("rooftop") ||
    text.includes("deck") ||
    text.includes("gazebo") ||
    text.includes("viewpoint") ||
    text.includes("sky")
  ) {
    return "🌇";
  }
  if (
    text.includes("jog") ||
    text.includes("running") ||
    text.includes("track") ||
    text.includes("walk")
  ) {
    return "🏃";
  }
  if (text.includes("bbq") || text.includes("barbecue") || text.includes("grill")) {
    return "🍖";
  }
  if (text.includes("pet") || text.includes("dog")) {
    return "🐕";
  }

  // Work & Education
  if (
    text.includes("library") ||
    text.includes("reading") ||
    text.includes("study") ||
    text.includes("book")
  ) {
    return "📚";
  }
  if (
    text.includes("cowork") ||
    text.includes("business") ||
    text.includes("meeting") ||
    text.includes("conference") ||
    text.includes("workstation") ||
    text.includes("office")
  ) {
    return "💼";
  }

  // Dining & Food
  if (
    text.includes("cafe") ||
    text.includes("coffee") ||
    text.includes("canteen") ||
    text.includes("cafeteria") ||
    text.includes("dining") ||
    text.includes("restaurant")
  ) {
    return "☕";
  }

  return "🏢";
}

/**
 * Validates that a person's full name or contact name is valid (letters, spaces,
 * dots, hyphens, parentheses, and apostrophes, at least 2 characters, no digits).
 */
export function isValidPersonName(name: string): boolean {
  const trimmed = (name || "").trim();
  if (trimmed.length < 2) return false;
  return /^[a-zA-Z\s.\-',()]+$/.test(trimmed) && (trimmed.match(/[a-zA-Z]/g) || []).length >= 2;
}

/** 10-digit mobile number, digits only (mirrors backend `PHONE_10_DIGIT_PATTERN`, GS-016). */
export const PHONE_10_DIGIT_RE = /^\d{10}$/;

/** Keep only digits and cap at 10 so a phone input can't hold anything else. */
export function toPhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

