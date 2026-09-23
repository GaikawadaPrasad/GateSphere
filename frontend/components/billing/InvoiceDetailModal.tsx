"use client";

import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import type { MaintenanceInvoice } from "@/types/billing";

/** Read-only invoice breakdown. Shared by the Community Admin and Super Admin billing pages. */
export function InvoiceDetailModal({
  invoice,
  onClose,
}: {
  invoice: MaintenanceInvoice | null;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={Boolean(invoice)}
      onClose={() => onClose()}
      title={invoice ? `Invoice Details — ${invoice.invoice_number}` : "Invoice Details"}
    >
      {invoice && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Header info grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.75rem",
              padding: "0.85rem",
              background: "var(--bg-card, #f8fafc)",
              borderRadius: "6px",
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Unit</div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                Unit {invoice.unit_number || invoice.unit_id?.slice(0, 8)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Status</div>
              <div style={{ marginTop: "0.2rem" }}>
                <StatusBadge status={invoice.status} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Due Date</div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{invoice.due_date || "–"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Billing Period</div>
              <div style={{ fontSize: "0.8rem", fontWeight: 500 }}>
                {invoice.billing_period_start || "–"} to {invoice.billing_period_end || "–"}
              </div>
            </div>
          </div>

          {/* Line Items List */}
          <div>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Invoice Line Items
            </h4>
            {invoice.items && invoice.items.length > 0 ? (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  overflow: "hidden",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-muted, #f1f5f9)", textAlign: "left" }}>
                      <th style={{ padding: "0.5rem 0.75rem" }}>Description</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, idx) => (
                      <tr key={item.id || idx} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.5rem 0.75rem" }}>
                          <div style={{ fontWeight: 500 }}>{item.description}</div>
                          {item.charge_head_name && (
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              {item.charge_head_name}
                            </div>
                          )}
                        </td>
                        <td
                          style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600 }}
                        >
                          {formatCurrency(Number(item.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{
                  padding: "0.75rem",
                  background: "var(--bg-card, #f8fafc)",
                  borderRadius: "6px",
                  border: "1px dashed var(--border)",
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  textAlign: "center",
                }}
              >
                Standard monthly maintenance assessment
              </div>
            )}
          </div>

          {/* Financial Summary Breakdown */}
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
              <span style={{ color: "var(--muted)" }}>Subtotal:</span>
              <span style={{ fontWeight: 600 }}>
                {formatCurrency(Number(invoice.subtotal || invoice.total_amount))}
              </span>
            </div>
            {Number(invoice.discount) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#059669" }}>
                <span>Discount:</span>
                <span>-{formatCurrency(Number(invoice.discount))}</span>
              </div>
            )}
            {Number(invoice.tax) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Tax:</span>
                <span>+{formatCurrency(Number(invoice.tax))}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid var(--border)",
                paddingTop: "0.4rem",
                fontWeight: 700,
                color: "var(--fg)",
              }}
            >
              <span>Total Amount:</span>
              <span>{formatCurrency(Number(invoice.total_amount))}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#059669" }}>
              <span>Amount Paid:</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(Number(invoice.amount_paid))}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid var(--border)",
                paddingTop: "0.3rem",
                fontSize: "0.95rem",
                fontWeight: 700,
                color: Number(invoice.balance_due) > 0 ? "#dc2626" : "#059669",
              }}
            >
              <span>Balance Due:</span>
              <span>{formatCurrency(Number(invoice.balance_due))}</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => onClose()}>
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
