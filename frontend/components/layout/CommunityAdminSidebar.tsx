"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/store/ui";
import { useMyNotifications } from "@/hooks/use-notifications";

const navItems = [
  { label: "Dashboard", href: "/community-admin/dashboard", icon: "📊" },
  { label: "Property", href: "/community-admin/property", icon: "🏢" },
  { label: "Residents", href: "/community-admin/residents", icon: "👥" },
  { label: "Staff", href: "/community-admin/staff", icon: "🛠️" },
  { label: "Communication", href: "/community-admin/communication", icon: "📢" },
  { label: "Billing & Finance", href: "/community-admin/billing", icon: "💳" },
  { label: "Incidents", href: "/community-admin/incidents", icon: "🚨" },
  { label: "Notifications", href: "/community-admin/notifications", icon: "🔔", badgeKey: "notifications" },
];

export function CommunityAdminSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const { data: notifications } = useMyNotifications({ unread_only: true });
  const unreadCount = notifications?.length || 0;

  const handleLinkClick = () => {
    // On small screens, close sidebar after clicking a nav link
    if (typeof window !== "undefined" && window.innerWidth < 768 && sidebarOpen) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={toggleSidebar}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`app-sidebar ${sidebarOpen ? "open-mobile" : "collapsed-mobile"}`}
        style={{
          width: sidebarOpen ? 250 : 72,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s ease",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          zIndex: 40,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarOpen ? "space-between" : "center",
            padding: sidebarOpen ? "0 1.25rem" : "0",
            borderBottom: "1px solid var(--sidebar-border)",
          }}
        >
          {sidebarOpen ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-sm)",
                  background: "linear-gradient(135deg, #2563eb, #10b981)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  color: "white",
                  fontSize: "0.95rem",
                }}
              >
                GS
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--sidebar-fg)", letterSpacing: "-0.01em" }}>
                  GateSphere
                </div>
                <div style={{ fontSize: "0.65rem", color: "#10b981", fontWeight: 600, textTransform: "uppercase" }}>
                  Community Admin
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "linear-gradient(135deg, #2563eb, #10b981)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: "white",
                fontSize: "0.95rem",
              }}
            >
              GS
            </div>
          )}

          <button
            type="button"
            onClick={toggleSidebar}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--sidebar-muted)",
              cursor: "pointer",
              padding: "0.35rem",
              borderRadius: "var(--radius-sm)",
              display: sidebarOpen ? "block" : "none",
            }}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            ◀
          </button>
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: "1rem 0.5rem", flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/community-admin/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: sidebarOpen ? "0.65rem 0.85rem" : "0.65rem",
                    justifyContent: sidebarOpen ? "space-between" : "center",
                    borderRadius: "var(--radius-sm)",
                    color: isActive ? "#ffffff" : "var(--sidebar-muted)",
                    background: isActive ? "var(--sidebar-active)" : "transparent",
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "0.85rem",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                    borderLeft: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                    position: "relative",
                  }}
                  title={item.label}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                    {sidebarOpen && <span>{item.label}</span>}
                  </div>

                  {item.badgeKey === "notifications" && unreadCount > 0 && (
                    <span
                      style={{
                        background: "#ef4444",
                        color: "white",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.4rem",
                        borderRadius: "var(--radius-full)",
                        minWidth: 18,
                        textAlign: "center",
                        display: sidebarOpen ? "inline-block" : "none",
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Toggle button when collapsed */}
        {!sidebarOpen && (
          <div style={{ padding: "0.75rem", display: "flex", justifyContent: "center", borderTop: "1px solid var(--sidebar-border)" }}>
            <button
              type="button"
              onClick={toggleSidebar}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--sidebar-muted)",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              ▶
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
