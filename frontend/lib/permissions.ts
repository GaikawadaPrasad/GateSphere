/**
 * GateSphere Frontend — RBAC & Permission Helpers (UX Only)
 */

import type { CurrentUser } from "@/types/auth";

export function can(user: CurrentUser | null | undefined, permission: string): boolean {
  if (!user || user.is_active === false) {
    return false;
  }

  if (user.is_superadmin || user.permissions?.includes("*")) {
    return true;
  }

  if (!user.permissions || !Array.isArray(user.permissions)) {
    return false;
  }

  if (user.permissions.includes(permission)) {
    return true;
  }

  // Handle module-level wildcards like "visitors:*" matching "visitors:read"
  return user.permissions.some((p) => {
    if (p.endsWith(":*")) {
      const prefix = p.slice(0, -1); // e.g. "visitors:"
      return permission.startsWith(prefix);
    }
    return false;
  });
}

export function canAny(user: CurrentUser | null | undefined, permissions: string[]): boolean {
  return permissions.some((permission) => can(user, permission));
}

export function canAll(user: CurrentUser | null | undefined, permissions: string[]): boolean {
  return permissions.every((permission) => can(user, permission));
}

export function isSuperAdmin(user: CurrentUser | null | undefined): boolean {
  if (!user) return false;
  return Boolean(
    user.is_superadmin ||
    user.active_role === "super_admin" ||
    user.roles?.some((r) => r.role_slug === "super_admin")
  );
}

export function isAuditor(user: CurrentUser | null | undefined): boolean {
  if (!user) return false;
  return Boolean(
    user.active_role === "auditor" ||
    user.roles?.some((r) => r.role_slug === "auditor")
  );
}

export function isDomesticStaff(user: CurrentUser | null | undefined): boolean {
  if (!user) return false;
  return Boolean(
    user.active_role === "domestic_staff" ||
    user.roles?.some((r) => r.role_slug === "domestic_staff")
  );
}

export function isResident(user: CurrentUser | null | undefined): boolean {
  if (!user) return false;
  return Boolean(
    (user.active_role as string) === "resident" ||
    (user.active_role as string) === "owner" ||
    (user.active_role as string) === "tenant" ||
    user.roles?.some(
      (r) =>
        (r.role_slug as string) === "resident" ||
        (r.role_slug as string) === "owner" ||
        (r.role_slug as string) === "tenant"
    )
  );
}

export function getRoleLandingRoute(user: CurrentUser | null | undefined): string {
  if (!user) return "/login";
  if (user.is_superadmin || user.active_role === "super_admin" || user.roles?.some((r) => r.role_slug === "super_admin")) {
    return "/super-admin/dashboard";
  }
  const role = (user.active_role || user.roles?.[0]?.role_slug) as string | undefined;
  switch (role) {
    case "super_admin":
      return "/super-admin/dashboard";
    case "community_admin":
      return "/community-admin/dashboard";
    case "association_committee":
      return "/association-committee/governance";
    case "facility_manager":
      return "/facility-manager/dashboard";
    case "security_supervisor":
      return "/security-supervisor/dashboard";
    case "security_guard":
      return "/security-guard/dashboard";
    case "resident":
    case "owner":
    case "tenant":
      return "/owner-tenant/dashboard";
    case "domestic_staff":
      return "/domestic-staff/dashboard";
    case "vendor_technician":
      return "/vendor-technician/dashboard";
    case "auditor":
      return "/auditor/dashboard";
    default:
      return "/dashboard";
  }
}
