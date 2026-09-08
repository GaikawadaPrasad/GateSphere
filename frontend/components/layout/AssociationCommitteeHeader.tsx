"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe, useLogout } from "@/hooks/use-auth";
import { useCommunityDetails } from "@/hooks/use-communities";
import { useUiStore } from "@/store/ui";
import {
  useMyNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/use-notifications";
import { formatDate } from "@/lib/utils";
import type { AppNotification } from "@/types/notifications";

export function AssociationCommitteeHeader() {
  const router = useRouter();
  const { data: user } = useMe();
  const logout = useLogout();
  const { activeCommunityId, toggleSidebar } = useUiStore();
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);

  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load read notification IDs from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storageKey = `gatesphere_read_notifs_${user?.id || "ac"}`;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          setReadIds(new Set(JSON.parse(stored)));
        }
      } catch {
        // Ignored
      }
    }
  }, [user?.id]);

  const { data: notificationsData, isLoading: notifLoading } = useMyNotifications({
    unread_only: false,
    page_size: 20,
  });

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const rawNotifications: AppNotification[] = Array.isArray(notificationsData) ? notificationsData : [];

  // Fallback demo notifications for committee governance if inbox is empty
  const sampleNotifications: AppNotification[] = [
    {
      id: "gov-notif-1",
      user_id: user?.id || "u-1",
      title: "Special Assessment Proposal Submitted",
      body: "Clubhouse Solar Panel Infrastructure proposal submitted for committee review and CapEx authorization.",
      category: "billing",
      action_url: "/association-committee/assessments",
      is_read: false,
      created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    },
    {
      id: "gov-notif-2",
      user_id: user?.id || "u-1",
      title: "Security Incident Escalation",
      body: "Security Incident #INC-2026-004 (High severity) reported at Main Gate - checkpoint override log.",
      category: "emergency",
      action_url: "/association-committee/incidents",
      is_read: false,
      created_at: new Date(Date.now() - 120 * 60000).toISOString(),
    },
    {
      id: "gov-notif-3",
      user_id: user?.id || "u-1",
      title: "Monthly Collection Reconciled",
      body: "August billing cycle collections reconciled with 92% efficiency. Audit log updated.",
      category: "billing",
      action_url: "/association-committee/collection-audit",
      is_read: true,
      created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    },
  ];

  const sourceNotifications = rawNotifications.length > 0 ? rawNotifications : sampleNotifications;

  // Apply read state (server read OR local read)
  const notifications: AppNotification[] = sourceNotifications.map((n) => ({
    ...n,
    is_read: Boolean(n.is_read || readIds.has(n.id)),
  }));

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications =
    filterTab === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  const markNotificationAsSeen = (id: string) => {
    setReadIds((prev) => {
      const updated = new Set(prev);
      updated.add(id);
      if (typeof window !== "undefined") {
        const storageKey = `gatesphere_read_notifs_${user?.id || "ac"}`;
        localStorage.setItem(storageKey, JSON.stringify(Array.from(updated)));
      }
      return updated;
    });

    if (id && !id.startsWith("gov-notif-")) {
      markRead.mutate(id);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    markNotificationAsSeen(notif.id);
    setIsOpen(false);
    if (notif.action_url) {
      router.push(notif.action_url);
    } else if (notif.category === "billing") {
      router.push("/association-committee/financial-summary");
    } else if (notif.category === "emergency") {
      router.push("/association-committee/incidents");
    } else {
      router.push("/association-committee/governance");
    }
  };

  const handleMarkAllRead = async () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds((prev) => {
      const updated = new Set([...Array.from(prev), ...allIds]);
      if (typeof window !== "undefined") {
        const storageKey = `gatesphere_read_notifs_${user?.id || "ac"}`;
        localStorage.setItem(storageKey, JSON.stringify(Array.from(updated)));
      }
      return updated;
    });

    try {
      await markAllRead.mutateAsync();
    } catch {
      // Ignored
    }
  };

  const handleSignOut = async () => {
    try {
      await logout.mutateAsync();
      router.replace("/login");
    } catch {
      router.replace("/login");
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "billing":
        return "💰";
      case "emergency":
        return "🚨";
      case "announcement":
        return "📢";
      case "complaint":
        return "🛠️";
      default:
        return "🔔";
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
              gap: "0.4rem",
              background: "#f5f3ff",
              border: "1px solid #ddd6fe",
              color: "#6d28d9",
              padding: "0.25rem 0.65rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
              fontWeight: 600,
              maxWidth: 240,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span>🏛️</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {community?.name || "Green Park Enclave"}
            </span>
            <span
              title="Single Community Governance Isolation"
              style={{ fontSize: "0.75rem", color: "#8b5cf6", marginLeft: "0.15rem", flexShrink: 0 }}
            >
              🔒
            </span>
          </div>
        </div>
      </div>

      {/* Right section: Notification bell, User info & Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
        {/* Notification Bell with Dropdown Popover */}
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "var(--radius-sm)",
              background: isOpen ? "#f1f5f9" : "#f8fafc",
              border: "1px solid var(--border)",
              fontSize: "1.1rem",
              color: "var(--fg)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Governance Notifications"
            aria-label="Open notifications"
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
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 2px",
                  border: "2px solid #ffffff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Popover Menu */}
          {isOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 380,
                maxWidth: "90vw",
                background: "#ffffff",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                animation: "fadeIn 0.15s ease-out",
              }}
            >
              {/* Popover Header */}
              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--fg)" }}>
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        background: "#ede9fe",
                        color: "#6d28d9",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.1rem 0.45rem",
                        borderRadius: "var(--radius-full)",
                      }}
                    >
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markAllRead.isPending}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "0.2rem 0.4rem",
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--border)",
                  background: "#ffffff",
                }}
              >
                <button
                  type="button"
                  onClick={() => setFilterTab("all")}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    fontSize: "0.775rem",
                    fontWeight: filterTab === "all" ? 600 : 500,
                    color: filterTab === "all" ? "var(--primary)" : "var(--muted)",
                    background: "none",
                    borderTop: "none",
                    borderLeft: "none",
                    borderRight: "none",
                    borderBottomWidth: 2,
                    borderBottomStyle: "solid",
                    borderBottomColor: filterTab === "all" ? "var(--primary)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("unread")}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    fontSize: "0.775rem",
                    fontWeight: filterTab === "unread" ? 600 : 500,
                    color: filterTab === "unread" ? "var(--primary)" : "var(--muted)",
                    background: "none",
                    borderTop: "none",
                    borderLeft: "none",
                    borderRight: "none",
                    borderBottomWidth: 2,
                    borderBottomStyle: "solid",
                    borderBottomColor: filterTab === "unread" ? "var(--primary)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* Notification List Body */}
              <div
                style={{
                  maxHeight: 340,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {notifLoading ? (
                  <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div className="skeleton" style={{ width: "100%", height: 40 }} />
                    <div className="skeleton" style={{ width: "100%", height: 40 }} />
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--muted)" }}>
                    <div style={{ fontSize: "1.75rem", marginBottom: "0.25rem" }}>✨</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>All caught up!</div>
                    <p style={{ fontSize: "0.75rem", marginTop: "0.15rem" }}>
                      No {filterTab === "unread" ? "unread" : ""} governance notifications found.
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      style={{
                        padding: "0.85rem 1rem",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.75rem",
                        background: n.is_read ? "#ffffff" : "#f5f3ff",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      className="hover-panel"
                    >
                      <span style={{ fontSize: "1.25rem", flexShrink: 0, marginTop: "0.1rem" }}>
                        {getCategoryIcon(n.category)}
                      </span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.825rem",
                              fontWeight: n.is_read ? 600 : 700,
                              color: n.is_read ? "var(--fg)" : "#5b21b6",
                            }}
                          >
                            {n.title}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                            {!n.is_read && (
                              <button
                                type="button"
                                title="Mark as seen"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markNotificationAsSeen(n.id);
                                }}
                                style={{
                                  background: "#ede9fe",
                                  border: "none",
                                  color: "#6d28d9",
                                  borderRadius: "50%",
                                  width: 20,
                                  height: 20,
                                  fontSize: "0.7rem",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                }}
                              >
                                ✓
                              </button>
                            )}
                            {!n.is_read && (
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: "#7c3aed",
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </div>
                        </div>

                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--fg-secondary)",
                            marginTop: "0.2rem",
                            lineHeight: 1.35,
                          }}
                        >
                          {n.body}
                        </p>

                        <div
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--muted)",
                            marginTop: "0.35rem",
                          }}
                        >
                          {formatDate(n.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Popover Footer */}
              <div
                style={{
                  padding: "0.65rem 1rem",
                  borderTop: "1px solid var(--border)",
                  background: "#f8fafc",
                  textAlign: "center",
                }}
              >
                <Link
                  href="/association-committee/reports"
                  onClick={() => setIsOpen(false)}
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--primary)",
                    textDecoration: "none",
                  }}
                >
                  View Governance Audit Reports →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: "0.85rem",
              flexShrink: 0,
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            {user?.full_name ? user.full_name.slice(0, 2).toUpperCase() : "AC"}
          </div>

          <div className="hide-mobile" style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--fg)", lineHeight: 1.2 }}>
              {user?.full_name || "Committee Member"}
            </span>
            <span style={{ fontSize: "0.7rem", color: "#7c3aed", fontWeight: 600 }}>
              Association Committee
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={logout.isPending}
          className="btn btn-secondary"
          style={{ padding: "0.4rem 0.75rem", height: 34, fontSize: "0.8rem" }}
          title="Sign out of committee session"
        >
          {logout.isPending ? "..." : "Logout"}
        </button>
      </div>
    </header>
  );
}

