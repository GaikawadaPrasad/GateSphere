import { describe, it, expect } from "vitest";
import { BrandTokens, getModuleAccent } from "@/config/brand-tokens";

describe("Brand Tokens & Design System Specification", () => {
  it("defines canonical brand colors matching design requirements", () => {
    expect(BrandTokens.colors.primary).toBe("#1D4ED8"); // Trust Blue
    expect(BrandTokens.colors.secondary).toBe("#0D9488"); // Fresh Teal
    expect(BrandTokens.colors.darkText).toBe("#0F172A"); // Deep Charcoal
    expect(BrandTokens.colors.slateText).toBe("#64748B"); // Slate
    expect(BrandTokens.colors.background).toBe("#FAF9F7"); // Warm Off-White
  });

  it("provides correct accent colors for all 10 domain functional modules", () => {
    expect(getModuleAccent("security")).toBe("#1D4ED8");
    expect(getModuleAccent("residents")).toBe("#0D9488");
    expect(getModuleAccent("visitors")).toBe("#7C3AED");
    expect(getModuleAccent("maintenance")).toBe("#16A34A");
    expect(getModuleAccent("payments")).toBe("#D97706");
    expect(getModuleAccent("parking")).toBe("#0891B2");
    expect(getModuleAccent("amenities")).toBe("#9333EA");
    expect(getModuleAccent("communication")).toBe("#EA580C");
    expect(getModuleAccent("emergency")).toBe("#DC2626");
    expect(getModuleAccent("reports")).toBe("#475569");
  });

  it("defines standard typography weight and size scales", () => {
    expect(BrandTokens.typography.weights.hero).toBe(900);
    expect(BrandTokens.typography.weights.eyebrow).toBe(700);
    expect(BrandTokens.typography.eyebrow.textTransform).toBe("uppercase");
  });
});
