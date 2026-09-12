"use client";

import Link from "next/link";
import type { Community } from "@/types/communities";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";

export interface CommunityWithMetrics extends Community {
  totalTowersCount?: number;
  totalUnitsCount?: number;
  totalResidentsCount?: number;
  occupancyRate?: number;
  financialStatus?: "Good" | "Attention" | "Critical";
}

interface CommunityTableProps {
  communities: CommunityWithMetrics[] | undefined;
  isLoading?: boolean;
  onView?: (community: CommunityWithMetrics) => void;
  onEdit?: (community: CommunityWithMetrics) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  enableClientPagination?: boolean;
}

export function CommunityTable({
  communities,
  isLoading,
  onView,
  onEdit,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  enableClientPagination = true,
}: CommunityTableProps) {
  const columns: Column<CommunityWithMetrics>[] = [
    {
      key: "name",
      header: "Community Name",
      sortable: true,
      render: (comm) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--fg)" }}>{comm.name}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Code: {comm.code}</div>
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      sortable: true,
      render: (comm) => {
        const parts = [comm.city, comm.state].filter(Boolean);
        return <span>{parts.length > 0 ? parts.join(", ") : "–"}</span>;
      },
    },
    {
      key: "towers",
      header: "Towers",
      align: "center",
      sortable: true,
      render: (comm) => <span>{comm.totalTowersCount ?? comm.total_towers ?? "–"}</span>,
    },
    {
      key: "units",
      header: "Units",
      align: "center",
      sortable: true,
      render: (comm) => <span>{comm.totalUnitsCount ?? comm.total_units ?? "–"}</span>,
    },
    {
      key: "residents",
      header: "Residents",
      align: "center",
      sortable: true,
      render: (comm) => <span>{comm.totalResidentsCount ?? comm.total_residents ?? "–"}</span>,
    },
    {
      key: "occupancy",
      header: "Occupancy",
      align: "center",
      sortable: true,
      render: (comm) => {
        const occ = comm.occupancyRate ?? 0;
        return (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: 48,
                height: 6,
                background: "#e2e8f0",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${occ}%`,
                  height: "100%",
                  background:
                    occ > 75 ? "var(--success)" : occ > 40 ? "var(--warning)" : "var(--primary)",
                }}
              />
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>{occ}%</span>
          </div>
        );
      },
    },
    {
      key: "financialStatus",
      header: "Financial Status",
      align: "center",
      sortable: true,
      render: (comm) => {
        const status = comm.financialStatus || "Good";
        return (
          <StatusBadge
            status={status === "Good" ? "paid" : status === "Attention" ? "pending" : "overdue"}
            label={status}
          />
        );
      },
    },
    {
      key: "is_active",
      header: "Status",
      align: "center",
      sortable: true,
      render: (comm) => <StatusBadge status={comm.is_active} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (comm) => (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
          {onEdit && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(comm);
              }}
              style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", height: 28 }}
              title="Edit or Delete Community"
            >
              ✏️ Edit
            </button>
          )}

          {onView ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                onView(comm);
              }}
              style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", height: 28 }}
            >
              👁️ View
            </button>
          ) : (
            <Link
              href={`/super-admin/communities?id=${comm.id}`}
              className="btn btn-secondary"
              style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", height: 28 }}
            >
              👁️ View
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns as unknown as Column<Record<string, unknown>>[]}
      data={communities as unknown as Record<string, unknown>[]}
      isLoading={isLoading}
      emptyTitle="No communities found"
      emptyDescription="No communities have been created yet or none match your search."
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      enableClientPagination={enableClientPagination}
    />
  );
}
