"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { gateApi, type GateEvent } from "@/lib/api";

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

  const filteredHistory = history.filter((h) => {
    const matchSearch =
      h.visitor_name.toLowerCase().includes(search.toLowerCase()) ||
      (h.vehicle_number && h.vehicle_number.toLowerCase().includes(search.toLowerCase()));
    const matchType = typeFilter === "all" || h.visitor_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div>
      <PageHeader
        title="Gate Movement History (Read-Only)"
        subtitle="Historical log of recorded entry and exit movements across all community gates"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Gate History" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Historical Entry / Exit Log</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredHistory.length} logs recorded
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 220 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search visitor/vehicle…" />
            </div>

            <select
              className="select-field"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Visitor Types</option>
              <option value="Guest">Guest</option>
              <option value="Delivery">Delivery</option>
              <option value="Cab">Cab</option>
              <option value="Staff">Staff</option>
              <option value="Technician">Technician</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Visitor / Vehicle</th>
                <th>Type</th>
                <th>Gate Location</th>
                <th>Duty Guard</th>
                <th>Action Taken</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading gate history…
                  </td>
                </tr>
              ) : (
                filteredHistory.map((h) => (
                  <tr key={h.id}>
                    <td>{h.timestamp}</td>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{h.visitor_name}</td>
                    <td>{h.visitor_type}</td>
                    <td>{h.gate_name}</td>
                    <td>{h.guard_name}</td>
                    <td>
                      <StatusBadge status={h.action} />
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
