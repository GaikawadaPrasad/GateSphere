import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { GateEvent, PanicAlert } from "@/types/gate";

interface ActivityFeedProps {
  events: GateEvent[] | undefined;
  alerts: PanicAlert[] | undefined;
  isLoading?: boolean;
}

export function ActivityFeed({ events, alerts, isLoading }: ActivityFeedProps) {
  const hasAlerts = alerts && alerts.length > 0;
  const recentEvents = (events || []).slice(0, 6);

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h3 className="card-title">Live Security Activity</h3>
          {hasAlerts && <StatusBadge status="emergency" label={`${alerts.length} Active Alert`} />}
        </div>
        <Link href="/super-admin/gate-traffic" style={{ fontSize: "0.8rem", fontWeight: 500 }}>
          View all →
        </Link>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 44, width: "100%" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Critical Panic Alerts */}
          {alerts?.map((alert) => (
            <div
              key={alert.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem",
                background: "var(--danger-light)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "1.1rem" }}>🚨</span>
                <div>
                  <div style={{ fontWeight: 600, color: "#991b1b", fontSize: "0.85rem", textTransform: "capitalize" }}>
                    {alert.alert_type} Alert{alert.message ? ` — ${alert.message}` : ""}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#b91c1c" }}>
                    {formatRelativeTime(alert.created_at)}
                  </div>
                </div>
              </div>
              <StatusBadge status={alert.status} />
            </div>
          ))}

          {/* Gate Events */}
          {recentEvents.map((evt) => (
            <div
              key={evt.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.65rem 0.75rem",
                borderBottom: "1px solid var(--border-light)",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "1rem" }}>
                  {evt.event_type.includes("visitor")
                    ? "🚶"
                    : evt.event_type.includes("vehicle")
                      ? "🚗"
                      : "👷"}
                </span>
                <div>
                  <div style={{ fontWeight: 500, color: "var(--fg)", textTransform: "capitalize" }}>
                    {evt.event_type.replace(/_/g, " ")}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {formatRelativeTime(evt.occurred_at)}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>
                {evt.gate_id ? `Gate #${evt.gate_id.slice(0, 4)}` : "Main Gate"}
              </span>
            </div>
          ))}

          {!hasAlerts && recentEvents.length === 0 && (
            <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--muted)", fontSize: "0.85rem" }}>
              No recent gate activity
            </div>
          )}
        </div>
      )}
    </div>
  );
}
