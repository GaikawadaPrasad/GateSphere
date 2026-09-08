"use client";

import Link from "next/link";
import type { CollectionAuditSummary } from "@/types/governance";
import { formatCurrency, formatDate } from "@/lib/utils";

interface CollectionAuditCardProps {
  summary?: CollectionAuditSummary;
  isLoading?: boolean;
}

export function CollectionAuditCard({ summary, isLoading }: CollectionAuditCardProps) {
  if (isLoading) {
    return (
      <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="skeleton" style={{ width: "45%", height: 20 }} />
        <div className="skeleton" style={{ width: "100%", height: 80 }} />
        <div className="skeleton" style={{ width: "100%", height: 100 }} />
      </div>
    );
  }

  const payments = summary?.recent_payments || [];
  const methods = summary?.payment_methods_breakdown || {};

  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="card-header">
        <div>
          <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>🔍</span> Collection Audit & Traceability
          </h2>
          <p style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            Real-time receipt verification and payment method distribution
          </p>
        </div>
        <Link
          href="/association-committee/collection-audit"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", height: 30 }}
        >
          Audit Ledger →
        </Link>
      </div>

      {/* Methods distribution */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.775rem", fontWeight: 600, color: "var(--fg-secondary)", marginBottom: "0.5rem" }}>
          Payment Channels
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {Object.keys(methods).length === 0 ? (
            <span style={{ fontSize: "0.775rem", color: "var(--muted)" }}>No payments recorded yet</span>
          ) : (
            Object.entries(methods).map(([method, data]) => (
              <div
                key={method}
                style={{
                  padding: "0.4rem 0.65rem",
                  background: "#f8fafc",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--fg)" }}>{method}:</span>
                <span style={{ color: "#059669", fontWeight: 600 }}>{formatCurrency(parseFloat(data.total_amount))}</span>
                <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>({data.count})</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent payment transactions list */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.775rem", fontWeight: 600, color: "var(--fg-secondary)", marginBottom: "0.5rem" }}>
          Recent Verified Collections
        </div>
        {payments.length === 0 ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--muted)", fontSize: "0.8rem" }}>
            No recent payment receipts available.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {payments.slice(0, 3).map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  background: "#ffffff",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.8rem",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                    Ref: {p.payment_reference}
                  </div>
                  <div style={{ fontSize: "0.725rem", color: "var(--muted)" }}>
                    {p.receipt_number ? `Receipt: ${p.receipt_number} · ` : ""}{formatDate(p.paid_at)} · {p.payment_method.toUpperCase()}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: "#059669" }}>
                  {formatCurrency(parseFloat(p.amount || "0"))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
