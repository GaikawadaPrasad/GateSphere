"use client";

import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import type { AuditQueryParams } from "@/types/audit";

export const auditKeys = {
  all: ["audit"] as const,
  logs: (params?: AuditQueryParams) => [...auditKeys.all, "logs", params] as const,
};

export function useAuditLogs(params?: AuditQueryParams) {
  return useQuery({
    queryKey: auditKeys.logs(params),
    queryFn: () => auditApi.logs(params),
    staleTime: 15_000,
  });
}
