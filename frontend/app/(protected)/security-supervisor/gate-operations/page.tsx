"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { gateApi, type GateEvent } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function SecuritySupervisorGateOperationsPage() {
  const [events, setEvents] = useState<GateEvent[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const data = await gateApi.events({ page_size: 50 });
    setEvents(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const eventTypes = Array.from(new Set(events.map((e) => e.event_type)));

  const filteredEvents = events.filter((e) => {
    const ref = ((e as any).reference_type || "").toLowerCase();
    const matchSearch =
      !search ||
      ref.includes(search.toLowerCase()) ||
      e.event_type.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || e.event_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div>
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

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Reference</th>
                <th>Gate</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading gate traffic stream…
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No gate events matching filter.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td>{formatDateTime(ev.occurred_at)}</td>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>
                      <StatusBadge status={ev.event_type} />
                    </td>
                    <td>
                      {(ev as any).reference_type
                        ? `${(ev as any).reference_type.replace(/_/g, " ")} (#${((ev as any).reference_id || "").slice(0, 8)})`
                        : "—"}
                    </td>
                    <td>{ev.gate_id ? `Gate #${ev.gate_id.slice(0, 8)}` : "—"}</td>
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
