"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { complaintsApi, type ServiceTicket } from "@/lib/api";

export default function VendorServiceHistoryPage() {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await complaintsApi.tickets({ page_size: 50 });
      if (Array.isArray(data)) {
        // Service history consists of completed, resolved, or resident confirmation tickets
        const completed = data.filter(
          (t) =>
            t.status === "resolved" ||
            t.status === "resident_confirmation" ||
            t.status === "closed",
        );
        setTickets(completed);
      } else {
        setTickets([]);
      }
    } catch {
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const columns: Column<ServiceTicket>[] = useMemo(
    () => [
      {
        key: "ticket_number",
        header: "Ticket #",
        render: (h) => (
          <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{h.ticket_number}</span>
        ),
      },
      {
        key: "subject",
        header: "Service Subject",
        render: (h) => <span style={{ fontWeight: 500, color: "var(--fg)" }}>{h.subject}</span>,
      },
      {
        key: "priority",
        header: "Priority",
        render: (h) => (
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              padding: "0.2rem 0.5rem",
              borderRadius: "var(--radius-sm)",
              background:
                h.priority === "urgent" || h.priority === "emergency" || h.priority === "critical"
                  ? "#fee2e2"
                  : h.priority === "high"
                    ? "#ffedd5"
                    : "#f1f5f9",
              color:
                h.priority === "urgent" || h.priority === "emergency" || h.priority === "critical"
                  ? "#991b1b"
                  : h.priority === "high"
                    ? "#9a3412"
                    : "#475569",
            }}
          >
            {h.priority}
          </span>
        ),
      },
      {
        key: "resolved_date",
        header: "Resolved / Closed Date",
        render: (h) => {
          const resolvedDate = h.resolved_at
            ? new Date(h.resolved_at).toLocaleDateString()
            : h.closed_at
              ? new Date(h.closed_at).toLocaleDateString()
              : "Completed";
          return <span>{resolvedDate}</span>;
        },
      },
      {
        key: "confirmation_status",
        header: "Confirmation Status",
        render: (h) => (
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              textTransform: "capitalize",
              color:
                h.resident_confirmation_status === "confirmed"
                  ? "var(--success)"
                  : h.resident_confirmation_status === "disputed"
                    ? "var(--danger)"
                    : "var(--muted)",
            }}
          >
            {h.resident_confirmation_status || "Pending"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Workflow Status",
        render: (h) => <StatusBadge status={h.status} />,
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Service Record History (Read-Only)"
        subtitle="Historical archive of all completed, approved, and signed-off service work orders"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Service History" }]}
      />

      <div className="card">
        <div
          className="card-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h3 className="card-title">Completed Work Log ({tickets.length})</h3>
          <button
            className="btn btn-secondary"
            style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
            onClick={loadData}
          >
            Refresh Archive
          </button>
        </div>

        <DataTable<ServiceTicket>
          columns={columns}
          data={tickets}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No completed service records found"
          emptyDescription="No completed service records found in the archive yet."
          emptyIcon="📜"
          keyExtractor={(h) => h.id}
        />
      </div>
    </div>
  );
}

