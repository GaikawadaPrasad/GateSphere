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
        padding: "0 1.5rem",
        position: "sticky",
        top: 0,
        zIndex: 30,
        gap: "0.75rem",
      }}
    >
      {/* Left section: Breadcrumb/Scope */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, flex: 1 }}>
        <button
          type="button"
          onClick={toggleSidebar}
          className="btn btn-secondary"
          style={{ padding: "0.4rem 0.6rem", height: 34, flexShrink: 0 }}
          title="Toggle Navigation"
        >
          ☰
        </button>

        {/* Global Scope Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
          <span className="header-scope-label" style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500, whiteSpace: "nowrap" }}>
            Scope:
          </span>
          <select
            className="select-field"
            value={activeCommunityId || ""}
            onChange={(e) => setActiveCommunity(e.target.value || null)}
            style={{
              height: 34,
              padding: "0.25rem 0.5rem",
              fontSize: "0.825rem",
              width: "auto",
              maxWidth: 220,
              minWidth: 120,
            }}
          >
            <option value="">🌐 All (Global)</option>
            {communities?.map((comm) => (
              <option key={comm.id} value={comm.id}>
                {comm.name} ({comm.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right section: User info & Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
        {/* User Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1D4ED8, #0D9488)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: "0.85rem",
              flexShrink: 0,
            }}
          >
            {user?.full_name?.charAt(0).toUpperCase() || "S"}
          </div>
          <div className="header-user-email" style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--fg)", lineHeight: 1.2 }}>
              {user?.full_name || "Super Admin"}
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
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
          style={{ height: 34, fontSize: "0.75rem", padding: "0.35rem 0.6rem" }}
        >
          {logout.isPending ? "…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
