"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useMe, useLogout } from "@/hooks/use-auth";
import { useCommunities } from "@/hooks/use-communities";
import { useUiStore } from "@/store/ui";
import type { Community } from "@/types/communities";

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

  const roleName = user?.active_role
    ? user.active_role.replace(/_/g, " ").toUpperCase()
    : user?.is_superadmin
      ? "SUPER ADMIN"
      : "USER";

  return (
    <header className="header">
      {/* Left section: Hamburger & Role Badge & Scope */}
      <div
        className="mobile-header-left"
        style={{ display: "flex", alignItems: "center", gap: "1rem" }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
          style={{
            width: 36,
            height: 36,
            padding: 0,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Role Badge with Live Pulse - hidden on mobile */}
        <div
          className="mobile-hide"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
            padding: "0.25rem 0.75rem",
            borderRadius: "9999px",
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            fontSize: "11.5px",
            fontWeight: 800,
            color: "#1E40AF",
            letterSpacing: "0.04em",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#2563EB",
              boxShadow: "0 0 8px rgba(37, 99, 235, 0.8)",
            }}
          />
          {roleName}
        </div>

        {/* Global Scope Selector - hidden on mobile */}
        <div
          className="mobile-hide"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "#F8FAFC",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "0.2rem 0.6rem",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Scope:</span>
          <select
            value={activeCommunityId || ""}
            onChange={(e) => setActiveCommunity(e.target.value || null)}
            style={{
              height: 28,
              border: "none",
              background: "transparent",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "var(--fg)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">🌐 All Communities (Global)</option>
            {communities?.map((comm: Community) => (
              <option key={comm.id} value={comm.id}>
                {comm.name} ({comm.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right section: User info & Actions */}
      <div
        className="mobile-header-right"
        style={{ display: "flex", alignItems: "center", gap: "1rem" }}
      >
        {/* User Profile Pill - text hidden on mobile, avatar stays */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            padding: "0.25rem 0.75rem 0.25rem 0.35rem",
            background: "#F8FAFC",
            border: "1px solid var(--border)",
            borderRadius: "9999px",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1D4ED8, #0D9488)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "12px",
              boxShadow: "0 2px 6px rgba(29, 78, 216, 0.25)",
              flexShrink: 0,
            }}
          >
            {user?.full_name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div
            className="mobile-hide-text"
            style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}
          >
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--fg)" }}>
              {user?.full_name || "User"}
            </span>
            <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>{user?.email || ""}</span>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleSignOut}
          disabled={logout.isPending}
          style={{
            height: 34,
            fontSize: "12.5px",
            fontWeight: 600,
            padding: "0 0.85rem",
            borderRadius: "8px",
          }}
        >
          {logout.isPending ? "…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
