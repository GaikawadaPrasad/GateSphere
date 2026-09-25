"use client";

import { useQuery } from "@tanstack/react-query";
import { gateApi } from "@/lib/api";
import { useLivePollInterval } from "@/hooks/use-realtime";
import type { ListQueryParams } from "@/types/api";

export const gateKeys = {
  all: ["gate"] as const,
  events: (params?: ListQueryParams) => [...gateKeys.all, "events", params] as const,
  alerts: (params?: ListQueryParams) => [...gateKeys.all, "alerts", params] as const,
  rosters: (params?: ListQueryParams) => [...gateKeys.all, "rosters", params] as const,
};

export function useGateEvents(params?: ListQueryParams) {
  const livePoll = useLivePollInterval(15_000);
  return useQuery({
    queryKey: gateKeys.events(params),
    queryFn: () => gateApi.events(params),
    staleTime: 10_000,
    refetchInterval: livePoll,
  });
}

export function usePanicAlerts(params?: ListQueryParams) {
  const livePoll = useLivePollInterval(10_000, 60_000); // SOS keeps a safety net
  return useQuery({
    queryKey: gateKeys.alerts(params),
    queryFn: () => gateApi.alerts(params),
    staleTime: 5_000,
    refetchInterval: livePoll,
  });
}

export function useGuardRosters(params?: ListQueryParams) {
  return useQuery({
    queryKey: gateKeys.rosters(params),
    queryFn: () => gateApi.rosters(params),
    staleTime: 30_000,
  });
}
