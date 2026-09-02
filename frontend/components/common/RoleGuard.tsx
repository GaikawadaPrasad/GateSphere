"use client";

import { useMe } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

interface RoleGuardProps {
  children: ReactNode;
  requireSuperAdmin?: boolean;
  requiredPermission?: string;
  allowedRoles?: string[];
  fallback?: ReactNode;
  redirectTo?: string;
}

export function RoleGuard({
  children,
  requireSuperAdmin = false,
  requiredPermission,
  allowedRoles,
  fallback = null,
  redirectTo,
}: RoleGuardProps) {
  const router = useRouter();
  const { data: user, isLoading } = useMe();

  const userRoles = user?.roles?.map((r: any) => (typeof r === "string" ? r : r.role_slug)) || [];
  const hasAllowedRole =
    !allowedRoles ||
    allowedRoles.length === 0 ||
    user?.is_superadmin ||
    allowedRoles.some((role) => userRoles.includes(role));

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}`);
      return;
    }

    if (requireSuperAdmin && !user.is_superadmin) {
      router.replace(redirectTo || "/unauthorized");
      return;
    }

    if (allowedRoles && !hasAllowedRole) {
      router.replace(redirectTo || "/unauthorized");
      return;
    }
  }, [user, isLoading, requireSuperAdmin, allowedRoles, hasAllowedRole, redirectTo, router]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <div className="skeleton" style={{ width: 180, height: 24, borderRadius: 8 }} />
      </div>
    );
  }

  if (!user) return null;

  if (requireSuperAdmin && !user.is_superadmin) {
    return fallback;
  }

  if (allowedRoles && !hasAllowedRole) {
    return fallback;
  }

  if (requiredPermission && !user.is_superadmin && !user.permissions?.includes(requiredPermission)) {
    return fallback;
  }

  return <>{children}</>;
}
