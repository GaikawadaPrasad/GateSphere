"use client";

import { useState } from "react";
import Link from "next/link";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails } from "@/hooks/use-communities";
import { useIncidents } from "@/hooks/use-incidents";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/utils";
import type { Incident } from "@/types/incidents";

export default function SecurityIncidentsReviewPage() {
  const { activeCommunityId } = useUiStore();
  const { data: community } = useCommunityDetails(activeCommunityId || undefined);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: incidents, isLoading } = useIncidents({
    community_id: activeCommunityId || undefined,
    incident_status: statusFilter === "all" ? undefined : statusFilter,
    severity: severityFilter === "all" ? undefined : severityFilter,
    q: searchQuery || undefined,
    page_size: 50,
  });

  const incidentColumns: Column<Incident>[] = [
    {
      key: "incident_number",
      header: "Incident #",
      render: (item) => (
        <Link
          href={`/association-committee/incidents/${item.id}`}
          style={{ fontWeight: 600, color: "var(--primary)" }}
        >
          #{item.incident_number || item.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "incident_type",
      header: "Category",
      render: (item) => (
        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
          {item.incident_type}
        </span>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      render: (item) => {
        const s = item.severity;
        let bg = "#f1f5f9";
        let fg = "#475569";
        if (s === "critical") {
          bg = "#fee2e2";
          fg = "#991b1b";
        } else if (s === "high") {
          bg = "#ffedd5";
          fg = "#9a3412";
        } else if (s === "medium") {
          bg = "#fef3c7";
          fg = "#92400e";
        }
        return (
          <span
            style={{
              background: bg,
              color: fg,
              fontSize: "0.725rem",
              fontWeight: 700,
              padding: "0.15rem 0.5rem",
              borderRadius: "var(--radius-full)",
              textTransform: "uppercase",
            }}
          >
            {s}
          </span>
        );
      },
    },
    {
      key: "location_text",
      header: "Location",
      render: (item) => item.location_text || "Premises",
    },
    {
      key: "reported_at",
      header: "Reported At",
      render: (item) => formatDate(item.reported_at),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      header: "Review",
      align: "right",
      render: (item) => (
        <Link
          href={`/association-committee/incidents/${item.id}`}
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", height: 28 }}
        >
          Review Report →
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Security Incident Reports & Oversight"
        subtitle={`Committee oversight and incident report reviews for ${community?.name || "Community Scope"}`}
        breadcrumbs={[
          { label: "Association Committee", href: "/association-committee/governance" },
          { label: "Security Incidents" },
        ]}
      />

      {/* Scope Disclaimer */}
      <div
        style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "var(--radius)",
          padding: "0.85rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          color: "#92400e",
          fontSize: "0.8rem",
        }}
      >
        <span>🛡️</span>
        <div>
          <strong>Governance Oversight Role (FR-13):</strong> Review incident logs, responder timelines, and resolution summaries. Live dispatch and gate controls are restricted to security personnel.
        </div>
      </div>

      {/* Filters & Search Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: 260, maxWidth: 400 }}>
          <input
            type="text"
            placeholder="Search incident number, type, location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ fontSize: "0.85rem" }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="select-field"
            style={{ width: "auto", fontSize: "0.8rem", height: 36 }}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-field"
            style={{ width: "auto", fontSize: "0.8rem", height: 36 }}
          >
            <option value="all">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="responding">Responding</option>
            <option value="contained">Contained</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Incidents DataTable */}
      <div className="card">
        <DataTable<Incident>
          columns={incidentColumns}
          data={incidents}
          isLoading={isLoading}
          emptyTitle="No incident reports"
          emptyDescription="No security incident records match the selected filters."
        />
      </div>
    </div>
  );
}
