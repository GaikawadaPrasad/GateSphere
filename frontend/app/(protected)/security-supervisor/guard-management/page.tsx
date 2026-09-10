"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { gateApi } from "@/lib/api";

interface GuardRosterItem {
  id: string;
  guard_name: string;
  guard_user_id: string;
  shift: string;
  assigned_gate: string;
  status: string;
  shift_date: string;
  shift_start: string;
  shift_end: string;
}

export default function SecuritySupervisorGuardManagementPage() {
  const [roster, setRoster] = useState<GuardRosterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Assign Shift Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGuard, setSelectedGuard] = useState<GuardRosterItem | null>(null);
  const [newStatus, setNewStatus] = useState("active");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await gateApi.rosters();
      setRoster(
        (data || []).map((r: any) => ({
          id: r.id,
          guard_name: `Guard (${r.guard_user_id ? r.guard_user_id.slice(0, 8) : "Staff"})`,
          guard_user_id: r.guard_user_id,
          shift: `${r.shift_start || "08:00"} - ${r.shift_end || "16:00"}`,
          assigned_gate: "Main Perimeter Gate",
          status: r.status ? r.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Planned",
          shift_date: r.shift_date,
          shift_start: r.shift_start,
          shift_end: r.shift_end,
        }))
      );
    } catch {
      // fallback
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveAssignment = async () => {
    if (!selectedGuard) return;
    try {
      const statusSlug = newStatus.toLowerCase().replace(/\s+/g, "_");
      await gateApi.transitionRoster(selectedGuard.id, statusSlug, "Supervisor roster update");
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to update guard shift status.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Guard Management & Roster"
        subtitle="Assign security personnel to shifts and gates, manage duty rosters, and monitor attendance"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Guard Management" }]}
      />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Security Personnel Roster</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Guard Name</th>
                <th>Assigned Shift</th>
                <th>Assigned Gate / Post</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading roster…
                  </td>
                </tr>
              ) : (
                roster.map((g) => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{g.guard_name}</td>
                    <td>{g.shift}</td>
                    <td>{g.assigned_gate}</td>
                    <td>
                      <StatusBadge status={g.status} />
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                        onClick={() => {
                          setSelectedGuard(g);
                          setNewStatus(g.status.toLowerCase().replace(/\s+/g, "_"));
                          setIsModalOpen(true);
                        }}
                      >
                        Update Duty Status
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Shift Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Duty Status & Shift Transition — ${selectedGuard?.guard_name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveAssignment}>
              Update Status
            </button>
          </>
        }
      >
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Roster Duty Status
            </label>
            <select className="select-field" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="planned">Planned (Scheduled)</option>
              <option value="active">Active (On Duty)</option>
              <option value="completed">Completed (Shift Done)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              Shift Time: {selectedGuard?.shift} | Date: {selectedGuard?.shift_date}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
