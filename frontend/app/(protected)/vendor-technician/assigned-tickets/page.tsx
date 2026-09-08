"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { vendorTicketsApi, type VendorTicket } from "@/lib/api";

export default function VendorAssignedTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<VendorTicket[]>([]);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const data = await vendorTicketsApi.list();
    setTickets(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAcceptTicket = async (ticketId: string) => {
    await vendorTicketsApi.updateStatus(ticketId, "Accepted");
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: "Accepted" } : t)));
    alert(`Ticket #${ticketId} Accepted! Move to Work Progress to update status as you travel.`);
  };

  const filteredTickets = tickets.filter((t) => {
    const matchSearch =
      t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.facility.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  return (
    <div>
      <PageHeader
        title="Assigned Work Tickets"
        subtitle="Review new service ticket assignments, accept jobs, view target locations, and access entry passes"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Assigned Tickets" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Service Work Orders</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredTickets.length} assigned tickets
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 220 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search ticket/title/facility…" />
            </div>

            <select
              className="select-field"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Task Summary</th>
                <th>Facility / Location</th>
                <th>Priority</th>
                <th>SLA Deadline</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading tickets…
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No assigned tickets found.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.ticket_number}</td>
                    <td style={{ fontWeight: 500, color: "var(--fg)" }}>{t.title}</td>
                    <td>
                      <div>{t.facility}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{t.location}</div>
                    </td>
                    <td>
                      <StatusBadge status={t.priority} />
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--warning)" }}>{t.sla_deadline}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {t.status === "Assigned" ? (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                            onClick={() => handleAcceptTicket(t.id)}
                          >
                            Accept Work
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                            onClick={() => router.push("/vendor-technician/work-progress")}
                          >
                            Progress Job
                          </button>
                        )}
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          onClick={() => router.push("/vendor-technician/entry-pass")}
                        >
                          View Gate Pass
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
