"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/store/ui";
import {
  AUDITOR_NAV,
  DOMESTIC_STAFF_NAV,
  OWNER_TENANT_NAV,
  SECURITY_GUARD_NAV,
  VENDOR_TECHNICIAN_NAV,
  NavItem,
} from "@/config/dashboard-navigation";

const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/super-admin/dashboard", icon: "📊" },
  { id: "communities", label: "Communities", href: "/super-admin/communities", icon: "🏢" },
  { id: "residents", label: "Residents", href: "/super-admin/residents", icon: "👥" },
  { id: "gate-traffic", label: "Gate Traffic", href: "/super-admin/gate-traffic", icon: "🛡️" },
  { id: "complaints", label: "Complaints", href: "/super-admin/complaints", icon: "🎫" },
  { id: "billing", label: "Billing & Finance", href: "/super-admin/billing", icon: "💳" },
  { id: "reports", label: "Reports & Analytics", href: "/super-admin/reports", icon: "📈" },
  { id: "audit-logs", label: "Audit Logs", href: "/super-admin/audit-logs", icon: "📋" },
  { id: "settings", label: "System Settings", href: "/super-admin/settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUiStore();

  // Determine current active dashboard
  let navConfig = {
    title: "GateSphere",
    roleLabel: "Owner / Tenant",
    accentColor: "#1D4ED8",
    items: OWNER_TENANT_NAV.navItems,
  };

  if (pathname.startsWith("/auditor") || pathname.startsWith("/dashboard/auditor")) {
    navConfig = {
      title: "GateSphere",
      roleLabel: "Auditor (Read-Only)",
      accentColor: "#64748B",
      items: AUDITOR_NAV.navItems,
    };
  } else if (
    pathname.startsWith("/domestic-staff") ||
    pathname.startsWith("/dashboard/domestic-staff")
  ) {
    navConfig = {
      title: "GateSphere",
      roleLabel: "Domestic Staff",
      accentColor: "#0D9488",
      items: DOMESTIC_STAFF_NAV.navItems,
    };
  } else if (
    pathname.startsWith("/owner-tenant") ||
    pathname.startsWith("/resident") ||
    pathname.startsWith("/dashboard/owner-tenant")
  ) {
    navConfig = {
      title: "GateSphere",
      roleLabel: "Owner / Tenant",
      accentColor: "#2563EB",
      items: OWNER_TENANT_NAV.navItems,
    };
  } else if (pathname.startsWith("/super-admin") || pathname.startsWith("/dashboard/super-admin")) {
    navConfig = {
      title: "GateSphere",
      roleLabel: "Super Admin",
      accentColor: "#3B82F6",
      items: SUPER_ADMIN_NAV_ITEMS,
    };
  } else if (
    pathname.startsWith("/community-admin") ||
    pathname.startsWith("/dashboard/community-admin")
  ) {
    navConfig = {
      title: "GateSphere",
      roleLabel: "Community Admin",
      accentColor: "#2563EB",
      items: [
        { id: "dashboard", label: "Dashboard", href: "/community-admin/dashboard", icon: "🏢" },
      ],
    };
  } else if (
    pathname.startsWith("/security-guard") ||
    pathname.startsWith("/dashboard/security-guard")
  ) {
    navConfig = {
      title: "GateSphere",
      roleLabel: "Security Guard",
      accentColor: "#DC2626",
      items: SECURITY_GUARD_NAV.navItems,
    };
  } else if (
    pathname.startsWith("/security-supervisor") ||
    pathname.startsWith("/dashboard/security-supervisor")
  ) {
    navConfig = {
      title: "GateSphere",
      roleLabel: "Security Supervisor",
      accentColor: "#EA580C",
      items: [
        { id: "dashboard", label: "Dashboard", href: "/security-supervisor/dashboard", icon: "📊" },
        { id: "gate-operations", label: "Gate Operations", href: "/security-supervisor/gate-operations", icon: "🛡️" },
        { id: "guard-management", label: "Guard Management", href: "/security-supervisor/guard-management", icon: "👮" },
        { id: "visitor-management", label: "Visitor Management", href: "/security-supervisor/visitor-management", icon: "👥" },
        { id: "delivery-management", label: "Delivery Management", href: "/security-supervisor/delivery-management", icon: "📦" },
        { id: "domestic-staff", label: "Domestic Staff", href: "/security-supervisor/domestic-staff", icon: "👔" },
        { id: "blacklist", label: "Blacklist", href: "/security-supervisor/blacklist", icon: "🚫" },
        { id: "incidents", label: "Incidents", href: "/security-supervisor/incidents", icon: "⚠️" },
        { id: "emergency-alerts", label: "Emergency Alerts", href: "/security-supervisor/emergency-alerts", icon: "🚨" },
        { id: "checkpoints", label: "Checkpoints", href: "/security-supervisor/checkpoints", icon: "📍" },
        { id: "reports", label: "Reports", href: "/security-supervisor/reports", icon: "📈" },
        { id: "audit-logs", label: "Audit Logs", href: "/security-supervisor/audit-logs", icon: "📋" },
      ],
    };
  } else if (pathname.startsWith("/dashboard/facility-manager")) {
    navConfig = {
      title: "GateSphere",
      roleLabel: "Facility Manager",
      accentColor: "#059669",
      items: [
        { id: "dashboard", label: "Dashboard", href: "/dashboard/facility-manager", icon: "🔧" },
      ],
    };
  } else if (pathname.startsWith("/dashboard/association-committee")) {
    navConfig = {
      title: "GateSphere",
      roleLabel: "Association Committee",
      accentColor: "#7C3AED",
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          href: "/dashboard/association-committee",
          icon: "🏛️",
        },
      ],
    };
  } else if (
    pathname.startsWith("/vendor-technician") ||
    pathname.startsWith("/dashboard/vendor-technician")
  ) {
    navConfig = {
      title: "GateSphere",
      roleLabel: "Vendor Technician",
      accentColor: "#D97706",
      items: VENDOR_TECHNICIAN_NAV.navItems,
    };
  }

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
        <div className="sidebar-backdrop" onClick={toggleSidebar} aria-label="Close menu" />
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
                  background: `linear-gradient(135deg, ${navConfig.accentColor}, #8b5cf6)`,
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
                  {navConfig.title}
                </div>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: navConfig.accentColor,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {navConfig.roleLabel}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "var(--radius-sm)",
                background: `linear-gradient(135deg, ${navConfig.accentColor}, #0D9488)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                color: "white",
                fontSize: "1rem",
                boxShadow: `0 2px 10px ${navConfig.accentColor}66`,
              }}
            >
              GS
            </div>
          )}

          <button
            type="button"
            onClick={toggleSidebar}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
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
        <nav style={{ padding: "0.75rem 0.5rem", flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {navConfig.items.map((item) => {
              const isExactActive = pathname === item.href;
              const isSubActive =
                item.href !== navConfig.items[0]?.href && pathname.startsWith(item.href);
              const isActive = isExactActive || isSubActive;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: sidebarOpen ? "0.6rem 0.85rem" : "0.6rem",
                    justifyContent: sidebarOpen ? "flex-start" : "center",
                    borderRadius: "var(--radius-sm)",
                    color: isActive ? "#FFFFFF" : "var(--sidebar-muted)",
                    background: isActive ? "var(--sidebar-surface)" : "transparent",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "13.5px",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                    borderLeft: isActive
                      ? `3px solid ${item.accentColor || navConfig.accentColor || "var(--brand-primary)"}`
                      : "3px solid transparent",
                  }}
                  title={item.label}
                >
                  <span style={{ fontSize: "1.15rem" }}>{item.icon}</span>
                  {sidebarOpen && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                      }}
                    >
                      <span>{item.label}</span>
                      {item.badge !== undefined && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "0.1rem 0.45rem",
                            borderRadius: "9999px",
                            background: item.accentColor
                              ? `${item.accentColor}30`
                              : `${navConfig.accentColor}30`,
                            color: item.accentColor || navConfig.accentColor,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
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
              title="Expand sidebar"
            >
              ▶
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
