"use client";

import React, { useState, useMemo, type ReactNode } from "react";
import { TableSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Pagination } from "@/components/tables/Pagination";

export type SortDirection = "asc" | "desc" | null;

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (item: T, index: number) => ReactNode;
  width?: string | number;
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onRowClick?: (item: T) => void;
  keyExtractor?: (item: T, index: number) => string;
  // Client-side sorting & pagination fallback
  enableClientSort?: boolean;
  enableClientPagination?: boolean;
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
}

export function DataTable<T extends object = Record<string, unknown>>({
  columns,
  data = [],
  isLoading,
  emptyTitle = "No records found",
  emptyDescription = "There is currently no data to display for this view.",
  emptyIcon,
  page: controlledPage,
  pageSize: controlledPageSize,
  total: controlledTotal,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  keyExtractor,
  enableClientSort = true,
  enableClientPagination = false,
  defaultSortKey,
  defaultSortDir = "asc",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSortKey ? defaultSortDir : null);
  const [localPage, setLocalPage] = useState<number>(1);
  const [localPageSize, setLocalPageSize] = useState<number>(10);

  const handleSort = (colKey: string, sortable?: boolean) => {
    if (!sortable && !enableClientSort) return;
    if (sortKey === colKey) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
      setSortKey(colKey);
      setSortDir("asc");
    }
  };

  // Process data (sort)
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!sortKey || !sortDir) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      const comp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? comp : -comp;
    });
  }, [data, sortKey, sortDir]);

  // Client-side pagination if needed
  const isClientPaging = enableClientPagination && !onPageChange;
  const currentPage = isClientPaging ? localPage : (controlledPage || 1);
  const currentPageSize = isClientPaging ? localPageSize : (controlledPageSize || 10);
  const currentTotal = isClientPaging ? sortedData.length : (controlledTotal !== undefined ? controlledTotal : sortedData.length);

  const paginatedData = useMemo(() => {
    if (!isClientPaging) return sortedData;
    const start = (currentPage - 1) * currentPageSize;
    return sortedData.slice(start, start + currentPageSize);
  }, [sortedData, isClientPaging, currentPage, currentPageSize]);

  if (isLoading) {
    return <TableSkeleton rows={currentPageSize || 5} cols={columns.length} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />;
  }

  return (
    <div className="table-responsive-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              const canSort = col.sortable ?? enableClientSort;

              return (
                <th
                  key={col.key}
                  onClick={() => canSort && handleSort(col.key, col.sortable)}
                  style={{
                    width: col.width,
                    textAlign: col.align || "left",
                    cursor: canSort ? "pointer" : "default",
                    userSelect: "none",
                  }}
                  title={canSort ? `Sort by ${col.header}` : undefined}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      justifyContent: col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start",
                      width: "100%",
                    }}
                  >
                    <span>{col.header}</span>
                    {canSort && (
                      <span style={{ fontSize: "11px", color: isSorted ? "var(--brand-primary)" : "var(--text-muted)", opacity: isSorted ? 1 : 0.4 }}>
                        {isSorted ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((item, index) => {
            const itemRecord = item as Record<string, unknown>;
            const key = keyExtractor ? keyExtractor(item, index) : (itemRecord.id as string) || String(index);
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(item)}
                style={{ cursor: onRowClick ? "pointer" : "default" }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      textAlign: col.align || "left",
                    }}
                  >
                    {col.render ? col.render(item, index) : String(itemRecord[col.key] ?? "–")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {(onPageChange || isClientPaging) && (
        <Pagination
          page={currentPage}
          pageSize={currentPageSize}
          total={currentTotal}
          onPageChange={isClientPaging ? setLocalPage : onPageChange!}
          onPageSizeChange={isClientPaging ? setLocalPageSize : onPageSizeChange}
        />
      )}
    </div>
  );
}
