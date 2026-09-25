"use client";

import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { ENTRY_SOURCE_LABELS, type VehicleEntry } from "@/types/vehicles";

interface Props {
  rows: VehicleEntry[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  isLoading: boolean;
  gateName: Map<string, string>;
  /** Omit for read-only viewers (auditor / resident) — no exit action is rendered. */
  onExit?: (entry: VehicleEntry) => void;
  exitingId?: string | null;
  emptyTitle: string;
  emptyDescription: string;
}

/** Gate movement log for plates (FR-08 automated entry/exit logging). */
export function VehicleEntriesTable({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading,
  gateName,
  onExit,
  exitingId,
  emptyTitle,
  emptyDescription,
}: Props) {
  const columns: Column<VehicleEntry>[] = [
    {
      key: "registration_number",
      header: "Plate",
      render: (e) => (
        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{e.registration_number}</span>
      ),
    },
    {
      key: "is_flagged",
      header: "Registration",
      render: (e) =>
        e.is_flagged ? (
          <StatusBadge status="warning" label="⚠ Flagged — unregistered" />
        ) : (
          <StatusBadge status="verified" label="Registered" />
        ),
    },
    {
      key: "source_type",
      header: "Source",
      render: (e) => ENTRY_SOURCE_LABELS[e.source_type] ?? e.source_type,
    },
    {
      key: "gate_id",
      header: "Gate",
      render: (e) => (e.gate_id ? gateName.get(e.gate_id) || "Gate" : "—"),
    },
    {
      key: "entry_at",
      header: "Entered",
      render: (e) => (
        <span title={formatDateTime(e.entry_at)}>{formatRelativeTime(e.entry_at)}</span>
      ),
    },
    {
      key: "exit_at",
      header: "Exited",
      render: (e) => (e.exit_at ? formatDateTime(e.exit_at) : "—"),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => (
        <StatusBadge status={e.status} label={e.status === "inside" ? "Inside" : "Exited"} />
      ),
    },
  ];
  if (onExit) {
    columns.push({
      key: "actions",
      header: "Action",
      align: "right",
      render: (e) =>
        e.status === "inside" ? (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            onClick={() => onExit(e)}
            disabled={exitingId === e.id}
            aria-busy={exitingId === e.id}
          >
            {exitingId === e.id ? "Logging…" : "Log Exit"}
          </button>
        ) : null,
    });
  }

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      keyExtractor={(e) => e.id}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyIcon="🚗"
    />
  );
}
