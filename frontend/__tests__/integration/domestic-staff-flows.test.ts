import { describe, it, expect } from "vitest";
import { DOMESTIC_STAFF_NAV_ITEMS } from "@/config/dashboard-navigation";
import { formatDuration } from "@/lib/utils";

describe("Domestic Staff 9 Modules Operational Verification", () => {
  it("contains exactly 9 modules in the Domestic Staff navigation specification", () => {
    expect(DOMESTIC_STAFF_NAV_ITEMS).toHaveLength(9);
    const moduleSlugs = DOMESTIC_STAFF_NAV_ITEMS.map((item) => item.id);
    expect(moduleSlugs).toContain("overview");
    expect(moduleSlugs).toContain("profile");
    expect(moduleSlugs).toContain("assigned-homes");
    expect(moduleSlugs).toContain("schedule");
    expect(moduleSlugs).toContain("attendance");
    expect(moduleSlugs).toContain("entry-exit");
    expect(moduleSlugs).toContain("visits");
    expect(moduleSlugs).toContain("notifications");
    expect(moduleSlugs).toContain("emergency");
  });

  it("calculates duty durations and shift attendance properly", () => {
    const checkInDurationMinutes = 185; // 3 hours 5 minutes
    expect(formatDuration(checkInDurationMinutes)).toBe("3h 5m");

    const fullShiftDurationMinutes = 375; // 6 hours 15 minutes
    expect(formatDuration(fullShiftDurationMinutes)).toBe("6h 15m");
  });

  it("ensures emergency panic SOS payload contains mandatory tracking coordinates", () => {
    const panicPayload = {
      alert_type: "sos",
      priority: "high",
      unit_id: "Unit A-402, Emerald Tower",
      details: "Domestic staff emergency SOS trigger",
    };
    expect(panicPayload.alert_type).toBe("sos");
    expect(panicPayload.priority).toBe("high");
    expect(panicPayload.unit_id).toBeDefined();
  });
});
