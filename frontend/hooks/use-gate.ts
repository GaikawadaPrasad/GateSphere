"use client";

import { useQuery } from "@tanstack/react-query";
import { gateApi } from "@/lib/api";
import type { ListQueryParams } from "@/types/api";

export const gateKeys = {
  all: ["gate"] as const,
  events: (params?: ListQueryParams) => [...gateKeys.all, "events", params] as const,
  alerts: (params?: ListQueryParams) => [...gateKeys.all, "alerts", params] as const,
  rosters: (params?: ListQueryParams) => [...gateKeys.all, "rosters", params] as const,
};

export function useGateEvents(params?: ListQueryParams) {
  return useQuery({
    queryKey: gateKeys.events(params),
    queryFn: () => gateApi.events(params),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function usePanicAlerts(params?: ListQueryParams) {
  return useQuery({
    queryKey: gateKeys.alerts(params),
    queryFn: () => gateApi.alerts(params),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useGuardRosters(params?: ListQueryParams) {
  return useQuery({
    queryKey: gateKeys.rosters(params),
    queryFn: () => gateApi.rosters(params),
    staleTime: 30_000,
  });
}
