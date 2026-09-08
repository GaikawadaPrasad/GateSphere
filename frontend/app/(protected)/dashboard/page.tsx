"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, useLogout } from "@/hooks/use-auth";
import { getRoleLandingRoute } from "@/lib/permissions";

/**
 * Smart role-router. Redirects the user to their correct portal based on role.
 * This acts as a fallback landing page that immediately routes to the right place.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { data: user, isLoading } = useMe();
  const logout = useLogout();

  useEffect(() => {
    if (user) {
      const landing = getRoleLandingRoute(user);
      if (landing && landing !== "/dashboard") {
        router.replace(landing);
      }
    }
  }, [user, router]);

  if (isLoading) {
    return (
      <main className="container" aria-busy="true" aria-live="polite">
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <h2>Loading dashboard…</h2>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="container">
      <h1>Dashboard</h1>
      <div className="card">
        <p>
          Signed in as <strong>{user.full_name}</strong> ({user.email})
        </p>
        <p>
          Role: <strong>{user.active_role || (user.is_superadmin ? "Super Admin" : "User")}</strong>
        </p>
        <p>
          Scope:{" "}
          {user.is_superadmin
            ? "all communities (Super Admin)"
            : user.community_ids?.length
              ? `${user.community_ids.length} community(ies)`
              : "no community"}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => router.replace(getRoleLandingRoute(user))}
          >
            Go to Role Portal
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={logout.isPending}
            onClick={async () => {
              try {
                await logout.mutateAsync();
              } catch {
                // Ignore sign out network error and proceed to login
              }
              router.replace("/login");
            }}
          >
            {logout.isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </main>
  );
}
