"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { useQueryClient } from "@tanstack/react-query";
import { gateApi } from "@/lib/api";

export default function SecuritySupervisorDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Emergency Modal
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyType, setEmergencyType] = useState("Medical Emergency");
  const [location, setLocation] = useState("");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleTriggerEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    await gateApi.triggerEmergency({ type: emergencyType, location: location || "Main Grounds" });
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
          title="Guards On Duty"
          value="8"
          subtext="2 Gates Covered"
          icon="👮"
          onClick={() => router.push("/security-supervisor/guard-management")}
        />
        <KpiCard
          title="Live Gate Traffic"
          value="42"
          subtext="18 Visitors Inside"
          icon="🛡️"
          onClick={() => router.push("/security-supervisor/gate-operations")}
        />
        <KpiCard
          title="Pending Approvals"
          value="5"
          subtext="Requires Resident/Supervisor Signoff"
          icon="👥"
          trend="warning"
          trendValue="Action Needed"
          onClick={() => router.push("/security-supervisor/visitor-management")}
        />
        <KpiCard
          title="Deliveries Today"
          value="24"
          subtext="3 At Gate Desk"
          icon="📦"
          onClick={() => router.push("/security-supervisor/delivery-management")}
        />
        <KpiCard
          title="Domestic Staff Inside"
          value="14"
          subtext="Active Attendance"
          icon="👔"
          onClick={() => router.push("/security-supervisor/domestic-staff")}
        />
        <KpiCard
          title="Blacklist Attempts"
          value="1"
          subtext="Blocked Today"
          icon="🚫"
          trend="danger"
          trendValue="1 Attempted"
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
                    <th>Visitor / Vehicle</th>
                    <th>Gate</th>
                    <th>Duty Guard</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>10:20</td>
                    <td style={{ fontWeight: 600 }}>Rohan Mehta (KA-01-MJ-4412)</td>
                    <td>North Gate Main</td>
                    <td>Guard Somnath</td>
                    <td><StatusBadge status="Approved" /></td>
                  </tr>
                  <tr>
                    <td>10:18</td>
                    <td style={{ fontWeight: 600 }}>Amazon Courier (KA-05-EV-1029)</td>
                    <td>South Service Gate</td>
                    <td>Guard Vikram</td>
                    <td><StatusBadge status="Approved" /></td>
                  </tr>
                  <tr>
                    <td>09:50</td>
                    <td style={{ fontWeight: 600, color: "var(--danger)" }}>Unidentified Person (BL-8809)</td>
                    <td>North Gate Main</td>
                    <td>Guard Somnath</td>
                    <td><StatusBadge status="Blocked" /></td>
                  </tr>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem", background: "#f8fafc", borderRadius: "var(--radius-sm)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Somnath Patil</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Main Gate North (Morning)</div>
                </div>
                <StatusBadge status="Active" />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem", background: "#f8fafc", borderRadius: "var(--radius-sm)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Vikram Singh</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Service Gate South (Morning)</div>
                </div>
                <StatusBadge status="Active" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🚨 Active Emergency Alerts</h3>
            </div>
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--radius-sm)",
                background: "var(--danger-light)",
                border: "1px solid var(--danger-border)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#991b1b" }}>
                Medical Emergency — Tower B 12th Floor
              </div>
              <div style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.25rem" }}>
                Reported by Mrs. Kapoor. Responder: Supervisor Devraj (Acknowledged).
              </div>
            </div>
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
              <option value="Medical Emergency">Medical Emergency</option>
              <option value="Fire Breakout">Fire Breakout</option>
              <option value="Security Breach">Security Breach</option>
              <option value="Suspicious Visitor">Suspicious Visitor</option>
              <option value="Theft Alert">Theft Alert</option>
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
