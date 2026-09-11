"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useIncidentDetails, useIncidentHistory, useIncidentActions } from "@/hooks/use-incidents";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/utils";

export default function SecurityIncidentDetailPage() {
  const params = useParams();
  const incidentId = params?.incidentId as string;

  const { data: incident, isLoading } = useIncidentDetails(incidentId);
  const { data: history, isLoading: historyLoading } = useIncidentHistory(incidentId);
  const { data: actions, isLoading: actionsLoading } = useIncidentActions(incidentId);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="skeleton" style={{ width: 280, height: 32 }} />
        <div className="skeleton" style={{ width: "100%", height: 250 }} />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
        <h2>Incident Report Not Found</h2>
        <p style={{ marginTop: "0.5rem", color: "var(--muted)" }}>
          The requested security incident record could not be found.
        </p>
        <Link
          href="/association-committee/incidents"
          className="btn btn-primary"
          style={{ marginTop: "1rem" }}
        >
          ← Back to Incident List
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Incident #${incident.incident_number || incident.id.slice(0, 8)}`}
        subtitle={`Security Incident Report · ${incident.incident_type.toUpperCase()} · ${incident.location_text || "Premises"}`}
        breadcrumbs={[
          { label: "Association Committee", href: "/association-committee/governance" },
          { label: "Security Incidents", href: "/association-committee/incidents" },
          { label: `#${incident.incident_number || incident.id.slice(0, 8)}` },
        ]}
        actions={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link href="/association-committee/incidents" className="btn btn-secondary">
              ← Back to Incidents
            </Link>
          </div>
        }
      />

      <div className="responsive-grid">
        {/* Left Column: Incident Details, Description, Actions Log */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Main Info Card */}
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
                Incident Classification & Status
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span
                  style={{
                    background:
                      incident.severity === "critical" || incident.severity === "high"
                        ? "#fee2e2"
                        : "#f1f5f9",
                    color:
                      incident.severity === "critical" || incident.severity === "high"
                        ? "#991b1b"
                        : "#475569",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.6rem",
                    borderRadius: "var(--radius-full)",
                    textTransform: "uppercase",
                  }}
                >
                  Severity: {incident.severity}
                </span>
                <StatusBadge status={incident.status} />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "1rem",
                fontSize: "0.875rem",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  padding: "0.75rem",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span style={{ color: "var(--muted)", fontSize: "0.775rem" }}>
                  Incident Category
                </span>
                <div style={{ fontWeight: 600, textTransform: "capitalize", marginTop: "0.2rem" }}>
                  {incident.incident_type}
                </div>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span style={{ color: "var(--muted)", fontSize: "0.775rem" }}>Location</span>
                <div style={{ fontWeight: 600, marginTop: "0.2rem" }}>
                  {incident.location_text || "Community Common Area"}
                </div>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span style={{ color: "var(--muted)", fontSize: "0.775rem" }}>
                  Reported Timestamp
                </span>
                <div style={{ fontWeight: 600, marginTop: "0.2rem" }}>
                  {formatDate(incident.reported_at)}
                </div>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span style={{ color: "var(--muted)", fontSize: "0.775rem" }}>
                  Resolution Timestamp
                </span>
                <div style={{ fontWeight: 600, marginTop: "0.2rem" }}>
                  {incident.resolved_at ? formatDate(incident.resolved_at) : "Pending Resolution"}
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <h3
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--fg)",
                  marginBottom: "0.4rem",
                }}
              >
                Incident Description & Details
              </h3>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--fg-secondary)" }}>
                {incident.description || "No specific incident description recorded."}
              </p>
            </div>

            {/* Resolution Summary */}
            {incident.resolution_summary && (
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: "1rem",
                  marginTop: "1rem",
                }}
              >
                <h3
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#059669",
                    marginBottom: "0.4rem",
                  }}
                >
                  Resolution Summary
                </h3>
                <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--fg-secondary)" }}>
                  {incident.resolution_summary}
                </p>
              </div>
            )}
          </div>

          {/* Action Log by Responders */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: "1rem" }}>
              Security & Responder Action Log
            </h2>

            {actionsLoading ? (
              <div className="skeleton" style={{ width: "100%", height: 100 }} />
            ) : !actions || actions.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", padding: "1rem 0" }}>
                No tactical actions recorded for this incident report.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {actions.map((act) => (
                  <div
                    key={act.id}
                    style={{
                      padding: "0.75rem 1rem",
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.825rem",
                          color: "var(--fg)",
                          textTransform: "capitalize",
                        }}
                      >
                        Action: {act.action_type.replace(/_/g, " ")}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {formatDate(act.action_at || act.created_at)}
                      </span>
                    </div>
                    {act.details && (
                      <div
                        style={{
                          fontSize: "0.825rem",
                          color: "var(--fg-secondary)",
                          marginTop: "0.35rem",
                        }}
                      >
                        {act.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Status Transition History & Governance Note */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Status Timeline History */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: "1rem" }}>
              Incident Lifecycle Timeline
            </h2>

            {historyLoading ? (
              <div className="skeleton" style={{ width: "100%", height: 120 }} />
            ) : !history || history.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                Initial status: <StatusBadge status={incident.status} />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  position: "relative",
                }}
              >
                {history.map((h, i) => (
                  <div
                    key={h.id || i}
                    style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "#8b5cf6",
                        marginTop: 5,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--fg)" }}>
                        Status changed to{" "}
                        <span style={{ textTransform: "capitalize" }}>{h.new_status}</span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.725rem",
                          color: "var(--muted)",
                          marginTop: "0.15rem",
                        }}
                      >
                        {formatDate(h.changed_at || h.created_at)}
                      </div>
                      {h.reason && (
                        <div
                          style={{
                            fontSize: "0.775rem",
                            color: "var(--fg-secondary)",
                            marginTop: "0.2rem",
                          }}
                        >
                          Reason: {h.reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Governance Oversight Note */}
          <div className="card" style={{ background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
            <h3
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "#6d28d9",
                marginBottom: "0.4rem",
              }}
            >
              ⚖️ Committee Audit Note
            </h3>
            <p style={{ fontSize: "0.8rem", color: "#5b21b6", lineHeight: 1.5 }}>
              Security incident reviews are retained for statutory community reporting, insurance
              claims, and annual security audits (NFR-COMP-02).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
