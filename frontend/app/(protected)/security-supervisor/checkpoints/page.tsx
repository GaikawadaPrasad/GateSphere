"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { checkpointsApi, gateApi, communitiesApi, authApi } from "@/lib/api";

interface CheckpointItem {
  id: string;
  gate_id: string;
  name: string;
  location: string;
  assigned_guard: string;
  guard_id?: string;
  last_patrol: string;
  status: string;
}

export default function SecuritySupervisorCheckpointsPage() {
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Assign Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCp, setSelectedCp] = useState<CheckpointItem | null>(null);
  const [guardUserId, setGuardUserId] = useState("");
  const [guardsList, setGuardsList] = useState<{ id: string; name: string }[]>([]);

  // Override Modal
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [commRes, assignmentsRes, rostersRes, meRes] = await Promise.allSettled([
        communitiesApi.list(),
        gateApi.assignments(),
        gateApi.rosters(),
        authApi.me(),
      ]);

      const guards: { id: string; name: string }[] = [];
      if (rostersRes.status === "fulfilled") {
        for (const r of rostersRes.value || []) {
          if (r.guard_user_id && !guards.some((g) => g.id === r.guard_user_id)) {
            guards.push({ id: r.guard_user_id, name: `Guard (${r.guard_user_id.slice(0, 8)})` });
          }
        }
      }
      setGuardsList(guards);

      let cid = meRes.status === "fulfilled" && meRes.value?.community_ids?.[0] ? meRes.value.community_ids[0] : null;
      if (!cid && commRes.status === "fulfilled" && commRes.value?.length) {
        cid = commRes.value[0].id;
      }

      let gatesList: any[] = [];
      if (cid) {
        gatesList = await communitiesApi.gates(cid).catch(() => []);
      }

      const activeAssignments = assignmentsRes.status === "fulfilled" ? assignmentsRes.value : [];
      const assignmentByGate = new Map<string, any>();
      for (const a of activeAssignments || []) {
        if (a.gate_id) assignmentByGate.set(a.gate_id, a);
      }

      if (gatesList.length > 0) {
        setCheckpoints(
          gatesList.map((g: any) => {
            const assign = assignmentByGate.get(g.id);
            return {
              id: g.id,
              gate_id: g.id,
              name: g.name || "Perimeter Gate",
              location: g.code ? `Code: ${g.code}` : "Perimeter Boundary",
              assigned_guard: assign ? `Guard ${assign.guard_user_id.slice(0, 8)}` : "Unassigned",
              guard_id: assign?.guard_user_id,
              last_patrol: assign?.assigned_from
                ? new Date(assign.assigned_from).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Active",
              status: assign ? "Active" : "Pending",
            };
          }),
        );
      } else {
        setCheckpoints([]);
      }
    } catch {
      setCheckpoints([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignGuard = async () => {
    if (!selectedCp || !selectedCp.gate_id) {
      setIsModalOpen(false);
      return;
    }
    try {
      const gid = guardUserId || guardsList[0]?.id;
      if (gid) {
        await gateApi.createAssignment({
          guard_user_id: gid,
          gate_id: selectedCp.gate_id,
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to assign guard to checkpoint.");
    }
  };

  const handleCheckpointOverride = async () => {
    if (!selectedCp || !overrideReason.trim()) return;
    try {
      if (selectedCp.gate_id) {
        await checkpointsApi.override({
          gate_id: selectedCp.gate_id,
          reason: overrideReason.trim(),
        });
        alert("Checkpoint override successfully logged to audit trail.");
      }
      setIsOverrideModalOpen(false);
      setOverrideReason("");
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to execute checkpoint override.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Perimeter Checkpoints & Guard Patrol"
        subtitle="Manage perimeter security checkpoints, guard duty assignments, and patrol check-in logs"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Checkpoints" },
        ]}
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
              ) : checkpoints.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No checkpoints found.
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
                    <td style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                        onClick={() => {
                          setSelectedCp(cp);
                          setGuardUserId(cp.guard_id || "");
                          setIsModalOpen(true);
                        }}
                      >
                        Reassign Guard
                      </button>
                      <button
                        className="btn btn-warning"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                        onClick={() => {
                          setSelectedCp(cp);
                          setIsOverrideModalOpen(true);
                        }}
                      >
                        ⚡ Override
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
          <label
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: "0.35rem",
            }}
          >
            Select Duty Guard
          </label>
          <select
            className="select-field"
            value={guardUserId}
            onChange={(e) => setGuardUserId(e.target.value)}
          >
            {guardsList.length > 0 ? (
              guardsList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))
            ) : (
              <option value="">No on-duty guards found</option>
            )}
          </select>
        </div>
      </Modal>

      {/* Checkpoint Override Modal */}
      <Modal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        title={`Supervisor Emergency Override — ${selectedCp?.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsOverrideModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-warning" onClick={handleCheckpointOverride}>
              Confirm Override
            </button>
          </>
        }
      >
        <div>
          <p style={{ fontSize: "0.825rem", color: "var(--muted)", marginBottom: "1rem" }}>
            This action forces a checkpoint bypass / security override. An immutable audit record
            will be logged with your supervisor credential.
          </p>
          <label
            style={{
              display: "block",
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: "0.35rem",
            }}
          >
            Override Reason *
          </label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Emergency vehicle perimeter access"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            required
          />
        </div>
      </Modal>
    </div>
  );
}
