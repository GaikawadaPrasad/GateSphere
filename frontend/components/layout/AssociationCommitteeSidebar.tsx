"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUiStore } from "@/store/ui";
import { useGovernanceOverview } from "@/hooks/use-governance";

const navItems = [
  { label: "Governance Overview", href: "/association-committee/governance", icon: "🏛️" },
  { label: "Financial Summary", href: "/association-committee/financial-summary", icon: "💰" },
  { label: "Special Assessments", href: "/association-committee/assessments", icon: "📋", badgeKey: "assessments" },
  { label: "Security Incidents", href: "/association-committee/incidents", icon: "🚨", badgeKey: "incidents" },
  { label: "Collection Audit", href: "/association-committee/collection-audit", icon: "🔍" },
  { label: "Reports & Traceability", href: "/association-committee/reports", icon: "📊" },
];

export function AssociationCommitteeSidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, activeCommunityId } = useUiStore();
  const { data: govOverview } = useGovernanceOverview(activeCommunityId);

  const pendingAssessments = govOverview?.pendingAssessmentsCount || 0;
  const openIncidents = govOverview?.openIncidentsCount || 0;

  const handleLinkClick = () => {
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
          width: sidebarOpen ? 260 : 72,
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
                  width: 34,
                  height: 34,
                  borderRadius: "var(--radius-sm)",
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  color: "white",
                  fontSize: "0.95rem",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              >
                GS
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--sidebar-fg)", letterSpacing: "-0.01em" }}>
                  GateSphere
                </div>
                <div style={{ fontSize: "0.65rem", color: "#a78bfa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Association Committee
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: 34,
                height: 34,
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

        {/* Governance Scope Notice */}
        {sidebarOpen && (
          <div
            style={{
              margin: "0.75rem 1rem 0.25rem",
              padding: "0.5rem 0.75rem",
              background: "rgba(139, 92, 246, 0.12)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.72rem",
              color: "#ddd6fe",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span>⚖️</span>
            <span>Governance & Oversight Scope</span>
          </div>
        )}

        {/* Navigation Links */}
        <nav style={{ padding: "0.75rem 0.5rem", flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/association-committee/governance" && pathname.startsWith(item.href));

              let badgeCount = 0;
              if (item.badgeKey === "assessments") badgeCount = pendingAssessments;
              if (item.badgeKey === "incidents") badgeCount = openIncidents;

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
                    background: isActive ? "var(--sidebar-active)" : "transparent",
                    color: isActive ? "#ffffff" : "var(--sidebar-muted)",
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "0.875rem",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                    borderLeft: isActive ? "3px solid #8b5cf6" : "3px solid transparent",
                  }}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                    <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{item.icon}</span>
                    {sidebarOpen && (
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.label}
                      </span>
                    )}
                  </div>

                  {sidebarOpen && badgeCount > 0 && (
                    <span
                      style={{
                        background: item.badgeKey === "incidents" ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.25)",
                        color: item.badgeKey === "incidents" ? "#fca5a5" : "#fde68a",
                        border: item.badgeKey === "incidents" ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(245, 158, 11, 0.5)",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        padding: "0.1rem 0.45rem",
                        borderRadius: "var(--radius-full)",
                        flexShrink: 0,
                      }}
                    >
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer info */}
        {sidebarOpen && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderTop: "1px solid var(--sidebar-border)",
              fontSize: "0.72rem",
              color: "var(--sidebar-muted)",
            }}
          >
            <div>GateSphere GSE-2026</div>
            <div style={{ color: "#64748b", marginTop: "0.15rem" }}>Sivion QA Verified · FR-01..FR-19</div>
          </div>
        )}
      </aside>
    </>
  );
}
