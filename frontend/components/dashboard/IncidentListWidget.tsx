"use client";

import Link from "next/link";
import type { Incident } from "@/types/incidents";
import { formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/common/LoadingSkeleton";

interface IncidentListWidgetProps {
  incidents?: Incident[];
  isLoading?: boolean;
}

export function IncidentListWidget({ incidents, isLoading }: IncidentListWidgetProps) {
  if (isLoading) {
    return (
      <div className="card" style={{ height: "100%", minHeight: 280, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <Skeleton width={190} height={20} borderRadius={4} />
            <Skeleton width={90} height={20} borderRadius={4} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <Skeleton width="100%" height={54} borderRadius={6} />
            <Skeleton width="100%" height={54} borderRadius={6} />
            <Skeleton width="100%" height={54} borderRadius={6} />
          </div>
        </div>
      </div>
    );
  }

  const openIncidents =
    incidents?.filter(
      (i) => i.status !== "resolved" && i.status !== "closed" && i.status !== "false_alarm",
    ) || [];

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <span className="badge badge-danger">Critical</span>;
      case "high":
        return <span className="badge badge-warning">High</span>;
      case "medium":
        return <span className="badge badge-primary">Medium</span>;
      default:
        return <span className="badge badge-neutral">Low</span>;
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="card-header" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h3 className="card-title">🚨 Recent Incidents &amp; Alerts</h3>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            Active security and facility escalations
          </p>
        </div>
        <Link
          href="/community-admin/incidents"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
        >
          View All ({incidents?.length || 0}) →
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: "auto", maxHeight: 220, marginTop: "0.5rem" }}>
        {openIncidents.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2.5rem 0",
              color: "var(--muted)",
              fontSize: "0.85rem",
            }}
          >
            <span style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.25rem" }}>
              🛡️
            </span>
            No open incidents or security alerts.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {openIncidents.slice(0, 5).map((incident) => (
              <div
                key={incident.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.85rem",
                  background: incident.severity === "critical" ? "#fef2f2" : "#f8fafc",
                  border: `1px solid ${incident.severity === "critical" ? "#fecaca" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.825rem",
                  gap: "0.5rem",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.15rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {getSeverityBadge(incident.severity)}
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--fg)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        textTransform: "capitalize",
                      }}
                    >
                      {incident.incident_type} Incident
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    📍 {incident.location_text || "Community Grounds"} · Reported{" "}
                    {formatDateTime(incident.reported_at || incident.created_at)}
                  </div>
                </div>

                <Link
                  href="/community-admin/incidents"
                  className="btn btn-secondary"
                  style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem", height: 28, flexShrink: 0 }}
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
