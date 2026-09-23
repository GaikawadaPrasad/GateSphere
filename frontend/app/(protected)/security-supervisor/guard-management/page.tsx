"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { authApi, gateApi, guardsApi } from "@/lib/api";
import { PasswordField } from "@/components/forms/PasswordField";
import { generateInitialPassword, isValidPersonName } from "@/lib/utils";
import { toast } from "@/store/toast";

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
  const [communityId, setCommunityId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Status Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedGuard, setSelectedGuard] = useState<GuardRosterItem | null>(null);
  const [newStatus, setNewStatus] = useState("active");
  const [isUpdating, setIsUpdating] = useState(false);

  // Schedule New Shift Modal
  const STANDARD_SHIFTS = [
    { id: "morning", label: "Morning Shift (06:00 - 14:00)", start: "06:00", end: "14:00" },
    { id: "general", label: "General / Day Shift (08:00 - 16:00)", start: "08:00", end: "16:00" },
    { id: "afternoon", label: "Afternoon / Evening Shift (14:00 - 22:00)", start: "14:00", end: "22:00" },
    { id: "night", label: "Night Shift (16:00 - 00:00)", start: "16:00", end: "23:59" },
    { id: "custom", label: "Custom Shift Timing", start: "", end: "" },
  ];

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGuardId, setSelectedGuardId] = useState("");
  const [manualGuardId, setManualGuardId] = useState("");
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedShiftPreset, setSelectedShiftPreset] = useState("general");
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("16:00");
  const [shiftNotes, setShiftNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Register New Guard Modal
  const [isRegisterGuardOpen, setIsRegisterGuardOpen] = useState(false);
  const [guardFullName, setGuardFullName] = useState("");
  const [guardEmail, setGuardEmail] = useState("");
  const [guardPhone, setGuardPhone] = useState("");
  const [guardPassword, setGuardPassword] = useState("guard@Gate2026!");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState("");

  const handleOpenRegisterGuard = () => {
    setGuardFullName("");
    setGuardEmail("");
    setGuardPhone("");
    setGuardPassword("guard@Gate2026!");
    setRegisterError("");
    setIsRegisterGuardOpen(true);
  };

  const [guardFieldErrors, setGuardFieldErrors] = useState<Record<string, string>>({});

  const validateGuardForm = () => {
    const errors: Record<string, string> = {};
    const nameTrim = guardFullName.trim();
    if (!nameTrim || nameTrim.length < 2) {
      errors.fullName = "Guard full name must be at least 2 characters long.";
    } else if (!isValidPersonName(nameTrim)) {
      errors.fullName = "Guard full name must contain only alphabetic letters and spaces.";
    }
    const emailTrim = guardEmail.trim();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      errors.email = "Please enter a valid email address.";
    }
    const phoneTrim = guardPhone.trim();
    if (phoneTrim) {
      const phoneDigits = phoneTrim.replace(/\D/g, "");
      if (!/^\+?[0-9\s\-()]{7,20}$/.test(phoneTrim) || phoneDigits.length < 10) {
        errors.phone = "Please enter a valid phone number (at least 10 digits).";
      }
    }
    const pwd = guardPassword.trim();
    if (pwd && pwd.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    }
    setGuardFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterGuard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateGuardForm()) {
      toast.error("Please resolve the highlighted validation errors.");
      return;
    }

    const finalPassword = guardPassword.trim() || generateInitialPassword(guardFullName, "guard");
    setIsRegistering(true);
    setRegisterError("");
    try {
      await guardsApi.create({
        full_name: guardFullName.trim(),
        email: guardEmail.trim(),
        password: finalPassword,
        phone: guardPhone.trim() || undefined,
        community_id: communityId,
      });
      toast.success(`Security guard "${guardFullName.trim()}" registered successfully.`, "Guard Created");
      setIsRegisterGuardOpen(false);
      setGuardFieldErrors({});
      await loadData();
    } catch (err: any) {
      const msg = err?.message || "Failed to register security guard.";
      setRegisterError(msg);
      toast.error(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rosterData, assignData, guardsData, meData] = await Promise.allSettled([
        gateApi.rosters(),
        gateApi.assignments(),
        guardsApi.list(),
        authApi.me().catch(() => null),
      ]);

      if (meData.status === "fulfilled" && meData.value) {
        const me: any = meData.value;
        const cid = me?.community_ids?.[0] || me?.community_id || me?.roles?.find((r: any) => r.community_id)?.community_id;
        if (cid) setCommunityId(cid);
      }

      const rawRoster = rosterData.status === "fulfilled" && Array.isArray(rosterData.value) ? rosterData.value : [];
      const rawAssigns = assignData.status === "fulfilled" && Array.isArray(assignData.value) ? assignData.value : [];
      const rawGuards = guardsData.status === "fulfilled" && Array.isArray(guardsData.value) ? guardsData.value : [];

      const guards: { id: string; name: string }[] = [];
      const seenIds = new Set<string>();

      rawGuards.forEach((g: any) => {
        if (g.id && !seenIds.has(g.id)) {
          seenIds.add(g.id);
          guards.push({
            id: g.id,
            name: `${g.full_name || "Guard"} (${g.email || g.id.slice(0, 8)})`,
          });
        }
      });

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
      toast.success(`Guard shift status updated to "${newStatus}".`);
      setIsStatusModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update guard shift status.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    const gid = selectedGuardId || manualGuardId.trim();
    if (!gid) {
      toast.error("Please select or enter a Guard User ID.");
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
      toast.success("Guard shift roster scheduled successfully.");
      setIsCreateModalOpen(false);
      setShiftNotes("");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to schedule guard shift roster.");
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
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              onClick={loadData}
              disabled={isLoading}
            >
              🔄 {isLoading ? "Refreshing…" : "Refresh"}
            </button>
            <button className="btn btn-secondary" onClick={handleOpenRegisterGuard}>
              👮 + Register Security Guard
            </button>
            <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
              ➕ Schedule Guard Shift
            </button>
          </div>
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

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Standard Shift Timing *
            </label>
            <select
              className="select-field"
              value={selectedShiftPreset}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedShiftPreset(val);
                const preset = STANDARD_SHIFTS.find((s) => s.id === val);
                if (preset && preset.id !== "custom") {
                  setShiftStart(preset.start);
                  setShiftEnd(preset.end);
                }
              }}
            >
              {STANDARD_SHIFTS.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.label}
                </option>
              ))}
            </select>
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
              <select
                className="select-field"
                value={shiftStart}
                onChange={(e) => {
                  setShiftStart(e.target.value);
                  setSelectedShiftPreset("custom");
                }}
                required
              >
                <option value="06:00">06:00 AM</option>
                <option value="07:00">07:00 AM</option>
                <option value="08:00">08:00 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="14:00">02:00 PM (14:00)</option>
                <option value="16:00">04:00 PM (16:00)</option>
                <option value="18:00">06:00 PM (18:00)</option>
                <option value="20:00">08:00 PM (20:00)</option>
                <option value="22:00">10:00 PM (22:00)</option>
                <option value="23:00">11:00 PM (23:00)</option>
                {![
                  "06:00", "07:00", "08:00", "10:00", "12:00",
                  "14:00", "16:00", "18:00", "20:00", "22:00", "23:00"
                ].includes(shiftStart) && (
                  <option value={shiftStart}>{shiftStart}</option>
                )}
              </select>
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
              <select
                className="select-field"
                value={shiftEnd}
                onChange={(e) => {
                  setShiftEnd(e.target.value);
                  setSelectedShiftPreset("custom");
                }}
                required
              >
                <option value="12:00">12:00 PM</option>
                <option value="14:00">02:00 PM (14:00)</option>
                <option value="15:00">03:00 PM (15:00)</option>
                <option value="16:00">04:00 PM (16:00)</option>
                <option value="18:00">06:00 PM (18:00)</option>
                <option value="20:00">08:00 PM (20:00)</option>
                <option value="22:00">10:00 PM (22:00)</option>
                <option value="23:59">12:00 AM (23:59)</option>
                {![
                  "12:00", "14:00", "15:00", "16:00", "18:00",
                  "20:00", "22:00", "23:59"
                ].includes(shiftEnd) && (
                  <option value={shiftEnd}>{shiftEnd}</option>
                )}
              </select>
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

      {/* Register Guard Modal */}
      <Modal
        isOpen={isRegisterGuardOpen}
        onClose={() => setIsRegisterGuardOpen(false)}
        title="👮 Register New Security Guard"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsRegisterGuardOpen(false)}
              disabled={isRegistering}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              form="register-guard-form"
              disabled={isRegistering}
            >
              {isRegistering ? "Registering…" : "Register Guard"}
            </button>
          </>
        }
      >
        <form id="register-guard-form" onSubmit={handleRegisterGuard}>
          {registerError && (
            <div
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "6px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                fontSize: "0.8rem",
                marginBottom: "1rem",
              }}
            >
              {registerError}
            </div>
          )}

          <div
            style={{
              padding: "1rem",
              background: "#F8FAFC",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span>👮</span> 1. Guard Identity &amp; Portal Login
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  Full Name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  required
                  placeholder="e.g. Vikram Singh"
                  value={guardFullName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGuardFullName(val);
                    setGuardPassword(generateInitialPassword(val, "guard"));
                    if (guardFieldErrors.fullName) {
                      setGuardFieldErrors((prev) => ({ ...prev, fullName: "" }));
                    }
                  }}
                />
                {guardFieldErrors.fullName && (
                  <span style={{ color: "var(--danger, #ef4444)", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                    {guardFieldErrors.fullName}
                  </span>
                )}
              </div>

              <div>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="+91 98765 43210"
                  value={guardPhone}
                  onChange={(e) => {
                    setGuardPhone(e.target.value);
                    if (guardFieldErrors.phone) {
                      setGuardFieldErrors((prev) => ({ ...prev, phone: "" }));
                    }
                  }}
                />
                {guardFieldErrors.phone && (
                  <span style={{ color: "var(--danger, #ef4444)", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                    {guardFieldErrors.phone}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  Email Address <span style={{ color: "#EF4444" }}>*</span>{" "}
                  <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>
                    (For Gate Login)
                  </span>
                </label>
                <input
                  type="email"
                  className="input-field"
                  required
                  placeholder="e.g. vikram.guard@gatesphere.com"
                  value={guardEmail}
                  onChange={(e) => {
                    setGuardEmail(e.target.value);
                    if (guardFieldErrors.email) {
                      setGuardFieldErrors((prev) => ({ ...prev, email: "" }));
                    }
                  }}
                />
                {guardFieldErrors.email && (
                  <span style={{ color: "var(--danger, #ef4444)", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                    {guardFieldErrors.email}
                  </span>
                )}
              </div>

              <div>
                <PasswordField
                  value={guardPassword}
                  onChange={(val) => {
                    setGuardPassword(val);
                    if (guardFieldErrors.password) {
                      setGuardFieldErrors((prev) => ({ ...prev, password: "" }));
                    }
                  }}
                  placeholder="e.g. vikram@Gate2026!"
                  required
                  minLength={10}
                />
                {guardFieldErrors.password && (
                  <span style={{ color: "var(--danger, #ef4444)", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                    {guardFieldErrors.password}
                  </span>
                )}
              </div>
            </div>

            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)" }}>
              💡 Providing an email and password allows this security guard to sign in to the <strong>Security Guard Live Gate Dashboard</strong> to verify visitors, scan entry QR codes, and record cab/delivery logs.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
