"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { checkpointsApi } from "@/lib/api";

export default function SecuritySupervisorCheckpointsPage() {
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Assign Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCp, setSelectedCp] = useState<any>(null);
  const [guardName, setGuardName] = useState("Somnath Patil");

  const loadData = async () => {
    setIsLoading(true);
    const data = await checkpointsApi.list();
    setCheckpoints(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignGuard = () => {
    if (!selectedCp) return;
    setCheckpoints((prev) =>
      prev.map((c) => (c.id === selectedCp.id ? { ...c, assigned_guard: guardName } : c))
    );
    setIsModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Perimeter Checkpoints & Guard Patrol"
        subtitle="Manage perimeter security checkpoints, guard duty assignments, and patrol check-in logs"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Checkpoints" }]}
      />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Security Checkpoints</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Checkpoint Name</th>
                <th>Physical Location</th>
                <th>Assigned Duty Guard</th>
                <th>Last Patrol Check-in</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading checkpoints…
                  </td>
                </tr>
              ) : (
                checkpoints.map((cp) => (
                  <tr key={cp.id}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>📍 {cp.name}</td>
                    <td>{cp.location}</td>
                    <td>{cp.assigned_guard}</td>
                    <td>{cp.last_patrol}</td>
                    <td>
                      <StatusBadge status={cp.status} />
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                        onClick={() => {
                          setSelectedCp(cp);
                          setGuardName(cp.assigned_guard);
                          setIsModalOpen(true);
                        }}
                      >
                        Reassign Guard
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reassign Guard Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Reassign Guard — ${selectedCp?.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAssignGuard}>
              Save Assignment
            </button>
          </>
        }
      >
        <div>
          <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
            Select Duty Guard
          </label>
          <select className="select-field" value={guardName} onChange={(e) => setGuardName(e.target.value)}>
            <option value="Somnath Patil">Somnath Patil (Main Gate)</option>
            <option value="Vikram Singh">Vikram Singh (Service Gate)</option>
            <option value="Patrol Team 2">Patrol Team 2 (Perimeter)</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}
