"use client";

import { useState, useMemo } from "react";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails } from "@/hooks/use-communities";
import {
  useGovernanceOverview,
  useSpecialAssessments,
  useCollectionAudit,
} from "@/hooks/use-governance";
import { useIncidents } from "@/hooks/use-incidents";
import { useResidents } from "@/hooks/use-residents";
import { useInvoices } from "@/hooks/use-billing";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { billingApi, auditApi } from "@/lib/api";
import type { Payment } from "@/types/billing";
import type { SpecialAssessment } from "@/types/governance";
import type { Incident } from "@/types/incidents";
import type { ResidentProfile } from "@/types/residents";

type ReportTab = "financial" | "collections" | "assessments" | "incidents";

export default function GovernanceReportsPage() {
  const { activeCommunityId } = useUiStore();
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);
  const [activeTab, setActiveTab] = useState<ReportTab>("financial");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const { data: overview } = useGovernanceOverview(activeCommunityId);
  const { data: audit, isLoading: auditLoading } = useCollectionAudit(activeCommunityId);
  const { data: assessments, isLoading: assessmentsLoading } = useSpecialAssessments({
    community_id: activeCommunityId,
  });
  const { data: incidents, isLoading: incidentsLoading } = useIncidents({
    community_id: activeCommunityId || undefined,
    page_size: 50,
  });
  const { data: residentsList } = useResidents({
    community_id: activeCommunityId || undefined,
    page_size: 200,
  });
  const { data: invoicesList } = useInvoices({
    community_id: activeCommunityId || undefined,
    page_size: 200,
  });

  // Lookup maps for person and invoice resolution
  const residentMap = useMemo(() => {
    const map = new Map<string, ResidentProfile>();
    if (Array.isArray(residentsList)) {
      residentsList.forEach((r) => {
        if (r.user_id) map.set(r.user_id, r);
        if (r.id) map.set(r.id, r);
      });
    }
    return map;
  }, [residentsList]);

  const invoiceMap = useMemo(() => {
    const map = new Map<
      string,
      { invoice_number: string; unit_number?: string; total_amount: string; due_date?: string }
    >();
    if (Array.isArray(invoicesList)) {
      invoicesList.forEach((inv) => {
        if (inv.id) map.set(inv.id, inv);
      });
    }
    return map;
  }, [invoicesList]);

  const getPayerInfo = (p: Payment) => {
    const resident = p.payer_user_id ? residentMap.get(p.payer_user_id) : undefined;
    const firstAlloc = p.allocations?.[0];
    const invoice = firstAlloc?.invoice_id ? invoiceMap.get(firstAlloc.invoice_id) : undefined;

    const name = p.payer_name || resident?.full_name || "Resident Payer";
    const email = p.payer_email || resident?.email || "";
    const phone = p.payer_phone || resident?.phone || "";
    const residentType = p.resident_type || resident?.resident_type || "Resident";
    const isPrimary = resident?.primary_occupant;

    let unitDisplay = "–";
    if (p.unit_number) {
      unitDisplay = `${p.tower_name ? `${p.tower_name} · ` : ""}Unit ${p.unit_number}`;
    } else if (resident?.unit_number) {
      unitDisplay = `${resident.tower_name ? `${resident.tower_name} · ` : ""}Unit ${resident.unit_number}`;
    } else if (invoice?.unit_number) {
      unitDisplay = `Unit ${invoice.unit_number}`;
    }

    const invoiceNumber =
      p.invoice_number ||
      invoice?.invoice_number ||
      (firstAlloc ? `Inv #${firstAlloc.invoice_id.slice(0, 8)}` : "Maintenance Dues");

    return {
      resident,
      invoice,
      name,
      email,
      phone,
      residentType,
      isPrimary,
      unitDisplay,
      invoiceNumber,
    };
  };

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
    {
      key: "payer_name",
      header: "Resident / Payer",
      render: (item) => {
        const payer = getPayerInfo(item);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontWeight: 600, color: "var(--fg)" }}>{payer.name}</span>
              {payer.residentType && (
                <span
                  style={{
                    fontSize: "0.675rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "var(--radius-sm)",
                    background: "#f1f5f9",
                    color: "#475569",
                    fontWeight: 600,
                    textTransform: "capitalize",
                  }}
                >
                  {payer.residentType}
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                flexWrap: "wrap",
                fontSize: "0.75rem",
                color: "var(--muted)",
              }}
            >
              <span style={{ fontWeight: 500, color: "var(--primary)" }}>{payer.unitDisplay}</span>
              {payer.email && <span>· {payer.email}</span>}
              {payer.phone && <span>· {payer.phone}</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: "payment_reference",
      header: "Reference & Receipt",
      render: (item) => (
        <div>
          <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.825rem" }}>
            {item.payment_reference}
          </span>
          {item.receipt_number && (
            <div style={{ fontSize: "0.725rem", color: "#059669", fontWeight: 500 }}>
              Receipt: {item.receipt_number}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "id",
      header: "Allocated Invoice",
      render: (item) => {
        const payer = getPayerInfo(item);
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.825rem", color: "var(--fg)" }}>
              {payer.invoiceNumber}
            </div>
            <div style={{ fontSize: "0.725rem", color: "var(--muted)" }}>Maintenance Dues</div>
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (item) => (
        <span style={{ fontWeight: 700, color: "#059669", fontSize: "0.925rem" }}>
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
    {
      key: "community_id",
      header: "Audit",
      render: (item) => (
        <button
          type="button"
          onClick={() => setSelectedPayment(item)}
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem" }}
        >
          🔍 View
        </button>
      ),
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

  const activePayer = selectedPayment ? getPayerInfo(selectedPayment) : null;

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
          flexWrap: "wrap", // tabs wrap on phones instead of running off-screen
          borderBottom: "1px solid var(--border)",
          columnGap: "1.5rem",
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
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
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
                Verified payment receipts with payer identity and unit allocations
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

      {/* Payment & Resident Audit Details Modal */}
      {selectedPayment && activePayer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={() => setSelectedPayment(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ marginBottom: "1rem" }}>
              <div>
                <h2 className="card-title" style={{ fontSize: "1.1rem" }}>
                  Receipt & Payer Audit Verification
                </h2>
                <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
                  Verified transaction breakdown for association statutory records
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  color: "var(--muted)",
                }}
              >
                ✕
              </button>
            </div>

            {/* Resident Profile Section */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1rem",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginBottom: "0.5rem",
                }}
              >
                Payer Identity & Residential Unit
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--fg)" }}>
                    {activePayer.name}
                  </div>
                  <div
                    style={{
                      fontSize: "0.825rem",
                      color: "var(--primary)",
                      fontWeight: 600,
                      marginTop: "0.15rem",
                    }}
                  >
                    {activePayer.unitDisplay}
                  </div>
                  {activePayer.email && (
                    <div
                      style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.2rem" }}
                    >
                      ✉️ {activePayer.email}
                    </div>
                  )}
                  {activePayer.phone && (
                    <div
                      style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.1rem" }}
                    >
                      📞 {activePayer.phone}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "0.3rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.725rem",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      background: "#e0f2fe",
                      color: "#0369a1",
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    Role: {activePayer.residentType}
                  </span>
                  {activePayer.isPrimary && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "var(--radius-sm)",
                        background: "#dcfce7",
                        color: "#15803d",
                        fontWeight: 600,
                      }}
                    >
                      Primary Occupant
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction & Settlement Details */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                fontSize: "0.85rem",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Payment Reference</span>
                <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                  {selectedPayment.payment_reference}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Receipt Number</span>
                <span style={{ fontWeight: 600, color: "#059669" }}>
                  {selectedPayment.receipt_number || "Direct Allocation"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Allocated Invoice</span>
                <span style={{ fontWeight: 600 }}>{activePayer.invoiceNumber}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Payment Method</span>
                <span style={{ fontWeight: 600, textTransform: "uppercase" }}>
                  {selectedPayment.payment_method}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Transaction Timestamp</span>
                <span style={{ fontWeight: 500 }}>{formatDate(selectedPayment.paid_at)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Verification Status</span>
                <StatusBadge status={selectedPayment.payment_status} />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.5rem 0",
                  borderTop: "2px solid var(--border)",
                  marginTop: "0.25rem",
                }}
              >
                <span style={{ fontWeight: 700, color: "var(--fg)" }}>Total Amount Settled</span>
                <span style={{ fontWeight: 700, color: "#059669", fontSize: "1.1rem" }}>
                  {formatCurrency(parseFloat(selectedPayment.amount || "0"))}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="btn btn-primary"
                style={{ fontSize: "0.825rem", padding: "0.4rem 0.85rem" }}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
