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

  const isSuper = Boolean(
    user?.is_superadmin ||
      user?.active_role === "super_admin" ||
      user?.roles?.some((r) => r.role_slug === "super_admin"),
  );

  const userRoles: string[] = [
    ...(user?.active_role ? [user.active_role] : []),
    ...(user?.roles?.map((r) => r.role_slug) || []),
  ];
  if (isSuper) {
    userRoles.push("super_admin");
  }

  const hasAllowedRole =
    !allowedRoles ||
    allowedRoles.length === 0 ||
    isSuper ||
    allowedRoles.some((role) => userRoles.includes(role));

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace(
        `/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}`,
      );
      return;
    }

    if (requireSuperAdmin && !isSuper) {
      router.replace(redirectTo || "/unauthorized");
      return;
    }

    if (allowedRoles && !hasAllowedRole) {
      router.replace(redirectTo || "/unauthorized");
      return;
    }
  }, [
    user,
    isLoading,
    requireSuperAdmin,
    isSuper,
    allowedRoles,
    hasAllowedRole,
    redirectTo,
    router,
  ]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "50vh",
        }}
      >
        <div className="skeleton" style={{ width: 180, height: 24, borderRadius: 8 }} />
      </div>
    );
  }

  if (!user) return null;

  if (requireSuperAdmin && !isSuper) {
    return fallback;
  }

  if (allowedRoles && !hasAllowedRole) {
    return fallback;
  }

  if (requiredPermission && !isSuper && !user.permissions?.includes(requiredPermission)) {
    return fallback;
  }

  return <>{children}</>;
}
