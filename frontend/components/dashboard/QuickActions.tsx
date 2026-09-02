"use client";

import Link from "next/link";

interface QuickActionsProps {
  onNewCommunity?: () => void;
}

export function QuickActions({ onNewCommunity }: QuickActionsProps) {
  return (
    <div className="card" style={{ marginBottom: "2rem" }}>
      <div className="card-header">
        <h3 className="card-title">Quick Actions</h3>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Super Admin Tools</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {onNewCommunity ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onNewCommunity}
            style={{ justifyContent: "flex-start", padding: "0.75rem 1rem" }}
          >
            <span>➕</span> Add Community
          </button>
        ) : (
          <Link
            href="/super-admin/communities"
            className="btn btn-primary"
            style={{ justifyContent: "flex-start", padding: "0.75rem 1rem" }}
          >
            <span>➕</span> Add Community
          </Link>
        )}

        <Link
          href="/super-admin/audit-logs"
          className="btn btn-secondary"
          style={{ justifyContent: "flex-start", padding: "0.75rem 1rem" }}
        >
          <span>📋</span> View Audit Logs
        </Link>

        <Link
          href="/super-admin/gate-traffic"
          className="btn btn-secondary"
          style={{ justifyContent: "flex-start", padding: "0.75rem 1rem" }}
        >
          <span>🛡️</span> Live Gate Monitor
        </Link>

        <Link
          href="/super-admin/settings"
          className="btn btn-secondary"
          style={{ justifyContent: "flex-start", padding: "0.75rem 1rem" }}
        >
          <span>⚙️</span> RBAC Permissions
        </Link>
      </div>
    </div>
  );
}
