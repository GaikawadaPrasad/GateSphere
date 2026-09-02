"use client";

import { useRouter } from "next/navigation";
import { useMe, useLogout } from "@/hooks/use-auth";
import { useCommunities } from "@/hooks/use-communities";
import { useUiStore } from "@/store/ui";

export function Header() {
  const router = useRouter();
  const { data: user } = useMe();
  const logout = useLogout();
  const { data: communities } = useCommunities();
  const { activeCommunityId, setActiveCommunity, toggleSidebar } = useUiStore();

  const handleSignOut = async () => {
    try {
      await logout.mutateAsync();
      router.replace("/login");
    } catch {
      router.replace("/login");
    }
  };

  return (
    <header
      style={{
        height: 64,
        background: "#ffffff",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2rem",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left section: Breadcrumb/Scope */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <button
          type="button"
          onClick={toggleSidebar}
          className="btn btn-secondary"
          style={{ padding: "0.4rem 0.6rem", height: 34 }}
          title="Toggle Navigation"
        >
          ☰
        </button>

        {/* Global Scope Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500 }}>Scope:</span>
          <select
            className="select-field"
            value={activeCommunityId || ""}
            onChange={(e) => setActiveCommunity(e.target.value || null)}
            style={{ height: 34, padding: "0.25rem 0.6rem", fontSize: "0.85rem", width: "auto", minWidth: 200 }}
          >
            <option value="">🌐 All Communities (Global)</option>
            {communities?.map((comm) => (
              <option key={comm.id} value={comm.id}>
                {comm.name} ({comm.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right section: User info & Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        {/* User Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            {user?.full_name?.charAt(0).toUpperCase() || "S"}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
              {user?.full_name || "Super Admin"}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {user?.email || "super_admin@gatesphere.com"}
            </span>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleSignOut}
          disabled={logout.isPending}
          style={{ height: 34, fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
        >
          {logout.isPending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
