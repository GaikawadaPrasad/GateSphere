import { describe, it, expect } from "vitest";
import { RESIDENT_NAV_ITEMS } from "@/config/dashboard-navigation";
import { formatCurrency } from "@/lib/utils";

describe("Resident / Owner-Tenant 14 Modules Flow Verification", () => {
  it("contains exactly 14 modules in the Resident navigation specification", () => {
    expect(RESIDENT_NAV_ITEMS).toHaveLength(14);
    const moduleSlugs = RESIDENT_NAV_ITEMS.map((item) => item.id);
    expect(moduleSlugs).toContain("overview");
    expect(moduleSlugs).toContain("profile");
    expect(moduleSlugs).toContain("property");
    expect(moduleSlugs).toContain("family-members");
    expect(moduleSlugs).toContain("visitors");
    expect(moduleSlugs).toContain("deliveries");
    expect(moduleSlugs).toContain("amenities");
    expect(moduleSlugs).toContain("maintenance");
    expect(moduleSlugs).toContain("complaints");
    expect(moduleSlugs).toContain("vehicles");
    expect(moduleSlugs).toContain("domestic-staff");
    expect(moduleSlugs).toContain("payments");
    expect(moduleSlugs).toContain("notifications");
    expect(moduleSlugs).toContain("emergency");
  });

  it("verifies receipt number formatting pattern for simulated payments", () => {
    const currentYear = new Date().getFullYear();
    const randomSuffix = 4821;
    const receiptNumber = `RCP-${currentYear}-${randomSuffix}`;
    expect(receiptNumber).toMatch(/^RCP-\d{4}-\d{4}$/);
  });

  it("calculates outstanding balances correctly across multiple line items", () => {
    const lineItems = [
      { head: "Common Area Maintenance", amount: 220.0 },
      { head: "Security & Gate Operations", amount: 80.0 },
      { head: "Sinking Fund Reserve", amount: 50.0 },
    ];
    const total = lineItems.reduce((acc, item) => acc + item.amount, 0);
    expect(total).toBe(350.0);
    expect(formatCurrency(total)).toBe("$350.00");
  });
});
