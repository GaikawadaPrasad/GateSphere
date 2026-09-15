"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { vendorTicketsApi, type VendorTicket } from "@/lib/api";

export default function VendorAssignedTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<VendorTicket[]>([]);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await vendorTicketsApi.list();
      setTickets(
        (data || []).map((t: any) => ({
          id: t.id,
          ticket_number: t.ticket_number || `TKT-${t.id.slice(0, 6).toUpperCase()}`,
          title: t.subject || "Service Ticket",
          facility: t.vendor_name || "Community Grounds",
          location: t.description || "Community Facility",
          priority: (t.priority || "medium").toUpperCase(),
          sla_deadline: t.resolution_due_at
            ? new Date(t.resolution_due_at).toLocaleDateString()
            : "Within SLA",
          status: t.status || "created",
        })),
      );
    } catch {
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAcceptTicket = async (ticketId: string) => {
    try {
      await vendorTicketsApi.updateStatus(ticketId, "acknowledged", "Accepted by Technician");
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: "acknowledged" } : t)),
      );
      alert("Ticket Accepted! You can now start work on-site or view your digital gate pass.");
    } catch (err: any) {
      alert(err?.message || "Failed to update ticket status");
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.facility.toLowerCase().includes(search.toLowerCase());
      const matchPriority =
        priorityFilter === "all" || t.priority.toLowerCase() === priorityFilter.toLowerCase();
      return matchSearch && matchPriority;
    });
  }, [tickets, search, priorityFilter]);

  const columns: Column<VendorTicket>[] = useMemo(
    () => [
      {
        key: "ticket_number",
        header: "Ticket #",
        render: (t) => (
          <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{t.ticket_number}</span>
        ),
      },
      {
        key: "title",
        header: "Task Summary",
        render: (t) => <span style={{ fontWeight: 500, color: "var(--fg)" }}>{t.title}</span>,
      },
      {
        key: "facility",
        header: "Facility / Details",
        render: (t) => (
          <div>
            <div>{t.facility}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{t.location}</div>
          </div>
        ),
      },
      {
        key: "priority",
        header: "Priority",
        render: (t) => <StatusBadge status={t.priority} />,
      },
      {
        key: "sla_deadline",
        header: "SLA Deadline",
        render: (t) => (
          <span style={{ fontWeight: 600, color: "var(--warning)" }}>{t.sla_deadline}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        render: (t) => <StatusBadge status={t.status.replace(/_/g, " ").toUpperCase()} />,
      },
      {
        key: "actions",
        header: "Actions",
        render: (t) => (
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {t.status === "assigned" || t.status === "created" ? (
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
        ),
      },
    ],
    [router],
  );

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
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search ticket/title/facility…"
              />
            </div>

            <select
              className="select-field"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <DataTable<VendorTicket>
          columns={columns}
          data={filteredTickets}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No assigned tickets found"
          emptyDescription="You have no assigned service tickets matching the selected filters."
          emptyIcon="🎫"
          keyExtractor={(t) => t.id}
        />
      </div>
    </div>
  );
}

