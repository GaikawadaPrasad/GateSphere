"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";

export default function VendorServiceHistoryPage() {
  const history = [
    {
      id: "hist-1",
      ticket_number: "VT-801",
      title: "Clubhouse Main HVAC Servicing",
      facility: "Clubhouse Main Hall",
      completed_date: "2026-08-20",
      rating: "5.0 ★",
      status: "Approved",
    },
    {
      id: "hist-2",
      ticket_number: "VT-802",
      title: "Central Fountain Motor Repair",
      facility: "Central Lawn",
      completed_date: "2026-08-15",
      rating: "4.8 ★",
      status: "Approved",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Service Record History (Read-Only)"
        subtitle="Historical archive of all completed, approved, and signed-off service work contracts"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Service History" }]}
      />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Completed Work Log</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Service Title</th>
                <th>Facility Location</th>
                <th>Completion Date</th>
                <th>Manager Rating</th>
                <th>Approval Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td style={{ fontWeight: 600 }}>{h.ticket_number}</td>
                  <td style={{ fontWeight: 500, color: "var(--fg)" }}>{h.title}</td>
                  <td>{h.facility}</td>
                  <td>{h.completed_date}</td>
                  <td style={{ fontWeight: 600, color: "var(--warning)" }}>{h.rating}</td>
                  <td>
                    <StatusBadge status={h.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
