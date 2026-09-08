import { describe, it, expect } from "vitest";
import { AUDITOR_NAV_ITEMS } from "@/config/dashboard-navigation";
import { isAuditor, can } from "@/lib/permissions";
import type { CurrentUser } from "@/types/auth";

describe("Auditor Role & 11 Modules Read-Only Integrity Test", () => {
  const auditor: CurrentUser = {
    id: "auditor-01",
    email: "compliance@gatesphere.com",
    full_name: "Internal Auditor",
    is_active: true,
    is_superadmin: false,
    permissions: [
      "audit:read",
      "gate:read",
      "visitors:read",
      "maintenance:read",
      "vendors:read",
      "incidents:read",
      "financial:read",
    ],
    permission_version: 1,
    community_ids: ["comm-1"],
    active_role: "auditor",
    session_bucket: "auditor",
    roles: [{ id: "r-auditor", role_slug: "auditor", community_id: "comm-1" }],
  };

  it("contains exactly 11 modules in the Auditor navigation specification", () => {
    expect(AUDITOR_NAV_ITEMS).toHaveLength(11);
    const moduleSlugs = AUDITOR_NAV_ITEMS.map((item) => item.id);
    expect(moduleSlugs).toContain("overview");
    expect(moduleSlugs).toContain("audit-logs");
    expect(moduleSlugs).toContain("user-activity");
    expect(moduleSlugs).toContain("gate-activity");
    expect(moduleSlugs).toContain("visitor-records");
    expect(moduleSlugs).toContain("maintenance-records");
    expect(moduleSlugs).toContain("vendor-activity");
    expect(moduleSlugs).toContain("incident-records");
    expect(moduleSlugs).toContain("financial-records");
    expect(moduleSlugs).toContain("reports");
    expect(moduleSlugs).toContain("audit-search");
  });

  it("prohibits any write, delete, or update action across all 11 modules for the auditor role", () => {
    expect(isAuditor(auditor)).toBe(true);

    const writeActions = [
      "audit:create",
      "audit:delete",
      "gate:override",
      "visitors:create",
      "visitors:approve",
      "maintenance:update",
      "financial:refund",
      "incidents:delete",
      "users:update",
    ];

    writeActions.forEach((action) => {
      expect(can(auditor, action)).toBe(false);
    });
  });
});
