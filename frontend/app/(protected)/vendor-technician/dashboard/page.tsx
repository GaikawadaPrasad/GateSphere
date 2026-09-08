"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";

export default function VendorDashboardPage() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div>
      <PageHeader
        title="Vendor / Technician Work Console"
        subtitle="Assigned service contracts, work status progression, gate entry passes, and completion signoffs"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Dashboard" }]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-secondary" onClick={handleRefresh} disabled={isRefreshing}>
              🔄 {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button className="btn btn-primary" onClick={() => setIsPassModalOpen(true)}>
              🪪 Digital Gate Pass
            </button>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        <KpiCard
          title="Assigned Tickets"
          value="2"
          subtext="1 High Priority"
          icon="🎫"
          onClick={() => router.push("/vendor-technician/assigned-tickets")}
        />
        <KpiCard
          title="Jobs In Progress"
          value="1"
          subtext="Swimming Pool Pump"
          icon="⏳"
          trend="primary"
          trendValue="Active Now"
          onClick={() => router.push("/vendor-technician/work-progress")}
        />
        <KpiCard
          title="Active Gate Pass"
          value="PASS-VEN-8812"
          subtext="Valid for North Gate"
          icon="🪪"
          onClick={() => router.push("/vendor-technician/entry-pass")}
        />
        <KpiCard
          title="Completed Jobs"
          value="45"
          subtext="Lifetime Approved"
          icon="✅"
          onClick={() => router.push("/vendor-technician/service-history")}
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
          ⚡ Technician Quick Actions
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => router.push("/vendor-technician/assigned-tickets")}>
            🎫 View Assigned Tickets
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/vendor-technician/work-progress")}>
            ⏳ Update Work Status
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/vendor-technician/entry-pass")}>
            🪪 Show Digital Entry Pass
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/vendor-technician/work-completion")}>
            ✅ Submit Work Completion
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/vendor-technician/profile")}>
            👤 Manage Technician Profile
          </button>
        </div>
      </div>

      {/* Main Grid matching Super Admin */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "1.75rem",
          alignItems: "start",
        }}
      >
        {/* Left Side: Active Assigned Tickets Table */}
        <div style={{ minWidth: 0 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Today's Assigned Service Tickets</h3>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                onClick={() => router.push("/vendor-technician/assigned-tickets")}
              >
                View Tickets
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Task Summary</th>
                    <th>Facility Location</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>VT-901</td>
                    <td style={{ fontWeight: 500, color: "var(--fg)" }}>Swimming Pool Pump Replacement</td>
                    <td>Olympic Swimming Pool</td>
                    <td><StatusBadge status="High" /></td>
                    <td><StatusBadge status="In Progress" /></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>VT-902</td>
                    <td style={{ fontWeight: 500, color: "var(--fg)" }}>Elevator B3 Sensor Error Code E-409</td>
                    <td>Tower B Shaft B3</td>
                    <td><StatusBadge status="Emergency" /></td>
                    <td><StatusBadge status="Assigned" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Active Entry Pass QR Card & SLA Countdown */}
        <div style={{ maxWidth: 460, width: "100%" }}>
          <div
            className="card"
            style={{
              marginBottom: "1.5rem",
              background: "linear-gradient(135deg, #0b1329, #121e3d)",
              color: "white",
            }}
          >
            <div className="card-header" style={{ borderBottom: "1px solid #1e293b" }}>
              <h3 className="card-title" style={{ color: "white" }}>🪪 Active Gate Entry Pass</h3>
              <StatusBadge status="Active" />
            </div>

            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>Pass Code</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "monospace", color: "#60a5fa" }}>
                PASS-VEN-8812
              </div>
              <div
                style={{
                  width: 120,
                  height: 120,
                  margin: "1rem auto",
                  background: "white",
                  padding: "0.5rem",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  color: "#0f172a",
                  fontWeight: 700,
                }}
              >
                [ QR CODE PASS ]
              </div>
              <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                Show this QR at Security Gate North for instant verification
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Entry Pass Modal */}
      <Modal
        isOpen={isPassModalOpen}
        onClose={() => setIsPassModalOpen(false)}
        title="🪪 Technician Digital Gate Entry Pass"
        footer={
          <button className="btn btn-primary" onClick={() => setIsPassModalOpen(false)}>
            Close Pass
          </button>
        }
      >
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Authorized Vendor Technician</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--fg)" }}>
            Alexander Wright (Apex Water)
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "monospace", color: "var(--primary)", marginTop: "0.5rem" }}>
            PASS-VEN-8812
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--success)", fontWeight: 600, marginTop: "0.2rem" }}>
            ● Valid Today 08:00 - 20:00
          </div>
        </div>
      </Modal>
    </div>
  );
}
