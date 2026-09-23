"use client";

import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";

/**
 * Printable payment receipt. `receipt` is the `GET /billing/payments/{id}/receipt` payload,
 * or the list row as a fallback while it loads. Shared by the Community Admin and Super
 * Admin billing pages.
 */
export function PaymentReceiptModal({
  receipt,
  onClose,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- receipt payload is untyped in lib/api (`apiGet<any>`), as it was inline before extraction.
  receipt: any | null;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={Boolean(receipt)}
      onClose={() => onClose()}
      title={
        receipt?.receipt_number ? `Payment Receipt #${receipt.receipt_number}` : "Payment Receipt"
      }
    >
      {receipt && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div
            style={{
              border: "2px dashed var(--border)",
              borderRadius: "8px",
              padding: "1.25rem",
              background: "#fcfdfe",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {/* Receipt Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "0.75rem",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)" }}>
                  {receipt.community_name || "GateSphere Enterprise"}
                </h3>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                  Official Maintenance Collection Receipt
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <StatusBadge status={receipt.payment_status || receipt.status || "success"} />
                {receipt.receipt_number && (
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, marginTop: "0.25rem" }}>
                    Receipt #{receipt.receipt_number}
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Key-Value Rows */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                fontSize: "0.85rem",
              }}
            >
              <div>
                <span style={{ color: "var(--muted)", display: "block", fontSize: "0.75rem" }}>
                  Payment Reference
                </span>
                <strong>{receipt.payment_reference}</strong>
              </div>
              <div>
                <span style={{ color: "var(--muted)", display: "block", fontSize: "0.75rem" }}>
                  Payment Date
                </span>
                <span>{formatDateTime(receipt.paid_at)}</span>
              </div>
              <div>
                <span style={{ color: "var(--muted)", display: "block", fontSize: "0.75rem" }}>
                  Payer / Resident
                </span>
                <span>{receipt.payer_name || receipt.resident_type || "Unit Resident"}</span>
              </div>
              <div>
                <span style={{ color: "var(--muted)", display: "block", fontSize: "0.75rem" }}>
                  Unit
                </span>
                <span>
                  {receipt.unit_number
                    ? `Unit ${receipt.unit_number}`
                    : receipt.unit_id
                      ? `Unit ${receipt.unit_id.slice(0, 8)}`
                      : "–"}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--muted)", display: "block", fontSize: "0.75rem" }}>
                  Payment Method
                </span>
                <span style={{ textTransform: "uppercase", fontWeight: 600 }}>
                  {receipt.payment_method}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--muted)", display: "block", fontSize: "0.75rem" }}>
                  Amount Collected
                </span>
                <strong style={{ color: "#059669", fontSize: "1.1rem" }}>
                  {formatCurrency(Number(receipt.amount))}
                </strong>
              </div>
            </div>

            {/* Allocations Breakdown */}
            {receipt.allocations && receipt.allocations.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--muted)",
                    marginBottom: "0.35rem",
                  }}
                >
                  Invoice Allocations
                </div>
                {receipt.allocations.map((alloc: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      padding: "0.25rem 0",
                    }}
                  >
                    <span>Invoice #{alloc.invoice_number || alloc.invoice_id?.slice(0, 8)}</span>
                    <strong>
                      {formatCurrency(Number(alloc.amount || alloc.allocated_amount))}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              🖨️ Print Receipt
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onClose()}>
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
