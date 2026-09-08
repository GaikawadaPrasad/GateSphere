"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe, useLogout } from "@/hooks/use-auth";
import { useCommunityDetails } from "@/hooks/use-communities";
import { useUiStore } from "@/store/ui";
import { useMyNotifications } from "@/hooks/use-notifications";

export function CommunityAdminHeader() {
  const router = useRouter();
  const { data: user } = useMe();
  const logout = useLogout();
  const { activeCommunityId, toggleSidebar } = useUiStore();
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);
  const { data: notifications } = useMyNotifications({ unread_only: true });
  const unreadCount = notifications?.length || 0;

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
      {/* Left section: Sidebar toggle & Community Scope badge */}
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

        {/* Community Scope Badge (Single Community Isolation) */}
        <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              padding: "0.25rem 0.6rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
              fontWeight: 600,
              maxWidth: 200,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span>🏢</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{community?.name || "Community Portal"}</span>
            <span
              title="Single Community Scope Enforced"
              style={{ fontSize: "0.75rem", color: "#10b981", marginLeft: "0.15rem", flexShrink: 0 }}
            >
              🔒
            </span>
          </div>
        </div>
      </div>

      {/* Right section: Notification bell, User info & Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
        {/* Notification Bell Icon */}
        <Link
          href="/community-admin/notifications"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 34,
            height: 34,
            borderRadius: "var(--radius-sm)",
            background: "#f8fafc",
            border: "1px solid var(--border)",
            fontSize: "1rem",
            color: "var(--fg)",
            textDecoration: "none",
            flexShrink: 0,
          }}
          title="Notification Center"
        >
          🔔
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                background: "#ef4444",
                color: "white",
                fontSize: "0.6rem",
                fontWeight: 700,
                width: 16,
                height: 16,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #ffffff",
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        {/* User Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: "0.85rem",
              flexShrink: 0,
            }}
          >
            {user?.full_name?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="header-user-email" style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--fg)", lineHeight: 1.2 }}>
              {user?.full_name || "Community Admin"}
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
              {user?.email || "admin@community.com"}
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
