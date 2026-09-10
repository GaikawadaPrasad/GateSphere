"use client";

import Link from "next/link";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails } from "@/hooks/use-communities";
import { useGovernanceOverview, useCollectionAudit } from "@/hooks/use-governance";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { FinancialSummaryCard } from "@/components/governance/FinancialSummaryCard";
import { AssessmentSummaryCard } from "@/components/governance/AssessmentSummaryCard";
import { IncidentSummaryCard } from "@/components/governance/IncidentSummaryCard";
import { CollectionAuditCard } from "@/components/governance/CollectionAuditCard";
import { formatCurrency } from "@/lib/utils";

export default function GovernanceOverviewPage() {
  const { activeCommunityId } = useUiStore();
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);
  const { data: overview, isLoading: overviewLoading } = useGovernanceOverview(activeCommunityId);
  const { data: audit, isLoading: auditLoading } = useCollectionAudit(activeCommunityId);

  const billedNum = overview ? parseFloat(overview.totalBilled || "0") : 0;
  const collectedNum = overview ? parseFloat(overview.totalCollected || "0") : 0;
  const outstandingNum = overview ? parseFloat(overview.outstandingBalance || "0") : 0;

  return (
    <div>
      <PageHeader
        title="Governance Overview"
        subtitle={
          community
            ? `Governance & Oversight Scope: ${community.name} (Single-Tenant Enforcement)`
            : "Residential Community Governance & Strategic Oversight"
        }
        actions={
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Link
              href="/association-committee/reports"
              className="btn btn-secondary"
              style={{ fontSize: "0.825rem", padding: "0.45rem 0.85rem" }}
            >
              <span>📊</span> Governance Reports
            </Link>
            <Link
              href="/association-committee/assessments"
              className="btn btn-primary"
              style={{ fontSize: "0.825rem", padding: "0.45rem 0.85rem" }}
            >
              <span>📋</span> Review Assessments
            </Link>
          </div>
        }
      />

      {/* Governance Notice Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
          border: "1px solid #ddd6fe",
          borderRadius: "var(--radius)",
          padding: "0.9rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.25rem" }}>⚖️</span>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#5b21b6" }}>
              Association Committee Governance Portal (PRD GSE-2026)
            </div>
            <div style={{ fontSize: "0.775rem", color: "#6d28d9" }}>
              Access financial summaries · Approve special assessments · Review incident logs · Audit collections & ledger records
            </div>
          </div>
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "#6d28d9",
            fontWeight: 600,
            background: "#ffffff",
            padding: "0.25rem 0.6rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid #ddd6fe",
          }}
        >
          Oversight & Compliance Mode
        </div>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        <KpiCard
          title="Total Invoiced"
          value={formatCurrency(billedNum)}
          subtitle="Community billing aggregate"
          icon="💳"
          accent="primary"
          isLoading={overviewLoading}
        />

        <KpiCard
          title="Total Collections"
          value={formatCurrency(collectedNum)}
          subtitle="Verified payment receipts"
          icon="💰"
          accent="success"
          isLoading={overviewLoading}
        />

        <KpiCard
          title="Outstanding Dues"
          value={formatCurrency(outstandingNum)}
          subtitle={outstandingNum > 0 ? "Pending unit collection" : "All accounts clear"}
          icon="⏳"
          accent={outstandingNum > 0 ? "danger" : "neutral"}
          isLoading={overviewLoading}
        />

        <KpiCard
          title="Assessments For Review"
          value={overview?.pendingAssessmentsCount || 0}
          subtitle="Pending committee action"
          icon="📋"
          accent={overview?.pendingAssessmentsCount ? "warning" : "neutral"}
          badge={
            overview?.pendingAssessmentsCount
              ? { text: "Action Required", variant: "warning" }
              : undefined
          }
          isLoading={overviewLoading}
        />

        <KpiCard
          title="Security Incidents"
          value={overview?.openIncidentsCount || 0}
          subtitle="Active / under investigation"
          icon="🚨"
          accent={overview?.openIncidentsCount ? "danger" : "neutral"}
          isLoading={overviewLoading}
        />
      </div>

      {/* Middle Grid: Financial Health & Special Assessments */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: "1.5rem",
          marginBottom: "1.75rem",
        }}
      >
        <FinancialSummaryCard stats={overview?.financialStats} isLoading={overviewLoading} />
        <AssessmentSummaryCard assessments={overview?.activeAssessments} isLoading={overviewLoading} />
      </div>

      {/* Bottom Grid: Security Incidents & Collection Audit */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: "1.5rem",
          marginBottom: "1.75rem",
        }}
      >
        <IncidentSummaryCard incidents={overview?.recentIncidents} isLoading={overviewLoading} />
        <CollectionAuditCard summary={audit} isLoading={auditLoading} />
      </div>

      {/* Governance Traceability Quick Access */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>📊</span> Governance Reporting & Statutory Traceability
            </h2>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.15rem" }}>
              Quick export and audit verification links for committee meetings
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
            marginTop: "0.5rem",
          }}
        >
          <Link
            href="/association-committee/financial-summary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1rem",
              background: "#f8fafc",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
            }}
            className="hover-panel"
          >
            <span style={{ fontSize: "1.5rem" }}>📑</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)" }}>Financial Ledger Report</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Invoices, adjustments & balance sheet</div>
            </div>
          </Link>

          <Link
            href="/association-committee/collection-audit"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1rem",
              background: "#f8fafc",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
            }}
            className="hover-panel"
          >
            <span style={{ fontSize: "1.5rem" }}>🧾</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)" }}>Collection Audit Report</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Payment receipts and channel reconciliations</div>
            </div>
          </Link>

          <Link
            href="/association-committee/assessments"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1rem",
              background: "#f8fafc",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
            }}
            className="hover-panel"
          >
            <span style={{ fontSize: "1.5rem" }}>📋</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)" }}>CapEx Review Register</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Special assessment approval audit trail</div>
            </div>
          </Link>

          <Link
            href="/association-committee/incidents"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1rem",
              background: "#f8fafc",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
            }}
            className="hover-panel"
          >
            <span style={{ fontSize: "1.5rem" }}>🚨</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)" }}>Security Incident Archive</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Incident logs, investigations & resolutions</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
