"use client";

import { useState } from "react";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails } from "@/hooks/use-communities";
import { useInvoices, usePayments, useBillingRules, useChargeHeads } from "@/hooks/use-billing";
import { useGovernanceOverview, useCollectionAudit } from "@/hooks/use-governance";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { billingApi } from "@/lib/api";
import type { MaintenanceInvoice, Payment } from "@/types/billing";

type TabType = "overview" | "collections" | "outstanding" | "rules";

export default function FinancialSummaryPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isExporting, setIsExporting] = useState(false);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("all");
  const { activeCommunityId } = useUiStore();
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);

  const { data: overview } = useGovernanceOverview(activeCommunityId);
  const { data: audit } = useCollectionAudit(activeCommunityId);
  const { data: invoices, isLoading: invoicesLoading } = useInvoices({
    community_id: activeCommunityId || undefined,
    page_size: 50,
  });
  const { data: payments, isLoading: paymentsLoading } = usePayments({
    community_id: activeCommunityId || undefined,
    page_size: 50,
  });
  const { data: rules } = useBillingRules(activeCommunityId || undefined);
  const { data: chargeHeads } = useChargeHeads(activeCommunityId || undefined);

  const handleExportInvoices = async () => {
    if (!activeCommunityId) return;
    try {
      setIsExporting(true);
      const csv = await billingApi.exportInvoicesCsv({ community_id: activeCommunityId });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `financial_invoices_${community?.name || "community"}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to export invoices CSV");
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
      link.setAttribute("download", `collections_audit_${community?.name || "community"}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to export collections CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredInvoices = (invoices || []).filter((inv) => {
    if (invoiceStatusFilter === "all") return true;
    return inv.status === invoiceStatusFilter;
  });

  const outstandingInvoices = (invoices || []).filter(
    (inv) =>
      inv.status === "overdue" ||
      (inv.status === "posted" && parseFloat(inv.balance_due || "0") > 0),
  );

  const invoiceColumns: Column<MaintenanceInvoice>[] = [
    { key: "invoice_number", header: "Invoice #" },
    {
      key: "unit_id",
      header: "Unit",
      render: (item) => (
        <span style={{ fontWeight: 600 }}>{item.unit_number || item.unit_id.slice(0, 8)}</span>
      ),
    },
    {
      key: "total_amount",
      header: "Total Amount",
      align: "right",
      render: (item) => formatCurrency(parseFloat(item.total_amount || "0")),
    },
    {
      key: "amount_paid",
      header: "Paid",
      align: "right",
      render: (item) => (
        <span style={{ color: "#059669", fontWeight: 600 }}>
          {formatCurrency(parseFloat(item.amount_paid || "0"))}
        </span>
      ),
    },
    {
      key: "balance_due",
      header: "Balance Due",
      align: "right",
      render: (item) => {
        const bal = parseFloat(item.balance_due || "0");
        return (
          <span
            style={{ color: bal > 0 ? "#dc2626" : "var(--fg)", fontWeight: bal > 0 ? 600 : 400 }}
          >
            {formatCurrency(bal)}
          </span>
        );
      },
    },
    {
      key: "due_date",
      header: "Due Date",
      render: (item) => (item.due_date ? formatDate(item.due_date) : "–"),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

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
      header: "Method",
      render: (item) => (
        <span className="badge badge-neutral">
          {String(item.payment_method || "").toUpperCase()}
        </span>
      ),
    },
    {
      key: "paid_at",
      header: "Timestamp",
      render: (item) => (item.paid_at ? formatDate(item.paid_at) : "–"),
    },
    {
      key: "payment_status",
      header: "Status",
      render: (item) => <StatusBadge status={item.payment_status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Financial Summary & Audit"
        subtitle={`Governance view for ${community?.name || "Community Scope"} — Comprehensive billing, dues & ledger oversight`}
        breadcrumbs={[
          { label: "Association Committee", href: "/association-committee/governance" },
          { label: "Financial Summary" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={handleExportInvoices}
              disabled={isExporting}
              className="btn btn-secondary"
              style={{ fontSize: "0.825rem", padding: "0.45rem 0.85rem" }}
            >
              📥 Export Invoices CSV
            </button>
            <button
              type="button"
              onClick={handleExportPayments}
              disabled={isExporting}
              className="btn btn-secondary"
              style={{ fontSize: "0.825rem", padding: "0.45rem 0.85rem" }}
            >
              📥 Export Collections CSV
            </button>
          </div>
        }
      />

      {/* Tabs Navigation */}
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
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "0.75rem 0.25rem",
            background: "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderBottomWidth: 2,
            borderBottomStyle: "solid",
            borderBottomColor: activeTab === "overview" ? "var(--primary)" : "transparent",
            color: activeTab === "overview" ? "var(--primary)" : "var(--muted)",
            fontWeight: activeTab === "overview" ? 600 : 500,
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          💰 Financial Overview
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
          🧾 Collection Summary ({payments?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("outstanding")}
          style={{
            padding: "0.75rem 0.25rem",
            background: "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderBottomWidth: 2,
            borderBottomStyle: "solid",
            borderBottomColor: activeTab === "outstanding" ? "var(--primary)" : "transparent",
            color: activeTab === "outstanding" ? "var(--primary)" : "var(--muted)",
            fontWeight: activeTab === "outstanding" ? 600 : 500,
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          ⏳ Outstanding Dues ({outstandingInvoices.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          style={{
            padding: "0.75rem 0.25rem",
            background: "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderBottomWidth: 2,
            borderBottomStyle: "solid",
            borderBottomColor: activeTab === "rules" ? "var(--primary)" : "transparent",
            color: activeTab === "rules" ? "var(--primary)" : "var(--muted)",
            fontWeight: activeTab === "rules" ? 600 : 500,
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          ⚙️ Charge Heads & Billing Rules
        </button>
      </div>

      {/* TAB 1: Financial Overview */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            <div className="card" style={{ borderTop: "3px solid #3b82f6" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
                TOTAL INVOICED REVENUE
              </div>
              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "var(--fg)",
                  margin: "0.4rem 0",
                }}
              >
                {formatCurrency(parseFloat(overview?.totalBilled || "0"))}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Gross billings generated across all units
              </div>
            </div>

            <div className="card" style={{ borderTop: "3px solid #10b981" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
                TOTAL COLLECTED
              </div>
              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "#059669",
                  margin: "0.4rem 0",
                }}
              >
                {formatCurrency(parseFloat(overview?.totalCollected || "0"))}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Reconciled & verified payments
              </div>
            </div>

            <div className="card" style={{ borderTop: "3px solid #ef4444" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
                TOTAL OUTSTANDING DUES
              </div>
              <div
                style={{
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "#dc2626",
                  margin: "0.4rem 0",
                }}
              >
                {formatCurrency(parseFloat(overview?.outstandingBalance || "0"))}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Unpaid and overdue balances
              </div>
            </div>
          </div>

          {/* Invoices List for Governance */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Community Invoices Audit Log</h2>
                <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
                  Maintenance invoices issued to units (Read-only oversight)
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <select
                  value={invoiceStatusFilter}
                  onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                  className="select-field"
                  style={{ width: "auto", fontSize: "0.8rem", height: 32 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="posted">Posted</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            <DataTable<MaintenanceInvoice>
              columns={invoiceColumns}
              data={filteredInvoices}
              isLoading={invoicesLoading}
              emptyTitle="No invoices found"
              emptyDescription="No maintenance invoices match the selected filter."
            />
          </div>
        </div>
      )}

      {/* TAB 2: Collection Summary */}
      {activeTab === "collections" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Payment Methods Breakdown */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: "1rem" }}>
              Collection Channels & Payment Methods
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              {Object.entries(audit?.payment_methods_breakdown || {}).map(([method, data]) => (
                <div
                  key={method}
                  style={{
                    padding: "1rem",
                    background: "#f8fafc",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      textTransform: "uppercase",
                    }}
                  >
                    {method}
                  </div>
                  <div
                    style={{
                      fontSize: "1.35rem",
                      fontWeight: 700,
                      color: "#059669",
                      margin: "0.25rem 0",
                    }}
                  >
                    {formatCurrency(parseFloat(data.total_amount))}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {data.count} transactions
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payments DataTable */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Verified Payment Records</h2>
                <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
                  Historical record of all payments received
                </p>
              </div>
            </div>

            <DataTable<Payment>
              columns={paymentColumns}
              data={payments}
              isLoading={paymentsLoading}
              emptyTitle="No payments recorded"
              emptyDescription="No payment transactions have been logged for this community."
            />
          </div>
        </div>
      )}

      {/* TAB 3: Outstanding Dues */}
      {activeTab === "outstanding" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Outstanding Unit Balances & Delinquency Oversight</h2>
              <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
                Units with pending or overdue invoices requiring committee attention
              </p>
            </div>
          </div>

          <DataTable<MaintenanceInvoice>
            columns={invoiceColumns}
            data={outstandingInvoices}
            isLoading={invoicesLoading}
            emptyTitle="No outstanding dues"
            emptyDescription="All residential units have clear balances."
          />
        </div>
      )}

      {/* TAB 4: Rules & Charge Heads */}
      {activeTab === "rules" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: "1.5rem",
          }}
        >
          {/* Billing Rules */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: "1rem" }}>
              Active Billing Policy Rules
            </h2>
            {rules ? (
              (() => {
                const activeRule = Array.isArray(rules) ? rules[0] : rules;
                if (!activeRule)
                  return (
                    <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                      No custom billing rules configured.
                    </div>
                  );
                return (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.5rem 0",
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Billing Frequency</span>
                      <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                        {activeRule.billing_frequency || "Monthly"}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.5rem 0",
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Payment Due Days</span>
                      <span style={{ fontWeight: 600 }}>{activeRule.due_days || 10} days</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.5rem 0",
                        borderBottom: "1px solid var(--border-light)",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Grace Period</span>
                      <span style={{ fontWeight: 600 }}>
                        {activeRule.grace_period_days || 5} days
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.5rem 0",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Late Fee</span>
                      <span style={{ fontWeight: 600 }}>
                        {activeRule.late_fee_type === "percentage"
                          ? `${activeRule.late_fee_amount}%`
                          : formatCurrency(parseFloat(activeRule.late_fee_amount || "0"))}
                      </span>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                No custom billing rules configured.
              </div>
            )}
          </div>

          {/* Charge Heads */}
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: "1rem" }}>
              Approved Charge Heads
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {(chargeHeads || []).map((ch) => (
                <div
                  key={ch.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.6rem 0.75rem",
                    background: "#f8fafc",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-light)",
                    fontSize: "0.825rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--fg)" }}>{ch.name}</div>
                    <div style={{ fontSize: "0.725rem", color: "var(--muted)" }}>
                      Code: {ch.code} · Type: {ch.charge_type}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                    {formatCurrency(parseFloat(ch.default_amount || "0"))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
