"use client";

import { useState, useMemo, useEffect } from "react";
import { useUiStore } from "@/store/ui";
import {
  useResidents,
  useMoveRecords,
  useTransitionMoveRecord,
  useEmergencyContacts,
  useAddResident,
  useDeleteResident,
} from "@/hooks/use-residents";
import { useCommunityUnits, useTowers } from "@/hooks/use-communities";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterPanel } from "@/components/common/FilterPanel";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PasswordField } from "@/components/forms/PasswordField";
import type { ResidentProfile, MoveRecord } from "@/types/residents";
import { formatDateTime, generateInitialPassword, isValidPersonName } from "@/lib/utils";
import { onboardingApi } from "@/lib/api";
import { toast } from "@/store/toast";
import { UpdateUserCredentialsModal, type CredentialUser } from "@/components/common/UpdateUserCredentialsModal";

export default function CommunityAdminResidentsPage() {
  const { activeCommunityId } = useUiStore();
  const [activeTab, setActiveTab] = useState<"directory" | "approvals" | "invitations">("directory");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedResident, setSelectedResident] = useState<ResidentProfile | null>(null);
  const [credentialUser, setCredentialUser] = useState<CredentialUser | null>(null);

  // Add Resident Modal State
  const [isAddResidentOpen, setIsAddResidentOpen] = useState(false);
  const [targetTowerId, setTargetTowerId] = useState("");
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

  // Delete Resident State
  const [residentToDelete, setResidentToDelete] = useState<ResidentProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Invitations State
  const [invitations, setInvitations] = useState<any[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [isCreateInviteOpen, setIsCreateInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteTowerId, setInviteTowerId] = useState("");
  const [inviteUnitId, setInviteUnitId] = useState("");
  const [inviteRole, setInviteRole] = useState("primary_owner");
  const [inviteIsPrimary, setInviteIsPrimary] = useState(true);
  const [inviteMessage, setInviteMessage] = useState("");
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [selectedInvitation, setSelectedInvitation] = useState<any | null>(null);

  const [viewedInviteIds, setViewedInviteIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const stored = localStorage.getItem(
        `gatesphere_viewed_invites_${activeCommunityId || "default"}`,
      );
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    if (!activeCommunityId || typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(`gatesphere_viewed_invites_${activeCommunityId}`);
      if (stored) {
        setViewedInviteIds(new Set(JSON.parse(stored)));
      } else {
        setViewedInviteIds(new Set());
      }
    } catch {
      setViewedInviteIds(new Set());
    }
  }, [activeCommunityId]);

  const markInvitationAsViewed = (inviteId: string) => {
    setViewedInviteIds((prev) => {
      const updated = new Set(prev);
      updated.add(inviteId);
      if (typeof window !== "undefined" && activeCommunityId) {
        try {
          localStorage.setItem(
            `gatesphere_viewed_invites_${activeCommunityId}`,
            JSON.stringify(Array.from(updated)),
          );
        } catch {
          // Ignore localStorage errors
        }
      }
      return updated;
    });
  };

  const markAllInvitationsAsViewed = () => {
    setViewedInviteIds((prev) => {
      const updated = new Set(prev);
      invitations.forEach((i) => updated.add(i.id));
      if (typeof window !== "undefined" && activeCommunityId) {
        try {
          localStorage.setItem(
            `gatesphere_viewed_invites_${activeCommunityId}`,
            JSON.stringify(Array.from(updated)),
          );
        } catch {
          // Ignore
        }
      }
      return updated;
    });
    toast.success("All invitations marked as viewed.", "Updated");
  };

  const unviewedPendingCount = invitations.filter(
    (i) => i.status === "pending" && !viewedInviteIds.has(i.id),
  ).length;

  const fetchInvitations = async () => {
    if (!activeCommunityId) return;
    try {
      setInvitationsLoading(true);
      const list = await onboardingApi.listInvitations(activeCommunityId);
      setInvitations(Array.isArray(list) ? list : []);
    } catch {
      setInvitations([]);
    } finally {
      setInvitationsLoading(false);
    }
  };

  useEffect(() => {
    if (activeCommunityId) {
      fetchInvitations();
    }
  }, [activeCommunityId, activeTab]);

  // Queries
  const {
    data: residents,
    isLoading: residentsLoading,
    refetch: refetchResidents,
  } = useResidents({
    community_id: activeCommunityId || undefined,
  });

  const { data: towers } = useTowers(activeCommunityId || undefined);
  const { data: communityUnits } = useCommunityUnits(activeCommunityId || undefined);
  const addResidentMutation = useAddResident();
  const deleteResidentMutation = useDeleteResident();

  const {
    data: moveRecords,
    isLoading: movesLoading,
    refetch: refetchMoves,
  } = useMoveRecords({
    community_id: activeCommunityId || undefined,
  });

  const filteredUnits = useMemo(() => {
    if (!communityUnits) return [];
    if (!targetTowerId) return communityUnits;
    return communityUnits.filter((u) => u.tower_id === targetTowerId);
  }, [communityUnits, targetTowerId]);

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

  const handleDeleteResident = async () => {
    if (!residentToDelete) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteResidentMutation.mutateAsync(residentToDelete.id);
      setResidentToDelete(null);
      setSelectedResident(null);
      refetchResidents();
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete resident profile.");
    } finally {
      setIsDeleting(false);
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
        <div style={{ display: "flex", gap: "0.4rem" }}>
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
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", background: "#f8fafc" }}
            onClick={(e) => {
              e.stopPropagation();
              setCredentialUser({
                id: r.user_id || r.id,
                full_name: r.full_name,
                email: r.email || "",
                phone: r.phone || "",
                roleName: r.resident_type || "Resident",
              });
            }}
            title="Update Credentials"
          >
            🔑 Credentials
          </button>
        </div>
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
    setTargetTowerId("");
    setTargetUnitId("");
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("resident@Gate2026!");
    setOccupancyRole("primary_owner");
    setIsPrimary(true);
    setAgreementRef("");
    setAddError("");
    setResidentFieldErrors({});
  };

  const handleOpenAddResident = () => {
    resetAddForm();
    setIsAddResidentOpen(true);
  };

  const [residentFieldErrors, setResidentFieldErrors] = useState<Record<string, string>>({});

  const validateResidentForm = () => {
    const errors: Record<string, string> = {};
    if (!targetUnitId) {
      errors.targetUnitId = "Please select a residential unit.";
    }
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.fullName = "Resident full name must be at least 2 characters long.";
    } else if (!isValidPersonName(trimmedName)) {
      errors.fullName = "Name must contain only alphabetic letters and spaces.";
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }
    if (phone.trim() && !/^\+?[0-9\s\-()]{7,20}$/.test(phone.trim())) {
      errors.phone = "Invalid phone number format.";
    }
    if (password && password.trim().length < 10) {
      errors.password = "Initial password must be at least 10 characters.";
    }
    const trimmedAgreement = agreementRef.trim();
    if (trimmedAgreement) {
      if (trimmedAgreement.length < 3 || trimmedAgreement.length > 50) {
        errors.agreementRef = "Agreement reference must be between 3 and 50 characters.";
      } else if (!/^[A-Za-z0-9\-_/]+$/.test(trimmedAgreement)) {
        errors.agreementRef = "Agreement reference can only contain letters, numbers, hyphens, underscores, or slashes (e.g. LEASE-2026-081).";
      }
    }
    setResidentFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddResidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) {
      setAddError("Active community required.");
      return;
    }

    if (!validateResidentForm()) {
      setAddError("Please correct highlighted errors before onboarding resident.");
      return;
    }

    setAddError("");
    setIsAdding(true);
    try {
      const defaultPassword = generateInitialPassword(fullName, "resident");
      await addResidentMutation.mutateAsync({
        communityId: activeCommunityId,
        data: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          password: password.trim() || defaultPassword,
          unit_id: targetUnitId,
          occupancy_role: occupancyRole,
          is_primary: isPrimary,
          agreement_reference: agreementRef.trim() || undefined,
        },
      });
      setIsAddResidentOpen(false);
      setResidentFieldErrors({});
      toast.success(`Resident ${fullName.trim()} registered successfully!`, "Resident Onboarded");
      resetAddForm();
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

        <button
          type="button"
          onClick={() => setActiveTab("invitations")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "invitations" ? 700 : 500,
            color: activeTab === "invitations" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "invitations" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>📨 Resident Invitations</span>
          {unviewedPendingCount > 0 && (
            <span
              style={{
                background: "var(--primary)",
                color: "white",
                fontSize: "0.7rem",
                padding: "0.1rem 0.45rem",
                borderRadius: "var(--radius-full)",
                fontWeight: 700,
              }}
            >
              {unviewedPendingCount}
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
            enableClientPagination={true}
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
            enableClientPagination={true}
          />
        </div>
      )}

      {activeTab === "invitations" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>Active Resident Invitations</h3>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0.2rem 0 0 0" }}>
                Generate secure onboarding invitation links for new residents to join their unit.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {unviewedPendingCount > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "12px", padding: "0.4rem 0.75rem" }}
                  onClick={markAllInvitationsAsViewed}
                >
                  ✓ Mark All as Viewed
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setInviteError("");
                  setInviteEmail("");
                  setInvitePhone("");
                  setInviteFullName("");
                  setInviteTowerId("");
                  setInviteUnitId("");
                  setInviteRole("primary_owner");
                  setInviteIsPrimary(true);
                  setInviteMessage("");
                  setIsCreateInviteOpen(true);
                }}
              >
                ✉️ + Issue New Invitation
              </button>
            </div>
          </div>

          <DataTable
            columns={[
              {
                key: "invited_email",
                header: "Invited Resident",
                render: (row: any) => {
                  const isUnviewed = row.status === "pending" && !viewedInviteIds.has(row.id);
                  return (
                    <div
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        markInvitationAsViewed(row.id);
                        setSelectedInvitation(row);
                      }}
                      title="Click to view invitation details"
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <span style={{ color: isUnviewed ? "var(--primary)" : "inherit" }}>
                          {row.full_name || row.invited_email}
                        </span>
                        {isUnviewed && (
                          <span
                            style={{
                              background: "var(--primary)",
                              color: "white",
                              fontSize: "0.65rem",
                              padding: "0.05rem 0.35rem",
                              borderRadius: "var(--radius-full)",
                              fontWeight: 700,
                            }}
                          >
                            NEW
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {row.invited_email} {row.invited_phone ? `· ${row.invited_phone}` : ""}
                      </div>
                    </div>
                  );
                },
              },
              {
                key: "unit",
                header: "Target Unit",
                render: (row: any) => (
                  <span>
                    Unit {row.unit_number || "—"} ({row.tower_name || "Tower"})
                  </span>
                ),
              },
              {
                key: "occupancy_role",
                header: "Occupancy Role",
                render: (row: any) => (
                  <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>
                    {(row.occupancy_role || "resident").replace(/_/g, " ")}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row: any) => <StatusBadge status={row.status || "pending"} />,
              },
              {
                key: "actions",
                header: "Actions",
                render: (row: any) => (
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "12px", padding: "0.25rem 0.6rem" }}
                      onClick={() => {
                        markInvitationAsViewed(row.id);
                        setSelectedInvitation(row);
                      }}
                    >
                      👁️ View
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "12px", padding: "0.25rem 0.6rem" }}
                      onClick={() => {
                        markInvitationAsViewed(row.id);
                        const link = `${window.location.origin}/invitations/${row.token}`;
                        navigator.clipboard.writeText(link);
                        toast.success("Invitation activation link copied to clipboard!", "Copied");
                      }}
                    >
                      📋 Copy Link
                    </button>
                    {row.status === "pending" && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "12px", padding: "0.25rem 0.6rem", color: "#DC2626" }}
                        onClick={async () => {
                          try {
                            await onboardingApi.revokeInvitation(activeCommunityId!, row.id);
                            toast.success("Invitation revoked.", "Revoked");
                            fetchInvitations();
                          } catch (err: any) {
                            toast.error(err?.message || "Failed to revoke invitation", "Error");
                          }
                        }}
                      >
                        ✕ Revoke
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
            data={invitations}
            isLoading={invitationsLoading}
            emptyTitle="No invitations issued"
            emptyDescription="Click '+ Issue New Invitation' to invite an owner or tenant."
            enableClientPagination={true}
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

            {/* Danger Zone — Delete Profile */}
            <div
              style={{
                borderTop: "1px solid #fecaca",
                paddingTop: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div style={{ fontSize: "0.775rem", color: "#b91c1c" }}>
                ⚠️ Permanently removes this resident profile and portal access.
              </div>
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.85rem", flexShrink: 0 }}
                onClick={() => {
                  setResidentToDelete(selectedResident);
                }}
              >
                🗑️ Delete Profile
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Resident Confirmation Modal */}
      <Modal
        isOpen={Boolean(residentToDelete)}
        onClose={() => {
          setResidentToDelete(null);
          setDeleteError("");
        }}
        title="⚠️ Delete Resident Profile"
      >
        {residentToDelete && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Destructive Warning */}
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🗑️</span>
                <strong style={{ fontSize: "0.95rem", color: "#991b1b" }}>
                  This action is permanent and cannot be undone.
                </strong>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#7f1d1d", margin: 0, lineHeight: 1.5 }}>
                You are about to permanently delete the profile of{" "}
                <strong>{residentToDelete.full_name}</strong> (Unit{" "}
                {residentToDelete.unit_number || "–"}).
              </p>
              <p style={{ fontSize: "0.8rem", color: "#991b1b", margin: 0 }}>
                This will remove their portal access, visitor pre-approvals, and all associated records.
              </p>
            </div>

            {deleteError && (
              <div
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--radius-sm)",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setResidentToDelete(null);
                  setDeleteError("");
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteResident}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Yes, Delete Permanently"}
              </button>
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
        onClose={() => {
          setIsAddResidentOpen(false);
          setResidentFieldErrors({});
          setAddError("");
        }}
        title="👤 Onboard New Resident"
        maxWidth={640}
      >
        <form onSubmit={handleAddResidentSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Header Subtitle */}
            <p style={{ margin: 0, fontSize: "0.825rem", color: "#64748b" }}>
              Assign residential unit occupancy, resident contact credentials, and portal permissions.
            </p>

            {addError && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#991b1b",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>⚠️</span>
                <span>{addError}</span>
              </div>
            )}

            {/* SECTION 1: UNIT & TOWER ALLOCATION */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, fontSize: "0.825rem", color: "#334155" }}>
                <span>🏢</span> Location & Residential Unit
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                {/* Tower Selection */}
                <div>
                  <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    Tower / Block
                  </label>
                  <select
                    className="input-field"
                    value={targetTowerId}
                    onChange={(e) => {
                      setTargetTowerId(e.target.value);
                      setTargetUnitId("");
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="">All Towers ({towers?.length || 0})</option>
                    {towers?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code || `${t.total_floors} fl`})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unit Selection */}
                <div>
                  <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    Residential Unit <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    className="input-field"
                    value={targetUnitId}
                    onChange={(e) => setTargetUnitId(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: `1px solid ${residentFieldErrors.targetUnitId ? "#dc2626" : "#cbd5e1"}`,
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="">-- Choose Unit --</option>
                    {filteredUnits && filteredUnits.length > 0 ? (
                      filteredUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          Unit {u.unit_number} {u.unit_type ? `(${u.unit_type})` : ""} {u.sq_ft ? `• ${u.sq_ft} sqft` : ""}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        {targetTowerId ? "No units found in this tower" : "No units found in community"}
                      </option>
                    )}
                  </select>
                  {residentFieldErrors.targetUnitId && (
                    <span style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem", display: "block" }}>
                      {residentFieldErrors.targetUnitId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 2: RESIDENT PROFILE & CONTACT */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, fontSize: "0.825rem", color: "#334155" }}>
                <span>👤</span> Resident Identity &amp; Contact
              </div>

              {/* Name & Email */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    Full Name <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={fullName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFullName(val);
                      setPassword(generateInitialPassword(val, "resident"));
                    }}
                    placeholder="e.g. Ananya Patel"
                    required
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: `1px solid ${residentFieldErrors.fullName ? "#dc2626" : "#cbd5e1"}`,
                    }}
                  />
                  {residentFieldErrors.fullName && (
                    <span style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem", display: "block" }}>
                      {residentFieldErrors.fullName}
                    </span>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    Email Address <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. ananya@example.com"
                    required
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: `1px solid ${residentFieldErrors.email ? "#dc2626" : "#cbd5e1"}`,
                    }}
                  />
                  {residentFieldErrors.email && (
                    <span style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem", display: "block" }}>
                      {residentFieldErrors.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Phone & Password */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="input-field"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: `1px solid ${residentFieldErrors.phone ? "#dc2626" : "#cbd5e1"}`,
                    }}
                  />
                  {residentFieldErrors.phone && (
                    <span style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem", display: "block" }}>
                      {residentFieldErrors.phone}
                    </span>
                  )}
                </div>
                <div>
                  <PasswordField
                    value={password}
                    onChange={(val) => {
                      setPassword(val);
                      if (residentFieldErrors.password) {
                        setResidentFieldErrors((prev) => {
                          const n = { ...prev };
                          delete n.password;
                          return n;
                        });
                      }
                    }}
                    error={residentFieldErrors.password}
                    placeholder="e.g. ananya@Gate2026!"
                  />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)" }}>
                💡 Providing credentials allows this resident to sign in to the <strong>Resident Portal</strong> to approve visitors, receive delivery alerts, and book amenities.
              </p>
            </div>

            {/* SECTION 3: OCCUPANCY & ROLES */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 600, fontSize: "0.825rem", color: "#334155" }}>
                <span>📋</span> Occupancy Role &amp; Details
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    Occupancy Role <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    className="input-field"
                    value={occupancyRole}
                    onChange={(e) => setOccupancyRole(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <option value="primary_owner">Primary Owner</option>
                    <option value="secondary_owner">Secondary Owner / Co-Owner</option>
                    <option value="tenant">Tenant / Renter</option>
                    <option value="family">Family Member</option>
                    <option value="occupant">Occupant</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#475569", marginBottom: "0.35rem" }}>
                    Agreement Reference (Optional)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={agreementRef}
                    aria-invalid={Boolean(residentFieldErrors.agreementRef)}
                    onChange={(e) => {
                      setAgreementRef(e.target.value);
                      if (residentFieldErrors.agreementRef) {
                        setResidentFieldErrors((prev) => {
                          const n = { ...prev };
                          delete n.agreementRef;
                          return n;
                        });
                      }
                    }}
                    placeholder="e.g. LEASE-2026-081"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.85rem",
                      borderRadius: "6px",
                      border: `1px solid ${residentFieldErrors.agreementRef ? "#dc2626" : "#cbd5e1"}`,
                    }}
                  />
                  {residentFieldErrors.agreementRef && (
                    <span style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem", display: "block" }}>
                      {residentFieldErrors.agreementRef}
                    </span>
                  )}
                </div>
              </div>

              {/* Primary Contact Checkbox Box */}
              <div
                style={{
                  background: isPrimary ? "#f0fdf4" : "#f8fafc",
                  border: isPrimary ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onClick={() => setIsPrimary(!isPrimary)}
              >
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  style={{ marginTop: "0.2rem", cursor: "pointer", accentColor: "#16a34a" }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div>
                  <div style={{ fontSize: "0.825rem", fontWeight: 600, color: isPrimary ? "#166534" : "#334155" }}>
                    Primary Unit Contact
                  </div>
                  <div style={{ fontSize: "0.75rem", color: isPrimary ? "#15803d" : "#64748b", marginTop: "0.1rem" }}>
                    Receives all visitor approvals, entry alerts, delivery checkpoints, and invoices for this unit.
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem", marginTop: "0.25rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddResidentOpen(false)}
                disabled={isAdding}
                style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isAdding}
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "var(--primary, #2563eb)",
                  color: "#ffffff",
                  fontWeight: 600,
                  borderRadius: "6px",
                }}
              >
                {isAdding ? "Registering..." : "👤 Register Resident"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Issue Resident Invitation Modal */}
      <Modal
        isOpen={isCreateInviteOpen}
        onClose={() => {
          setIsCreateInviteOpen(false);
          setInviteError("");
        }}
        title="📨 Issue Resident Invitation"
        maxWidth={580}
      >
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!activeCommunityId) return;
            if (!inviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
              setInviteError("Please enter a valid email address.");
              return;
            }
            if (invitePhone.trim() && !/^\+?[0-9\s\-()]{7,20}$/.test(invitePhone.trim())) {
              setInviteError("Please enter a valid phone number (e.g. +91 98765 43210).");
              return;
            }
            if (inviteFullName.trim() && !isValidPersonName(inviteFullName.trim())) {
              setInviteError("Resident name must contain only alphabetic letters and spaces.");
              return;
            }
            if (!inviteUnitId) {
              setInviteError("Please select an assigned residential unit.");
              return;
            }

            try {
              setIsCreatingInvite(true);
              setInviteError("");
              const res = await onboardingApi.createInvitation(activeCommunityId, {
                invited_email: inviteEmail.trim().toLowerCase(),
                invited_phone: invitePhone.trim() || undefined,
                full_name: inviteFullName.trim() || undefined,
                unit_id: inviteUnitId,
                occupancy_role: inviteRole,
                is_primary: inviteIsPrimary,
                message: inviteMessage.trim() || undefined,
              });

              setIsCreateInviteOpen(false);
              toast.success("Resident invitation issued.", "Invitation Created");
              if (res?.token) {
                const link = `${window.location.origin}/invitations/${res.token}`;
                navigator.clipboard.writeText(link);
                toast.success("Activation link copied to clipboard!", "Link Copied");
              }
              fetchInvitations();
            } catch (err: any) {
              setInviteError(err?.message || "Failed to create invitation.");
            } finally {
              setIsCreatingInvite(false);
            }
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p style={{ margin: 0, fontSize: "0.825rem", color: "#64748b" }}>
              Send an onboarding invitation link for a new owner or tenant to register their account.
            </p>

            {inviteError && (
              <div
                style={{
                  padding: "0.6rem 0.8rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  color: "#991b1b",
                  fontSize: "0.8rem",
                }}
              >
                ⚠️ {inviteError}
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
                Invited Email Address *
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="resident@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
                  Resident Full Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. John Doe"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="e.g. +91 98765 43210"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
                  Filter Tower
                </label>
                <select
                  className="select-field"
                  value={inviteTowerId}
                  onChange={(e) => {
                    setInviteTowerId(e.target.value);
                    setInviteUnitId("");
                  }}
                >
                  <option value="">All Towers</option>
                  {towers?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
                  Target Unit *
                </label>
                <select
                  className="select-field"
                  value={inviteUnitId}
                  onChange={(e) => setInviteUnitId(e.target.value)}
                  required
                >
                  <option value="">Select Unit</option>
                  {(inviteTowerId
                    ? (communityUnits || []).filter((u) => u.tower_id === inviteTowerId)
                    : (communityUnits || [])
                  ).map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unit_number}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
                  Occupancy Role
                </label>
                <select
                  className="select-field"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="primary_owner">Primary Owner</option>
                  <option value="secondary_owner">Co-Owner</option>
                  <option value="tenant">Tenant</option>
                  <option value="family">Family</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "1.2rem" }}>
                <input
                  type="checkbox"
                  id="inviteIsPrimary"
                  checked={inviteIsPrimary}
                  onChange={(e) => setInviteIsPrimary(e.target.checked)}
                />
                <label htmlFor="inviteIsPrimary" style={{ fontSize: "13px", fontWeight: 600, color: "#334155", cursor: "pointer" }}>
                  Primary Contact for Unit
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.775rem", fontWeight: 600, color: "#334155", marginBottom: "0.35rem" }}>
                Welcome Note (Optional)
              </label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="Welcome to our community! Please complete your registration using this link."
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsCreateInviteOpen(false)}
                disabled={isCreatingInvite}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isCreatingInvite || !inviteUnitId}
              >
                {isCreatingInvite ? "Issuing..." : "✉️ Issue Invitation"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Update Credentials Modal */}
      <UpdateUserCredentialsModal
        isOpen={Boolean(credentialUser)}
        onClose={() => setCredentialUser(null)}
        user={credentialUser}
        onSuccess={() => refetchResidents()}
      />

      {/* Resident Invitation Details Modal */}
      <Modal
        isOpen={Boolean(selectedInvitation)}
        onClose={() => setSelectedInvitation(null)}
        title={
          selectedInvitation
            ? `Invitation: ${selectedInvitation.full_name || selectedInvitation.invited_email}`
            : "Resident Invitation Details"
        }
      >
        {selectedInvitation && (
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
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Invited Resident</div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", marginTop: "0.2rem" }}>
                  {selectedInvitation.full_name || "–"}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                  {selectedInvitation.invited_email}
                  {selectedInvitation.invited_phone ? ` · ${selectedInvitation.invited_phone}` : ""}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Status</div>
                <div style={{ marginTop: "0.2rem" }}>
                  <StatusBadge status={selectedInvitation.status || "pending"} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Target Unit</div>
                <div style={{ fontWeight: 600, marginTop: "0.2rem" }}>
                  Unit {selectedInvitation.unit_number || "–"}{" "}
                  ({selectedInvitation.tower_name || "Tower"})
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Occupancy Role</div>
                <div style={{ fontWeight: 600, textTransform: "capitalize", marginTop: "0.2rem" }}>
                  {(selectedInvitation.occupancy_role || "resident").replace(/_/g, " ")}
                  {selectedInvitation.is_primary ? " (Primary)" : ""}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Expires At</div>
                <div style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}>
                  {selectedInvitation.expires_at
                    ? formatDateTime(selectedInvitation.expires_at)
                    : "–"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Created On</div>
                <div style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}>
                  {selectedInvitation.created_at
                    ? formatDateTime(selectedInvitation.created_at)
                    : "–"}
                </div>
              </div>
            </div>

            {/* Invitation Link Section */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
                🔗 Secure Onboarding Invitation URL
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  readOnly
                  className="input-field"
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}/invitations/${selectedInvitation.token}`
                      : `/invitations/${selectedInvitation.token}`
                  }
                  style={{ flex: 1, fontSize: "0.8rem", background: "#f8fafc" }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flexShrink: 0 }}
                  onClick={() => {
                    const link = `${window.location.origin}/invitations/${selectedInvitation.token}`;
                    navigator.clipboard.writeText(link);
                    toast.success("Invitation link copied to clipboard!", "Copied");
                  }}
                >
                  📋 Copy Link
                </button>
              </div>
            </div>

            {selectedInvitation.message && (
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Personal Welcome Note
                </div>
                <div
                  style={{
                    padding: "0.75rem",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    fontStyle: "italic",
                    border: "1px solid var(--border)",
                  }}
                >
                  &ldquo;{selectedInvitation.message}&rdquo;
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid var(--border)",
                paddingTop: "1rem",
              }}
            >
              <div>
                {selectedInvitation.status === "pending" && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ color: "#DC2626", borderColor: "#fecaca" }}
                    onClick={async () => {
                      if (confirm("Are you sure you want to revoke this invitation?")) {
                        try {
                          await onboardingApi.revokeInvitation(
                            activeCommunityId!,
                            selectedInvitation.id,
                          );
                          toast.success("Invitation revoked successfully.", "Revoked");
                          setSelectedInvitation(null);
                          fetchInvitations();
                        } catch (err: any) {
                          toast.error(err?.message || "Failed to revoke invitation", "Error");
                        }
                      }
                    }}
                  >
                    ✕ Revoke Invitation
                  </button>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedInvitation(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
