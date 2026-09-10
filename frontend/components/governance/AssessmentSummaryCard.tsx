"use client";

import Link from "next/link";
import type { SpecialAssessment } from "@/types/governance";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/common/StatusBadge";

interface AssessmentSummaryCardProps {
  assessments?: SpecialAssessment[];
  isLoading?: boolean;
}

export function AssessmentSummaryCard({ assessments, isLoading }: AssessmentSummaryCardProps) {
  if (isLoading) {
    return (
      <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="skeleton" style={{ width: "45%", height: 20 }} />
        <div className="skeleton" style={{ width: "100%", height: 70 }} />
        <div className="skeleton" style={{ width: "100%", height: 70 }} />
      </div>
    );
  }

  const list = assessments || [];
  const pendingCount = list.filter((a) => a.status === "under_review" || a.status === "draft").length;

  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="card-header">
        <div>
          <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>📋</span> Special Assessments
          </h2>
          <p style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            CapEx and special community levy approvals
          </p>
        </div>
        <Link
          href="/association-committee/assessments"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", height: 30 }}
        >
          Manage Assessments →
        </Link>
      </div>

      {pendingCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 0.85rem",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "var(--radius-sm)",
            color: "#92400e",
            fontSize: "0.8rem",
            fontWeight: 500,
            marginBottom: "1rem",
          }}
        >
          <span>⚠️</span>
          <span>
            <strong>{pendingCount} assessment{pendingCount > 1 ? "s" : ""}</strong> awaiting Association Committee review and approval.
          </span>
        </div>
      )}

      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--muted)", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>No Special Assessments</div>
          <p style={{ fontSize: "0.775rem", marginTop: "0.25rem" }}>
            No active or pending special assessment proposals found for this community.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
          {list.slice(0, 3).map((item) => {
            const target = parseFloat(item.target_amount || "0");
            const collected = parseFloat(item.amount_collected || "0");
            const progress = target > 0 ? Math.min(Math.round((collected / target) * 100), 100) : 0;

            return (
              <Link
                key={item.id}
                href={`/association-committee/assessments/${item.id}`}
                style={{
                  display: "block",
                  padding: "0.85rem",
                  background: "#ffffff",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  textDecoration: "none",
                  transition: "all 0.15s ease",
                }}
                className="hover-panel"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)" }}>{item.title}</div>
                    <div style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                      Effective: {formatDate(item.effective_date)} · {item.affected_units_count || 0} units
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                <div style={{ marginTop: "0.6rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--fg-secondary)", marginBottom: "0.25rem" }}>
                    <span>Target: {formatCurrency(target)}</span>
                    <span>Collected: {formatCurrency(collected)} ({progress}%)</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: "var(--primary)",
                      }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
