"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { useQueryClient } from "@tanstack/react-query";
import { serviceRequestsApi } from "@/lib/api";

export default function FacilityManagerDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Quick form state
  const [reqTitle, setReqTitle] = useState("");
  const [reqCategory, setReqCategory] = useState("Plumbing");
  const [reqPriority, setReqPriority] = useState<"Low" | "Medium" | "High" | "Critical">("High");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleQuickCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;
    await serviceRequestsApi.create({ title: reqTitle, category: reqCategory, priority: reqPriority });
    setIsModalOpen(false);
    setReqTitle("");
    router.push("/facility-manager/service-requests");
  };

  return (
    <div>
      <PageHeader
        title="Facility Manager Dashboard"
        subtitle="Operational facilities oversight, preventive maintenance, vendor status & SLA warnings"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Dashboard" }]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              🔄 {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsModalOpen(true)}
            >
              ➕ Quick Service Ticket
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
          title="Total Facilities"
          value="12"
          subtext="4 Available, 2 Maintenance"
          icon="🏢"
          onClick={() => router.push("/facility-manager/facilities")}
        />
        <KpiCard
          title="Open Service Requests"
          value="8"
          subtext="3 High Priority"
          icon="📋"
          trend="warning"
          trendValue="2 At Risk SLA"
          onClick={() => router.push("/facility-manager/service-requests")}
        />
        <KpiCard
          title="Scheduled Maintenance"
          value="5"
          subtext="2 Starting Today"
          icon="🔧"
          onClick={() => router.push("/facility-manager/maintenance")}
        />
        <KpiCard
          title="Active Vendors"
          value="6"
          subtext="3 On-Site Working"
          icon="🛠️"
          onClick={() => router.push("/facility-manager/vendors")}
        />
        <KpiCard
          title="Open Complaints"
          value="4"
          subtext="1 Breached SLA"
          icon="🎫"
          trend="danger"
          trendValue="Needs Triage"
          onClick={() => router.push("/facility-manager/complaints")}
        />
        <KpiCard
          title="Amenity Bookings"
          value="15"
          subtext="Today's Total Slots"
          icon="🏊"
          onClick={() => router.push("/facility-manager/amenities")}
        />
      </div>

      {/* Quick Actions Panel */}
      <div
        className="card"
        style={{
          marginBottom: "1.75rem",
          padding: "1rem 1.25rem",
          background: "linear-gradient(135deg, #ffffff, #f8fafc)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)", marginBottom: "0.75rem" }}>
          ⚡ Quick Management Actions
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => router.push("/facility-manager/facilities")}>
            🏢 Add / Edit Facility
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/facility-manager/maintenance")}>
            🔧 Schedule Maintenance
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/facility-manager/service-requests")}>
            📋 Create Service Request
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/facility-manager/vendors")}>
            🛠️ Assign Vendor
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/facility-manager/amenities")}>
            🏊 Block Amenity Slot
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/facility-manager/complaints")}>
            🎫 View Complaints
          </button>
          <button className="btn btn-secondary" onClick={() => router.push("/facility-manager/incidents")}>
            ⚠️ View Incidents
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
        {/* Left Side: Recent Active Maintenance & Service Tickets */}
        <div style={{ minWidth: 0 }}>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div className="card-header">
              <h3 className="card-title">Active Maintenance & Repairs</h3>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                onClick={() => router.push("/facility-manager/maintenance")}
              >
                View All
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Maintenance ID</th>
                    <th>Facility</th>
                    <th>Priority</th>
                    <th>Vendor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 600 }}>MNT-2026-089</td>
                    <td>Olympic Swimming Pool</td>
                    <td><StatusBadge status="High" /></td>
                    <td>Apex Water Treatment</td>
                    <td><StatusBadge status="In Progress" /></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>MNT-2026-090</td>
                    <td>Elevator Shaft B3</td>
                    <td><StatusBadge status="Emergency" /></td>
                    <td>Schindler Elevator Techs</td>
                    <td><StatusBadge status="Vendor Assigned" /></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>MNT-2026-091</td>
                    <td>Main Diesel Generator</td>
                    <td><StatusBadge status="Medium" /></td>
                    <td>PowerGen Services</td>
                    <td><StatusBadge status="Scheduled" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: SLA Warnings & High-Priority Alerts */}
        <div style={{ maxWidth: 460, width: "100%" }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">⚠️ SLA Warnings & Action Items</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--danger-light)",
                  border: "1px solid var(--danger-border)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#991b1b" }}>
                  🚨 SLA Breached: Unauthorized Parking Complaint CMP-402
                </div>
                <div style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.25rem" }}>
                  Overdue by 2 hours. Requires supervisor dispatch.
                </div>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--warning-light)",
                  border: "1px solid var(--warning-border)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#92400e" }}>
                  ⚠️ SLA At Risk: Corridor Light Fixture SR-8802
                </div>
                <div style={{ fontSize: "0.75rem", color: "#b45309", marginTop: "0.25rem" }}>
                  Assigned to ElectroSpark. 30 mins remaining.
                </div>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--primary-light)",
                  border: "1px solid #bfdbfe",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e40af" }}>
                  🛠️ Vendor Work Pending Review: Swimming Pool Pump
                </div>
                <div style={{ fontSize: "0.75rem", color: "#1e3a8a", marginTop: "0.25rem" }}>
                  Apex Water submitted completion proof. Awaiting manager signoff.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Ticket Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Service Request Ticket"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleQuickCreateRequest}>
              Create Request
            </button>
          </>
        }
      >
        <form onSubmit={handleQuickCreateRequest}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Request Title / Issue *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Main Gate Barrier Arm Stuck"
              value={reqTitle}
              onChange={(e) => setReqTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Category
              </label>
              <select
                className="select-field"
                value={reqCategory}
                onChange={(e) => setReqCategory(e.target.value)}
              >
                <option value="Plumbing">Plumbing</option>
                <option value="Electrical">Electrical</option>
                <option value="Elevator">Elevator</option>
                <option value="Security Hardware">Security Hardware</option>
                <option value="Civil/Structure">Civil / Structure</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Priority
              </label>
              <select
                className="select-field"
                value={reqPriority}
                onChange={(e) => setReqPriority(e.target.value as any)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
