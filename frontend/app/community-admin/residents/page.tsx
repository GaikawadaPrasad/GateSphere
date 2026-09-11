"use client";

import { useState } from "react";
import { useUiStore } from "@/store/ui";
import {
  useResidents,
  useMoveRecords,
  useTransitionMoveRecord,
  useEmergencyContacts,
  useAddResident,
} from "@/hooks/use-residents";
import { useCommunityUnits } from "@/hooks/use-communities";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterPanel } from "@/components/common/FilterPanel";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { ResidentProfile, MoveRecord } from "@/types/residents";
import { formatDateTime } from "@/lib/utils";

export default function CommunityAdminResidentsPage() {
  const { activeCommunityId } = useUiStore();
  const [activeTab, setActiveTab] = useState<"directory" | "approvals">("directory");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedResident, setSelectedResident] = useState<ResidentProfile | null>(null);

  // Add Resident Modal State
  const [isAddResidentOpen, setIsAddResidentOpen] = useState(false);
  const [targetUnitId, setTargetUnitId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [occupancyRole, setOccupancyRole] = useState("primary_owner");
  const [isPrimary, setIsPrimary] = useState(true);
  const [agreementRef, setAgreementRef] = useState("");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Queries
  const {
    data: residents,
    isLoading: residentsLoading,
    refetch: refetchResidents,
  } = useResidents({
    community_id: activeCommunityId || undefined,
  });

  const { data: communityUnits } = useCommunityUnits(activeCommunityId || undefined);
  const addResidentMutation = useAddResident();

  const {
    data: moveRecords,
    isLoading: movesLoading,
    refetch: refetchMoves,
  } = useMoveRecords({
    community_id: activeCommunityId || undefined,
  });

  const transitionMove = useTransitionMoveRecord();

  // Emergency contacts for selected resident modal
  const { data: contacts } = useEmergencyContacts(selectedResident?.id);

  // Move Approval modal state
  const [selectedMove, setSelectedMove] = useState<MoveRecord | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDecision = async (moveId: string, decision: "approved" | "rejected") => {
    try {
      setIsProcessing(true);
      if (decision === "rejected") {
        await transitionMove.mutateAsync({
          moveId,
          data: {
            status: "rejected",
            clearance_notes: approvalNotes || "Move request rejected by community administrator.",
          },
        });
      } else {
        // If status is "requested", step through "scheduled" then "approved"
        if (selectedMove?.status === "requested") {
          await transitionMove.mutateAsync({
            moveId,
            data: {
              status: "scheduled",
              scheduled_at: selectedMove.scheduled_at || new Date().toISOString(),
              clearance_notes: approvalNotes || "Scheduled by community administrator.",
            },
          });
        }
        await transitionMove.mutateAsync({
          moveId,
          data: {
            status: "approved",
            clearance_notes: approvalNotes || "Move request approved by community administrator.",
          },
        });
      }
      setSelectedMove(null);
      setApprovalNotes("");
      refetchMoves();
      refetchResidents();
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Resident Directory Columns
  const residentColumns: Column<ResidentProfile>[] = [
    {
      key: "full_name",
      header: "Resident Name",
      render: (r) => (
        <div>
          <strong>{r.full_name}</strong>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {r.email || r.phone || "–"}
          </div>
        </div>
      ),
    },
    {
      key: "unit",
      header: "Unit / Tower",
      render: (r) => (
        <div>
          <strong>Unit {r.unit_number || "–"}</strong>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{r.tower_name || "–"}</div>
        </div>
      ),
    },
    {
      key: "resident_type",
      header: "Occupancy Type",
      render: (r) => (
        <span
          className={`badge ${(r.resident_type || (r as any).occupancy_role || "")?.includes("owner") ? "badge-primary" : "badge-neutral"}`}
          style={{ textTransform: "capitalize" }}
        >
          {(r.resident_type || (r as any).occupancy_role || "Resident")?.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status || (r as any).profile_status || "active"} />,
    },
    {
      key: "actions",
      header: "Action",
      render: (r) => (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedResident(r);
          }}
        >
          View Profile →
        </button>
      ),
    },
  ];

  // Move Records / Approvals Columns
  const moveColumns: Column<MoveRecord>[] = [
    {
      key: "resident_name",
      header: "Resident / Applicant",
      render: (m) => <strong>{m.resident_name || "Resident"}</strong>,
    },
    {
      key: "unit",
      header: "Unit",
      render: (m) => (
        <span>
          Unit {m.unit_number || "–"} ({m.tower_name || "Tower"})
        </span>
      ),
    },
    {
      key: "move_type",
      header: "Move Type",
      render: (m) => (
        <span
          className={`badge ${m.move_type === "move_in" ? "badge-success" : "badge-warning"}`}
          style={{ textTransform: "uppercase", fontSize: "0.7rem" }}
        >
          {m.move_type === "move_in" ? "📥 Move-In" : "📤 Move-Out"}
        </span>
      ),
    },
    {
      key: "scheduled_date",
      header: "Scheduled Date",
      render: (m) => formatDateTime(m.scheduled_at || m.scheduled_date || m.created_at),
    },
    {
      key: "status",
      header: "Review Status",
      render: (m) => <StatusBadge status={m.status} />,
    },
    {
      key: "actions",
      header: "Action",
      render: (m) => (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {m.status === "requested" || m.status === "scheduled" ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
              onClick={() => setSelectedMove(m)}
            >
              Review &amp; Decide
            </button>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic" }}>
              {m.status}
            </span>
          )}
        </div>
      ),
    },
  ];

  const filteredResidents = residents?.filter((r) => {
    const matchesSearch =
      r.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.unit_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const status = r.status || (r as any).profile_status;
    const matchesStatus = !statusFilter || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingApprovalsCount =
    moveRecords?.filter((m) => m.status === "requested" || m.status === "scheduled").length || 0;

  const resetAddForm = () => {
    setTargetUnitId(communityUnits?.[0]?.id || "");
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setOccupancyRole("primary_owner");
    setIsPrimary(true);
    setAgreementRef("");
    setAddError("");
  };

  const handleOpenAddResident = () => {
    resetAddForm();
    setIsAddResidentOpen(true);
  };

  const handleAddResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) {
      setAddError("Active community required.");
      return;
    }
    if (!targetUnitId) {
      setAddError("Please select a residential unit.");
      return;
    }
    if (!fullName.trim() || !email.trim()) {
      setAddError("Full name and email are required.");
      return;
    }

    setAddError("");
    setIsAdding(true);
    try {
      await addResidentMutation.mutateAsync({
        communityId: activeCommunityId,
        data: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password: password.trim() || undefined,
          unit_id: targetUnitId,
          occupancy_role: occupancyRole,
          is_primary: isPrimary,
          agreement_reference: agreementRef.trim() || undefined,
        },
      });
      setIsAddResidentOpen(false);
      refetchResidents();
    } catch (err: any) {
      setAddError(err?.message || "Failed to onboard resident.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <PageHeader
        title="Residents &amp; Occupancy"
        description="Resident profiles, family members, emergency contacts, and move-in/out gate approval workflows."
        action={
          <button type="button" className="btn btn-primary" onClick={handleOpenAddResident}>
            👤 + Onboard Resident
          </button>
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "directory" ? 700 : 500,
            color: activeTab === "directory" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "directory" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          👥 Resident Directory ({residents?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("approvals")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "approvals" ? 700 : 500,
            color: activeTab === "approvals" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "approvals" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>📦 Move Approvals</span>
          {pendingApprovalsCount > 0 && (
            <span
              style={{
                background: "#f59e0b",
                color: "white",
                fontSize: "0.7rem",
                padding: "0.1rem 0.45rem",
                borderRadius: "var(--radius-full)",
                fontWeight: 700,
              }}
            >
              {pendingApprovalsCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "directory" && (
        <div>
          <FilterPanel
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search resident by name, email, or unit..."
            filterValue={statusFilter}
            onFilterChange={setStatusFilter}
            filterLabel="Status"
            filterOptions={[
              { label: "Active", value: "active" },
              { label: "Pending", value: "pending" },
              { label: "Moved Out", value: "moved_out" },
            ]}
          />

          <DataTable
            columns={residentColumns}
            data={filteredResidents as (ResidentProfile & Record<string, unknown>)[]}
            isLoading={residentsLoading}
            emptyTitle="No residents found"
            emptyDescription="No resident profiles matching your filter criteria."
          />
        </div>
      )}

      {activeTab === "approvals" && (
        <div>
          <DataTable
            columns={moveColumns}
            data={moveRecords as (MoveRecord & Record<string, unknown>)[]}
            isLoading={movesLoading}
            emptyTitle="No move records"
            emptyDescription="All resident move-in and move-out applications have been processed."
          />
        </div>
      )}

      {/* Resident Profile Details Modal */}
      <Modal
        isOpen={Boolean(selectedResident)}
        onClose={() => setSelectedResident(null)}
        title={
          selectedResident ? `Resident Profile: ${selectedResident.full_name}` : "Resident Details"
        }
      >
        {selectedResident && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Occupancy Type</div>
                <div style={{ fontWeight: 600, textTransform: "capitalize", marginTop: "0.2rem" }}>
                  {selectedResident.resident_type?.replace("_", " ")}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Assigned Unit</div>
                <div style={{ fontWeight: 600, marginTop: "0.2rem" }}>
                  Unit {selectedResident.unit_number || "–"} ({selectedResident.tower_name || "–"})
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Email</div>
                <div style={{ fontWeight: 500, marginTop: "0.2rem" }}>
                  {selectedResident.email || "–"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Phone</div>
                <div style={{ fontWeight: 500, marginTop: "0.2rem" }}>
                  {selectedResident.phone || "–"}
                </div>
              </div>
            </div>

            {/* Emergency Contacts */}
            <div>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                🚨 Emergency Contacts
              </h4>
              {contacts && contacts.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: "0.5rem 0.75rem",
                        background: "#ffffff",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        <strong>{c.name}</strong> ({c.relationship})
                      </span>
                      <span style={{ color: "var(--primary)" }}>📞 {c.phone}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>
                  No emergency contacts registered.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Move Decision Modal */}
      <Modal
        isOpen={Boolean(selectedMove)}
        onClose={() => setSelectedMove(null)}
        title="Review Resident Move Application"
      >
        {selectedMove && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}
              >
                <span>
                  <strong>Applicant:</strong> {selectedMove.resident_name || "Resident"}
                </span>
                <StatusBadge status={selectedMove.status} />
              </div>
              <div>
                <strong>Unit:</strong> Unit {selectedMove.unit_number || "—"} (
                {selectedMove.tower_name || "Tower"})
              </div>
              <div style={{ marginTop: "0.25rem" }}>
                <strong>Move Type:</strong>{" "}
                {selectedMove.move_type === "move_in" ? "Move-In" : "Move-Out"}
              </div>
              <div style={{ marginTop: "0.25rem" }}>
                <strong>Scheduled Date:</strong>{" "}
                {formatDateTime(
                  selectedMove.scheduled_at ||
                    selectedMove.scheduled_date ||
                    selectedMove.created_at,
                )}
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.35rem",
                }}
              >
                Administrative Remarks / Clearance Notes
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Optional comments regarding gate pass, security deposit, or clearance..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedMove(null)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleDecision(selectedMove.id, "rejected")}
                disabled={isProcessing}
              >
                Reject Request
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleDecision(selectedMove.id, "approved")}
                disabled={isProcessing}
              >
                {isProcessing ? "Processing…" : "Approve & Issue Gate Pass"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Onboard Resident Modal */}
      <Modal
        isOpen={isAddResidentOpen}
        onClose={() => setIsAddResidentOpen(false)}
        title="👤 Onboard New Resident"
      >
        <form onSubmit={handleAddResidentSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {addError && (
              <div
                style={{
                  padding: "0.6rem 0.8rem",
                  background: "#fee2e2",
                  border: "1px solid #f87171",
                  borderRadius: "6px",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {addError}
              </div>
            )}

            {/* Unit Selection */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                Target Residential Unit <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                className="input"
                value={targetUnitId}
                onChange={(e) => setTargetUnitId(e.target.value)}
                required
                style={{ width: "100%" }}
              >
                <option value="">Select Unit...</option>
                {communityUnits && communityUnits.length > 0 ? (
                  communityUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unit_number} {u.unit_type ? `(${u.unit_type})` : ""} {u.sq_ft ? `• ${u.sq_ft} sqft` : ""}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No units found in community
                  </option>
                )}
              </select>
            </div>

            {/* Name & Email */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Full Name <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ananya Patel"
                  required
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Email Address <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. ananya@example.com"
                  required
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Phone & Password */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Initial Password (Optional)
                </label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Auto-generated if blank"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Occupancy Role & Primary Status */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", alignItems: "center" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                  Occupancy Role
                </label>
                <select
                  className="input"
                  value={occupancyRole}
                  onChange={(e) => setOccupancyRole(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="primary_owner">Primary Owner</option>
                  <option value="secondary_owner">Secondary Owner / Co-Owner</option>
                  <option value="tenant">Tenant / Renter</option>
                  <option value="family">Family Member</option>
                  <option value="occupant">Occupant</option>
                </select>
              </div>
              <div style={{ paddingTop: "1.2rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                  />
                  <span>Primary Unit Contact</span>
                </label>
              </div>
            </div>

            {/* Agreement Reference */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem" }}>
                Agreement Reference (Optional)
              </label>
              <input
                type="text"
                className="input"
                value={agreementRef}
                onChange={(e) => setAgreementRef(e.target.value)}
                placeholder="e.g. LEASE-2026-081"
                style={{ width: "100%" }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddResidentOpen(false)}
                disabled={isAdding}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isAdding || !targetUnitId}
              >
                {isAdding ? "Onboarding..." : "👤 Register Resident"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
