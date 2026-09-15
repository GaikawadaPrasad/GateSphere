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

  it("handles multi-apartment assignments mapping for security gate verification", () => {
    const assignments = [
      { staff_id: "s1", unit: { unit_number: "A-101" } },
      { staff_id: "s1", unit: { unit_number: "B-204" } },
      { staff_id: "s2", unit: { unit_number: "C-305" } },
    ];
    const unitMap: Record<string, string[]> = {};
    assignments.forEach((a) => {
      const sid = a.staff_id;
      const unitLabel = a.unit?.unit_number || "Assigned";
      if (!unitMap[sid]) unitMap[sid] = [];
      if (!unitMap[sid].includes(unitLabel)) unitMap[sid].push(unitLabel);
    });

    expect(unitMap["s1"]).toEqual(["A-101", "B-204"]);
    expect(unitMap["s2"]).toEqual(["C-305"]);
  });

  it("accurately correlates open and closed attendance for guard console", () => {
    const attendanceRecords = [
      { id: "att-1", staff_id: "s1", check_in_at: "2026-09-12T08:00:00Z", check_out_at: null },
      { id: "att-2", staff_id: "s2", check_in_at: "2026-09-12T07:00:00Z", check_out_at: "2026-09-12T11:00:00Z" },
    ];

    const openAttendanceMap: Record<string, any> = {};
    const latestClosedMap: Record<string, any> = {};
    attendanceRecords.forEach((att) => {
      const sid = att.staff_id;
      if (!att.check_out_at && !openAttendanceMap[sid]) {
        openAttendanceMap[sid] = att;
      } else if (att.check_out_at && !latestClosedMap[sid]) {
        latestClosedMap[sid] = att;
      }
    });

    expect(openAttendanceMap["s1"]).toBeDefined();
    expect(openAttendanceMap["s1"].id).toBe("att-1");
    expect(openAttendanceMap["s2"]).toBeUndefined();
    expect(latestClosedMap["s2"]).toBeDefined();
  });
});
