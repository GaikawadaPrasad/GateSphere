"use client";

import { useState } from "react";
import Link from "next/link";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails } from "@/hooks/use-communities";
import { useMe } from "@/hooks/use-auth";
import {
  useSpecialAssessments,
  useCreateAssessment,
  useApproveAssessment,
  useRejectAssessment,
} from "@/hooks/use-governance";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SpecialAssessment } from "@/types/governance";

export default function SpecialAssessmentsPage() {
  const { activeCommunityId } = useUiStore();
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);
  const { data: currentUser } = useMe();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Selected assessment for review modal
  const [selectedAssessment, setSelectedAssessment] = useState<SpecialAssessment | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectMode, setIsRejectMode] = useState(false);

  // New Assessment Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPurpose, setNewPurpose] = useState("CapEx Infrastructure");
  const [newDescription, setNewDescription] = useState("");
  const [newTargetAmount, setNewTargetAmount] = useState("25000");
  const [newUnitsCount, setNewUnitsCount] = useState(120);
  const [newProposerDepartment, setNewProposerDepartment] = useState("Facility Operations & Maintenance");
  const [newProposerName, setNewProposerName] = useState("");
  const [newEffectiveDate, setNewEffectiveDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  );
  const [newDueDate, setNewDueDate] = useState(
    new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10)
  );

  const { data: assessments, isLoading } = useSpecialAssessments({
    community_id: activeCommunityId,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const createMutation = useCreateAssessment();
  const approveMutation = useApproveAssessment();
  const rejectMutation = useRejectAssessment();

  const computedPerUnit = Math.max(
    parseFloat(newTargetAmount || "0") / Math.max(newUnitsCount || 1, 1),
    0
  ).toFixed(2);

  const [assessmentFieldErrors, setAssessmentFieldErrors] = useState<Record<string, string>>({});

  const validateAssessmentForm = () => {
    const errors: Record<string, string> = {};
    if (!newTitle.trim() || newTitle.trim().length < 3) {
      errors.title = "Project title must be at least 3 characters long.";
    }
    const amt = parseFloat(newTargetAmount || "0");
    if (isNaN(amt) || amt <= 0) {
      errors.targetAmount = "Target budget must be a positive number.";
    }
    if (!newUnitsCount || newUnitsCount < 1) {
      errors.unitsCount = "Units count must be at least 1.";
    }
    if (newEffectiveDate && newDueDate && new Date(newDueDate) < new Date(newEffectiveDate)) {
      errors.dueDate = "Due date cannot be earlier than effective start date.";
    }
    setAssessmentFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cid = activeCommunityId || community?.id;
    if (!cid) {
      alert("Please select a community first.");
      return;
    }

    if (!validateAssessmentForm()) return;

    try {
      await createMutation.mutateAsync({
        payload: {
          title: newTitle.trim(),
          purpose: newPurpose,
          description: newDescription.trim(),
          target_amount: newTargetAmount,
          affected_units_count: newUnitsCount,
          per_unit_amount: computedPerUnit,
          effective_date: newEffectiveDate,
          due_date: newDueDate,
          proposed_by_user_id: currentUser?.id,
          proposed_by_name: newProposerName.trim() || currentUser?.full_name || "Facility Operations",
          proposer_department: newProposerDepartment,
          proposer_role: currentUser?.active_role || "facility_manager",
        },
        communityId: cid,
      });

      setIsCreateModalOpen(false);
      setAssessmentFieldErrors({});
      setNewTitle("");
      setNewDescription("");
      setNewProposerName("");
      alert("Special assessment proposed successfully and submitted for committee review.");
    } catch (err) {
      console.error("Failed to create assessment", err);
      alert("Failed to submit assessment proposal. Please try again.");
    }
  };

  const isSelfProposal = (item: SpecialAssessment) => {
    if (!currentUser) return false;
    if (item.proposed_by_user_id && item.proposed_by_user_id === currentUser.id) {
      return true;
    }
    if (
      item.proposed_by_name &&
      currentUser.full_name &&
      item.proposed_by_name.trim().toLowerCase() === currentUser.full_name.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  };

  const handleApprove = async () => {
    if (!selectedAssessment) return;
    if (isSelfProposal(selectedAssessment)) {
      alert("Maker-Checker Violation: You cannot approve your own proposal. Another committee member must review and approve.");
      return;
    }

    try {
      await approveMutation.mutateAsync({
        id: selectedAssessment.id,
        notes: reviewNotes,
        approved_by_user_id: currentUser?.id,
        approved_by_name: currentUser?.full_name || "Association Committee Executive",
      });
      setSelectedAssessment(null);
      setReviewNotes("");
      alert("Special assessment approved successfully by the Association Committee.");
    } catch {
      alert("Failed to approve special assessment. Please try again.");
    }
  };

  const handleReject = async () => {
    if (!selectedAssessment) return;
    try {
      await rejectMutation.mutateAsync({
        id: selectedAssessment.id,
        reason: rejectReason,
        rejected_by_user_id: currentUser?.id,
        rejected_by_name: currentUser?.full_name || "Association Committee Executive",
      });
      setSelectedAssessment(null);
      setIsRejectMode(false);
      setRejectReason("");
      alert("Special assessment returned with rejection notes.");
    } catch {
      alert("Failed to reject special assessment.");
    }
  };

  const filteredAssessments = (assessments || []).filter((a) => {
    if (statusFilter === "all") return true;
    return a.status === statusFilter;
  });

  const assessmentColumns: Column<SpecialAssessment>[] = [
    {
      key: "title",
      header: "Assessment Project",
      render: (item) => (
        <div>
          <Link
            href={`/association-committee/assessments/${item.id}`}
            style={{ fontWeight: 600, color: "var(--primary)", fontSize: "0.875rem" }}
          >
            {item.title}
          </Link>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            {item.purpose}
          </div>
        </div>
      ),
    },
    {
      key: "proposed_by_name",
      header: "Proposal Origin (Maker)",
      render: (item) => {
        const isSelf = isSelfProposal(item);
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ fontWeight: 600, color: "var(--fg)", fontSize: "0.825rem" }}>
                {item.proposed_by_name || "Facility Management"}
              </span>
              {isSelf && (
                <span
                  style={{
                    fontSize: "0.675rem",
                    padding: "0.1rem 0.35rem",
                    background: "#fef3c7",
                    color: "#92400e",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: 600,
                  }}
                >
                  You (Maker)
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.725rem", color: "var(--muted)" }}>
              {item.proposer_department || "Operations & Maintenance"}
            </div>
          </div>
        );
      },
    },
    {
      key: "target_amount",
      header: "Target Budget",
      align: "right",
      render: (item) => (
        <span style={{ fontWeight: 700, color: "var(--fg)" }}>
          {formatCurrency(parseFloat(item.target_amount || "0"))}
        </span>
      ),
    },
    {
      key: "per_unit_amount",
      header: "Per Unit",
      align: "right",
      render: (item) => (
        <span style={{ fontWeight: 600, color: "#2563eb" }}>
          {formatCurrency(parseFloat(item.per_unit_amount || "0"))}
        </span>
      ),
    },
    {
      key: "amount_collected",
      header: "Collected",
      align: "right",
      render: (item) => {
        const target = parseFloat(item.target_amount || "0");
        const collected = parseFloat(item.amount_collected || "0");
        const pct = target > 0 ? Math.min(Math.round((collected / target) * 100), 100) : 0;
        return (
          <div>
            <span style={{ color: "#059669", fontWeight: 600 }}>{formatCurrency(collected)}</span>
            <span style={{ fontSize: "0.725rem", color: "var(--muted)", marginLeft: "0.25rem" }}>
              ({pct}%)
            </span>
          </div>
        );
      },
    },
    {
      key: "effective_date",
      header: "Effective Date",
      render: (item) => (item.effective_date ? formatDate(item.effective_date) : "–"),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <div>
          <StatusBadge status={item.status} />
          {item.approved_by_name && item.status === "approved" && (
            <div style={{ fontSize: "0.7rem", color: "#059669", marginTop: "0.15rem" }}>
              ✓ By {item.approved_by_name}
            </div>
          )}
          {item.rejected_by_name && item.status === "rejected" && (
            <div style={{ fontSize: "0.7rem", color: "#dc2626", marginTop: "0.15rem" }}>
              ✕ By {item.rejected_by_name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Committee Action",
      align: "right",
      render: (item) => {
        const isSelf = isSelfProposal(item);
        return (
          <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", alignItems: "center" }}>
            <Link
              href={`/association-committee/assessments/${item.id}`}
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem", height: 28 }}
            >
              View
            </Link>
            {item.status === "under_review" && (
              isSelf ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssessment(item);
                    setIsRejectMode(false);
                  }}
                  className="btn btn-secondary"
                  title="Maker-Checker Rule: You proposed this assessment. Another committee member must approve it."
                  style={{
                    fontSize: "0.725rem",
                    padding: "0.25rem 0.55rem",
                    height: 28,
                    background: "#fef3c7",
                    borderColor: "#fde68a",
                    color: "#92400e",
                  }}
                >
                  👁️ View (Self-Made)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssessment(item);
                    setIsRejectMode(false);
                  }}
                  className="btn btn-primary"
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem", height: 28 }}
                >
                  ⚖️ Review & Vote
                </button>
              )
            )}
          </div>
        );
      },
    },
  ];

  const isSelectedSelf = selectedAssessment ? isSelfProposal(selectedAssessment) : false;

  return (
    <div>
      <PageHeader
        title="Special Assessments Governance"
        subtitle={`CapEx and special community levy approvals for ${community?.name || "Governance Scope"}`}
        breadcrumbs={[
          { label: "Association Committee", href: "/association-committee/governance" },
          { label: "Special Assessments" },
        ]}
        actions={
          <button
            type="button"
            onClick={() => {
              setNewProposerName(currentUser?.full_name || "");
              setIsCreateModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            ➕ Propose Assessment
          </button>
        }
      />

      {/* Governance & Maker-Checker Notice */}
      <div
        style={{
          background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--fg)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span>⚖️</span> Maker-Checker Governance & Committee Approval Authority (PRD FR-09)
          </div>
          <p style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.2rem", maxWidth: 750 }}>
            CapEx projects and special infrastructure levies are initiated by Facility Management or Operations, and require formal sign-off by the Association Committee. <strong>Segregation of Duties:</strong> A proposer cannot approve their own assessment proposal.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-field"
            style={{ width: "auto", fontSize: "0.8rem", height: 34 }}
          >
            <option value="all">All Statuses</option>
            <option value="under_review">Awaiting Committee Vote</option>
            <option value="approved">Approved & Active</option>
            <option value="active">In Collection</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected / Returned</option>
          </select>
        </div>
      </div>

      {/* Assessments DataTable */}
      <div className="card">
        <DataTable<SpecialAssessment & Record<string, unknown>>
          columns={
            assessmentColumns as unknown as Column<SpecialAssessment & Record<string, unknown>>[]
          }
          data={filteredAssessments as unknown as (SpecialAssessment & Record<string, unknown>)[]}
          isLoading={isLoading}
          emptyTitle="No assessments found"
          emptyDescription="No special assessment records match the current criteria."
        />
      </div>

      {/* Committee Review & Approval Modal */}
      {selectedAssessment && (
        <Modal
          isOpen={Boolean(selectedAssessment)}
          onClose={() => {
            setSelectedAssessment(null);
            setIsRejectMode(false);
          }}
          title={isRejectMode ? "Reject / Return Special Assessment" : "Association Committee Governance Review"}
          maxWidth={600}
          footer={
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                width: "100%",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedAssessment(null);
                  setIsRejectMode(false);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                {isSelectedSelf ? (
                  <div style={{ fontSize: "0.775rem", color: "#92400e", fontWeight: 600, display: "flex", alignItems: "center" }}>
                    🔒 Self-approval restricted per Maker-Checker policy
                  </div>
                ) : !isRejectMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRejectMode(true)}
                      className="btn btn-danger"
                    >
                      Reject Proposal
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                      className="btn btn-primary"
                    >
                      {approveMutation.isPending ? "Approving..." : "✅ Approve Assessment"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRejectMode(false)}
                      className="btn btn-secondary"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={rejectMutation.isPending}
                      className="btn btn-danger"
                    >
                      {rejectMutation.isPending ? "Submitting..." : "Confirm Rejection"}
                    </button>
                  </>
                )}
              </div>
            </div>
          }
        >
          <div>
            {/* Maker-Checker Warning when viewing self-proposed item */}
            {isSelectedSelf && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.75rem 1rem",
                  marginBottom: "1rem",
                  fontSize: "0.825rem",
                  color: "#92400e",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "0.2rem" }}>
                  ⚠️ Segregation of Duties (Maker-Checker Policy)
                </div>
                You submitted this special assessment proposal. Enterprise statutory standards prohibit a single person from both proposing and accepting a financial levy. Another Association Committee member or the President must review and approve this proposal.
              </div>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)" }}>
                {selectedAssessment.title}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                {selectedAssessment.purpose}
              </div>
            </div>

            {/* Proposer Info Card */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.6rem 0.85rem",
                background: "#f1f5f9",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                marginBottom: "1rem",
                fontSize: "0.8rem",
              }}
            >
              <div>
                <span style={{ color: "var(--muted)" }}>Proposed By: </span>
                <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                  {selectedAssessment.proposed_by_name || "Facility Operations"}
                </span>
                <span style={{ color: "var(--muted)", marginLeft: "0.35rem" }}>
                  ({selectedAssessment.proposer_department || "Management"})
                </span>
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                Submitted: {formatDate(selectedAssessment.created_at)}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                padding: "0.85rem",
                background: "#f8fafc",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}
            >
              <div>
                <span style={{ color: "var(--muted)" }}>Target Budget:</span>
                <div style={{ fontWeight: 700, color: "var(--fg)" }}>
                  {formatCurrency(parseFloat(selectedAssessment.target_amount || "0"))}
                </div>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Per Unit Assessment:</span>
                <div style={{ fontWeight: 700, color: "#2563eb" }}>
                  {formatCurrency(parseFloat(selectedAssessment.per_unit_amount || "0"))}
                </div>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Target Units:</span>
                <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                  {selectedAssessment.affected_units_count || 0} Units
                </div>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Effective Date:</span>
                <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                  {formatDate(selectedAssessment.effective_date)}
                </div>
              </div>
            </div>

            {selectedAssessment.description && (
              <div style={{ marginBottom: "1rem" }}>
                <label
                  style={{ fontSize: "0.775rem", fontWeight: 600, color: "var(--fg-secondary)" }}
                >
                  Project Scope & Scope Justification
                </label>
                <p
                  style={{
                    fontSize: "0.85rem",
                    marginTop: "0.25rem",
                    color: "var(--fg-secondary)",
                    lineHeight: 1.5,
                  }}
                >
                  {selectedAssessment.description}
                </p>
              </div>
            )}

            {!isSelectedSelf && (
              !isRejectMode ? (
                <div>
                  <label
                    style={{ fontSize: "0.775rem", fontWeight: 600, color: "var(--fg-secondary)" }}
                  >
                    Committee Approval Resolution Notes (e.g. AGM Resolution #)
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="e.g. Approved pursuant to AGM Resolution #4. Scheduled for next billing cycle."
                    className="input-field"
                    style={{ minHeight: 80, marginTop: "0.25rem", width: "100%" }}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: "0.775rem", fontWeight: 600, color: "#dc2626" }}>
                    Reason for Rejection / Modification Request
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Specify why this proposal is returned (e.g. Requires revised contractor quotes or scope adjustment)."
                    className="input-field"
                    style={{
                      minHeight: 80,
                      marginTop: "0.25rem",
                      width: "100%",
                      borderColor: "#fca5a5",
                    }}
                  />
                </div>
              )
            )}
          </div>
        </Modal>
      )}

      {/* Propose Special Assessment Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Propose CapEx / Special Assessment"
          maxWidth={620}
        >
          <form onSubmit={handleCreateAssessment}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.65rem 0.85rem",
                  fontSize: "0.8rem",
                  color: "#166534",
                }}
              >
                <strong>Proposal Workflow:</strong> Submitting will enter the assessment into <em>Under Review</em> status. Per Maker-Checker governance, approval must be granted by another committee executive.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Initiating Department / Entity *
                  </label>
                  <select
                    value={newProposerDepartment}
                    onChange={(e) => setNewProposerDepartment(e.target.value)}
                    className="select-field"
                  >
                    <option value="Facility Operations & Maintenance">Facility Operations</option>
                    <option value="Engineering & Infrastructure Committee">Engineering Committee</option>
                    <option value="Managing Committee Executive">Managing Committee Board</option>
                    <option value="Security & Surveillance Committee">Security Committee</option>
                    <option value="Amenities & Landscaping Sub-committee">Amenities Committee</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Proposer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newProposerName}
                    onChange={(e) => setNewProposerName(e.target.value)}
                    placeholder="e.g. Alex Rivera (Facility Manager)"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                  Assessment Project Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Clubhouse Solar Panel Infrastructure"
                  className="input-field"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Category / Purpose *
                  </label>
                  <select
                    value={newPurpose}
                    onChange={(e) => setNewPurpose(e.target.value)}
                    className="select-field"
                  >
                    <option value="CapEx Infrastructure">CapEx Infrastructure</option>
                    <option value="Equipment Overhaul">Equipment Overhaul</option>
                    <option value="Security & Surveillance Upgrade">Security Upgrade</option>
                    <option value="Landscaping & Amenities">Amenities & Landscaping</option>
                    <option value="Structural & Safety Repairs">Structural & Safety</option>
                    <option value="Emergency Reserve Replenishment">Emergency Reserve</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Target Budget (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={newTargetAmount}
                    onChange={(e) => setNewTargetAmount(e.target.value)}
                    placeholder="e.g. 48000"
                    className="input-field"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Participating Units Count *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newUnitsCount}
                    onChange={(e) => setNewUnitsCount(parseInt(e.target.value, 10) || 1)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Per Unit Assessment
                  </label>
                  <div
                    style={{
                      height: 38,
                      padding: "0.6rem 0.85rem",
                      background: "#f1f5f9",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      fontWeight: 700,
                      color: "#2563eb",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {formatCurrency(parseFloat(computedPerUnit))} / unit
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Effective Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().slice(0, 10)}
                    value={newEffectiveDate}
                    onChange={(e) => setNewEffectiveDate(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    min={newEffectiveDate || new Date().toISOString().slice(0, 10)}
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                  Project Scope & Scope Justification
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide background, vendor quotation summaries, and AGM resolution context..."
                  className="input-field"
                  style={{ minHeight: 80, width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn btn-primary"
                >
                  {createMutation.isPending ? "Submitting..." : "Submit Proposal for Committee Review"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
