"use client";

import Link from "next/link";
import type { FinancialStats } from "@/types/dashboards";
import { formatCurrency } from "@/lib/utils";

interface FinancialSummaryCardProps {
  stats?: FinancialStats;
  isLoading?: boolean;
}

export function FinancialSummaryCard({ stats, isLoading }: FinancialSummaryCardProps) {
  if (isLoading) {
    return (
      <div
        className="card"
        style={{ height: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <div className="skeleton" style={{ width: "45%", height: 20 }} />
        <div className="skeleton" style={{ width: "100%", height: 80 }} />
        <div className="skeleton" style={{ width: "100%", height: 120 }} />
      </div>
    );
  }

  const billed = stats ? parseFloat(String(stats.total_billed || "0")) : 0;
  const collected = stats ? parseFloat(String(stats.total_collected || "0")) : 0;
  const outstanding = stats ? parseFloat(String(stats.outstanding_balance || "0")) : 0;
  const collectionRate = billed > 0 ? Math.min(Math.round((collected / billed) * 100), 100) : 0;

  const statusMap = stats?.invoices_by_status || {};

  return (
    <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="card-header">
        <div>
          <h2
            className="card-title"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span>💰</span> Financial Health & Summary
          </h2>
          <p style={{ fontSize: "0.775rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            Community billing aggregates and collection performance
          </p>
        </div>
        <Link
          href="/association-committee/financial-summary"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", height: 30 }}
        >
          View Full Financials →
        </Link>
      </div>

      {/* Progress & Highlights */}
      <div
        style={{
          background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1.25rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--fg-secondary)" }}>
            Collection Efficiency
          </span>
          <span
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              color: collectionRate >= 80 ? "#059669" : "#d97706",
            }}
          >
            {collectionRate}%
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: "100%",
            height: 10,
            background: "#e2e8f0",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${collectionRate}%`,
              height: "100%",
              background:
                collectionRate >= 80
                  ? "linear-gradient(90deg, #10b981, #059669)"
                  : "linear-gradient(90deg, #f59e0b, #d97706)",
              transition: "width 0.5s ease",
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.75rem",
            marginTop: "1rem",
          }}
        >
          <div>
            <div
              style={{ fontSize: "0.725rem", color: "var(--muted)", textTransform: "uppercase" }}
            >
              Total Invoiced
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)" }}>
              {formatCurrency(billed)}
            </div>
          </div>
          <div>
            <div
              style={{ fontSize: "0.725rem", color: "var(--muted)", textTransform: "uppercase" }}
            >
              Total Collected
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#059669" }}>
              {formatCurrency(collected)}
            </div>
          </div>
          <div>
            <div
              style={{ fontSize: "0.725rem", color: "var(--muted)", textTransform: "uppercase" }}
            >
              Outstanding Dues
            </div>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: outstanding > 0 ? "#dc2626" : "var(--fg)",
              }}
            >
              {formatCurrency(outstanding)}
            </div>
          </div>
        </div>
      </div>

      {/* Invoices by Status Breakdown */}
      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--fg-secondary)",
            marginBottom: "0.5rem",
          }}
        >
          Invoice Status Breakdown
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.5rem 0.75rem",
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--fg-secondary)" }}>Paid Invoices</span>
            <span className="badge badge-success">{statusMap["paid"] || 0}</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.5rem 0.75rem",
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--fg-secondary)" }}>
              Overdue Invoices
            </span>
            <span className="badge badge-danger">{statusMap["overdue"] || 0}</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.5rem 0.75rem",
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--fg-secondary)" }}>
              Posted / Pending
            </span>
            <span className="badge badge-warning">{statusMap["posted"] || 0}</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.5rem 0.75rem",
              background: "#ffffff",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--fg-secondary)" }}>Drafts</span>
            <span className="badge badge-neutral">{statusMap["draft"] || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
