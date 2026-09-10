"use client";

import { useState } from "react";
import Link from "next/link";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails } from "@/hooks/use-communities";
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

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert("Please enter a title for the assessment project.");
      return;
    }
    const cid = activeCommunityId || community?.id;
    if (!cid) {
      alert("Please select a community first.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        payload: {
          community_id: cid,
          title: newTitle.trim(),
          purpose: newPurpose,
          description: newDescription.trim(),
          target_amount: newTargetAmount,
          affected_units_count: newUnitsCount,
          per_unit_amount: computedPerUnit,
          effective_date: newEffectiveDate,
          due_date: newDueDate,
        },
        communityId: cid,
      });

      setIsCreateModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      alert("Special assessment proposed successfully and submitted for committee review.");
    } catch (err) {
      console.error("Failed to create assessment", err);
      alert("Failed to submit assessment proposal. Please try again.");
    }
  };

  const handleApprove = async () => {
    if (!selectedAssessment) return;
    try {
      await approveMutation.mutateAsync({
        id: selectedAssessment.id,
        notes: reviewNotes,
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
      key: "target_amount",
      header: "Target Amount",
      align: "right",
      render: (item) => (
        <span style={{ fontWeight: 700 }}>
          {formatCurrency(parseFloat(item.target_amount || "0"))}
        </span>
      ),
    },
    {
      key: "per_unit_amount",
      header: "Per Unit",
      align: "right",
      render: (item) => formatCurrency(parseFloat(item.per_unit_amount || "0")),
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
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      header: "Action",
      align: "right",
      render: (item) => (
        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
          <Link
            href={`/association-committee/assessments/${item.id}`}
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem", height: 28 }}
          >
            View
          </Link>
          {item.status === "under_review" && (
            <button
              type="button"
              onClick={() => {
                setSelectedAssessment(item);
                setIsRejectMode(false);
              }}
              className="btn btn-primary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem", height: 28 }}
            >
              Review
            </button>
          )}
        </div>
      ),
    },
  ];

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
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
            style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            ➕ Propose Assessment
          </button>
        }
      />

      {/* Overview Notice */}
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
          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)" }}>
            Committee Approval Authority (PRD FR-09)
          </div>
          <p style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            The Association Committee evaluates CapEx projects, equipment overhauls, and exceptional
            infrastructure levies prior to unit billing.
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
            <option value="under_review">Awaiting Review</option>
            <option value="approved">Approved</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
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
          title={isRejectMode ? "Reject Special Assessment" : "Association Committee Review"}
          maxWidth={560}
          footer={
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                width: "100%",
                justifyContent: "space-between",
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
                {!isRejectMode ? (
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
                      {approveMutation.isPending ? "Approving..." : "Approve Assessment"}
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
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)" }}>
                {selectedAssessment.title}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                {selectedAssessment.purpose}
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
                <div style={{ fontWeight: 700, color: "var(--fg)" }}>
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
                  Project Description & Justification
                </label>
                <p
                  style={{
                    fontSize: "0.85rem",
                    marginTop: "0.25rem",
                    color: "var(--fg-secondary)",
                  }}
                >
                  {selectedAssessment.description}
                </p>
              </div>
            )}

            {!isRejectMode ? (
              <div>
                <label
                  style={{ fontSize: "0.775rem", fontWeight: 600, color: "var(--fg-secondary)" }}
                >
                  Committee Approval Notes (Optional)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Approved pursuant to AGM Resolution #4. Execution scheduled for Q4."
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
                  placeholder="Specify why this proposal is returned (e.g. Requires revised contractor quotes)."
                  className="input-field"
                  style={{
                    minHeight: 80,
                    marginTop: "0.25rem",
                    width: "100%",
                    borderColor: "#fca5a5",
                  }}
                />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Propose Special Assessment Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Propose Special Assessment"
          maxWidth={600}
        >
          <form onSubmit={handleCreateAssessment}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                    Target Budget ($) *
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
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", display: "block", marginBottom: "0.35rem" }}>
                  Project Description & Scope Justification
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
                  {createMutation.isPending ? "Submitting..." : "Submit for Committee Review"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
