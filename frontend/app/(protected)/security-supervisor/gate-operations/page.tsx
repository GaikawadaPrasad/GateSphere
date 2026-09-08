"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { gateApi, type GateEvent } from "@/lib/api";

export default function SecuritySupervisorGateOperationsPage() {
  const [events, setEvents] = useState<GateEvent[]>([]);
  const [search, setSearch] = useState("");
  const [gateFilter, setGateFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
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

  const handleFlagActivity = (id: string) => {
    alert(`Gate Activity #${id} has been flagged for supervisor audit review.`);
  };

  const filteredEvents = events.filter((e) => {
    const matchSearch =
      e.visitor_name.toLowerCase().includes(search.toLowerCase()) ||
      (e.vehicle_number && e.vehicle_number.toLowerCase().includes(search.toLowerCase())) ||
      e.guard_name.toLowerCase().includes(search.toLowerCase());
    const matchGate = gateFilter === "all" || e.gate_name === gateFilter;
    const matchAction = actionFilter === "all" || e.action === actionFilter;
    return matchSearch && matchGate && matchAction;
  });

  return (
    <div>
      <PageHeader
        title="Gate Operations Supervision"
        subtitle="Real-time monitoring of all gate traffic, entry/exit movements, guard actions, and unusual event flagging"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Gate Operations" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Live Gate Movements Log</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredEvents.length} events recorded today
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 220 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search visitor/vehicle/guard…" />
            </div>

            <select
              className="select-field"
              value={gateFilter}
              onChange={(e) => setGateFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Gates</option>
              <option value="Main Gate North">Main Gate North</option>
              <option value="Service Gate South">Service Gate South</option>
            </select>

            <select
              className="select-field"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Actions</option>
              <option value="Entry Approved">Entry Approved</option>
              <option value="Exit Recorded">Exit Recorded</option>
              <option value="Entry Denied">Entry Denied</option>
              <option value="Blacklist Block">Blacklist Block</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Visitor / Courier</th>
                <th>Type</th>
                <th>Vehicle #</th>
                <th>Gate Location</th>
                <th>Duty Guard</th>
                <th>Action Taken</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading gate traffic stream…
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No gate events matching filter.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td>{ev.timestamp}</td>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{ev.visitor_name}</td>
                    <td>{ev.visitor_type}</td>
                    <td style={{ fontFamily: "monospace" }}>{ev.vehicle_number || "N/A"}</td>
                    <td>{ev.gate_name}</td>
                    <td>{ev.guard_name}</td>
                    <td>
                      <StatusBadge status={ev.action} />
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                        onClick={() => handleFlagActivity(ev.id)}
                      >
                        🚩 Flag
                      </button>
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
