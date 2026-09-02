"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/store/ui";

const navItems = [
  { label: "Dashboard", href: "/super-admin/dashboard", icon: "📊" },
  { label: "Communities", href: "/super-admin/communities", icon: "🏢" },
  { label: "Residents", href: "/super-admin/residents", icon: "👥" },
  { label: "Gate Traffic", href: "/super-admin/gate-traffic", icon: "🛡️" },
  { label: "Complaints", href: "/super-admin/complaints", icon: "🎫" },
  { label: "Billing & Finance", href: "/super-admin/billing", icon: "💳" },
  { label: "Reports & Analytics", href: "/super-admin/reports", icon: "📈" },
  { label: "Audit Logs", href: "/super-admin/audit-logs", icon: "📋" },
  { label: "System Settings", href: "/super-admin/settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUiStore();

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
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--sidebar-fg)", letterSpacing: "-0.01em" }}>
                GateSphere
              </div>
              <div style={{ fontSize: "0.65rem", color: "#60a5fa", fontWeight: 600, textTransform: "uppercase" }}>
                Super Admin
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

      {/* Navigation Links */}
      <nav style={{ padding: "1rem 0.5rem", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/super-admin/dashboard" && pathname.startsWith(item.href));
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
                  borderLeft: isActive ? "3px solid var(--primary)" : "3px solid transparent",
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
  );
}
