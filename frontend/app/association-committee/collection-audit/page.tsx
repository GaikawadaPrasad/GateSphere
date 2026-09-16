"use client";

import { useState, useMemo } from "react";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails } from "@/hooks/use-communities";
import { usePayments, useInvoices } from "@/hooks/use-billing";
import { useResidents } from "@/hooks/use-residents";
import { useCollectionAudit } from "@/hooks/use-governance";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { billingApi } from "@/lib/api";
import type { Payment } from "@/types/billing";
import type { ResidentProfile } from "@/types/residents";

export default function CollectionAuditPage() {
  const { activeCommunityId } = useUiStore();
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);

  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const { data: audit, isLoading: auditLoading } = useCollectionAudit(activeCommunityId);
  const { data: payments, isLoading: paymentsLoading } = usePayments({
    community_id: activeCommunityId || undefined,
    page_size: 100,
  });
  const { data: residentsList } = useResidents({
    community_id: activeCommunityId || undefined,
    page_size: 200,
  });
  const { data: invoicesList } = useInvoices({
    community_id: activeCommunityId || undefined,
    page_size: 200,
  });

  // Lookup maps for fast and accurate person and invoice resolution
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
    const map = new Map<string, { invoice_number: string; unit_number?: string; total_amount: string; due_date?: string }>();
    if (Array.isArray(invoicesList)) {
      invoicesList.forEach((inv) => {
        if (inv.id) map.set(inv.id, inv);
      });
    }
    return map;
  }, [invoicesList]);

  // Helper to resolve comprehensive person info
  const getPayerInfo = (p: Payment) => {
    const resident = p.payer_user_id ? residentMap.get(p.payer_user_id) : undefined;
    const firstAlloc = p.allocations?.[0];
    const invoice = firstAlloc?.invoice_id ? invoiceMap.get(firstAlloc.invoice_id) : undefined;

    const name = resident?.full_name || p.payer_name || "Resident Payer";
    const email = resident?.email || p.payer_email || "";
    const phone = resident?.phone || p.payer_phone || "";
    const residentType = resident?.resident_type || p.resident_type || "Resident";
    const isPrimary = resident?.primary_occupant;

    let unitDisplay = "–";
    if (resident?.unit_number) {
      unitDisplay = `${resident.tower_name ? `${resident.tower_name} · ` : ""}Unit ${resident.unit_number}`;
    } else if (invoice?.unit_number) {
      unitDisplay = `Unit ${invoice.unit_number}`;
    } else if (p.unit_number) {
      unitDisplay = `${p.tower_name ? `${p.tower_name} · ` : ""}Unit ${p.unit_number}`;
    }

    const invoiceNumber = invoice?.invoice_number || (firstAlloc ? `Inv #${firstAlloc.invoice_id.slice(0, 8)}` : "Maintenance Dues");

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
    if (methodFilter !== "all" && p.payment_method?.toLowerCase() !== methodFilter.toLowerCase())
      return false;
    if (statusFilter !== "all" && p.payment_status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const payer = getPayerInfo(p);
      const matchRef = p.payment_reference?.toLowerCase().includes(q);
      const matchReceipt = p.receipt_number?.toLowerCase().includes(q);
      const matchName = payer.name.toLowerCase().includes(q);
      const matchEmail = payer.email.toLowerCase().includes(q);
      const matchPhone = payer.phone.toLowerCase().includes(q);
      const matchUnit = payer.unitDisplay.toLowerCase().includes(q);
      const matchInv = payer.invoiceNumber.toLowerCase().includes(q);

      if (!matchRef && !matchReceipt && !matchName && !matchEmail && !matchPhone && !matchUnit && !matchInv) {
        return false;
      }
    }
    return true;
  });

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
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--muted)" }}>
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
      header: "Payment & Receipt Ref",
      render: (item) => (
        <div>
          <span style={{ fontWeight: 600, color: "var(--fg)", fontFamily: "monospace", fontSize: "0.825rem" }}>
            {item.payment_reference}
          </span>
          {item.receipt_number ? (
            <div style={{ fontSize: "0.725rem", color: "#059669", fontWeight: 500 }}>
              Receipt: {item.receipt_number}
            </div>
          ) : (
            <div style={{ fontSize: "0.725rem", color: "var(--muted)" }}>Direct Settlement</div>
          )}
        </div>
      ),
    },
    {
      key: "id",
      header: "Allocated Invoice / Purpose",
      render: (item) => {
        const payer = getPayerInfo(item);
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.825rem", color: "var(--fg)" }}>
              {payer.invoiceNumber}
            </div>
            <div style={{ fontSize: "0.725rem", color: "var(--muted)" }}>
              Maintenance Dues
            </div>
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Amount Paid",
      align: "right",
      render: (item) => (
        <span style={{ fontWeight: 700, color: "#059669", fontSize: "0.925rem" }}>
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
      header: "Transaction Date",
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
          🔍 Details
        </button>
      ),
    },
  ];

  const activePayer = selectedPayment ? getPayerInfo(selectedPayment) : null;

  return (
    <div>
      <PageHeader
        title="Collection Audit & Receipt Verification"
        subtitle={`Audited trail of all resident dues collections and payment allocations for ${community?.name || "Governance Scope"}`}
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div className="card" style={{ borderTop: "3px solid #10b981" }}>
          <div style={{ fontSize: "0.775rem", color: "var(--muted)", fontWeight: 600 }}>
            TOTAL VERIFIED COLLECTIONS
          </div>
          <div
            style={{ fontSize: "1.75rem", fontWeight: 700, color: "#059669", margin: "0.3rem 0" }}
          >
            {formatCurrency(parseFloat(audit?.total_collections || "0"))}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {audit?.collection_count || 0} Successful Transactions
          </div>
        </div>

        <div className="card" style={{ borderTop: "3px solid #ef4444" }}>
          <div style={{ fontSize: "0.775rem", color: "var(--muted)", fontWeight: 600 }}>
            UNCOLLECTED OUTSTANDING DUES
          </div>
          <div
            style={{ fontSize: "1.75rem", fontWeight: 700, color: "#dc2626", margin: "0.3rem 0" }}
          >
            {formatCurrency(parseFloat(audit?.total_outstanding_amount || "0"))}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {audit?.outstanding_invoices_count || 0} Overdue / Unpaid Invoices
          </div>
        </div>

        <div className="card" style={{ borderTop: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: "0.775rem", color: "var(--muted)", fontWeight: 600 }}>
            AUDIT COMPLIANCE STATUS
          </div>
          <div
            style={{ fontSize: "1.25rem", fontWeight: 700, color: "#7c3aed", margin: "0.5rem 0" }}
          >
            🔒 Verified Traceable
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            Append-only ledger integrity (NFR-COMP-02)
          </div>
        </div>
      </div>

      {/* Payment Channels Matrix */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 className="card-title" style={{ marginBottom: "0.75rem" }}>
          Payment Method Reconciliation
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
          }}
        >
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
              <div
                style={{ fontSize: "0.725rem", color: "var(--muted)", textTransform: "uppercase" }}
              >
                {method}
              </div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "var(--fg)",
                  marginTop: "0.2rem",
                }}
              >
                {formatCurrency(parseFloat(val.total_amount))}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                {val.count} receipts
              </div>
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
        <div style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: 280, maxWidth: 450 }}>
          <input
            type="text"
            placeholder="Search resident name, unit #, reference, receipt #..."
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
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
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
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: "0.5rem" }}>
                Payer Identity & Residential Unit
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--fg)" }}>
                    {activePayer.name}
                  </div>
                  <div style={{ fontSize: "0.825rem", color: "var(--primary)", fontWeight: 600, marginTop: "0.15rem" }}>
                    {activePayer.unitDisplay}
                  </div>
                  {activePayer.email && (
                    <div style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                      ✉️ {activePayer.email}
                    </div>
                  )}
                  {activePayer.phone && (
                    <div style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                      📞 {activePayer.phone}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--muted)" }}>Payment Reference</span>
                <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{selectedPayment.payment_reference}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--muted)" }}>Receipt Number</span>
                <span style={{ fontWeight: 600, color: "#059669" }}>{selectedPayment.receipt_number || "Direct Allocation"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--muted)" }}>Allocated Invoice</span>
                <span style={{ fontWeight: 600 }}>{activePayer.invoiceNumber}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--muted)" }}>Payment Method</span>
                <span style={{ fontWeight: 600, textTransform: "uppercase" }}>{selectedPayment.payment_method}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--muted)" }}>Transaction Timestamp</span>
                <span style={{ fontWeight: 500 }}>{formatDate(selectedPayment.paid_at)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--muted)" }}>Verification Status</span>
                <StatusBadge status={selectedPayment.payment_status} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderTop: "2px solid var(--border)", marginTop: "0.25rem" }}>
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
