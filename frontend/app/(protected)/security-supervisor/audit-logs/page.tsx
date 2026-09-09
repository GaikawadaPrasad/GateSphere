"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { gateApi, communitiesApi } from "@/lib/api";

interface DisplayAuditLog {
  id: string;
  user: string;
  action: string;
  gate: string;
  reference: string;
  details: string;
  timestamp: string;
  isOverride: boolean;
}

export default function SecuritySupervisorAuditLogsPage() {
  const [logs, setLogs] = useState<DisplayAuditLog[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async () => {
    try {
      const comms = await communitiesApi.list().catch(() => []);
      const cid = comms?.[0]?.id;

      const [eventsRes, gatesRes] = await Promise.allSettled([
        gateApi.events({ page_size: 100 }),
        cid ? communitiesApi.gates(cid) : Promise.resolve([]),
      ]);

      const events = eventsRes.status === "fulfilled" && Array.isArray(eventsRes.value) ? eventsRes.value : [];
      const gates = gatesRes.status === "fulfilled" && Array.isArray(gatesRes.value) ? gatesRes.value : [];
      const gateMap: Record<string, string> = {};
      gates.forEach((g: any) => {
        if (g.id) gateMap[g.id] = g.name || `Gate ${g.id.slice(0, 6)}`;
      });

      const mappedLogs: DisplayAuditLog[] = events.map((e: any) => {
        const isOverride = e.event_type === "checkpoint_override" || e.event_type?.includes("override");
        const actionLabel = (e.event_type || "UNKNOWN_EVENT").toUpperCase().replace(/_/g, " ");
        const gateName = e.gate_id ? gateMap[e.gate_id] || "Gate System" : "Community Perimeter";
        const refInfo = e.reference_type
          ? `${e.reference_type.toUpperCase()}${e.reference_id ? ` (#${e.reference_id.slice(0, 8)})` : ""}`
          : "Direct Gate Action";
        const detailInfo = e.metadata?.reason || e.metadata?.notes || (isOverride ? "Supervisor override executed" : "Standard verification logged");

        return {
          id: e.id,
          user: e.actor_user_id ? `Staff (${e.actor_user_id.slice(0, 8)})` : "Duty Security Guard",
          action: actionLabel,
          gate: gateName,
          reference: refInfo,
          details: detailInfo,
          timestamp: e.occurred_at ? new Date(e.occurred_at).toLocaleString() : "Recently",
          isOverride,
        };
      });

      setLogs(mappedLogs);
    } catch {
      setLogs([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const filteredLogs = logs.filter((log) => {
    if (filterType === "all") return true;
    if (filterType === "override") return log.isOverride;
    if (filterType === "entry") return log.action.includes("ENTRY");
    if (filterType === "exit") return log.action.includes("EXIT");
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Security Audit Trail"
        subtitle="Immutable read-only log of security system actions, gate overrides, and supervisor commands"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Audit Logs" }]}
      />

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 className="card-title">Immutable Security Activity Log</h3>
            <p className="card-subtitle">Server-verified append-only audit records for all gate checkpoints and security events</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              <select
                className="form-input"
                style={{ padding: "6px 10px", fontSize: "0.85rem", width: "auto" }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Events</option>
                <option value="override">Overrides Only</option>
                <option value="entry">Entries Only</option>
                <option value="exit">Exits Only</option>
              </select>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "6px 12px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? "spin" : ""}>
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="table-container">
          {isLoading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
              Loading security audit records from backend...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", opacity: 0.5 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
              <p style={{ fontWeight: 500 }}>No security audit records match the current filter.</p>
              <p style={{ fontSize: "0.85rem" }}>Gate overrides and checkpoint transactions will automatically appear here.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Security Operator</th>
                  <th>Action / Event</th>
                  <th>Gate / Checkpoint</th>
                  <th>Reference</th>
                  <th>Reason / Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{log.timestamp}</td>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{log.user}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          backgroundColor: log.isOverride ? "rgba(239, 68, 68, 0.12)" : "rgba(59, 130, 246, 0.12)",
                          color: log.isOverride ? "var(--danger, #ef4444)" : "var(--primary, #3b82f6)",
                          fontWeight: 600,
                        }}
                      >
                        {log.isOverride && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                          </svg>
                        )}
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.85rem", fontWeight: 500 }}>{log.gate}</td>
                    <td style={{ color: "var(--muted)", fontSize: "0.8rem", fontFamily: "monospace" }}>{log.reference}</td>
                    <td style={{ fontSize: "0.85rem", maxWidth: "260px" }}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
