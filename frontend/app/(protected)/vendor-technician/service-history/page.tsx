"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
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

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Service Subject</th>
                <th>Priority</th>
                <th>Resolved / Closed Date</th>
                <th>Confirmation Status</th>
                <th>Workflow Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", padding: "2.5rem", color: "var(--muted)" }}
                  >
                    Loading service history records…
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", padding: "2.5rem", color: "var(--muted)" }}
                  >
                    No completed service records found in the archive yet.
                  </td>
                </tr>
              ) : (
                tickets.map((h) => {
                  const resolvedDate = h.resolved_at
                    ? new Date(h.resolved_at).toLocaleDateString()
                    : h.closed_at
                      ? new Date(h.closed_at).toLocaleDateString()
                      : "Completed";

                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600, fontFamily: "monospace" }}>
                        {h.ticket_number}
                      </td>
                      <td style={{ fontWeight: 500, color: "var(--fg)" }}>{h.subject}</td>
                      <td>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "var(--radius-sm)",
                            background:
                              h.priority === "urgent" || h.priority === "emergency"
                                ? "#fee2e2"
                                : h.priority === "high"
                                  ? "#ffedd5"
                                  : "#f1f5f9",
                            color:
                              h.priority === "urgent" || h.priority === "emergency"
                                ? "#991b1b"
                                : h.priority === "high"
                                  ? "#9a3412"
                                  : "#475569",
                          }}
                        >
                          {h.priority}
                        </span>
                      </td>
                      <td>{resolvedDate}</td>
                      <td style={{ textTransform: "capitalize" }}>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 600,
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
                      </td>
                      <td>
                        <StatusBadge status={h.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
