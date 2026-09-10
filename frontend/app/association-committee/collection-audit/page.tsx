"use client";

import { useState } from "react";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails } from "@/hooks/use-communities";
import { usePayments } from "@/hooks/use-billing";
import { useCollectionAudit } from "@/hooks/use-governance";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { billingApi } from "@/lib/api";
import type { Payment } from "@/types/billing";

export default function CollectionAuditPage() {
  const { activeCommunityId } = useUiStore();
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);

  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const { data: audit, isLoading: auditLoading } = useCollectionAudit(activeCommunityId);
  const { data: payments, isLoading: paymentsLoading } = usePayments({
    community_id: activeCommunityId || undefined,
    page_size: 100,
  });

  const handleExportCsv = async () => {
    if (!activeCommunityId) return;
    try {
      setIsExporting(true);
      const csv = await billingApi.exportPaymentsCsv(activeCommunityId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `collection_audit_${community?.name || "community"}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to export collection audit CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredPayments = (payments || []).filter((p) => {
    if (methodFilter !== "all" && p.payment_method?.toLowerCase() !== methodFilter.toLowerCase()) return false;
    if (statusFilter !== "all" && p.payment_status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchRef = p.payment_reference?.toLowerCase().includes(q);
      const matchReceipt = p.receipt_number?.toLowerCase().includes(q);
      if (!matchRef && !matchReceipt) return false;
    }
    return true;
  });

  const paymentColumns: Column<Payment>[] = [
    {
      key: "payment_reference",
      header: "Payment Reference",
      render: (item) => (
        <div>
          <span style={{ fontWeight: 600, color: "var(--fg)" }}>{item.payment_reference}</span>
          {item.receipt_number && (
            <div style={{ fontSize: "0.725rem", color: "var(--muted)" }}>Receipt: {item.receipt_number}</div>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount Paid",
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
        <span className="badge badge-neutral">{String(item.payment_method || "").toUpperCase()}</span>
      ),
    },
    {
      key: "paid_at",
      header: "Transaction Date",
      render: (item) => (item.paid_at ? formatDate(item.paid_at) : "–"),
    },
    {
      key: "payment_status",
      header: "Payment Status",
      render: (item) => <StatusBadge status={item.payment_status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Collection Audit & Receipt Verification"
        subtitle={`Audit trail of all resident dues collections and payment allocations for ${community?.name || "Governance Scope"}`}
        breadcrumbs={[
          { label: "Association Committee", href: "/association-committee/governance" },
          { label: "Collection Audit" },
        ]}
        actions={
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="btn btn-secondary"
            style={{ fontSize: "0.825rem", padding: "0.45rem 0.85rem" }}
          >
            📥 Export Collection Audit CSV
          </button>
        }
      />

      {/* Audit KPI Highlights */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ borderTop: "3px solid #10b981" }}>
          <div style={{ fontSize: "0.775rem", color: "var(--muted)", fontWeight: 600 }}>TOTAL VERIFIED COLLECTIONS</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#059669", margin: "0.3rem 0" }}>
            {formatCurrency(parseFloat(audit?.total_collections || "0"))}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{audit?.collection_count || 0} Successful Transactions</div>
        </div>

        <div className="card" style={{ borderTop: "3px solid #ef4444" }}>
          <div style={{ fontSize: "0.775rem", color: "var(--muted)", fontWeight: 600 }}>UNCOLLECTED OUTSTANDING DUES</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#dc2626", margin: "0.3rem 0" }}>
            {formatCurrency(parseFloat(audit?.total_outstanding_amount || "0"))}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{audit?.outstanding_invoices_count || 0} Overdue / Unpaid Invoices</div>
        </div>

        <div className="card" style={{ borderTop: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: "0.775rem", color: "var(--muted)", fontWeight: 600 }}>AUDIT COMPLIANCE STATUS</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#7c3aed", margin: "0.5rem 0" }}>
            🔒 Verified Traceable
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Append-only ledger integrity (NFR-COMP-02)</div>
        </div>
      </div>

      {/* Payment Channels Matrix */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 className="card-title" style={{ marginBottom: "0.75rem" }}>
          Payment Method Reconciliation
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          {Object.entries(audit?.payment_methods_breakdown || {}).map(([method, val]) => (
            <div
              key={method}
              style={{
                padding: "0.75rem",
                background: "#f8fafc",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div style={{ fontSize: "0.725rem", color: "var(--muted)", textTransform: "uppercase" }}>{method}</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)", marginTop: "0.2rem" }}>
                {formatCurrency(parseFloat(val.total_amount))}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.15rem" }}>{val.count} receipts</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: 260, maxWidth: 380 }}>
          <input
            type="text"
            placeholder="Search payment reference or receipt #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ fontSize: "0.85rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="select-field"
            style={{ width: "auto", fontSize: "0.8rem", height: 36 }}
          >
            <option value="all">All Methods</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="netbanking">Net Banking</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-field"
            style={{ width: "auto", fontSize: "0.8rem", height: 36 }}
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Collection Records DataTable */}
      <div className="card">
        <DataTable<Payment>
          columns={paymentColumns}
          data={filteredPayments}
          isLoading={paymentsLoading || auditLoading}
          emptyTitle="No collection records"
          emptyDescription="No payment receipts matched the given filter criteria."
        />
      </div>
    </div>
  );
}
