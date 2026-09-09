"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { useQueryClient } from "@tanstack/react-query";
import { gateApi, dashboardsApi, visitorsApi, deliveriesApi, domesticStaffApi, blacklistApi } from "@/lib/api";
import type { SecurityStats } from "@/types/dashboards";
import type { GuardRoster, GateEvent, PanicAlert } from "@/types/gate";
import { formatDateTime } from "@/lib/utils";

// Real backend enum (backend/app/modules/gate/models.py ALERT_TYPES)
const EMERGENCY_TYPES = [
  { label: "Medical Emergency", value: "medical" },
  { label: "Fire", value: "fire" },
  { label: "Security Breach", value: "security" },
  { label: "Suspicious / Intrusion", value: "intrusion" },
  { label: "Other", value: "other" },
];

export default function SecuritySupervisorDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Emergency Modal
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyType, setEmergencyType] = useState("medical");
  const [location, setLocation] = useState("");

  // Operational data
  const [isLoading, setIsLoading] = useState(true);
  const [securityStats, setSecurityStats] = useState<SecurityStats | null>(null);
  const [pendingVisitorCount, setPendingVisitorCount] = useState(0);
  const [deliveriesTodayCount, setDeliveriesTodayCount] = useState(0);
  const [deliveriesAtGateCount, setDeliveriesAtGateCount] = useState(0);
  const [staffInsideCount, setStaffInsideCount] = useState(0);
  const [blacklistCount, setBlacklistCount] = useState(0);
  const [activeRosters, setActiveRosters] = useState<GuardRoster[]>([]);
  const [recentEvents, setRecentEvents] = useState<GateEvent[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<PanicAlert[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    const [statsRes, visitorsRes, deliveriesRes, staffRes, blacklistRes, rostersRes, eventsRes, alertsRes] = await Promise.allSettled([
      dashboardsApi.security(),
      visitorsApi.requests(),
      deliveriesApi.list(),
      domesticStaffApi.attendance({ open_only: true }),
      blacklistApi.list(),
      gateApi.rosters(),
      gateApi.events({ page_size: 5 }),
      gateApi.alerts(),
    ]);
    if (statsRes.status === "fulfilled") setSecurityStats(statsRes.value);
    if (visitorsRes.status === "fulfilled") {
      setPendingVisitorCount((visitorsRes.value || []).filter((v: any) => v.status === "pending").length);
    }
    if (deliveriesRes.status === "fulfilled") {
      setDeliveriesTodayCount((deliveriesRes.value || []).length);
      setDeliveriesAtGateCount((deliveriesRes.value || []).filter((d: any) => d.status === "at_gate").length);
    }
    if (staffRes.status === "fulfilled") setStaffInsideCount((staffRes.value || []).length);
    if (blacklistRes.status === "fulfilled") setBlacklistCount((blacklistRes.value || []).filter((b: any) => b.is_active).length);
    if (rostersRes.status === "fulfilled") setActiveRosters((rostersRes.value || []).filter((r) => r.status === "active"));
    if (eventsRes.status === "fulfilled") setRecentEvents(eventsRes.value || []);
    if (alertsRes.status === "fulfilled") setActiveAlerts((alertsRes.value || []).filter((a) => a.status === "active" || a.status === "acknowledged"));
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    await loadData();
    setIsRefreshing(false);
  };

  const handleTriggerEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    await gateApi.triggerEmergency({
      alert_type: emergencyType,
      severity: "critical",
      message: location.trim() ? `Location: ${location.trim()}` : undefined,
    });
    setIsEmergencyModalOpen(false);
    setLocation("");
    router.push("/security-supervisor/emergency-alerts");
  };

  return (
    <div>
      <PageHeader
        title="Security Supervisor Dashboard"
        subtitle="Real-time gate traffic monitoring, guard roster management, panic alert command & blacklist oversight"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Dashboard" }]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-secondary" onClick={handleRefresh} disabled={isRefreshing}>
              🔄 {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button className="btn btn-danger" onClick={() => setIsEmergencyModalOpen(true)}>
              🚨 Emergency Alert
            </button>
          </div>
        }
      />

      {/* KPI Metrics Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        <KpiCard
          title="Guards On Active Shift"
          value={isLoading ? "…" : String(activeRosters.length)}
          subtext="Currently on duty"
          icon="👮"
          onClick={() => router.push("/security-supervisor/guard-management")}
        />
        <KpiCard
          title="Live Gate Traffic"
          value={isLoading ? "…" : String((securityStats?.visitors_inside ?? 0) + (securityStats?.vehicles_inside ?? 0))}
          subtext={`${securityStats?.visitors_inside ?? 0} Visitors Inside`}
          icon="🛡️"
          onClick={() => router.push("/security-supervisor/gate-operations")}
        />
        <KpiCard
          title="Pending Approvals"
          value={isLoading ? "…" : String(pendingVisitorCount)}
          subtext="Requires resident signoff"
          icon="👥"
          trend={pendingVisitorCount > 0 ? "warning" : undefined}
          trendValue={pendingVisitorCount > 0 ? "Action Needed" : undefined}
          onClick={() => router.push("/security-supervisor/visitor-management")}
        />
        <KpiCard
          title="Deliveries Today"
          value={isLoading ? "…" : String(deliveriesTodayCount)}
          subtext={`${deliveriesAtGateCount} at gate desk`}
          icon="📦"
          onClick={() => router.push("/security-supervisor/delivery-management")}
        />
        <KpiCard
          title="Domestic Staff Inside"
          value={isLoading ? "…" : String(staffInsideCount)}
          subtext="Open gate attendance"
          icon="👔"
          onClick={() => router.push("/security-supervisor/domestic-staff")}
        />
        <KpiCard
          title="Active Blacklist Entries"
          value={isLoading ? "…" : String(blacklistCount)}
          subtext="Currently enforced"
          icon="🚫"
          trend={blacklistCount > 0 ? "danger" : undefined}
          onClick={() => router.push("/security-supervisor/blacklist")}
        />
      </div>

      {/* Quick Actions Bar */}
      <div
        className="card"
        style={{
          marginBottom: "1.75rem",
          padding: "1rem 1.25rem",
          background: "linear-gradient(135deg, #ffffff, #f8fafc)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)", marginBottom: "0.75rem" }}>
          ⚡ Security Supervisor Quick Actions
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => router.push("/security-supervisor/guard-management")}>
            👮 Assign Guard Shift
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/security-supervisor/gate-operations")}>
            🛡️ View Live Gate Activity
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/security-supervisor/blacklist")}>
            🚫 Add Blacklist Entry
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/security-supervisor/incidents")}>
            ⚠️ Log Security Incident
          </button>
          <button className="btn btn-danger" onClick={() => setIsEmergencyModalOpen(true)}>
            🚨 Trigger Emergency Alert
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/security-supervisor/checkpoints")}>
            📍 Manage Checkpoints
          </button>
        </div>
      </div>

      {/* Grid Layout matching Super Admin */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "1.75rem",
          alignItems: "start",
        }}
      >
        {/* Left Side: Real-time Gate Traffic Monitoring */}
        <div style={{ minWidth: 0 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Supervised Gate Traffic Feed</h3>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                onClick={() => router.push("/security-supervisor/gate-operations")}
              >
                View Live Feed
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event Type</th>
                    <th>Gate</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "1.5rem" }}>Loading…</td>
                    </tr>
                  ) : recentEvents.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}>No recent gate events.</td>
                    </tr>
                  ) : (
                    recentEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td>{formatDateTime(ev.occurred_at)}</td>
                        <td style={{ fontWeight: 600 }}><StatusBadge status={ev.event_type} /></td>
                        <td>{ev.gate_id ? `Gate #${ev.gate_id.slice(0, 8)}` : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Active Guard Roster & Panic Alerts */}
        <div style={{ maxWidth: 460, width: "100%" }}>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div className="card-header">
              <h3 className="card-title">Active Guard Roster</h3>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                onClick={() => router.push("/security-supervisor/guard-management")}
              >
                Roster
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {isLoading ? (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Loading…</p>
              ) : activeRosters.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>No guards currently on an active shift.</p>
              ) : (
                activeRosters.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem", background: "#f8fafc", borderRadius: "var(--radius-sm)" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{r.shift_date}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{r.shift_start} – {r.shift_end}</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🚨 Active Emergency Alerts</h3>
            </div>
            {isLoading ? (
              <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Loading…</p>
            ) : activeAlerts.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>No active emergency alerts.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {activeAlerts.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--danger-light)",
                      border: "1px solid var(--danger-border)",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#991b1b", textTransform: "capitalize" }}>
                      {a.alert_type} {(a as any).message ? `— ${(a as any).message}` : ""}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.25rem", textTransform: "capitalize" }}>
                      Status: {a.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Modal */}
      <Modal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        title="⚠️ Trigger Emergency Security Alert"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsEmergencyModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleTriggerEmergency}>
              🚨 Confirm Emergency Broadcast
            </button>
          </>
        }
      >
        <form onSubmit={handleTriggerEmergency}>
          <div
            style={{
              padding: "0.75rem",
              background: "var(--danger-light)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--danger-border)",
              color: "#991b1b",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            ⚠️ Confirmation required: This will fan out emergency notifications to all on-duty guards and security personnel.
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Emergency Type *
            </label>
            <select
              className="select-field"
              value={emergencyType}
              onChange={(e) => setEmergencyType(e.target.value)}
            >
              {EMERGENCY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Specific Location / Unit
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Tower A Floor 8 / Clubhouse"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
