"use client";

import { useState, useMemo, useCallback } from "react";

export interface TableControlOptions<T> {
  data?: T[];
  searchKeys?: (keyof T | string)[];
  initialPageSize?: number;
  initialSortKey?: string;
  initialSortDir?: "asc" | "desc";
}

export function useTableControls<T extends Record<string, any>>({
  data = [],
  searchKeys = [],
  initialPageSize = 10,
  initialSortKey,
  initialSortDir = "asc",
}: TableControlOptions<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey || null);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(initialSortKey ? initialSortDir : null);

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

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortDir]);

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
    total: sortedData.length,
    filteredCount: filteredData.length,
    paginatedData,
    processedData: sortedData,
  };
}
