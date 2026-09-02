import { describe, it, expect } from "vitest";
import { can, isAuditor, isDomesticStaff, isResident, isSuperAdmin } from "@/lib/permissions";
import type { CurrentUser } from "@/types/auth";

describe("RBAC Permissions and Role Engine", () => {
  const superAdminUser: CurrentUser = {
    id: "user-1",
    email: "superadmin@gatesphere.com",
    full_name: "Super Admin",
    is_active: true,
    is_superadmin: true,
    permissions: ["*"],
    permission_version: 1,
    community_ids: [],
    roles: [{ id: "r-1", role_slug: "super_admin", community_id: null }],
  };

  const auditorUser: CurrentUser = {
    id: "user-2",
    email: "auditor@gatesphere.com",
    full_name: "Auditor John",
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
    roles: [{ id: "r-2", role_slug: "auditor", community_id: "comm-1" }],
  };

  const residentUser: CurrentUser = {
    id: "user-3",
    email: "resident@gatesphere.com",
    full_name: "Priya Mehta",
    is_active: true,
    is_superadmin: false,
    permissions: ["visitors:create", "visitors:read", "amenities:book", "complaints:create"],
    permission_version: 1,
    community_ids: ["comm-1"],
    roles: [{ id: "r-3", role_slug: "resident", community_id: "comm-1" }],
  };

  it("allows superadmin full wildcard access to all modules and write operations", () => {
    expect(can(superAdminUser, "communities:create")).toBe(true);
    expect(can(superAdminUser, "billing:write")).toBe(true);
    expect(can(superAdminUser, "users:delete")).toBe(true);
    expect(isSuperAdmin(superAdminUser)).toBe(true);
  });

  it("grants auditor read permissions but strictly denies mutation permissions", () => {
    expect(can(auditorUser, "audit:read")).toBe(true);
    expect(can(auditorUser, "gate:read")).toBe(true);
    expect(can(auditorUser, "financial:read")).toBe(true);

    // Write attempts MUST return false
    expect(can(auditorUser, "audit:create")).toBe(false);
    expect(can(auditorUser, "gate:update")).toBe(false);
    expect(can(auditorUser, "billing:create")).toBe(false);
    expect(can(auditorUser, "users:delete")).toBe(false);
    expect(isAuditor(auditorUser)).toBe(true);
  });

  it("verifies resident permissions correctly", () => {
    expect(can(residentUser, "visitors:create")).toBe(true);
    expect(can(residentUser, "amenities:book")).toBe(true);
    expect(can(residentUser, "audit:read")).toBe(false);
    expect(isResident(residentUser)).toBe(true);
    expect(isAuditor(residentUser)).toBe(false);
  });

  it("handles null or unauthenticated user safely without crashing", () => {
    expect(can(null, "audit:read")).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
    expect(isAuditor(null)).toBe(false);
    expect(isResident(null)).toBe(false);
    expect(isDomesticStaff(null)).toBe(false);
  });
});
