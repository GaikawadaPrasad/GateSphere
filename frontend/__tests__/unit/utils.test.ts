import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDuration,
  formatRelativeTime,
  formatCompactNumber,
  truncate,
  cn,
} from "@/lib/utils";

describe("UI and Data Formatting Utilities", () => {
  it("formats currencies in standard USD localized format", () => {
    expect(formatCurrency(350)).toBe("$350.00");
    expect(formatCurrency("1250.50")).toBe("$1,250.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(null)).toBe("$0.00");
  });

  it("formats durations into hours and minutes strings", () => {
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(0)).toBe("0m");
  });

  it("formats relative timestamps safely", () => {
    const justNow = new Date().toISOString();
    expect(formatRelativeTime(justNow)).toBe("1s ago");

    const tenMinsAgo = new Date(Date.now() - 1000 * 60 * 10).toISOString();
    expect(formatRelativeTime(tenMinsAgo)).toBe("10m ago");

    expect(formatRelativeTime(null)).toBe("just now");
  });

  it("formats compact numeric metrics for dashboard KPIs", () => {
    expect(formatCompactNumber(1200)).toBe("1.2K");
    expect(formatCompactNumber(1500000)).toBe("1.5M");
    expect(formatCompactNumber(42)).toBe("42");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("Short string", 20)).toBe("Short string");
    expect(truncate("This is an exceptionally long subject description that exceeds max limit", 15)).toBe(
      "This is an exce…"
    );
  });

  it("joins conditional class names seamlessly with cn()", () => {
    expect(cn("card", true && "card-active", false && "hidden", null, undefined)).toBe("card card-active");
  });
});
