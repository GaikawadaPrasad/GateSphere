"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUiStore } from "@/store/ui";
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

  const { data: assessment, isLoading } = useSpecialAssessment(assessmentId, activeCommunityId);
  const approveMutation = useApproveAssessment();
  const rejectMutation = useRejectAssessment();

  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ id: assessmentId, notes });
      alert("Special assessment approved successfully.");
      router.push("/association-committee/assessments");
    } catch {
      alert("Failed to approve assessment.");
    }
  };

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync({ id: assessmentId, reason: rejectReason });
      alert("Special assessment rejected.");
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
        subtitle={`Special Assessment Review & CapEx Details · ${assessment.purpose}`}
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
                <span style={{ color: "var(--muted)" }}>Created On: </span>
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
              <p style={{ fontSize: "0.775rem", color: "var(--muted)", margin: "0.35rem 0 1rem" }}>
                As an Association Committee member, approve or return this special assessment
                proposal.
              </p>

              {!showRejectBox ? (
                <div>
                  <label
                    style={{ fontSize: "0.775rem", fontWeight: 600, color: "var(--fg-secondary)" }}
                  >
                    Committee Approval Notes
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
                  <label style={{ fontSize: "0.775rem", fontWeight: 600, color: "#dc2626" }}>
                    Reason for Rejection
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Specify reason for returning proposal..."
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
                Governance Status
              </h2>
              <div
                style={{
                  padding: "0.75rem",
                  background: "#f8fafc",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  <strong>Status:</strong>{" "}
                  <span style={{ textTransform: "capitalize" }}>{assessment.status}</span>
                </div>
                {assessment.approved_at && (
                  <div style={{ marginTop: "0.4rem", color: "var(--muted)", fontSize: "0.775rem" }}>
                    Approved on: {formatDate(assessment.approved_at)}
                  </div>
                )}
                {assessment.approval_notes && (
                  <div
                    style={{
                      marginTop: "0.4rem",
                      fontSize: "0.8rem",
                      color: "var(--fg-secondary)",
                    }}
                  >
                    <em>&ldquo;{assessment.approval_notes}&rdquo;</em>
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
