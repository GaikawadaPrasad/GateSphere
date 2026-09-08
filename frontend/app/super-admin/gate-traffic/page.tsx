"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import { useGateEvents, usePanicAlerts, useGuardRosters } from "@/hooks/use-gate";
import { useCommunities } from "@/hooks/use-communities";
import type { GateEvent, GuardRoster } from "@/types/gate";

export default function GateTrafficPage() {
  const [communityId, setCommunityId] = useState("");
  const { data: communities } = useCommunities();

  const { data: events, isLoading: isEventsLoading } = useGateEvents({
    community_id: communityId || undefined,
    page_size: 20,
  });

  const { data: alerts } = usePanicAlerts({
    community_id: communityId || undefined,
    page_size: 5,
  });

  const { data: rosters } = useGuardRosters({
    community_id: communityId || undefined,
  });

  const eventColumns: Column<GateEvent>[] = [
    {
      key: "event_type",
      header: "Event Type",
      render: (e) => (
        <span style={{ fontWeight: 600, textTransform: "capitalize", color: "var(--fg)" }}>
          {e.event_type.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "entity_name",
      header: "Visitor / Vehicle / Staff",
      render: (e) => <span>{e.entity_name || e.entity_id || "–"}</span>,
    },
    {
      key: "gate_id",
      header: "Gate",
      align: "center",
      render: (e) => <span>Gate #{e.gate_id?.slice(0, 6) || "Main"}</span>,
    },
    {
      key: "occurred_at",
      header: "Occurred At",
      align: "right",
      render: (e) => <span>{formatDateTime(e.occurred_at)}</span>,
    },
  ];

  const rosterColumns: Column<GuardRoster>[] = [
    {
      key: "guard_name",
      header: "Guard Name",
      render: (r) => <span style={{ fontWeight: 600 }}>{r.guard_name || "Guard"}</span>,
    },
    {
      key: "shift_name",
      header: "Shift",
      align: "center",
      render: (r) => <span>{r.shift_name}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Gate Traffic & Security Operations"
        subtitle="Live gate events, active guard rosters, and panic alerts"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Gate Traffic" }]}
        actions={
          <select
            className="select-field"
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            style={{ width: "auto", height: 36, padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
          >
            <option value="">All Communities</option>
            {communities?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        }
      />

      {/* Panic Alerts Alert Box */}
      {alerts && alerts.length > 0 && (
        <div
          style={{
            background: "var(--danger-light)",
            border: "1px solid var(--danger-border)",
            borderRadius: "var(--radius)",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ color: "#991b1b", fontSize: "0.95rem", marginBottom: "0.5rem" }}>
            🚨 {alerts.length} Active Panic Alerts
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {alerts.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "white",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--danger-border)",
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: "#991b1b" }}>
                    {a.user_name || "Resident"} ({a.unit_number ? `Unit ${a.unit_number}` : "Community Grounds"})
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.75rem" }}>
                    {formatDateTime(a.created_at)}
                  </span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Events & Rosters */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
        {/* Gate Events */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Live Gate Events</h3>
            <span className="badge badge-success">● Live</span>
          </div>

          <DataTable
            columns={eventColumns as unknown as Column<Record<string, unknown>>[]}
            data={events as unknown as Record<string, unknown>[]}
            isLoading={isEventsLoading}
            emptyTitle="No gate events"
            emptyDescription="No vehicle or visitor traffic recorded yet."
          />
        </div>

        {/* Guard Rosters */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Guard Rosters</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Active Shift</span>
          </div>

          <DataTable
            columns={rosterColumns as unknown as Column<Record<string, unknown>>[]}
            data={rosters as unknown as Record<string, unknown>[]}
            emptyTitle="No guard rosters"
            emptyDescription="No guard shift records available."
          />
        </div>
      </div>
    </div>
  );
}
