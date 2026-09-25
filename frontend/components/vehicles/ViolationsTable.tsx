"use client";

import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  VIOLATION_NEXT,
  VIOLATION_TYPE_LABELS,
  type ParkingViolation,
  type ViolationStatus,
} from "@/types/vehicles";

const ACTION_LABEL: Record<ViolationStatus, string> = {
  open: "Reopen",
  acknowledged: "Acknowledge",
  resolved: "Resolve",
  waived: "Waive",
};

interface Props {
  rows: ParkingViolation[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  isLoading: boolean;
  slotCode: Map<string, string>;
  /** Omit for read-only viewers — the lifecycle buttons are then not rendered at all. */
  onTransition?: (v: ParkingViolation, next: ViolationStatus) => void;
  busyId?: string | null;
  emptyTitle: string;
  emptyDescription: string;
}

/** Parking violations with the open → acknowledged → resolved / waived lifecycle. */
export function ViolationsTable({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading,
  slotCode,
  onTransition,
  busyId,
  emptyTitle,
  emptyDescription,
}: Props) {
  const columns: Column<ParkingViolation>[] = [
    {
      key: "registration_number",
      header: "Plate",
      render: (v) => (
        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
          {v.registration_number || "—"}
          {!v.vehicle_id && v.registration_number ? (
            <span style={{ display: "block", fontSize: "0.7rem", color: "var(--muted)" }}>
              not registered
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "violation_type",
      header: "Type",
      render: (v) => VIOLATION_TYPE_LABELS[v.violation_type] ?? v.violation_type,
    },
    {
      key: "parking_slot_id",
      header: "Slot",
      render: (v) => (v.parking_slot_id ? slotCode.get(v.parking_slot_id) || "Slot" : "—"),
    },
    {
      key: "description",
      header: "Details",
      render: (v) => <span style={{ fontSize: "0.8rem" }}>{v.description || "—"}</span>,
    },
    {
      key: "fine_amount",
      header: "Fine",
      render: (v) =>
        v.fine_amount && Number(v.fine_amount) > 0 ? formatCurrency(v.fine_amount) : "Warning only",
    },
    { key: "occurred_at", header: "Reported", render: (v) => formatDateTime(v.occurred_at) },
    { key: "status", header: "Status", render: (v) => <StatusBadge status={v.status} /> },
  ];
  if (onTransition) {
    columns.push({
      key: "actions",
      header: "Action",
      align: "right",
      render: (v) => (
        <div
          style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end", flexWrap: "wrap" }}
        >
          {VIOLATION_NEXT[v.status].map((next) => (
            <button
              key={next}
              type="button"
              className={next === "waived" ? "btn btn-secondary" : "btn btn-primary"}
              style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
              disabled={busyId === v.id}
              onClick={() => onTransition(v, next)}
            >
              {ACTION_LABEL[next]}
            </button>
          ))}
        </div>
      ),
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
      keyExtractor={(v) => v.id}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyIcon="🅿️"
    />
  );
}
