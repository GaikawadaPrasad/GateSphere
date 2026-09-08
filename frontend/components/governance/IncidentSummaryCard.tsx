"use client";

import Link from "next/link";
import type { Incident } from "@/types/incidents";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/common/StatusBadge";

interface IncidentSummaryCardProps {
  incidents?: Incident[];
  isLoading?: boolean;
}

export function IncidentSummaryCard({ incidents, isLoading }: IncidentSummaryCardProps) {
  if (isLoading) {
    return (
      <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="skeleton" style={{ width: "45%", height: 20 }} />
        <div className="skeleton" style={{ width: "100%", height: 60 }} />
        <div className="skeleton" style={{ width: "100%", height: 60 }} />
      </div>
    );
  }

  const list = incidents || [];

  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="card-header">
        <div>
          <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>🚨</span> Security Incident Oversight
          </h2>
          <p style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            Review log of physical security & emergency reports
          </p>
        </div>
        <Link
          href="/association-committee/incidents"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", height: 30 }}
        >
          All Incidents →
        </Link>
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--muted)", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🛡️</div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>No Incidents Reported</div>
          <p style={{ fontSize: "0.775rem", marginTop: "0.25rem" }}>
            No security incidents or panic alerts have been logged recently.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", flex: 1 }}>
          {list.slice(0, 4).map((inc) => (
            <Link
              key={inc.id}
              href={`/association-committee/incidents/${inc.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 0.85rem",
                background: "#ffffff",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                textDecoration: "none",
                gap: "0.5rem",
              }}
              className="hover-panel"
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}>
                    #{inc.incident_number || inc.id.slice(0, 8)}
                  </span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.1rem 0.4rem",
                      borderRadius: 4,
                      fontWeight: 600,
                      background: inc.severity === "critical" || inc.severity === "high" ? "#fee2e2" : "#f1f5f9",
                      color: inc.severity === "critical" || inc.severity === "high" ? "#b91c1c" : "#475569",
                    }}
                  >
                    {inc.severity.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {inc.incident_type.toUpperCase()} · {inc.location_text || "Premises"} · {formatDate(inc.reported_at)}
                </div>
              </div>

              <StatusBadge status={inc.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
