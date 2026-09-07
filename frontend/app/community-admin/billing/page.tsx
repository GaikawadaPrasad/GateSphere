"use client";

import { useState } from "react";
import { useUiStore } from "@/store/ui";
import { useInvoices, usePayments, useChargeHeads, useBillingRules, useUnitLedger } from "@/hooks/use-billing";
import { useFinancialStats } from "@/hooks/use-dashboards";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterPanel } from "@/components/common/FilterPanel";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { MaintenanceInvoice, Payment, ChargeHead, UnitLedgerEntry } from "@/types/billing";
import { billingApi } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function CommunityAdminBillingPage() {
  const { activeCommunityId } = useUiStore();
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "rules">("invoices");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Queries
  const { data: financial } = useFinancialStats(activeCommunityId || undefined);
  const { data: invoices, isLoading: invoicesLoading } = useInvoices({
    community_id: activeCommunityId || undefined,
    page_size: 50,
  });
  const { data: payments, isLoading: paymentsLoading } = usePayments({
    community_id: activeCommunityId || undefined,
    page_size: 50,
  });
  const { data: chargeHeads, isLoading: chargeHeadsLoading } = useChargeHeads(activeCommunityId || undefined);
  const { data: billingRules } = useBillingRules(activeCommunityId || undefined);
  const { data: ledgerEntries, isLoading: ledgerLoading } = useUnitLedger(selectedUnitId || undefined);

  // Handle Export CSV
  const handleExportInvoices = async () => {
    try {
      const csvData = await billingApi.exportInvoicesCsv({
        community_id: activeCommunityId || undefined,
        invoice_status: statusFilter || undefined,
      });
      const blob = new Blob([csvData], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportPayments = async () => {
    try {
      const csvData = await billingApi.exportPaymentsCsv(activeCommunityId || undefined);
      const blob = new Blob([csvData], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  };

  // Invoices Columns
  const invoiceColumns: Column<MaintenanceInvoice>[] = [
    {
      key: "invoice_number",
      header: "Invoice #",
      render: (i) => <strong>{i.invoice_number}</strong>,
    },
    {
      key: "unit_number",
      header: "Unit",
      render: (i) => <span>Unit {i.unit_number || i.unit_id?.slice(0, 8)}</span>,
    },
    {
      key: "total_amount",
      header: "Total Billed",
      render: (i) => formatCurrency(Number(i.total_amount)),
    },
    {
      key: "amount_paid",
      header: "Paid",
      render: (i) => formatCurrency(Number(i.amount_paid)),
    },
    {
      key: "balance_due",
      header: "Balance Due",
      render: (i) => (
        <span style={{ fontWeight: Number(i.balance_due) > 0 ? 600 : 400, color: Number(i.balance_due) > 0 ? "#dc2626" : "var(--fg)" }}>
          {formatCurrency(Number(i.balance_due))}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: "due_date",
      header: "Due Date",
      render: (i) => i.due_date,
    },
    {
      key: "actions",
      header: "Ledger",
      render: (i) => (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
          onClick={() => setSelectedUnitId(i.unit_id)}
        >
          Unit Ledger →
        </button>
      ),
    },
  ];

  // Payments Columns
  const paymentColumns: Column<Payment>[] = [
    {
      key: "payment_reference",
      header: "Ref / Receipt",
      render: (p) => (
        <div>
          <strong>{p.payment_reference}</strong>
          {p.receipt_number && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>#{p.receipt_number}</div>}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (p) => <strong style={{ color: "#059669" }}>{formatCurrency(Number(p.amount))}</strong>,
    },
    {
      key: "payment_method",
      header: "Payment Method",
      render: (p) => <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>{p.payment_method}</span>,
    },
    {
      key: "payment_status",
      header: "Status",
      render: (p) => <StatusBadge status={p.payment_status || "success"} />,
    },
    {
      key: "paid_at",
      header: "Paid At",
      render: (p) => formatDateTime(p.paid_at),
    },
  ];

  // Charge Heads Columns
  const chargeHeadColumns: Column<ChargeHead>[] = [
    { key: "name", header: "Charge Name", render: (c) => <strong>{c.name}</strong> },
    { key: "code", header: "Code", render: (c) => <span className="badge badge-neutral">{c.code}</span> },
    { key: "charge_type", header: "Type", render: (c) => <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>{c.charge_type}</span> },
    { key: "default_amount", header: "Default Rate", render: (c) => formatCurrency(Number(c.default_amount)) },
    { key: "is_active", header: "Status", render: (c) => <span className={`badge ${c.is_active ? "badge-success" : "badge-neutral"}`}>{c.is_active ? "Active" : "Disabled"}</span> },
  ];

  // Ledger Columns
  const ledgerColumns: Column<UnitLedgerEntry>[] = [
    { key: "created_at", header: "Date", render: (l) => formatDateTime(l.created_at) },
    { key: "description", header: "Description", render: (l) => l.description },
    {
      key: "entry_type",
      header: "Type",
      render: (l) => (
        <span className={`badge ${l.entry_type === "credit" ? "badge-success" : "badge-warning"}`} style={{ textTransform: "uppercase" }}>
          {l.entry_type}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (l) => (
        <strong style={{ color: l.entry_type === "credit" ? "#059669" : "#dc2626" }}>
          {l.entry_type === "credit" ? "+" : "-"}{formatCurrency(Number(l.amount))}
        </strong>
      ),
    },
    { key: "balance_after", header: "Balance After", render: (l) => formatCurrency(Number(l.balance_after)) },
  ];

  const billed = Number(financial?.total_billed || 0);
  const collected = Number(financial?.total_collected || 0);
  const outstanding = Number(financial?.outstanding_balance || 0);
  const collectionRate = billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 100;

  const filteredInvoices = invoices?.filter((i) => {
    const matchesSearch =
      i.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.unit_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <PageHeader
        title="Billing &amp; Financial Health"
        description="Community invoice reconciliation, payment collections, resident unit ledgers, and maintenance tariff rules."
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {activeTab === "invoices" && (
              <button type="button" className="btn btn-secondary" onClick={handleExportInvoices}>
                📥 Export Invoices CSV
              </button>
            )}
            {activeTab === "payments" && (
              <button type="button" className="btn btn-secondary" onClick={handleExportPayments}>
                📥 Export Payments CSV
              </button>
            )}
          </div>
        }
      />

      {/* Financial Health Overview KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>Total Invoiced</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--fg)", marginTop: "0.25rem" }}>
            {formatCurrency(billed)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>Maintenance billed</div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>Total Collected</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#059669", marginTop: "0.25rem" }}>
            {formatCurrency(collected)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: "0.25rem" }}>{collectionRate}% collection rate</div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>Outstanding Balance</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: outstanding > 0 ? "#dc2626" : "var(--fg)", marginTop: "0.25rem" }}>
            {formatCurrency(outstanding)}
          </div>
          <div style={{ fontSize: "0.75rem", color: outstanding > 0 ? "#dc2626" : "var(--muted)", marginTop: "0.25rem" }}>
            {outstanding > 0 ? "Pending resident dues" : "Zero arrears"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "invoices" ? 700 : 500,
            color: activeTab === "invoices" ? "var(--primary)" : "var(--muted)",
            borderBottom: activeTab === "invoices" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          📄 Invoices Ledger ({invoices?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "payments" ? 700 : 500,
            color: activeTab === "payments" ? "var(--primary)" : "var(--muted)",
            borderBottom: activeTab === "payments" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          💳 Payment Transactions ({payments?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "rules" ? 700 : 500,
            color: activeTab === "rules" ? "var(--primary)" : "var(--muted)",
            borderBottom: activeTab === "rules" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
          }}
        >
          ⚙️ Charge Heads &amp; Rules ({chargeHeads?.length || 0})
        </button>
      </div>

      {activeTab === "invoices" && (
        <div>
          <FilterPanel
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search invoice # or unit..."
            filterValue={statusFilter}
            onFilterChange={setStatusFilter}
            filterLabel="Invoice Status"
            filterOptions={[
              { label: "Paid", value: "paid" },
              { label: "Issued / Posted", value: "posted" },
              { label: "Partially Paid", value: "partially_paid" },
              { label: "Overdue", value: "overdue" },
              { label: "Draft", value: "draft" },
            ]}
          />

          <DataTable
            columns={invoiceColumns}
            data={filteredInvoices as (MaintenanceInvoice & Record<string, unknown>)[]}
            isLoading={invoicesLoading}
            emptyTitle="No invoices found"
            emptyDescription="No maintenance invoices match the current filter."
          />
        </div>
      )}

      {activeTab === "payments" && (
        <DataTable
          columns={paymentColumns}
          data={payments as (Payment & Record<string, unknown>)[]}
          isLoading={paymentsLoading}
          emptyTitle="No payments recorded"
          emptyDescription="Resident maintenance collections and simulated payments will appear here."
        />
      )}

      {activeTab === "rules" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {billingRules && (
            <div className="card" style={{ background: "#f8fafc" }}>
              <h4 style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>📋 Community Billing Rules</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Billing Cycle</div>
                  <div style={{ fontWeight: 600, textTransform: "capitalize", marginTop: "0.15rem" }}>{billingRules.billing_frequency}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Payment Window</div>
                  <div style={{ fontWeight: 600, marginTop: "0.15rem" }}>{billingRules.due_days} days from issue</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Grace Period</div>
                  <div style={{ fontWeight: 600, marginTop: "0.15rem" }}>{billingRules.grace_period_days} days</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Late Fee Penalty</div>
                  <div style={{ fontWeight: 600, marginTop: "0.15rem" }}>
                    {billingRules.late_fee_type === "percentage" ? `${billingRules.late_fee_amount}%` : formatCurrency(Number(billingRules.late_fee_amount))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <h4 style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>Charge Heads Catalogue</h4>
            <DataTable
              columns={chargeHeadColumns}
              data={chargeHeads as (ChargeHead & Record<string, unknown>)[]}
              isLoading={chargeHeadsLoading}
              emptyTitle="No charge heads configured"
              emptyDescription="Charge heads define line items such as maintenance fees, parking, and clubhouse utilities."
            />
          </div>
        </div>
      )}

      {/* Unit Ledger Modal */}
      <Modal
        isOpen={Boolean(selectedUnitId)}
        onClose={() => setSelectedUnitId(null)}
        title="Unit Financial Ledger &amp; Audit"
      >
        <div>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Complete historical credit and debit audit trail for this residential unit.
          </p>
          <DataTable
            columns={ledgerColumns}
            data={ledgerEntries as (UnitLedgerEntry & Record<string, unknown>)[]}
            isLoading={ledgerLoading}
            emptyTitle="No ledger transactions"
            emptyDescription="No invoices or payment adjustments posted for this unit yet."
          />
        </div>
      </Modal>
    </div>
  );
}
