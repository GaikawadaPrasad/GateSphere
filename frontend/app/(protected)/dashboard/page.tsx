"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-auth";

/**
 * Smart role-router. Redirects the user to their correct portal based on role.
 * This acts as a fallback landing page that immediately routes to the right place.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { data: user, isLoading } = useMe();

  useEffect(() => {
    if (isLoading || !user) return;

    if (user.is_superadmin || user.active_role === "super_admin") {
      router.replace("/super-admin/dashboard");
      return;
    }

    const primaryRole = user.active_role || user.roles?.[0]?.role_slug;
    switch (primaryRole) {
      case "facility_manager":
        router.replace("/facility-manager/dashboard");
        break;
      case "security_supervisor":
        router.replace("/security-supervisor/dashboard");
        break;
      case "security_guard":
        router.replace("/security-guard/dashboard");
        break;
      case "vendor_technician":
        router.replace("/vendor-technician/dashboard");
        break;
      case "community_admin":
        router.replace("/community-admin/dashboard");
        break;
      case "resident":
        router.replace("/resident/home");
        break;
      default:
        const hasRole = (slug: string) => user.roles?.some((r) => r.role_slug === slug) ?? false;
        if (hasRole("facility_manager")) { router.replace("/facility-manager/dashboard"); return; }
        if (hasRole("security_supervisor")) { router.replace("/security-supervisor/dashboard"); return; }
        if (hasRole("security_guard")) { router.replace("/security-guard/dashboard"); return; }
        if (hasRole("vendor_technician")) { router.replace("/vendor-technician/dashboard"); return; }
        if (hasRole("community_admin")) { router.replace("/community-admin/dashboard"); return; }
        router.replace("/facility-manager/dashboard");
        break;
    }
  }, [user, isLoading, router]);

  // Show minimal loading state while routing
  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ textAlign: "center", color: "var(--muted, #64748b)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔄</div>
        <p>Redirecting to your role workspace dashboard…</p>
      </div>
    </main>
  );
}
