"use client";

import Link from "next/link";
import type { FinancialStats } from "@/types/dashboards";
import { formatCurrency } from "@/lib/utils";

interface FinancialHealthCardProps {
  data?: FinancialStats | null;
  isLoading?: boolean;
}

export function FinancialHealthCard({ data, isLoading }: FinancialHealthCardProps) {
  if (isLoading) {
    return (
      <div className="card" style={{ height: "100%", minHeight: 280 }}>
        <div className="skeleton" style={{ width: 160, height: 24, marginBottom: "1.5rem" }} />
        <div className="skeleton" style={{ width: "100%", height: 180 }} />
      </div>
    );
  }

  const billed = Number(data?.total_billed || 0);
  const collected = Number(data?.total_collected || 0);
  const outstanding = Number(data?.outstanding_balance || 0);
  const collectionRate = billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : 100;

  const invoiceBreakdown = data?.invoices_by_status || {
    paid: 0,
    issued: 0,
    partially_paid: 0,
    overdue: 0,
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="card-header">
        <div>
          <h3 className="card-title">💳 Financial Health &amp; Billing</h3>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            Collection efficiency &amp; invoice reconciliation
          </p>
        </div>
        <Link href="/community-admin/billing" className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
          View Ledger →
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", margin: "1rem 0" }}>
        <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>Total Billed</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)", marginTop: "0.25rem" }}>
            {formatCurrency(billed)}
          </div>
        </div>

        <div style={{ background: "#ecfdf5", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid #a7f3d0" }}>
          <div style={{ fontSize: "0.75rem", color: "#065f46", fontWeight: 500 }}>Collected</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#059669", marginTop: "0.25rem" }}>
            {formatCurrency(collected)}
          </div>
        </div>

        <div style={{ background: outstanding > 0 ? "#fef2f2" : "#f8fafc", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: `1px solid ${outstanding > 0 ? "#fecaca" : "var(--border)"}` }}>
          <div style={{ fontSize: "0.75rem", color: outstanding > 0 ? "#991b1b" : "var(--muted)", fontWeight: 500 }}>Outstanding</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: outstanding > 0 ? "#dc2626" : "var(--fg)", marginTop: "0.25rem" }}>
            {formatCurrency(outstanding)}
          </div>
        </div>
      </div>

      {/* Collection Progress Bar */}
      <div style={{ marginTop: "auto", paddingTop: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.35rem" }}>
          <span style={{ fontWeight: 600, color: "var(--fg-secondary)" }}>Collection Efficiency</span>
          <span style={{ fontWeight: 700, color: collectionRate >= 80 ? "#10b981" : collectionRate >= 50 ? "#f59e0b" : "#ef4444" }}>
            {collectionRate}%
          </span>
        </div>
        <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${collectionRate}%`,
              background: collectionRate >= 80 ? "linear-gradient(90deg, #10b981, #059669)" : collectionRate >= 50 ? "#f59e0b" : "#ef4444",
              borderRadius: 4,
              transition: "width 0.5s ease",
            }}
          />
        </div>

        {/* Invoice status pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
          {Object.entries(invoiceBreakdown).map(([statusKey, count]) => (
            <div
              key={statusKey}
              style={{
                fontSize: "0.75rem",
                padding: "0.2rem 0.55rem",
                borderRadius: "var(--radius-full)",
                background: "#f1f5f9",
                color: "#475569",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                textTransform: "capitalize",
              }}
            >
              <span>{statusKey.replace("_", " ")}:</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
