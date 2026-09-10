"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { gateApi, type GateEvent } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function SecurityGuardGateHistoryPage() {
  const [history, setHistory] = useState<GateEvent[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const data = await gateApi.events({ page_size: 50 });
    setHistory(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const eventTypes = Array.from(new Set(history.map((h) => h.event_type)));

  const filteredHistory = history.filter((h) => {
    const ref = ((h as any).reference_type || "").toLowerCase();
    const matchSearch = !search || ref.includes(search.toLowerCase()) || h.event_type.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || h.event_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div>
      <PageHeader
        title="Gate Movement History (Read-Only)"
        subtitle="Historical log of recorded gate events across all community gates"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Gate History" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Historical Gate Event Log</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredHistory.length} logs recorded
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 220 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search event/reference…" />
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
                    Loading gate history…
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No gate events found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDateTime(h.occurred_at)}</td>
                    <td style={{ fontWeight: 600, color: "var(--fg)", textTransform: "capitalize" }}>
                      <StatusBadge status={h.event_type} />
                    </td>
                    <td>
                      {(h as any).reference_type
                        ? `${(h as any).reference_type.replace(/_/g, " ")} (#${((h as any).reference_id || "").slice(0, 8)})`
                        : "—"}
                    </td>
                    <td>{h.gate_id ? `Gate #${h.gate_id.slice(0, 8)}` : "—"}</td>
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
