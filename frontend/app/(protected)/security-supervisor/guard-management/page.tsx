"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { DataTable, type Column } from "@/components/tables/DataTable";
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
  notes?: string;
}

export default function SecuritySupervisorGuardManagementPage() {
  const [roster, setRoster] = useState<GuardRosterItem[]>([]);
  const [guardsList, setGuardsList] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Status Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedGuard, setSelectedGuard] = useState<GuardRosterItem | null>(null);
  const [newStatus, setNewStatus] = useState("active");
  const [isUpdating, setIsUpdating] = useState(false);

  // Schedule New Shift Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGuardId, setSelectedGuardId] = useState("");
  const [manualGuardId, setManualGuardId] = useState("");
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("16:00");
  const [shiftNotes, setShiftNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rosterData, assignData] = await Promise.allSettled([
        gateApi.rosters(),
        gateApi.assignments(),
      ]);

      const rawRoster = rosterData.status === "fulfilled" && Array.isArray(rosterData.value) ? rosterData.value : [];
      const rawAssigns = assignData.status === "fulfilled" && Array.isArray(assignData.value) ? assignData.value : [];

      const guards: { id: string; name: string }[] = [];
      const seenIds = new Set<string>();

      rawAssigns.forEach((a: any) => {
        if (a.guard_user_id && !seenIds.has(a.guard_user_id)) {
          seenIds.add(a.guard_user_id);
          guards.push({
            id: a.guard_user_id,
            name: `Guard (${a.guard_user_id.slice(0, 8)})`,
          });
        }
      });

      rawRoster.forEach((r: any) => {
        if (r.guard_user_id && !seenIds.has(r.guard_user_id)) {
          seenIds.add(r.guard_user_id);
          guards.push({
            id: r.guard_user_id,
            name: `Security Guard (${r.guard_user_id.slice(0, 8)})`,
          });
        }
      });
      setGuardsList(guards);

      const guardNameMap = new Map(guards.map((g) => [g.id, g.name]));

      setRoster(
        rawRoster.map((r: any) => ({
          id: r.id,
          guard_name: guardNameMap.get(r.guard_user_id) || `Guard (${r.guard_user_id ? r.guard_user_id.slice(0, 8) : "Personnel"})`,
          guard_user_id: r.guard_user_id,
          shift: `${r.shift_start || "08:00"} - ${r.shift_end || "16:00"}`,
          assigned_gate: r.gate_id ? `Gate #${r.gate_id.slice(0, 8)}` : "Perimeter Security Post",
          status: r.status || "planned",
          shift_date: r.shift_date,
          shift_start: r.shift_start,
          shift_end: r.shift_end,
          notes: r.notes,
        })),
      );
    } catch {
      // fallback
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveStatus = async () => {
    if (!selectedGuard) return;
    setIsUpdating(true);
    try {
      const statusSlug = newStatus.toLowerCase().replace(/\s+/g, "_");
      await gateApi.transitionRoster(selectedGuard.id, statusSlug, "Supervisor duty status update");
      setIsStatusModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to update guard shift status.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    const gid = selectedGuardId || manualGuardId.trim();
    if (!gid) {
      alert("Please select or enter a Guard User ID.");
      return;
    }
    setIsCreating(true);
    try {
      await gateApi.createRoster({
        guard_user_id: gid,
        shift_date: shiftDate,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        notes: shiftNotes.trim() || undefined,
      });
      setIsCreateModalOpen(false);
      setShiftNotes("");
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to schedule guard shift roster.");
    } finally {
      setIsCreating(false);
    }
  };

  const columns: Column<GuardRosterItem>[] = [
    {
      key: "guard_name",
      header: "Guard Name",
      sortable: true,
      render: (g) => <span style={{ fontWeight: 600, color: "var(--fg)" }}>👮 {g.guard_name}</span>,
    },
    {
      key: "shift_date",
      header: "Shift Date",
      sortable: true,
      render: (g) => <span>{g.shift_date}</span>,
    },
    {
      key: "shift",
      header: "Duty Hours",
      sortable: true,
      render: (g) => <span>{g.shift}</span>,
    },
    {
      key: "assigned_gate",
      header: "Assigned Post",
      sortable: true,
      render: (g) => <span>{g.assigned_gate}</span>,
    },
    {
      key: "status",
      header: "Duty Status",
      sortable: true,
      render: (g) => <StatusBadge status={g.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (g) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
            onClick={() => {
              setSelectedGuard(g);
              setNewStatus(g.status.toLowerCase().replace(/\s+/g, "_"));
              setIsStatusModalOpen(true);
            }}
          >
            Update Status
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Guard Management & Duty Roster"
        subtitle="Schedule security personnel shifts, assign duty checkpoints, and monitor active duty roster transitions"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Guard Management" },
        ]}
        actions={
          <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
            ➕ Schedule Guard Shift
          </button>
        }
      />

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Security Duty Rosters</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {roster.length} guard shifts registered
            </p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={roster}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Guard Shifts Scheduled"
          emptyDescription="Click 'Schedule Guard Shift' above to assign guard duty rosters."
          emptyIcon="👮"
        />
      </div>

      {/* Schedule Shift Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="👮 Schedule Security Guard Shift"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateRoster}
              disabled={isCreating}
            >
              {isCreating ? "Scheduling…" : "Confirm Shift Assignment"}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateRoster}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Select Security Guard *
            </label>
            {guardsList.length > 0 ? (
              <select
                className="select-field"
                value={selectedGuardId}
                onChange={(e) => {
                  setSelectedGuardId(e.target.value);
                  setManualGuardId("");
                }}
              >
                <option value="">-- Choose from available guards --</option>
                {guardsList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            ) : null}

            {(!guardsList.length || !selectedGuardId) && (
              <div style={{ marginTop: guardsList.length ? "0.5rem" : 0 }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Or enter Guard User UUID directly..."
                  value={manualGuardId}
                  onChange={(e) => setManualGuardId(e.target.value)}
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Shift Date *
            </label>
            <input
              type="date"
              className="input-field"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              required
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1rem",
            }}
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
                Shift Start *
              </label>
              <input
                type="time"
                className="input-field"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
                Shift End *
              </label>
              <input
                type="time"
                className="input-field"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Special Instructions / Notes
            </label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="e.g. Assigned to North Perimeter Gate monitoring"
              value={shiftNotes}
              onChange={(e) => setShiftNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Duty Status Transition Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={`Duty Status & Shift Transition — ${selectedGuard?.guard_name}`}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsStatusModalOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveStatus}
              disabled={isUpdating}
            >
              {isUpdating ? "Updating…" : "Update Status"}
            </button>
          </>
        }
      >
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Roster Duty Status
            </label>
            <select
              className="select-field"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
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
