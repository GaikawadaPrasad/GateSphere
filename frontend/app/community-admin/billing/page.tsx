"use client";

import { useState } from "react";
import { useUiStore } from "@/store/ui";
import {
  useInvoices,
  usePayments,
  useChargeHeads,
  useBillingRules,
  useUnitLedger,
  useCreateInvoice,
  usePostInvoice,
  useCancelInvoice,
  useRecordPayment,
  useCreateChargeHead,
} from "@/hooks/use-billing";
import { useCommunityUnits } from "@/hooks/use-communities";
import { useFinancialStats } from "@/hooks/use-dashboards";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterPanel } from "@/components/common/FilterPanel";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import type {
  MaintenanceInvoice,
  Payment,
  ChargeHead,
  ChargeHeadCalculationType,
  UnitLedgerEntry,
} from "@/types/billing";
import { CALCULATION_TYPE_LABELS } from "@/types/billing";
import { InvoiceDetailModal } from "@/components/billing/InvoiceDetailModal";
import { PaymentReceiptModal } from "@/components/billing/PaymentReceiptModal";
import { billingApi } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/store/toast";

interface LineItemForm {
  charge_head_id: string;
  description: string;
  quantity: number;
  unit_rate: number;
  taxable: boolean;
}

export default function CommunityAdminBillingPage() {
  const { activeCommunityId } = useUiStore();
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "rules">("invoices");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Modal State for Invoice Generation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createUnitId, setCreateUnitId] = useState("");
  const [billingPeriodStart, setBillingPeriodStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [billingPeriodEnd, setBillingPeriodEnd] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() =>
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
  );
  const [discount, setDiscount] = useState<number>(0);
  const [postImmediately, setPostImmediately] = useState(true);
  const [lineItems, setLineItems] = useState<LineItemForm[]>([
    {
      charge_head_id: "",
      description: "Monthly Maintenance Assessment",
      quantity: 1,
      unit_rate: 2500,
      taxable: false,
    },
  ]);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Queries
  const { data: financial } = useFinancialStats(activeCommunityId || undefined);
  const {
    data: invoices,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useInvoices({
    community_id: activeCommunityId || undefined,
    page_size: 50,
  });
  const { data: payments, isLoading: paymentsLoading } = usePayments({
    community_id: activeCommunityId || undefined,
    page_size: 50,
  });
  const { data: chargeHeads, isLoading: chargeHeadsLoading } = useChargeHeads(
    activeCommunityId || undefined,
  );
  const { data: billingRules } = useBillingRules(activeCommunityId || undefined);
  const { data: units } = useCommunityUnits(activeCommunityId || undefined);
  const { data: ledgerEntries, isLoading: ledgerLoading } = useUnitLedger(
    selectedUnitId || undefined,
  );

  // Export Loading States
  const [isExportingInvoices, setIsExportingInvoices] = useState(false);
  const [isExportingPayments, setIsExportingPayments] = useState(false);

  // Detail Modal States
  const [selectedInvoice, setSelectedInvoice] = useState<MaintenanceInvoice | null>(null);
  const [selectedPaymentReceipt, setSelectedPaymentReceipt] = useState<any | null>(null);

  // Record Offline Payment Modal State
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    unit_id: "",
    invoice_id: "",
    amount: 0,
    payment_method: "upi",
    remarks: "",
  });
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [recordPaymentError, setRecordPaymentError] = useState("");

  // Add Charge Head Modal State
  const [isAddChargeHeadOpen, setIsAddChargeHeadOpen] = useState(false);
  const [chargeHeadForm, setChargeHeadForm] = useState({
    name: "",
    code: "",
    calculation_type: "flat" as ChargeHeadCalculationType,
    default_amount: 1500,
    taxable: false,
  });
  const [isSubmittingChargeHead, setIsSubmittingChargeHead] = useState(false);
  const [chargeHeadError, setChargeHeadError] = useState("");

  // Mutations
  const createInvoiceMutation = useCreateInvoice();
  const postInvoiceMutation = usePostInvoice();
  const cancelInvoiceMutation = useCancelInvoice();
  const recordPaymentMutation = useRecordPayment();
  const createChargeHeadMutation = useCreateChargeHead();

  // Reset Modal Form
  const resetInvoiceForm = () => {
    setCreateUnitId(units?.[0]?.id || "");
    const d = new Date();
    setBillingPeriodStart(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
    setBillingPeriodEnd(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10));
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate(new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10));
    setDiscount(0);
    setPostImmediately(true);
    setFormError("");

    const defaultCharge = chargeHeads?.[0];
    setLineItems([
      {
        charge_head_id: defaultCharge?.id || "",
        description: defaultCharge?.name || "Monthly Maintenance Assessment",
        quantity: 1,
        unit_rate: Number(defaultCharge?.default_amount) || 2500,
        taxable: false,
      },
    ]);
  };

  const handleChargeHeadChange = (index: number, chargeHeadId: string) => {
    const ch = chargeHeads?.find((c) => c.id === chargeHeadId);
    setLineItems((prev) => {
      const updated = [...prev];
      if (ch) {
        updated[index] = {
          ...updated[index],
          charge_head_id: ch.id,
          description: ch.name,
          unit_rate: Number(ch.default_amount) || 0,
        };
      } else {
        updated[index] = {
          ...updated[index],
          charge_head_id: "",
        };
      }
      return updated;
    });
  };

  const updateLineItem = <K extends keyof LineItemForm>(
    index: number,
    field: K,
    val: LineItemForm[K],
  ) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const addLineItem = () => {
    const defaultCharge = chargeHeads?.[0];
    setLineItems((prev) => [
      ...prev,
      {
        charge_head_id: defaultCharge?.id || "",
        description: defaultCharge?.name || "Utility / Common Area Charge",
        quantity: 1,
        unit_rate: Number(defaultCharge?.default_amount) || 500,
        taxable: false,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const itemsSubtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0),
    0,
  );
  const taxRatePercent = Number(
    (billingRules as any)?.tax_percent ?? (billingRules as any)?.[0]?.tax_percent ?? 0,
  );
  const taxableSubtotal = lineItems
    .filter((i) => i.taxable)
    .reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0), 0);
  const estimatedTax = (taxableSubtotal * taxRatePercent) / 100;
  const totalCalculated = Math.max(0, itemsSubtotal - (Number(discount) || 0) + estimatedTax);

  // Handle Create Invoice Submit
  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUnitId) {
      setFormError("Please select a residential unit.");
      return;
    }
    if (billingPeriodStart && billingPeriodEnd && billingPeriodEnd < billingPeriodStart) {
      setFormError("Billing period end date cannot precede start date.");
      return;
    }
    if (issueDate && dueDate && dueDate < issueDate) {
      setFormError("Invoice due date cannot precede issue date.");
      return;
    }
    if (Number(discount) < 0) {
      setFormError("Discount amount cannot be negative.");
      return;
    }
    if (Number(discount) > itemsSubtotal) {
      setFormError("Discount cannot exceed the invoice items subtotal.");
      return;
    }
    if (
      lineItems.length === 0 ||
      lineItems.some(
        (i) => !i.description.trim() || Number(i.quantity) <= 0 || Number(i.unit_rate) < 0,
      )
    ) {
      setFormError(
        "Please ensure all line items have a description (min 2 chars), quantity > 0, and rate >= 0.",
      );
      return;
    }

    setFormError("");
    setIsSubmitting(true);
    try {
      const newInvoice = await createInvoiceMutation.mutateAsync({
        unit_id: createUnitId,
        billing_period_start: billingPeriodStart || undefined,
        billing_period_end: billingPeriodEnd || undefined,
        issue_date: issueDate || undefined,
        due_date: dueDate || undefined,
        discount: Number(discount) || 0,
        items: lineItems.map((item) => ({
          description: item.description.trim(),
          charge_head_id: item.charge_head_id || undefined,
          quantity: Number(item.quantity),
          unit_rate: Number(item.unit_rate),
          taxable: Boolean(item.taxable),
        })),
      });

      if (postImmediately && newInvoice?.id) {
        await postInvoiceMutation.mutateAsync(newInvoice.id);
      }

      await refetchInvoices();
      setIsCreateModalOpen(false);
      toast.success(
        postImmediately
          ? "Invoice generated and posted to resident ledger."
          : "Draft invoice generated successfully.",
        "Invoice Created",
      );
    } catch (err: any) {
      const errMsg = err?.message || "Failed to generate invoice.";
      setFormError(errMsg);
      toast.error(errMsg, "Billing Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Export CSV
  const handleExportInvoices = async () => {
    if (!activeCommunityId) {
      toast.error("Please select an active community to export invoices.", "Export Failed");
      return;
    }
    try {
      setIsExportingInvoices(true);
      const csvData = await billingApi.exportInvoicesCsv({
        community_id: activeCommunityId,
        status: statusFilter || undefined,
      });
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Invoices CSV downloaded successfully.", "Export Complete");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to export invoices CSV.", "Export Failed");
    } finally {
      setIsExportingInvoices(false);
    }
  };

  const handleExportPayments = async () => {
    if (!activeCommunityId) {
      toast.error("Please select an active community to export payments.", "Export Failed");
      return;
    }
    try {
      setIsExportingPayments(true);
      const csvData = await billingApi.exportPaymentsCsv({
        community_id: activeCommunityId,
      });
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Payments CSV downloaded successfully.", "Export Complete");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to export payments CSV.", "Export Failed");
    } finally {
      setIsExportingPayments(false);
    }
  };

  // Handle Record Offline Payment Submit
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) {
      setRecordPaymentError("Active community required.");
      return;
    }
    if (!paymentForm.unit_id) {
      setRecordPaymentError("Please select a target residential unit.");
      return;
    }
    if (Number(paymentForm.amount) <= 0) {
      setRecordPaymentError("Payment amount must be greater than 0.");
      return;
    }

    try {
      setIsRecordingPayment(true);
      setRecordPaymentError("");
      const allocations = paymentForm.invoice_id
        ? [{ invoice_id: paymentForm.invoice_id, amount: Number(paymentForm.amount) }]
        : undefined;

      await recordPaymentMutation.mutateAsync({
        community_id: activeCommunityId,
        unit_id: paymentForm.unit_id,
        amount: Number(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        remarks: paymentForm.remarks.trim() || undefined,
        allocations,
      });

      toast.success("Payment recorded and posted to unit ledger.", "Payment Recorded");
      setIsRecordPaymentOpen(false);
      await refetchInvoices();
    } catch (err: any) {
      setRecordPaymentError(err?.message || "Failed to record payment.");
    } finally {
      setIsRecordingPayment(false);
    }
  };

  // Handle Add Charge Head Submit
  const handleCreateChargeHeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) {
      setChargeHeadError("Active community required.");
      return;
    }
    const trimmedName = chargeHeadForm.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setChargeHeadError("Charge head name must be at least 2 characters long.");
      return;
    }
    const trimmedCode = chargeHeadForm.code.trim().toUpperCase();
    if (!trimmedCode || !/^[A-Z0-9_-]{2,20}$/.test(trimmedCode)) {
      setChargeHeadError(
        "Charge head code must be 2-20 alphanumeric characters or dashes (e.g. MAINT-01).",
      );
      return;
    }
    if (Number(chargeHeadForm.default_amount) < 0) {
      setChargeHeadError("Default amount cannot be negative.");
      return;
    }

    try {
      setIsSubmittingChargeHead(true);
      setChargeHeadError("");
      await createChargeHeadMutation.mutateAsync({
        communityId: activeCommunityId,
        data: {
          name: trimmedName,
          code: trimmedCode,
          calculation_type: chargeHeadForm.calculation_type,
          default_amount: Number(chargeHeadForm.default_amount),
          taxable: chargeHeadForm.taxable,
        },
      });
      toast.success(`Charge head "${trimmedName}" created successfully.`, "Charge Head Created");
      setIsAddChargeHeadOpen(false);
    } catch (err: any) {
      setChargeHeadError(err?.message || "Failed to create charge head.");
    } finally {
      setIsSubmittingChargeHead(false);
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
        <span
          style={{
            fontWeight: Number(i.balance_due) > 0 ? 600 : 400,
            color: Number(i.balance_due) > 0 ? "#dc2626" : "var(--fg)",
          }}
        >
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
      render: (i) => i.due_date || "–",
    },
    {
      key: "actions",
      header: "Actions",
      render: (i) => (
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {i.status === "draft" && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
              onClick={async () => {
                if (confirm(`Post invoice ${i.invoice_number} to unit ledger now?`)) {
                  try {
                    await postInvoiceMutation.mutateAsync(i.id);
                    await refetchInvoices();
                    toast.success(
                      `Invoice ${i.invoice_number} posted successfully.`,
                      "Invoice Posted",
                    );
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to post invoice.", "Action Failed");
                  }
                }
              }}
              disabled={postInvoiceMutation.isPending}
            >
              📢 Post
            </button>
          )}
          {(i.status === "draft" || i.status === "posted" || i.status === "overdue") &&
            Number(i.amount_paid) === 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", color: "#dc2626" }}
                onClick={async () => {
                  if (confirm(`Cancel invoice ${i.invoice_number}?`)) {
                    try {
                      await cancelInvoiceMutation.mutateAsync(i.id);
                      await refetchInvoices();
                      toast.success(`Invoice ${i.invoice_number} cancelled.`, "Invoice Cancelled");
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to cancel invoice.", "Action Failed");
                    }
                  }
                }}
                disabled={cancelInvoiceMutation.isPending}
              >
                Cancel
              </button>
            )}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
            onClick={async () => {
              setSelectedInvoice(i);
              try {
                const full = await billingApi.getInvoice(i.id);
                if (full) setSelectedInvoice(full);
              } catch {
                // keep current i
              }
            }}
          >
            🔍 Details
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
            onClick={() => setSelectedUnitId(i.unit_id)}
          >
            Ledger →
          </button>
        </div>
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
          {p.receipt_number && (
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>#{p.receipt_number}</div>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (p) => (
        <strong style={{ color: "#059669" }}>{formatCurrency(Number(p.amount))}</strong>
      ),
    },
    {
      key: "payment_method",
      header: "Payment Method",
      render: (p) => (
        <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
          {p.payment_method}
        </span>
      ),
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
    {
      key: "actions",
      header: "Actions",
      render: (p) => (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
          onClick={async () => {
            setSelectedPaymentReceipt(p);
            try {
              const receipt = await billingApi.getPaymentReceipt(p.id);
              if (receipt) setSelectedPaymentReceipt(receipt);
            } catch {
              // fallback to p
            }
          }}
        >
          🧾 Receipt
        </button>
      ),
    },
  ];

  // Charge Heads Columns
  const chargeHeadColumns: Column<ChargeHead>[] = [
    { key: "name", header: "Charge Name", render: (c) => <strong>{c.name}</strong> },
    {
      key: "code",
      header: "Code",
      render: (c) => <span className="badge badge-neutral">{c.code}</span>,
    },
    {
      key: "calculation_type",
      header: "Calculation",
      render: (c) => (
        <span className="badge badge-primary">
          {CALCULATION_TYPE_LABELS[c.calculation_type] ?? c.calculation_type}
        </span>
      ),
    },
    {
      key: "default_amount",
      header: "Default Rate",
      render: (c) => formatCurrency(Number(c.default_amount)),
    },
    {
      key: "is_active",
      header: "Status",
      render: (c) => (
        <span className={`badge ${c.is_active ? "badge-success" : "badge-neutral"}`}>
          {c.is_active ? "Active" : "Disabled"}
        </span>
      ),
    },
  ];

  // Ledger Columns
  const ledgerColumns: Column<UnitLedgerEntry>[] = [
    { key: "created_at", header: "Date", render: (l) => formatDateTime(l.created_at) },
    { key: "description", header: "Description", render: (l) => l.description },
    {
      key: "entry_type",
      header: "Type",
      render: (l) => (
        <span
          className={`badge ${l.entry_type === "credit" ? "badge-success" : "badge-warning"}`}
          style={{ textTransform: "uppercase" }}
        >
          {l.entry_type}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (l) => (
        <strong style={{ color: l.entry_type === "credit" ? "#059669" : "#dc2626" }}>
          {l.entry_type === "credit" ? "+" : "-"}
          {formatCurrency(Number(l.amount))}
        </strong>
      ),
    },
    {
      key: "balance_after",
      header: "Balance After",
      render: (l) => formatCurrency(Number(l.balance_after)),
    },
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
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    resetInvoiceForm();
                    setIsCreateModalOpen(true);
                  }}
                >
                  🧾 Generate Invoice
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleExportInvoices}
                  disabled={isExportingInvoices}
                >
                  {isExportingInvoices ? "⏳ Exporting..." : "📥 Export Invoices CSV"}
                </button>
              </>
            )}
            {activeTab === "payments" && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setRecordPaymentError("");
                    setPaymentForm({
                      unit_id: units?.[0]?.id || "",
                      invoice_id: "",
                      amount: 0,
                      payment_method: "upi",
                      remarks: "",
                    });
                    setIsRecordPaymentOpen(true);
                  }}
                >
                  💳 + Record Payment
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleExportPayments}
                  disabled={isExportingPayments}
                >
                  {isExportingPayments ? "⏳ Exporting..." : "📥 Export Payments CSV"}
                </button>
              </>
            )}
            {activeTab === "rules" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setChargeHeadError("");
                  setChargeHeadForm({
                    name: "",
                    code: "",
                    calculation_type: "flat",
                    default_amount: 1500,
                    taxable: false,
                  });
                  setIsAddChargeHeadOpen(true);
                }}
              >
                ➕ Add Charge Head
              </button>
            )}
          </div>
        }
      />

      {/* Financial Health Overview KPI Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>
            Total Invoiced
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "var(--fg)",
              marginTop: "0.25rem",
            }}
          >
            {formatCurrency(billed)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
            Maintenance billed
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>
            Total Collected
          </div>
          <div
            style={{ fontSize: "1.4rem", fontWeight: 700, color: "#059669", marginTop: "0.25rem" }}
          >
            {formatCurrency(collected)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#059669", marginTop: "0.25rem" }}>
            {collectionRate}% collection rate
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>
            Outstanding Balance
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              color: outstanding > 0 ? "#dc2626" : "var(--fg)",
              marginTop: "0.25rem",
            }}
          >
            {formatCurrency(outstanding)}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: outstanding > 0 ? "#dc2626" : "var(--muted)",
              marginTop: "0.25rem",
            }}
          >
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
            borderBottom:
              activeTab === "invoices" ? "2px solid var(--primary)" : "2px solid transparent",
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
            borderBottom:
              activeTab === "payments" ? "2px solid var(--primary)" : "2px solid transparent",
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
            borderBottom:
              activeTab === "rules" ? "2px solid var(--primary)" : "2px solid transparent",
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
              { label: "Cancelled", value: "cancelled" },
            ]}
          />

          <DataTable
            columns={invoiceColumns}
            data={filteredInvoices as (MaintenanceInvoice & Record<string, unknown>)[]}
            isLoading={invoicesLoading}
            emptyTitle="No invoices found"
            emptyDescription="No maintenance invoices match the current filter."
            enableClientPagination={true}
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
          enableClientPagination={true}
        />
      )}

      {activeTab === "rules" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {billingRules && (
            <div className="card" style={{ background: "#f8fafc" }}>
              <h4 style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
                📋 Community Billing Rules
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "1rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Billing Cycle</div>
                  <div
                    style={{ fontWeight: 600, textTransform: "capitalize", marginTop: "0.15rem" }}
                  >
                    {(billingRules as any)?.billing_frequency ||
                      (billingRules as any)?.[0]?.billing_frequency ||
                      "Monthly"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Payment Window</div>
                  <div style={{ fontWeight: 600, marginTop: "0.15rem" }}>
                    {(billingRules as any)?.due_days ?? (billingRules as any)?.[0]?.due_days ?? 15}{" "}
                    days from issue
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Grace Period</div>
                  <div style={{ fontWeight: 600, marginTop: "0.15rem" }}>
                    {(billingRules as any)?.grace_period_days ??
                      (billingRules as any)?.[0]?.grace_period_days ??
                      5}{" "}
                    days
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Late Fee Penalty</div>
                  <div style={{ fontWeight: 600, marginTop: "0.15rem" }}>
                    {((billingRules as any)?.late_fee_type ||
                      (billingRules as any)?.[0]?.late_fee_type) === "percentage"
                      ? `${(billingRules as any)?.late_fee_amount ?? (billingRules as any)?.[0]?.late_fee_amount ?? 5}%`
                      : formatCurrency(
                          Number(
                            (billingRules as any)?.late_fee_amount ??
                              (billingRules as any)?.[0]?.late_fee_amount ??
                              0,
                          ),
                        )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Charge Heads Catalogue</h4>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                onClick={() => {
                  setChargeHeadError("");
                  setChargeHeadForm({
                    name: "",
                    code: "",
                    calculation_type: "flat",
                    default_amount: 1500,
                    taxable: false,
                  });
                  setIsAddChargeHeadOpen(true);
                }}
              >
                ➕ Add Charge Head
              </button>
            </div>
            <DataTable
              columns={chargeHeadColumns}
              data={chargeHeads as (ChargeHead & Record<string, unknown>)[]}
              isLoading={chargeHeadsLoading}
              emptyTitle="No charge heads configured"
              emptyDescription="Charge heads define line items such as maintenance fees, parking, and clubhouse utilities."
              enableClientPagination={true}
            />
          </div>
        </div>
      )}

      {/* Generate / Create Invoice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="🧾 Generate Maintenance Invoice"
      >
        <form onSubmit={handleCreateInvoiceSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {formError && (
              <div
                style={{
                  padding: "0.6rem 0.8rem",
                  background: "#fee2e2",
                  border: "1px solid #f87171",
                  borderRadius: "6px",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {formError}
              </div>
            )}

            {/* Target Unit */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                Target Residential Unit <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                className="select-field"
                value={createUnitId}
                onChange={(e) => setCreateUnitId(e.target.value)}
                required
                style={{ width: "100%" }}
              >
                <option value="">Select a unit...</option>
                {units && units.length > 0 ? (
                  units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unit_number} {u.unit_type ? `(${u.unit_type})` : ""}{" "}
                      {u.sq_ft ? `• ${u.sq_ft} sqft` : ""}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    No units found in community
                  </option>
                )}
              </select>
            </div>

            {/* Billing Period */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.3rem",
                  }}
                >
                  Period Start
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={billingPeriodStart}
                  onChange={(e) => setBillingPeriodStart(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.3rem",
                  }}
                >
                  Period End
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={billingPeriodEnd}
                  onChange={(e) => setBillingPeriodEnd(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Issue Date & Due Date */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.3rem",
                  }}
                >
                  Issue Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.3rem",
                  }}
                >
                  Due Date
                </label>
                <input
                  type="date"
                  className="input-field"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Line Items Section */}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: "0.85rem",
                marginTop: "0.25rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.6rem",
                }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Invoice Line Items</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                  onClick={addLineItem}
                >
                  + Add Line Item
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "0.75rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--muted)",
                            display: "block",
                            marginBottom: "0.2rem",
                          }}
                        >
                          Charge Head Preset
                        </label>
                        <select
                          className="select-field"
                          value={item.charge_head_id}
                          onChange={(e) => handleChargeHeadChange(idx, e.target.value)}
                          style={{ width: "100%", fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                        >
                          <option value="">Custom Charge Head</option>
                          {chargeHeads?.map((ch) => (
                            <option key={ch.id} value={ch.id}>
                              {ch.name} ({formatCurrency(Number(ch.default_amount))})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--muted)",
                            display: "block",
                            marginBottom: "0.2rem",
                          }}
                        >
                          Description *
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          value={item.description}
                          onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                          placeholder="Line item description"
                          required
                          style={{ width: "100%", fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr auto",
                        gap: "0.5rem",
                        alignItems: "flex-end",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--muted)",
                            display: "block",
                            marginBottom: "0.2rem",
                          }}
                        >
                          Qty
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          className="input-field"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(idx, "quantity", Number(e.target.value))}
                          style={{ width: "100%", fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--muted)",
                            display: "block",
                            marginBottom: "0.2rem",
                          }}
                        >
                          Unit Rate (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input-field"
                          value={item.unit_rate}
                          onChange={(e) => updateLineItem(idx, "unit_rate", Number(e.target.value))}
                          style={{ width: "100%", fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--muted)",
                            display: "block",
                            marginBottom: "0.2rem",
                          }}
                        >
                          Total Amount
                        </label>
                        <div
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            padding: "0.35rem 0",
                            color: "var(--fg)",
                          }}
                        >
                          {formatCurrency(
                            (Number(item.quantity) || 0) * (Number(item.unit_rate) || 0),
                          )}
                        </div>
                      </div>
                      <div>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => removeLineItem(idx)}
                            style={{
                              fontSize: "0.75rem",
                              padding: "0.35rem 0.5rem",
                              color: "#dc2626",
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Discount & Immediate Post */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.3rem",
                  }}
                >
                  Discount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ paddingTop: "1.2rem" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={postImmediately}
                    onChange={(e) => setPostImmediately(e.target.checked)}
                  />
                  <span>Post &amp; issue immediately (Active Ledger)</span>
                </label>
              </div>
            </div>

            {/* Invoice Total Summary Card */}
            <div
              style={{
                background: "#f1f5f9",
                borderRadius: "6px",
                padding: "0.85rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Items Subtotal:</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(itemsSubtotal)}</span>
              </div>
              {Number(discount) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#059669" }}>
                  <span>Discount Applied:</span>
                  <span>-{formatCurrency(Number(discount))}</span>
                </div>
              )}
              {estimatedTax > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>Tax ({taxRatePercent}%):</span>
                  <span>+{formatCurrency(estimatedTax)}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "0.4rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--fg)",
                }}
              >
                <span>Total Invoice Due:</span>
                <span style={{ color: "var(--primary)" }}>{formatCurrency(totalCalculated)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !createUnitId}
              >
                {isSubmitting
                  ? "Generating..."
                  : postImmediately
                    ? "🧾 Generate & Post Invoice"
                    : "💾 Save as Draft"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

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
            enableClientPagination={true}
          />
        </div>
      </Modal>

      <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />

      <PaymentReceiptModal
        receipt={selectedPaymentReceipt}
        onClose={() => setSelectedPaymentReceipt(null)}
      />

      {/* Record Offline Payment Modal */}
      <Modal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        title="💳 Record Offline Collection / Payment"
      >
        <form onSubmit={handleRecordPaymentSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {recordPaymentError && (
              <div
                style={{
                  padding: "0.6rem 0.8rem",
                  background: "#fee2e2",
                  border: "1px solid #f87171",
                  borderRadius: "6px",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {recordPaymentError}
              </div>
            )}

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                Target Residential Unit <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                className="select-field"
                value={paymentForm.unit_id}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, unit_id: e.target.value }))}
                style={{ width: "100%" }}
                required
              >
                <option value="">Select a unit...</option>
                {units?.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unit_number} {u.unit_type ? `(${u.unit_type})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.3rem",
                  }}
                >
                  Amount (₹) <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="input-field"
                  value={paymentForm.amount || ""}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      amount: Number(e.target.value),
                    }))
                  }
                  placeholder="e.g. 2500"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.3rem",
                  }}
                >
                  Payment Method <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  className="select-field"
                  value={paymentForm.payment_method}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({ ...prev, payment_method: e.target.value }))
                  }
                  style={{ width: "100%" }}
                >
                  <option value="upi">UPI / QR Code</option>
                  <option value="neft">NEFT / RTGS / IMPS</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash Collection</option>
                  <option value="card">Card POS</option>
                  <option value="bank_transfer">Direct Bank Transfer</option>
                </select>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                Allocate to Specific Invoice (Optional)
              </label>
              <select
                className="select-field"
                value={paymentForm.invoice_id}
                onChange={(e) =>
                  setPaymentForm((prev) => ({ ...prev, invoice_id: e.target.value }))
                }
                style={{ width: "100%" }}
              >
                <option value="">Auto-allocate or Unallocated Credit</option>
                {invoices
                  ?.filter((i) => !paymentForm.unit_id || i.unit_id === paymentForm.unit_id)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoice_number} (Due: {formatCurrency(Number(i.balance_due))})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                Remarks / Cheque / UTR # (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                value={paymentForm.remarks}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="e.g. Cheque #49281 HDFC Bank or UTR 328910"
                style={{ width: "100%" }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsRecordPaymentOpen(false)}
                disabled={isRecordingPayment}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  isRecordingPayment || !paymentForm.unit_id || Number(paymentForm.amount) <= 0
                }
              >
                {isRecordingPayment ? "Recording..." : "💾 Record Payment"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Add Charge Head Modal */}
      <Modal
        isOpen={isAddChargeHeadOpen}
        onClose={() => setIsAddChargeHeadOpen(false)}
        title="➕ Add Charge Head Tariff"
      >
        <form onSubmit={handleCreateChargeHeadSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {chargeHeadError && (
              <div
                style={{
                  padding: "0.6rem 0.8rem",
                  background: "#fee2e2",
                  border: "1px solid #f87171",
                  borderRadius: "6px",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {chargeHeadError}
              </div>
            )}

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                Charge Head Name <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                className="input-field"
                value={chargeHeadForm.name}
                onChange={(e) => setChargeHeadForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Diesel Generator Backup"
                style={{ width: "100%" }}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.3rem",
                  }}
                >
                  Code <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={chargeHeadForm.code}
                  onChange={(e) =>
                    setChargeHeadForm((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="e.g. DG_MAINT"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.3rem",
                  }}
                >
                  Calculation Type <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  className="select-field"
                  value={chargeHeadForm.calculation_type}
                  onChange={(e) =>
                    setChargeHeadForm((prev) => ({
                      ...prev,
                      calculation_type: e.target.value as ChargeHeadCalculationType,
                    }))
                  }
                  style={{ width: "100%" }}
                >
                  {(Object.keys(CALCULATION_TYPE_LABELS) as ChargeHeadCalculationType[]).map(
                    (t) => (
                      <option key={t} value={t}>
                        {CALCULATION_TYPE_LABELS[t]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.3rem",
                }}
              >
                Default Rate (₹) <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={chargeHeadForm.default_amount}
                onChange={(e) =>
                  setChargeHeadForm((prev) => ({
                    ...prev,
                    default_amount: Number(e.target.value),
                  }))
                }
                style={{ width: "100%" }}
                required
              />
            </div>

            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={chargeHeadForm.taxable}
                  onChange={(e) =>
                    setChargeHeadForm((prev) => ({ ...prev, taxable: e.target.checked }))
                  }
                />
                <span>Taxable (tax is applied on invoices using this charge head)</span>
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsAddChargeHeadOpen(false)}
                disabled={isSubmittingChargeHead}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  isSubmittingChargeHead ||
                  !chargeHeadForm.name.trim() ||
                  !chargeHeadForm.code.trim()
                }
              >
                {isSubmittingChargeHead ? "Creating..." : "➕ Create Charge Head"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
