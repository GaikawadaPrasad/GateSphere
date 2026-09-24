"use client";

import { useState, useMemo, useCallback } from "react";
import type { SortPreset } from "@/components/common/SortDropdown";

export type { SortPreset };

export interface TableControlOptions<T> {
  data?: T[];
  searchKeys?: (keyof T | string)[];
  initialPageSize?: number;
  initialSortKey?: string;
  initialSortDir?: "asc" | "desc";
  initialSortPreset?: SortPreset;
  dateKey?: string;
  textKey?: string;
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

export function useTableControls<T extends Record<string, any>>({
  data = [],
  searchKeys = [],
  initialPageSize = 10,
  initialSortKey,
  initialSortDir,
  initialSortPreset = "newest",
  dateKey,
  textKey,
}: TableControlOptions<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey || null);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(
    initialSortKey ? initialSortDir || "desc" : null,
  );
  const [sortPreset, setSortPresetState] = useState<SortPreset>(initialSortPreset);

  const setSortPreset = useCallback((preset: SortPreset) => {
    setSortPresetState(preset);
    // Clear manual column sort override so preset takes effect
    setSortKey(null);
    setSortDir(null);
    setPage(1);
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setFilters({});
    setSortPresetState("newest");
    setSortKey(null);
    setSortDir(null);
    setPage(1);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return searchTerm.trim().length > 0 || Object.keys(filters).length > 0;
  }, [searchTerm, filters]);

  // Filtered & Searched data
  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter((item) => {
      // 1. Check search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = searchKeys.some((key) => {
          const val = item[key as string];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(term);
        });
        if (!matchesSearch) return false;
      }

      // 2. Check individual field filters
      for (const [key, filterVal] of Object.entries(filters)) {
        if (!filterVal) continue;
        const itemVal = item[key];
        if (itemVal === null || itemVal === undefined) return false;
        if (String(itemVal).toLowerCase() !== filterVal.toLowerCase()) return false;
      }

      return true;
    });
  }, [data, searchTerm, searchKeys, filters]);

  // Determine active date and text keys for preset sorting
  const detectedDateKey = useMemo(() => {
    if (dateKey) return dateKey;
    if (!filteredData.length) return null;
    const sample = filteredData[0];
    for (const k of COMMON_DATE_KEYS) {
      if (k in sample && sample[k] !== undefined) return k;
    }
    return null;
  }, [dateKey, filteredData]);

  const detectedTextKey = useMemo(() => {
    if (textKey) return textKey;
    if (!filteredData.length) return null;
    const sample = filteredData[0];
    for (const k of COMMON_TEXT_KEYS) {
      if (k in sample && sample[k] !== undefined) return k;
    }
    // Fallback to first string field that is not an ID or URL
    for (const [k, v] of Object.entries(sample)) {
      if (typeof v === "string" && !k.endsWith("_id") && k !== "id" && !v.startsWith("http")) {
        return k;
      }
    }
    return null;
  }, [textKey, filteredData]);

  // Sorted data with Newly Added at Top as primary default
  const sortedData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];

    // 1. Manual column header sort override if set
    if (sortKey && sortDir) {
      return [...filteredData].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];

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

        const comp = String(aVal).localeCompare(String(bVal), undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return sortDir === "asc" ? comp : -comp;
      });
    }

    // 2. Preset sort
    return [...filteredData].sort((a, b) => {
      if (sortPreset === "newest" || sortPreset === "oldest") {
        const dKey = detectedDateKey;
        if (dKey) {
          const aVal = a[dKey];
          const bVal = b[dKey];
          if (aVal && bVal) {
            const aTime = new Date(aVal).getTime();
            const bTime = new Date(bVal).getTime();
            if (!isNaN(aTime) && !isNaN(bTime)) {
              return sortPreset === "newest" ? bTime - aTime : aTime - bTime;
            }
          }
        }
        // Fallback for newest: preserve order or reverse if no explicit date
        return 0;
      }

      if (sortPreset === "a-z" || sortPreset === "z-a") {
        const tKey = detectedTextKey;
        if (tKey) {
          const aVal = String(a[tKey] ?? "");
          const bVal = String(b[tKey] ?? "");
          const comp = aVal.localeCompare(bVal, undefined, {
            numeric: true,
            sensitivity: "base",
          });
          return sortPreset === "a-z" ? comp : -comp;
        }
      }

      return 0;
    });
  }, [filteredData, sortKey, sortDir, sortPreset, detectedDateKey, detectedTextKey]);

  // Paginated slice
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  return {
    searchTerm,
    setSearchTerm,
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortKey,
    sortDir,
    setSortKey,
    setSortDir,
    sortPreset,
    setSortPreset,
    total: sortedData.length,
    totalPages: Math.ceil(sortedData.length / pageSize) || 1,
    startIndex: (page - 1) * pageSize,
    filteredCount: filteredData.length,
    paginatedData,
    processedData: sortedData,
  };
}
