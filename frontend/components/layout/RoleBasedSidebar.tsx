"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/store/ui";
import { useMe } from "@/hooks/use-auth";
import { ROLE_CONFIGS, type NavItem } from "@/config/roles";

export function RoleBasedSidebar() {
  const pathname = usePathname();
  const { data: user } = useMe();
  const { sidebarOpen, toggleSidebar } = useUiStore();

  // Determine active role configuration from pathname or user roles
  let activeRoleKey = "super_admin";

  if (pathname.startsWith("/facility-manager")) {
    activeRoleKey = "facility_manager";
  } else if (pathname.startsWith("/security-supervisor")) {
    activeRoleKey = "security_supervisor";
  } else if (pathname.startsWith("/security-guard")) {
    activeRoleKey = "security_guard";
  } else if (pathname.startsWith("/vendor-technician") || pathname.startsWith("/vendor")) {
    activeRoleKey = "vendor_technician";
  } else if (user?.roles && user.roles.length > 0) {
    const primaryRole = user.roles[0].role_slug;
    if (ROLE_CONFIGS[primaryRole]) {
      activeRoleKey = primaryRole;
    }
  }

  const roleConfig = ROLE_CONFIGS[activeRoleKey] || ROLE_CONFIGS.super_admin;
  const navItems: NavItem[] = roleConfig.navItems;

  return (
    <aside
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
      {/* Brand Header matching Super Admin Sidebar */}
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
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
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
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: "var(--sidebar-fg)",
                  letterSpacing: "-0.01em",
                }}
              >
                GateSphere
              </div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: roleConfig.badgeColor || "#60a5fa",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                {roleConfig.title}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
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

      {/* Navigation Links matching Super Admin Sidebar */}
      <nav style={{ padding: "1rem 0.5rem", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== roleConfig.defaultRoute && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: sidebarOpen ? "0.65rem 0.85rem" : "0.65rem",
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  borderRadius: "var(--radius-sm)",
                  color: isActive ? "#ffffff" : "var(--sidebar-muted)",
                  background: isActive ? "var(--sidebar-active)" : "transparent",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "0.85rem",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                  borderLeft: isActive ? `3px solid ${roleConfig.badgeColor || "var(--primary)"}` : "3px solid transparent",
                }}
                title={item.label}
              >
                <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Toggle button when collapsed */}
      {!sidebarOpen && (
        <div
          style={{
            padding: "0.75rem",
            display: "flex",
            justifyContent: "center",
            borderTop: "1px solid var(--sidebar-border)",
          }}
        >
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
  );
}
