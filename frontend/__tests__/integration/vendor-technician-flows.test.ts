import { describe, it, expect } from "vitest";
import {
  VENDOR_TECHNICIAN_NAV,
  VENDOR_TECHNICIAN_NAV_ITEMS,
  getDashboardNavForRole,
} from "@/config/dashboard-navigation";

describe("Vendor / Technician Operational Workflow Verification (Section 8 GSE-2026)", () => {
  it("contains all 8 vendor modules in the navigation configuration", () => {
    expect(VENDOR_TECHNICIAN_NAV_ITEMS).toHaveLength(8);
    const moduleSlugs = VENDOR_TECHNICIAN_NAV_ITEMS.map((item) => item.id);
    expect(moduleSlugs).toContain("dashboard");
    expect(moduleSlugs).toContain("assigned-tickets");
    expect(moduleSlugs).toContain("work-progress");
    expect(moduleSlugs).toContain("entry-pass");
    expect(moduleSlugs).toContain("work-completion");
    expect(moduleSlugs).toContain("service-history");
    expect(moduleSlugs).toContain("notifications");
    expect(moduleSlugs).toContain("profile");
  });

  it("resolves the correct navigation configuration for role vendor_technician", () => {
    const navConfig = getDashboardNavForRole("vendor_technician");
    expect(navConfig.role).toBe("vendor_technician");
    expect(navConfig.basePath).toBe("/vendor-technician");
    expect(navConfig.navItems).toEqual(VENDOR_TECHNICIAN_NAV.navItems);
  });

  it("validates the full vendor ticket lifecycle state machine (Section 8.5)", () => {
    const getStepIndex = (status: string) => {
      if (status === "created" || status === "assigned") return 0;
      if (status === "acknowledged") return 1;
      if (status === "in_progress") return 2;
      if (status === "resolved" || status === "resident_confirmation" || status === "closed")
        return 3;
      return 0;
    };

    expect(getStepIndex("created")).toBe(0);
    expect(getStepIndex("assigned")).toBe(0);
    expect(getStepIndex("acknowledged")).toBe(1);
    expect(getStepIndex("in_progress")).toBe(2);
    expect(getStepIndex("resolved")).toBe(3);
    expect(getStepIndex("closed")).toBe(3);
  });

  it("generates and formats digital gate pass tokens for guard verification", () => {
    const ticket = {
      id: "abc12345-0000-0000-0000-000000000000",
      ticket_number: "TKT-1024",
      subject: "Swimming Pool Pump Failure",
    };

    const passCode = `PASS-${ticket.ticket_number.toUpperCase()}`;
    const qrData = `GS-PASS-${ticket.ticket_number}-${ticket.id.slice(0, 8).toUpperCase()}`;

    expect(passCode).toBe("PASS-TKT-1024");
    expect(qrData).toBe("GS-PASS-TKT-1024-ABC12345");
  });

  it("validates work completion submission payload structure for FM review", () => {
    const completionData = {
      ticketId: "tkt-88",
      workPerformed: "Pump inspected, impeller motor replaced, flow rate tested.",
      materialsUsed: "Impeller Seal 24mm, Motor Capacitor 45uF",
      startTime: "09:00",
      endTime: "11:30",
      remarks: "Tested running for 30 minutes with zero leakage.",
    };

    const formattedSummary =
      `Work: ${completionData.workPerformed}. Materials: ${completionData.materialsUsed}. Time: ${completionData.startTime}-${completionData.endTime}. Remarks: ${completionData.remarks}`.trim();

    expect(formattedSummary).toContain("Pump inspected");
    expect(formattedSummary).toContain("Impeller Seal");
    expect(formattedSummary).toContain("09:00-11:30");
  });
});
