"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { gateApi, type GateEvent } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function SecurityGuardGateHistoryPage() {
  const [history, setHistory] = useState<GateEvent[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await gateApi.events({ page_size: 50 });
      setHistory(data || []);
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load gate event history.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const eventTypes = Array.from(new Set(history.map((h) => h.event_type)));

  const filteredHistory = history.filter((h) => {
    const ref = ((h as any).reference_type || "").toLowerCase();
    const matchSearch =
      !search ||
      ref.includes(search.toLowerCase()) ||
      h.event_type.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || h.event_type === typeFilter;
    return matchSearch && matchType;
  });

  const columns: Column<GateEvent>[] = [
    {
      key: "occurred_at",
      header: "Timestamp",
      sortable: true,
      render: (h) => <span>⏱️ {formatDateTime(h.occurred_at)}</span>,
    },
    {
      key: "event_type",
      header: "Event Type",
      sortable: true,
      render: (h) => (
        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
          <StatusBadge status={h.event_type} />
        </span>
      ),
    },
    {
      key: "reference",
      header: "Reference",
      sortable: true,
      render: (h) => (
        <span>
          {(h as any).reference_type
            ? `${(h as any).reference_type.replace(/_/g, " ")} (#${((h as any).reference_id || "").slice(0, 8)})`
            : "—"}
        </span>
      ),
    },
    {
      key: "gate_id",
      header: "Gate Checkpoint",
      sortable: true,
      render: (h) => <span>{h.gate_id ? `Gate #${h.gate_id.slice(0, 8)}` : "Main Gate"}</span>,
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Gate Movement History (Read-Only)"
        subtitle="Historical log of recorded gate events across all community gates"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Guard" },
          { label: "Gate History" },
        ]}
      />

      {loadError && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            borderRadius: "var(--radius)",
            background: "var(--danger-light)",
            border: "1px solid var(--danger-border)",
            color: "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>⚠️ {loadError}</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
            onClick={loadData}
          >
            Retry
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Historical Gate Event Log</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredHistory.length} logs recorded
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
          data={filteredHistory}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Gate Events Found"
          emptyDescription="No gate movement events match your search or filter selection."
          emptyIcon="📜"
        />
      </div>
    </div>
  );
}
