"use client";

import { useState } from "react";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails } from "@/hooks/use-communities";
import {
  useGovernanceOverview,
  useSpecialAssessments,
  useCollectionAudit,
} from "@/hooks/use-governance";
import { useIncidents } from "@/hooks/use-incidents";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { billingApi, auditApi } from "@/lib/api";
import type { Payment } from "@/types/billing";
import type { SpecialAssessment } from "@/types/governance";
import type { Incident } from "@/types/incidents";

type ReportTab = "financial" | "collections" | "assessments" | "incidents";

export default function GovernanceReportsPage() {
  const { activeCommunityId } = useUiStore();
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);
  const [activeTab, setActiveTab] = useState<ReportTab>("financial");
  const [isExporting, setIsExporting] = useState(false);

  const { data: overview } = useGovernanceOverview(activeCommunityId);
  const { data: audit, isLoading: auditLoading } = useCollectionAudit(activeCommunityId);
  const { data: assessments, isLoading: assessmentsLoading } = useSpecialAssessments({
    community_id: activeCommunityId,
  });
  const { data: incidents, isLoading: incidentsLoading } = useIncidents({
    community_id: activeCommunityId || undefined,
    page_size: 50,
  });

  const handleExportInvoices = async () => {
    if (!activeCommunityId) return;
    try {
      setIsExporting(true);
      const csv = await billingApi.exportInvoicesCsv({ community_id: activeCommunityId });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `governance_financial_report_${community?.name || "community"}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to export report CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPayments = async () => {
    if (!activeCommunityId) return;
    try {
      setIsExporting(true);
      const csv = await billingApi.exportPaymentsCsv(activeCommunityId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `governance_collections_report_${community?.name || "community"}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to export report CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAuditLogs = async () => {
    if (!activeCommunityId) return;
    try {
      setIsExporting(true);
      const csv = await auditApi.exportCsv({ community_id: activeCommunityId });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `governance_audit_trace_${community?.name || "community"}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to export audit trace CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const paymentColumns: Column<Payment>[] = [
    { key: "payment_reference", header: "Reference #" },
    {
      key: "receipt_number",
      header: "Receipt #",
      render: (item) => (item.receipt_number ? String(item.receipt_number) : "–"),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (item) => (
        <span style={{ fontWeight: 700, color: "#059669" }}>
          {formatCurrency(parseFloat(item.amount || "0"))}
        </span>
      ),
    },
    {
      key: "payment_method",
      header: "Payment Method",
      render: (item) => (
        <span className="badge badge-neutral">
          {String(item.payment_method || "").toUpperCase()}
        </span>
      ),
    },
    {
      key: "paid_at",
      header: "Payment Date",
      render: (item) => (item.paid_at ? formatDate(item.paid_at) : "–"),
    },
    {
      key: "payment_status",
      header: "Status",
      render: (item) => <StatusBadge status={item.payment_status} />,
    },
  ];

  const assessmentColumns: Column<SpecialAssessment>[] = [
    { key: "title", header: "Assessment Project" },
    {
      key: "target_amount",
      header: "Budget",
      align: "right",
      render: (item) => formatCurrency(parseFloat(item.target_amount || "0")),
    },
    {
      key: "amount_collected",
      header: "Collected",
      align: "right",
      render: (item) => (
        <span style={{ color: "#059669", fontWeight: 600 }}>
          {formatCurrency(parseFloat(item.amount_collected || "0"))}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "approved_at",
      header: "Approval Date",
      render: (item) => (item.approved_at ? formatDate(item.approved_at) : "–"),
    },
  ];

  const incidentColumns: Column<Incident>[] = [
    {
      key: "incident_number",
      header: "Incident #",
      render: (item) => `#${item.incident_number || item.id.slice(0, 8)}`,
    },
    {
      key: "incident_type",
      header: "Type",
      render: (item) => <span style={{ textTransform: "capitalize" }}>{item.incident_type}</span>,
    },
    {
      key: "severity",
      header: "Severity",
      render: (item) => (
        <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.75rem" }}>
          {item.severity}
        </span>
      ),
    },
    {
      key: "location_text",
      header: "Location",
      render: (item) => item.location_text || "Premises",
    },
    {
      key: "reported_at",
      header: "Reported At",
      render: (item) => formatDate(item.reported_at),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Governance Reports & Statutory Traceability"
        subtitle={`Official governance records & audit exports for ${community?.name || "Community Scope"}`}
        breadcrumbs={[
          { label: "Association Committee", href: "/association-committee/governance" },
          { label: "Reports & Traceability" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleExportInvoices}
              disabled={isExporting}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
            >
              📥 Financial Report CSV
            </button>
            <button
              type="button"
              onClick={handleExportPayments}
              disabled={isExporting}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
            >
              📥 Collection Audit CSV
            </button>
            <button
              type="button"
              onClick={handleExportAuditLogs}
              disabled={isExporting}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
            >
              📥 Governance Audit Trace CSV
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          gap: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("financial")}
          style={{
            padding: "0.75rem 0.25rem",
            background: "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderBottomWidth: 2,
            borderBottomStyle: "solid",
            borderBottomColor: activeTab === "financial" ? "var(--primary)" : "transparent",
            color: activeTab === "financial" ? "var(--primary)" : "var(--muted)",
            fontWeight: activeTab === "financial" ? 600 : 500,
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          💰 Financial Report
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("collections")}
          style={{
            padding: "0.75rem 0.25rem",
            background: "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderBottomWidth: 2,
            borderBottomStyle: "solid",
            borderBottomColor: activeTab === "collections" ? "var(--primary)" : "transparent",
            color: activeTab === "collections" ? "var(--primary)" : "var(--muted)",
            fontWeight: activeTab === "collections" ? 600 : 500,
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          🧾 Collection History
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("assessments")}
          style={{
            padding: "0.75rem 0.25rem",
            background: "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderBottomWidth: 2,
            borderBottomStyle: "solid",
            borderBottomColor: activeTab === "assessments" ? "var(--primary)" : "transparent",
            color: activeTab === "assessments" ? "var(--primary)" : "var(--muted)",
            fontWeight: activeTab === "assessments" ? 600 : 500,
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          📋 Assessment Approvals
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("incidents")}
          style={{
            padding: "0.75rem 0.25rem",
            background: "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderBottomWidth: 2,
            borderBottomStyle: "solid",
            borderBottomColor: activeTab === "incidents" ? "var(--primary)" : "transparent",
            color: activeTab === "incidents" ? "var(--primary)" : "var(--muted)",
            fontWeight: activeTab === "incidents" ? 600 : 500,
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          🚨 Security Incident Log
        </button>
      </div>

      {/* TAB 1: Financial Report */}
      {activeTab === "financial" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Community Financial Overview & Revenue Realization</h2>
              <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
                Audited summary of billings, collections, and dues
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportInvoices}
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
            >
              Export CSV
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                padding: "1rem",
                background: "#f8fafc",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>GROSS INVOICED</div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "var(--fg)",
                  marginTop: "0.25rem",
                }}
              >
                {formatCurrency(parseFloat(overview?.totalBilled || "0"))}
              </div>
            </div>

            <div
              style={{
                padding: "1rem",
                background: "#f8fafc",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>COLLECTED REVENUE</div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#059669",
                  marginTop: "0.25rem",
                }}
              >
                {formatCurrency(parseFloat(overview?.totalCollected || "0"))}
              </div>
            </div>

            <div
              style={{
                padding: "1rem",
                background: "#f8fafc",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                OUTSTANDING RECEIVABLES
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#dc2626",
                  marginTop: "0.25rem",
                }}
              >
                {formatCurrency(parseFloat(overview?.outstandingBalance || "0"))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Collection History */}
      {activeTab === "collections" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Collection Records & Transaction Audit</h2>
              <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
                Verified payment receipts with transaction references
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPayments}
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
            >
              Export CSV
            </button>
          </div>

          <DataTable<Payment>
            columns={paymentColumns}
            data={audit?.recent_payments}
            isLoading={auditLoading}
            emptyTitle="No collection records"
            emptyDescription="No payment records found."
          />
        </div>
      )}

      {/* TAB 3: Assessment Approvals */}
      {activeTab === "assessments" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Special Assessment Review & Approval History</h2>
              <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
                Audit register of CapEx project decisions made by the Association Committee
              </p>
            </div>
          </div>

          <DataTable<SpecialAssessment>
            columns={assessmentColumns}
            data={assessments}
            isLoading={assessmentsLoading}
            emptyTitle="No assessment records"
            emptyDescription="No special assessment approvals logged yet."
          />
        </div>
      )}

      {/* TAB 4: Incident Log */}
      {activeTab === "incidents" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Security Incident Governance Log</h2>
              <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
                Audited record of security incidents and resolution timestamps
              </p>
            </div>
          </div>

          <DataTable<Incident>
            columns={incidentColumns}
            data={incidents}
            isLoading={incidentsLoading}
            emptyTitle="No incidents"
            emptyDescription="No security incidents on record."
          />
        </div>
      )}
    </div>
  );
}
