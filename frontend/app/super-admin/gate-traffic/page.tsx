"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import { useGateEvents, usePanicAlerts, useGuardRosters } from "@/hooks/use-gate";
import { useCommunities } from "@/hooks/use-communities";
import type { GateEvent, GuardRoster, PanicAlert } from "@/types/gate";
import type { Community } from "@/types/communities";

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

  const { data: rosters, isLoading: isRostersLoading } = useGuardRosters({
    community_id: communityId || undefined,
  });

  const eventColumns: Column<GateEvent>[] = [
    {
      key: "occurred_at",
      header: "Timestamp",
      render: (item) => formatDateTime(item.occurred_at),
    },
    {
      key: "event_type",
      header: "Event Type",
      render: (item) => <StatusBadge status={item.event_type} />,
    },
    {
      key: "reference_type",
      header: "Reference",
      render: (item) =>
        item.reference_type
          ? `${item.reference_type.replace(/_/g, " ")} (#${(item.reference_id || "").slice(0, 8)})`
          : "—",
    },
    {
      key: "gate_id",
      header: "Gate",
      render: (item) => (item.gate_id ? `Gate #${item.gate_id.slice(0, 8)}` : "—"),
    },
  ];

  const rosterColumns: Column<GuardRoster>[] = [
    {
      key: "shift_date",
      header: "Shift Date",
    },
    {
      key: "time",
      header: "Shift Timing",
      render: (item) => `${item.shift_start} - ${item.shift_end}`,
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Gate Traffic & Security Operations"
        subtitle="Live gate events, active guard rosters, and panic alerts"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Gate Traffic" },
        ]}
        actions={
          <select
            className="select-field"
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value)}
            style={{ width: "auto", height: 36, padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
          >
            <option value="">All Communities</option>
            {communities?.map((c: Community) => (
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
            {alerts.map((a: PanicAlert) => (
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
                  <span style={{ fontWeight: 600, color: "#991b1b", textTransform: "capitalize" }}>
                    {a.alert_type} {(a as any).message ? `— ${(a as any).message}` : ""}
                  </span>
                  <span
                    style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.75rem" }}
                  >
                    {formatDateTime(a.created_at)}
                  </span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Guard Rosters */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Active Security Roster
        </h2>
        <DataTable
          columns={rosterColumns}
          data={rosters}
          isLoading={isRostersLoading}
          emptyTitle="No guards scheduled"
          emptyDescription="No guard shift rosters are currently planned or active."
        />
      </div>

      {/* Live Gate Events Feed */}
      <div>
        <h2 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Recent Gate Traffic Log
        </h2>
        <DataTable
          columns={eventColumns}
          data={events}
          isLoading={isEventsLoading}
          emptyTitle="No gate traffic"
          emptyDescription="No entry or exit events recorded for the selected scope."
        />
      </div>
    </div>
  );
}
