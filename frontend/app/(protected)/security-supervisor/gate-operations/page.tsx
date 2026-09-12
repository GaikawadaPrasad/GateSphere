"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { gateApi, type GateEvent } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function SecuritySupervisorGateOperationsPage() {
  const [events, setEvents] = useState<GateEvent[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await gateApi.events({ page_size: 50 });
      setEvents(data || []);
    } catch {
      setEvents([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const eventTypes = Array.from(new Set(events.map((e) => e.event_type).filter(Boolean)));

  const filteredEvents = events.filter((e) => {
    const q = search.toLowerCase();
    const ref = ((e as any).reference_type || "").toLowerCase();
    const evType = (e.event_type || "").toLowerCase();
    const gateStr = (e.gate_id || "").toLowerCase();
    const matchSearch =
      !search ||
      ref.includes(q) ||
      evType.includes(q) ||
      gateStr.includes(q);
    const matchType = typeFilter === "all" || e.event_type === typeFilter;
    return matchSearch && matchType;
  });

  const columns: Column<GateEvent>[] = [
    {
      key: "occurred_at",
      header: "Timestamp",
      sortable: true,
      render: (e) => <span>⏱️ {formatDateTime(e.occurred_at)}</span>,
    },
    {
      key: "event_type",
      header: "Event Type",
      sortable: true,
      render: (e) => (
        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
          <StatusBadge status={e.event_type} />
        </span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      sortable: true,
      render: (e) => (
        <span>
          {(e as any).reference_type
            ? `${(e as any).reference_type.replace(/_/g, " ")} (#${((e as any).reference_id || "").slice(0, 8)})`
            : "—"}
        </span>
      ),
    },
    {
      key: "gate_id",
      header: "Gate",
      sortable: true,
      render: (e) => <span>{e.gate_id ? `Gate #${e.gate_id.slice(0, 8)}` : "Main Gate"}</span>,
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Gate Operations Supervision"
        subtitle="Real-time monitoring of all recorded gate events across every gate"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Gate Operations" },
        ]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Live Gate Movements Log</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredEvents.length} events recorded
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search event/reference…"
              />
            </div>

            <select
              className="select-field"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Event Types</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredEvents}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Gate Events Recorded"
          emptyDescription="No gate movement events match your search or filter selection."
          emptyIcon="🛡️"
        />
      </div>
    </div>
  );
}
