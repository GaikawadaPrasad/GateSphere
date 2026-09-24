"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUiStore } from "@/store/ui";
import { useMe } from "@/hooks/use-auth";
import {
  useSpecialAssessment,
  useApproveAssessment,
  useRejectAssessment,
} from "@/hooks/use-governance";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params?.assessmentId as string;
  const { activeCommunityId } = useUiStore();
  const { data: currentUser } = useMe();

  const { data: assessment, isLoading } = useSpecialAssessment(assessmentId, activeCommunityId);
  const approveMutation = useApproveAssessment();
  const rejectMutation = useRejectAssessment();

  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  const isSelfProposal =
    currentUser && assessment
      ? Boolean(
          (assessment.proposed_by_user_id && assessment.proposed_by_user_id === currentUser.id) ||
            (assessment.proposed_by_name &&
              currentUser.full_name &&
              assessment.proposed_by_name.trim().toLowerCase() ===
                currentUser.full_name.trim().toLowerCase()),
        )
      : false;

  const handleApprove = async () => {
    if (isSelfProposal) {
      alert(
        "Maker-Checker Violation: You cannot approve your own proposal. Another committee member must review and approve.",
      );
      return;
    }

    try {
      await approveMutation.mutateAsync({
        id: assessmentId,
        notes,
        approved_by_user_id: currentUser?.id,
        approved_by_name: currentUser?.full_name || "Association Committee Executive",
      });
      alert("Special assessment approved successfully by the Association Committee.");
      router.push("/association-committee/assessments");
    } catch {
      alert("Failed to approve assessment.");
    }
  };

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({
        id: assessmentId,
        reason: rejectReason,
        rejected_by_user_id: currentUser?.id,
        rejected_by_name: currentUser?.full_name || "Association Committee Executive",
      });
      alert("Special assessment returned with rejection notes.");
      router.push("/association-committee/assessments");
    } catch {
      alert("Failed to reject assessment.");
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="skeleton" style={{ width: 280, height: 32 }} />
        <div className="skeleton" style={{ width: "100%", height: 200 }} />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
        <h2>Special Assessment Not Found</h2>
        <p style={{ marginTop: "0.5rem", color: "var(--muted)" }}>
          The requested assessment proposal does not exist or has been removed.
        </p>
        <Link
          href="/association-committee/assessments"
          className="btn btn-primary"
          style={{ marginTop: "1rem" }}
        >
          ← Back to Assessments
        </Link>
      </div>
    );
  }

  const target = parseFloat(assessment.target_amount || "0");
  const collected = parseFloat(assessment.amount_collected || "0");
  const progress = target > 0 ? Math.min(Math.round((collected / target) * 100), 100) : 0;

  return (
    <div>
      <PageHeader
        title={assessment.title}
        subtitle={`Special Assessment Governance & CapEx Verification · ${assessment.purpose}`}
        breadcrumbs={[
          { label: "Association Committee", href: "/association-committee/governance" },
          { label: "Special Assessments", href: "/association-committee/assessments" },
          { label: assessment.title },
        ]}
        actions={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link href="/association-committee/assessments" className="btn btn-secondary">
              ← Back to List
            </Link>
          </div>
        }
      />

      <div className="responsive-grid">
        {/* Left Column: Details, Progress & Description */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Status & Highlights Card */}
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--fg)" }}>
                Assessment Proposal Overview
              </div>
              <StatusBadge status={assessment.status} />
            </div>

            {/* Proposer Origin Card */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 1rem",
                background: "#f1f5f9",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                marginBottom: "1.25rem",
                fontSize: "0.825rem",
              }}
            >
              <div>
                <span style={{ color: "var(--muted)" }}>Proposal Origin (Maker): </span>
                <span style={{ fontWeight: 700, color: "var(--fg)" }}>
                  {assessment.proposed_by_name || "Facility Operations & Maintenance"}
                </span>
                <span style={{ color: "var(--muted)", marginLeft: "0.4rem" }}>
                  ({assessment.proposer_department || "Operations"})
                </span>
                {isSelfProposal && (
                  <span
                    style={{
                      fontSize: "0.675rem",
                      padding: "0.15rem 0.4rem",
                      background: "#fef3c7",
                      color: "#92400e",
                      borderRadius: "var(--radius-sm)",
                      fontWeight: 600,
                      marginLeft: "0.5rem",
                    }}
                  >
                    You (Maker)
                  </span>
                )}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.775rem" }}>
                Submitted: {formatDate(assessment.created_at)}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  padding: "0.85rem",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>TARGET BUDGET</div>
                <div
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "var(--fg)",
                    marginTop: "0.25rem",
                  }}
                >
                  {formatCurrency(target)}
                </div>
              </div>

              <div
                style={{
                  padding: "0.85rem",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  PER UNIT ALLOCATION
                </div>
                <div
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "#2563eb",
                    marginTop: "0.25rem",
                  }}
                >
                  {formatCurrency(parseFloat(assessment.per_unit_amount || "0"))}
                </div>
              </div>

              <div
                style={{
                  padding: "0.85rem",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>TOTAL COLLECTED</div>
                <div
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "#059669",
                    marginTop: "0.25rem",
                  }}
                >
                  {formatCurrency(collected)}
                </div>
              </div>
            </div>

            {/* Collection Progress Bar */}
            <div style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  color: "var(--fg-secondary)",
                  marginBottom: "0.35rem",
                }}
              >
                <span>Collection Progress</span>
                <span style={{ fontWeight: 600 }}>{progress}% Complete</span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 10,
                  background: "#e2e8f0",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #3b82f6, #10b981)",
                  }}
                />
              </div>
            </div>

            {/* Timelines & Scope */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                fontSize: "0.85rem",
                borderTop: "1px solid var(--border)",
                paddingTop: "1rem",
              }}
            >
              <div>
                <span style={{ color: "var(--muted)" }}>Effective Start Date: </span>
                <span style={{ fontWeight: 600 }}>{formatDate(assessment.effective_date)}</span>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Due Date: </span>
                <span style={{ fontWeight: 600 }}>
                  {assessment.due_date ? formatDate(assessment.due_date) : "N/A"}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Participating Units: </span>
                <span style={{ fontWeight: 600 }}>
                  {assessment.affected_units_count || 0} Units
                </span>
              </div>
              <div>
                <span style={{ color: "var(--muted)" }}>Submission Date: </span>
                <span style={{ fontWeight: 600 }}>{formatDate(assessment.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Description & Objective */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: "0.75rem" }}>
              Project Scope & Objective
            </h2>
            <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "var(--fg-secondary)" }}>
              {assessment.description ||
                assessment.purpose ||
                "No additional project notes provided."}
            </p>
          </div>
        </div>

        {/* Right Column: Committee Governance Action Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {assessment.status === "under_review" ? (
            <div className="card" style={{ borderTop: "3px solid #8b5cf6" }}>
              <h2
                className="card-title"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <span>⚖️</span> Committee Governance Action
              </h2>

              {isSelfProposal ? (
                <div style={{ marginTop: "0.75rem" }}>
                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: "var(--radius-sm)",
                      padding: "0.85rem 1rem",
                      fontSize: "0.825rem",
                      color: "#92400e",
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>
                      🔒 Maker-Checker Segregation of Duties
                    </div>
                    You submitted this assessment proposal. Under statutory enterprise governance
                    rules, the same individual cannot both propose and approve a special levy.
                    Please have another Association Committee executive, the Treasurer, or President
                    review and cast the vote.
                  </div>
                </div>
              ) : !showRejectBox ? (
                <div>
                  <p
                    style={{
                      fontSize: "0.775rem",
                      color: "var(--muted)",
                      margin: "0.35rem 0 1rem",
                    }}
                  >
                    As an independent Association Committee member, review the project budget and
                    cast the formal governance approval.
                  </p>

                  <label
                    style={{ fontSize: "0.775rem", fontWeight: 600, color: "var(--fg-secondary)" }}
                  >
                    Committee Approval Notes / Resolution #
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Approved per AGM resolution #12. Effective next billing cycle."
                    className="input-field"
                    style={{
                      minHeight: 90,
                      marginTop: "0.25rem",
                      width: "100%",
                      marginBottom: "1rem",
                    }}
                  />

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={approveMutation.isPending}
                      className="btn btn-primary"
                      style={{ width: "100%", padding: "0.6rem" }}
                    >
                      {approveMutation.isPending ? "Approving..." : "✅ Approve Special Assessment"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowRejectBox(true)}
                      className="btn btn-secondary"
                      style={{ width: "100%", color: "#dc2626" }}
                    >
                      Reject or Request Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    style={{
                      fontSize: "0.775rem",
                      fontWeight: 600,
                      color: "#dc2626",
                      marginTop: "0.5rem",
                      display: "block",
                    }}
                  >
                    Reason for Rejection / Modification Request
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Specify why this proposal is returned (e.g. Requires revised vendor quotations)..."
                    className="input-field"
                    style={{
                      minHeight: 90,
                      marginTop: "0.25rem",
                      width: "100%",
                      marginBottom: "1rem",
                      borderColor: "#fca5a5",
                    }}
                  />

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={rejectMutation.isPending}
                      className="btn btn-danger"
                      style={{ width: "100%", padding: "0.6rem" }}
                    >
                      {rejectMutation.isPending ? "Submitting..." : "❌ Confirm Rejection"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowRejectBox(false)}
                      className="btn btn-secondary"
                      style={{ width: "100%" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <h2 className="card-title" style={{ marginBottom: "0.75rem" }}>
                Governance Status & Audit
              </h2>
              <div
                style={{
                  padding: "0.85rem",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <strong>Status:</strong>{" "}
                  <span style={{ textTransform: "capitalize", fontWeight: 600 }}>
                    {assessment.status}
                  </span>
                </div>
                {assessment.approved_at && (
                  <div style={{ marginTop: "0.5rem", color: "var(--muted)", fontSize: "0.775rem" }}>
                    Approved on: {formatDate(assessment.approved_at)}
                    {assessment.approved_by_name && (
                      <span>
                        {" "}
                        by <strong>{assessment.approved_by_name}</strong>
                      </span>
                    )}
                  </div>
                )}
                {assessment.approval_notes && (
                  <div
                    style={{
                      marginTop: "0.4rem",
                      fontSize: "0.8rem",
                      color: "var(--fg-secondary)",
                      background: "#ffffff",
                      padding: "0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <em>&ldquo;{assessment.approval_notes}&rdquo;</em>
                  </div>
                )}
                {assessment.rejected_by_name && assessment.status === "rejected" && (
                  <div style={{ marginTop: "0.5rem", color: "#dc2626", fontSize: "0.775rem" }}>
                    Rejected by <strong>{assessment.rejected_by_name}</strong>
                  </div>
                )}
                {assessment.rejection_reason && (
                  <div style={{ marginTop: "0.4rem", fontSize: "0.8rem", color: "#dc2626" }}>
                    <strong>Rejection Notes:</strong> {assessment.rejection_reason}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
