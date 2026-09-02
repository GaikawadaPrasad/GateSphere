"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useInvoices, usePayments } from "@/hooks/use-billing";
import { useCommunities } from "@/hooks/use-communities";
import type { MaintenanceInvoice, Payment } from "@/types/billing";

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<"invoices" | "payments">("invoices");
  const [communityId, setCommunityId] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data: communities } = useCommunities();
  const { data: invoices, isLoading: isInvoicesLoading } = useInvoices({
    community_id: communityId || undefined,
    page,
    page_size: pageSize,
  });

  const { data: payments, isLoading: isPaymentsLoading } = usePayments({
    community_id: communityId || undefined,
    page,
    page_size: pageSize,
  });

  const invoiceColumns: Column<MaintenanceInvoice>[] = [
    {
      key: "invoice_number",
      header: "Invoice #",
      render: (inv) => (
        <div>
          <span style={{ fontWeight: 600, color: "var(--fg)" }}>{inv.invoice_number}</span>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Unit {inv.unit_number || "–"}</div>
        </div>
      ),
    },
    {
      key: "total_amount",
      header: "Total Amount",
      align: "right",
      render: (inv) => <span style={{ fontWeight: 600 }}>{formatCurrency(inv.total_amount)}</span>,
    },
    {
      key: "balance_due",
      header: "Balance Due",
      align: "right",
      render: (inv) => (
        <span style={{ color: parseFloat(inv.balance_due) > 0 ? "var(--danger)" : "var(--success)", fontWeight: 500 }}>
          {formatCurrency(inv.balance_due)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (inv) => <StatusBadge status={inv.status} />,
    },
    {
      key: "due_date",
      header: "Due Date",
      align: "right",
      render: (inv) => <span>{formatDate(inv.due_date)}</span>,
    },
  ];

  const paymentColumns: Column<Payment>[] = [
    {
      key: "payment_reference",
      header: "Reference",
      render: (p) => <span style={{ fontWeight: 600 }}>{p.payment_reference}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (p) => <span style={{ fontWeight: 600, color: "var(--success)" }}>{formatCurrency(p.amount)}</span>,
    },
    {
      key: "payment_method",
      header: "Method",
      align: "center",
      render: (p) => <span className="badge badge-neutral">{p.payment_method?.toUpperCase()}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "paid_at",
      header: "Paid At",
      align: "right",
      render: (p) => <span>{formatDate(p.paid_at)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Billing & Financial Overview"
        subtitle="Global maintenance invoices, ledger health, and simulated payments"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Billing & Finance" }]}
        actions={
          <select
            className="select-field"
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            style={{ width: "auto", height: 36, padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
          >
            <option value="">All Communities</option>
            {communities?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <button
          type="button"
          className={`btn ${activeTab === "invoices" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("invoices")}
        >
          Maintenance Invoices
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "payments" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("payments")}
        >
          Payment Transactions
        </button>
      </div>

      <div className="card">
        {activeTab === "invoices" ? (
          <DataTable
            columns={invoiceColumns as unknown as Column<Record<string, unknown>>[]}
            data={invoices as unknown as Record<string, unknown>[]}
            isLoading={isInvoicesLoading}
            page={page}
            pageSize={pageSize}
            total={invoices?.length || 0}
            onPageChange={setPage}
            emptyTitle="No invoices found"
            emptyDescription="No maintenance invoices generated yet for this community scope."
          />
        ) : (
          <DataTable
            columns={paymentColumns as unknown as Column<Record<string, unknown>>[]}
            data={payments as unknown as Record<string, unknown>[]}
            isLoading={isPaymentsLoading}
            page={page}
            pageSize={pageSize}
            total={payments?.length || 0}
            onPageChange={setPage}
            emptyTitle="No payments recorded"
            emptyDescription="No payment transactions found in this scope."
          />
        )}
      </div>
    </div>
  );
}
