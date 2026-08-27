"use client";

import { useRouter } from "next/navigation";
import { useMe, useLogout } from "@/hooks/use-auth";
import { can } from "@/lib/permissions";

export default function DashboardPage() {
  const router = useRouter();
  const { data: user } = useMe();
  const logout = useLogout();

  if (!user) return null; // ProtectedLayout handles the redirect

  return (
    <main className="container">
      <h1>Dashboard</h1>
      <div className="card">
        <p>
          Signed in as <strong>{user.full_name}</strong> ({user.email})
        </p>
        <p>
          Scope:{" "}
          {user.is_superadmin
            ? "all communities (Super Admin)"
            : user.community_ids.length
              ? `${user.community_ids.length} community(ies)`
              : "no community"}
        </p>
        <p>Permissions: {user.is_superadmin ? "all (*)" : user.permissions.join(", ") || "none"}</p>
        <p>
          Example gate:{" "}
          {can(user, "visitors:approve") ? "can approve visitors" : "cannot approve visitors"}
        </p>
        <button
          disabled={logout.isPending}
          onClick={async () => {
            await logout.mutateAsync();
            router.replace("/login");
          }}
        >
          {logout.isPending ? "Signing out…" : "Sign out"}
        </button>
      </div>
      <p style={{ color: "var(--muted)", marginTop: "1rem" }}>
        Role-specific KPI widgets are wired per{" "}
        <code>docs/frontend/modules/dashboards/README.md</code>.
      </p>
    </main>
  );
}
