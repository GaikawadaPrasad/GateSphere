"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { gateApi } from "@/lib/api";

interface GuardRosterItem {
  id: string;
  guard_name: string;
  shift: string;
  assigned_gate: string;
  status: "On Duty" | "Scheduled" | "Off Duty";
}

export default function SecuritySupervisorGuardManagementPage() {
  const [roster, setRoster] = useState<GuardRosterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Assign Shift Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGuard, setSelectedGuard] = useState<GuardRosterItem | null>(null);
  const [newShift, setNewShift] = useState("Morning (06:00 - 14:00)");
  const [newGate, setNewGate] = useState("Main Gate North");

  const loadData = async () => {
    setIsLoading(true);
    const data = await gateApi.rosters();
    setRoster(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveAssignment = () => {
    if (!selectedGuard) return;
    setRoster((prev) =>
      prev.map((g) =>
        g.id === selectedGuard.id
          ? { ...g, shift: newShift, assigned_gate: newGate }
          : g
      )
    );
    setIsModalOpen(false);
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
                          setNewShift(g.shift);
                          setNewGate(g.assigned_gate);
                          setIsModalOpen(true);
                        }}
                      >
                        Change Shift / Gate
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
        title={`Assign Shift & Gate — ${selectedGuard?.guard_name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveAssignment}>
              Save Assignment
            </button>
          </>
        }
      >
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Select Shift
            </label>
            <select className="select-field" value={newShift} onChange={(e) => setNewShift(e.target.value)}>
              <option value="Morning (06:00 - 14:00)">Morning (06:00 - 14:00)</option>
              <option value="Evening (14:00 - 22:00)">Evening (14:00 - 22:00)</option>
              <option value="Night (22:00 - 06:00)">Night (22:00 - 06:00)</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Assigned Gate Post
            </label>
            <select className="select-field" value={newGate} onChange={(e) => setNewGate(e.target.value)}>
              <option value="Main Gate North">Main Gate North</option>
              <option value="Service Gate South">Service Gate South</option>
              <option value="Clubhouse Perimeter Patrol">Clubhouse Perimeter Patrol</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
