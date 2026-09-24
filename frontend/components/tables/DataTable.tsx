"use client";

import React, { useState, useEffect, useMemo, type ReactNode } from "react";
import { TableSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Pagination } from "@/components/tables/Pagination";
import { SortDropdown, type SortPreset } from "@/components/common/SortDropdown";

export type SortDirection = "asc" | "desc" | null;

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (item: T, index: number) => ReactNode;
  width?: string | number;
  align?: "left" | "center" | "right";
}

export interface DataTableProps<T> {
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
  // Integrated Sort Dropdown
  showSortDropdown?: boolean;
  sortPreset?: SortPreset;
  onSortPresetChange?: (preset: SortPreset) => void;
  toolbarActions?: ReactNode;
  // Mobile Card View customization
  renderCard?: (item: T, index: number) => ReactNode;
  viewMode?: "auto" | "table" | "cards";
  showViewToggle?: boolean;
}

const COMMON_DATE_KEYS = [
  "created_at",
  "createdAt",
  "occurred_at",
  "entry_time",
  "entry_at",
  "timestamp",
  "date",
  "start_date",
  "shift_date",
  "updated_at",
];

const COMMON_TEXT_KEYS = [
  "visitor_name",
  "full_name",
  "resident_name",
  "name",
  "subject",
  "title",
  "courier_company",
  "ticket_number",
  "invoice_number",
  "unit_number",
  "plate",
  "amenity_name",
  "gate_name",
  "vendor_name",
  "label",
  "code",
];

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    try {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } catch {
      // Fallback for older browsers
      mq.addListener?.(update);
      return () => mq.removeListener?.(update);
    }
  }, [breakpoint]);

  return isMobile;
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
  defaultSortDir,
  showSortDropdown = false,
  sortPreset: controlledSortPreset,
  onSortPresetChange,
  toolbarActions,
  renderCard,
  viewMode: controlledViewMode = "auto",
  showViewToggle = false,
}: DataTableProps<T>) {
  const isMobile = useIsMobile(768);
  const [manualViewMode, setManualViewMode] = useState<"table" | "cards" | null>(null);

  const effectiveViewMode =
    controlledViewMode !== "auto"
      ? controlledViewMode
      : manualViewMode !== null
        ? manualViewMode
        : isMobile
          ? "cards"
          : "table";

  const [internalSortPreset, setInternalSortPreset] = useState<SortPreset>("newest");
  const activeSortPreset = controlledSortPreset || internalSortPreset;

  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDir, setSortDir] = useState<SortDirection>(
    defaultSortKey ? defaultSortDir || "desc" : null,
  );
  const [localPage, setLocalPage] = useState<number>(1);
  const [localPageSize, setLocalPageSize] = useState<number>(controlledPageSize || 10);

  const handleSortPresetChange = (preset: SortPreset) => {
    if (onSortPresetChange) {
      onSortPresetChange(preset);
    } else {
      setInternalSortPreset(preset);
    }
    // Clear manual column sort override so dropdown preset takes effect
    setSortKey(null);
    setSortDir(null);
    setLocalPage(1);
  };

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

  // Determine active date and text keys for automatic preset sorting
  const detectedDateKey = useMemo(() => {
    if (!data || data.length === 0) return null;
    const sample = data[0] as Record<string, unknown>;
    for (const k of COMMON_DATE_KEYS) {
      if (k in sample && sample[k] !== undefined) return k;
    }
    return null;
  }, [data]);

  const detectedTextKey = useMemo(() => {
    if (!data || data.length === 0) return null;
    const sample = data[0] as Record<string, unknown>;
    for (const k of COMMON_TEXT_KEYS) {
      if (k in sample && sample[k] !== undefined) return k;
    }
    for (const col of columns) {
      const val = sample[col.key];
      if (typeof val === "string" && !col.key.endsWith("_id") && col.key !== "id") {
        return col.key;
      }
    }
    return null;
  }, [data, columns]);

  // Process data (sort)
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 1. Column header sort override
    if (sortKey && sortDir) {
      return [...data].sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sortKey];
        const bVal = (b as Record<string, unknown>)[sortKey];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }

        const aDate = Date.parse(String(aVal));
        const bDate = Date.parse(String(bVal));
        if (!isNaN(aDate) && !isNaN(bDate) && String(aVal).length > 8 && String(bVal).length > 8) {
          return sortDir === "asc" ? aDate - bDate : bDate - aDate;
        }

        const aStr = String(aVal);
        const bStr = String(bVal);
        const comp = aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? comp : -comp;
      });
    }

    // 2. Preset sort: only apply if sort dropdown or preset is enabled
    if (!enableClientSort || (!showSortDropdown && !controlledSortPreset)) return data;

    return [...data].sort((a, b) => {
      const aRec = a as Record<string, unknown>;
      const bRec = b as Record<string, unknown>;

      if (activeSortPreset === "newest" || activeSortPreset === "oldest") {
        const dKey = detectedDateKey;
        if (dKey) {
          const aVal = aRec[dKey];
          const bVal = bRec[dKey];
          if (aVal && bVal) {
            const aTime = new Date(String(aVal)).getTime();
            const bTime = new Date(String(bVal)).getTime();
            if (!isNaN(aTime) && !isNaN(bTime)) {
              return activeSortPreset === "newest" ? bTime - aTime : aTime - bTime;
            }
          }
        }
        return 0;
      }

      if (activeSortPreset === "a-z" || activeSortPreset === "z-a") {
        const tKey = detectedTextKey;
        if (tKey) {
          const aVal = String(aRec[tKey] ?? "");
          const bVal = String(bRec[tKey] ?? "");
          const comp = aVal.localeCompare(bVal, undefined, {
            numeric: true,
            sensitivity: "base",
          });
          return activeSortPreset === "a-z" ? comp : -comp;
        }
      }

      return 0;
    });
  }, [
    data,
    sortKey,
    sortDir,
    activeSortPreset,
    enableClientSort,
    detectedDateKey,
    detectedTextKey,
  ]);

  // Client-side pagination if needed
  const isClientPaging = enableClientPagination && !onPageChange;
  const currentPage = isClientPaging ? localPage : controlledPage || 1;
  const currentPageSize = isClientPaging ? localPageSize : controlledPageSize || 10;
  const currentTotal = isClientPaging
    ? sortedData.length
    : controlledTotal !== undefined
      ? controlledTotal
      : sortedData.length;

  const paginatedData = useMemo(() => {
    if (!isClientPaging) return sortedData;
    const start = (currentPage - 1) * currentPageSize;
    return sortedData.slice(start, start + currentPageSize);
  }, [sortedData, isClientPaging, currentPage, currentPageSize]);

  // Derive column categorization for automatic mobile card rendering
  const primaryCol = columns[0];
  const statusCol = columns.find(
    (c) =>
      c !== primaryCol &&
      (c.key === "status" ||
        c.key === "is_active" ||
        c.key === "occupancy" ||
        c.key === "financialStatus" ||
        c.header.toLowerCase().includes("status")),
  );
  const actionsCol = columns.find(
    (c) =>
      c.key === "actions" ||
      c.key === "action" ||
      c.header.toLowerCase() === "actions" ||
      c.header.toLowerCase() === "action",
  );
  const secondaryCols = columns.filter(
    (c) => c !== primaryCol && c !== statusCol && c !== actionsCol,
  );

  if (isLoading) {
    return <TableSkeleton rows={currentPageSize || 5} cols={columns.length} />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />;
  }

  return (
    <div className="table-responsive-container">
      {(showSortDropdown || toolbarActions || showViewToggle) && (
        <div
          className="data-table-toolbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
            padding: "0.75rem 0.85rem",
            borderBottom: "1px solid var(--border-light)",
            background: "#fcfdfe",
            minWidth: 0,
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {toolbarActions}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginLeft: "auto",
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {showViewToggle && (
              <div
                style={{
                  display: "inline-flex",
                  background: "#f1f5f9",
                  padding: "2px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setManualViewMode("cards")}
                  style={{
                    height: 28,
                    padding: "0 0.5rem",
                    fontSize: "11px",
                    fontWeight: 600,
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    background: effectiveViewMode === "cards" ? "#ffffff" : "transparent",
                    color: effectiveViewMode === "cards" ? "var(--primary)" : "var(--muted)",
                    boxShadow:
                      effectiveViewMode === "cards" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                  }}
                  title="Card View"
                >
                  📱 Cards
                </button>
                <button
                  type="button"
                  onClick={() => setManualViewMode("table")}
                  style={{
                    height: 28,
                    padding: "0 0.5rem",
                    fontSize: "11px",
                    fontWeight: 600,
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    background: effectiveViewMode === "table" ? "#ffffff" : "transparent",
                    color: effectiveViewMode === "table" ? "var(--primary)" : "var(--muted)",
                    boxShadow:
                      effectiveViewMode === "table" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                  }}
                  title="Table View"
                >
                  📊 Table
                </button>
              </div>
            )}

            {showSortDropdown && (
              <SortDropdown value={activeSortPreset} onChange={handleSortPresetChange} size="sm" />
            )}
          </div>
        </div>
      )}

      {/* View Mode Switching: Mobile Cards (Option 1) vs Desktop Scroller Table (Option 2) */}
      {effectiveViewMode === "cards" ? (
        <div className="data-table-cards-list">
          {paginatedData.map((item, index) => {
            const itemRecord = item as Record<string, unknown>;
            const key = keyExtractor
              ? keyExtractor(item, index)
              : (itemRecord.id as string) || String(index);

            if (renderCard) {
              return (
                <div
                  key={key}
                  className={`data-table-mobile-card ${onRowClick ? "is-clickable" : ""}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {renderCard(item, index)}
                </div>
              );
            }

            return (
              <div
                key={key}
                className={`data-table-mobile-card ${onRowClick ? "is-clickable" : ""}`}
                onClick={() => onRowClick?.(item)}
              >
                {/* Card Top: Primary Title & Status */}
                <div className="data-table-card-top">
                  <div className="data-table-card-main-title">
                    {primaryCol?.render
                      ? primaryCol.render(item, index)
                      : String(itemRecord[primaryCol?.key || ""] ?? "–")}
                  </div>
                  {statusCol && (
                    <div className="data-table-card-badge" onClick={(e) => e.stopPropagation()}>
                      {statusCol.render
                        ? statusCol.render(item, index)
                        : String(itemRecord[statusCol.key] ?? "")}
                    </div>
                  )}
                </div>

                {/* Card Body: Attributes grid */}
                {secondaryCols.length > 0 && (
                  <div className="data-table-card-grid">
                    {secondaryCols.map((col) => {
                      const renderedVal = col.render
                        ? col.render(item, index)
                        : String(itemRecord[col.key] ?? "–");
                      return (
                        <div key={col.key} className="data-table-card-field">
                          <span className="data-table-card-label">{col.header}</span>
                          <div className="data-table-card-value">{renderedVal}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Card Footer Actions */}
                {actionsCol && (
                  <div
                    className="data-table-card-footer-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actionsCol.render ? actionsCol.render(item, index) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-responsive-wrapper">
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
                          justifyContent:
                            col.align === "right"
                              ? "flex-end"
                              : col.align === "center"
                                ? "center"
                                : "flex-start",
                          width: "100%",
                        }}
                      >
                        <span>{col.header}</span>
                        {canSort && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: isSorted ? "var(--brand-primary)" : "var(--text-muted)",
                              opacity: isSorted ? 1 : 0.4,
                            }}
                          >
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
                const key = keyExtractor
                  ? keyExtractor(item, index)
                  : (itemRecord.id as string) || String(index);
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
        </div>
      )}

      {/* Pagination - spans full container width outside horizontal scroller */}
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
