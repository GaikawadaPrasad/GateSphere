"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMe, useLogout } from "@/hooks/use-auth";
import { useCommunities, useCommunityDetails } from "@/hooks/use-communities";
import { useUiStore } from "@/store/ui";
import {
  useMyNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/use-notifications";
import { formatRelativeTime } from "@/lib/utils";
import type { Community } from "@/types/communities";
import type { AppNotification } from "@/types/notifications";

function getCategoryIcon(category?: string) {
  switch (category) {
    case "emergency":
      return "🚨";
    case "billing":
      return "💳";
    case "visitor":
      return "👥";
    case "delivery":
      return "📦";
    case "complaint":
      return "🛠️";
    case "amenity":
      return "🏊";
    case "announcement":
      return "📢";
    case "system":
    case "audit":
      return "📋";
    default:
      return "🔔";
  }
}

export function Header() {
  const queryClient = useQueryClient();
  const { data: user } = useMe();
  const logout = useLogout();
  const { activeCommunityId, setActiveCommunity, toggleSidebar } = useUiStore();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<"all" | "unread">("all");
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const { data: allNotifications = [] } = useMyNotifications();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const isSuperAdmin = Boolean(user?.is_superadmin || user?.active_role === "super_admin");
  const { data: communities } = useCommunities(undefined, { enabled: isSuperAdmin });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(event.target as Node)
      ) {
        setIsNotifOpen(false);
      }
    }
    if (isNotifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isNotifOpen]);

  const assignedCommunityId =
    user?.community_ids?.[0] ||
    user?.roles?.find((r) => r.community_id)?.community_id ||
    null;
  const effectiveCommunityId = activeCommunityId || assignedCommunityId;

  useEffect(() => {
    if (!isSuperAdmin && assignedCommunityId && activeCommunityId !== assignedCommunityId) {
      setActiveCommunity(assignedCommunityId);
    }
  }, [isSuperAdmin, assignedCommunityId, activeCommunityId, setActiveCommunity]);

  const { data: currentCommunity } = useCommunityDetails(effectiveCommunityId || undefined);

  // useLogout hard-navigates to /login on success *and* failure — don't navigate here.
  const handleSignOut = () => logout.mutate();

  const roleName = user?.active_role
    ? user.active_role.replace(/_/g, " ").toUpperCase()
    : user?.is_superadmin
      ? "SUPER ADMIN"
      : "USER";

  // "Unread" tab filters the already-fetched recent list (same read test as the row below)
  // rather than polling a second list endpoint; the badge uses the server-side total.
  const displayedNotifications = (
    notifFilter === "unread"
      ? (allNotifications as AppNotification[]).filter((n) => !n.is_read && !n.read)
      : allNotifications
  ) as AppNotification[];

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

        {/* Global Scope Selector - only shown for super_admin */}
        {isSuperAdmin && (
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
              onChange={(e) => {
                // AGENTS.md §5.3: a community switch is an identity change — drop
                // every cached query so Tenant B never renders Tenant A's data.
                queryClient.clear();
                setActiveCommunity(e.target.value || null);
              }}
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
        )}

        {/* Scoped Community Badge for non-superadmin users */}
        {!isSuperAdmin && currentCommunity && (
          <div
            className="mobile-hide"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "#ECFDF5",
              border: "1px solid #A7F3D0",
              color: "#065F46",
              padding: "0.25rem 0.6rem",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              maxWidth: 220,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span>🏢</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {currentCommunity.name}
            </span>
            <span
              title="Community Scope Enforced"
              style={{
                fontSize: "11px",
                color: "#10B981",
                marginLeft: "0.15rem",
                flexShrink: 0,
              }}
            >
              🔒
            </span>
          </div>
        )}
      </div>

      {/* Right section: User info & Actions */}
      <div
        className="mobile-header-right"
        style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, flexShrink: 0 }}
      >
        {/* Notification Bell with Dropdown Popover */}
        <div style={{ position: "relative" }} ref={notifDropdownRef}>
          <button
            type="button"
            onClick={() => setIsNotifOpen((prev) => !prev)}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "8px",
              background: isNotifOpen ? "#EFF6FF" : "#F8FAFC",
              border: isNotifOpen ? "1px solid #BFDBFE" : "1px solid var(--border)",
              fontSize: "1.1rem",
              color: "var(--fg)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Notification Center"
            aria-label="Open notifications"
          >
            🔔
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  background: "#EF4444",
                  color: "white",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 2px",
                  border: "2px solid #FFFFFF",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Popover Dropdown */}
          {isNotifOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 380,
                maxWidth: "92vw",
                background: "#FFFFFF",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                boxShadow:
                  "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                animation: "fadeIn 0.15s ease-out",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#F8FAFC",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--fg)" }}>
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        background: "#EFF6FF",
                        color: "#1E40AF",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "9999px",
                        border: "1px solid #BFDBFE",
                      }}
                    >
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#2563EB",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "0.2rem 0.4rem",
                      borderRadius: "4px",
                    }}
                  >
                    {markAllRead.isPending ? "Marking..." : "Mark all read"}
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div
                style={{
                  display: "flex",
                  padding: "0.5rem 0.75rem",
                  gap: "0.5rem",
                  borderBottom: "1px solid var(--border)",
                  background: "#FFFFFF",
                }}
              >
                <button
                  type="button"
                  onClick={() => setNotifFilter("all")}
                  style={{
                    padding: "0.25rem 0.65rem",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "none",
                    background: notifFilter === "all" ? "#EFF6FF" : "transparent",
                    color: notifFilter === "all" ? "#1E40AF" : "var(--muted)",
                    cursor: "pointer",
                  }}
                >
                  All ({allNotifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNotifFilter("unread")}
                  style={{
                    padding: "0.25rem 0.65rem",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    border: "none",
                    background: notifFilter === "unread" ? "#EFF6FF" : "transparent",
                    color: notifFilter === "unread" ? "#1E40AF" : "var(--muted)",
                    cursor: "pointer",
                  }}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* Notification List */}
              <div
                style={{
                  maxHeight: "360px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {displayedNotifications.length === 0 ? (
                  <div
                    style={{
                      padding: "2.5rem 1rem",
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span
                      style={{ fontSize: "1.75rem", display: "block", marginBottom: "0.5rem" }}
                    >
                      🎉
                    </span>
                    <strong
                      style={{
                        display: "block",
                        color: "var(--fg)",
                        marginBottom: "0.25rem",
                      }}
                    >
                      No notifications
                    </strong>
                    You&apos;re completely caught up!
                  </div>
                ) : (
                  displayedNotifications.map((n) => {
                    const isUnread = !n.is_read && !n.read;
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (isUnread) markRead.mutate(n.id);
                        }}
                        style={{
                          padding: "0.75rem 1rem",
                          borderBottom: "1px solid #F1F5F9",
                          display: "flex",
                          gap: "0.75rem",
                          alignItems: "flex-start",
                          background: isUnread ? "#F0FDF4" : "#FFFFFF",
                          cursor: "pointer",
                          transition: "background 0.1s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isUnread ? "#E2FBE8" : "#F8FAFC";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isUnread ? "#F0FDF4" : "#FFFFFF";
                        }}
                      >
                        <span style={{ fontSize: "1.25rem", flexShrink: 0, marginTop: "0.1rem" }}>
                          {getCategoryIcon(n.category || n.type)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: "0.5rem",
                              marginBottom: "0.2rem",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: isUnread ? 700 : 600,
                                fontSize: "0.85rem",
                                color: "var(--fg)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {n.title || "Notification"}
                            </span>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--muted)",
                                flexShrink: 0,
                                fontFamily: "monospace",
                              }}
                            >
                              {formatRelativeTime(n.created_at || n.timestamp)}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: "0.8rem",
                              color: isUnread ? "var(--fg)" : "var(--muted)",
                              margin: 0,
                              lineHeight: 1.35,
                              wordBreak: "break-word",
                            }}
                          >
                            {n.body || n.message || ""}
                          </p>
                        </div>
                        {isUnread && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#2563EB",
                              flexShrink: 0,
                              marginTop: "0.35rem",
                            }}
                            title="Unread"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

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
