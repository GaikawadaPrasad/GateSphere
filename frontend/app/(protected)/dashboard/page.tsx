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

    // active_role is always returned by the session — use it as the primary signal
    if (user.is_superadmin || user.active_role === "super_admin") {
      router.replace("/super-admin/dashboard");
      return;
    }

    if (user.active_role === "community_admin") {
      router.replace("/community-admin/dashboard");
      return;
    }

    if (user.active_role === "security_guard" || user.active_role === "security_supervisor") {
      router.replace("/gate/live");
      return;
    }

    if (user.active_role === "resident") {
      router.replace("/resident/home");
      return;
    }

    // Fallback: roles[] array if available
    const hasRole = (slug: string) => user.roles?.some((r) => r.role_slug === slug) ?? false;
    if (hasRole("community_admin")) { router.replace("/community-admin/dashboard"); return; }
    if (hasRole("security_guard") || hasRole("security_supervisor")) { router.replace("/gate/live"); return; }
    if (hasRole("resident")) { router.replace("/resident/home"); return; }

    // Last resort: permissions-based
    if (!user.is_superadmin && user.community_ids?.length > 0) {
      if (user.permissions.includes("communities:update")) {
        router.replace("/community-admin/dashboard");
        return;
      }
      if (user.permissions.includes("gate:view")) {
        router.replace("/gate/live");
        return;
      }
    }
  }, [user, isLoading, router]);

  // Show minimal loading state while routing
  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ textAlign: "center", color: "var(--muted, #64748b)" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔄</div>
        <p>Redirecting to your dashboard…</p>
      </div>
    </main>
  );
}
