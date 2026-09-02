"use client";

import { useMe } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

interface RoleGuardProps {
  children: ReactNode;
  requireSuperAdmin?: boolean;
  requiredPermission?: string;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function RoleGuard({
  children,
  requireSuperAdmin = false,
  requiredPermission,
  fallback = null,
  redirectTo,
}: RoleGuardProps) {
  const router = useRouter();
  const { data: user, isLoading } = useMe();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (requireSuperAdmin && !user.is_superadmin) {
      if (redirectTo) {
        router.replace(redirectTo);
      } else {
        router.replace("/unauthorized");
      }
    }
  }, [user, isLoading, requireSuperAdmin, redirectTo, router]);

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

  if (requiredPermission && !user.is_superadmin && !user.permissions.includes(requiredPermission)) {
    return fallback;
  }

  return <>{children}</>;
}
