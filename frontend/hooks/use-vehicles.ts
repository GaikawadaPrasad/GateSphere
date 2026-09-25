"use client";

/**
 * Vehicle & Parking (FR-08) — shared TanStack Query hooks for the security guard,
 * security supervisor and auditor screens. Server data lives here only (AGENTS.md §5.3).
 *
 * Query keys are hierarchical — `["vehicles", communityId, <resource>, filters]` — so each
 * mutation invalidates exactly the resource it changed.
 */

import { useRef } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { communitiesApi, vehiclesApi } from "@/lib/api";
import { useMe } from "@/hooks/use-auth";
import { useLivePollInterval } from "@/hooks/use-realtime";
import { useUiStore } from "@/store/ui";
import type {
  EntryFilters,
  Page,
  ParkingAllocation,
  ParkingSlot,
  ParkingViolation,
  RecordEntryPayload,
  ReportViolationPayload,
  Vehicle,
  VehicleEntry,
  ViolationFilters,
  ViolationStatus,
} from "@/types/vehicles";

export const vehicleKeys = {
  all: (cid: string | null) => ["vehicles", cid] as const,
  entries: (cid: string | null) => ["vehicles", cid, "entries"] as const,
  violations: (cid: string | null) => ["vehicles", cid, "violations"] as const,
  registry: (cid: string | null) => ["vehicles", cid, "registry"] as const,
  slots: (cid: string | null) => ["vehicles", cid, "slots"] as const,
  allocations: (cid: string | null) => ["vehicles", cid, "allocations"] as const,
};

/**
 * The community the vehicle screens act in: the header's active community (super admin /
 * auditor switcher) or the viewer's own community grant. The backend re-derives scope from
 * the session regardless — this only picks which of the viewer's communities to show.
 */
export function useVehicleCommunityId(): string | null {
  const { data: me } = useMe();
  const activeCommunityId = useUiStore((s) => s.activeCommunityId);
  return (
    activeCommunityId ||
    me?.community_ids?.[0] ||
    me?.roles?.find((r) => r.community_id)?.community_id ||
    null
  );
}

function toPage<T>(res: { data: T[]; meta?: { total?: number } }): Page<T> {
  const rows = Array.isArray(res.data) ? res.data : [];
  return { rows, total: res.meta?.total ?? rows.length };
}

// -- reads ---------------------------------------------------------------------------- //
export function useVehicleEntries(
  cid: string | null,
  f: EntryFilters,
  opts?: { refetchInterval?: number },
) {
  // `refetchInterval` is the fallback used only while the realtime socket is down.
  const livePoll = useLivePollInterval(opts?.refetchInterval ?? 0);
  return useQuery<Page<VehicleEntry>>({
    queryKey: [...vehicleKeys.entries(cid), f],
    queryFn: async () =>
      toPage(
        await vehiclesApi.entriesPage({
          community_id: cid ?? undefined,
          open_only: f.openOnly || undefined,
          flagged_only: f.flaggedOnly || undefined,
          plate: f.plate || undefined,
          page: f.page ?? 1,
          page_size: f.pageSize ?? 20,
        }),
      ),
    enabled: !!cid,
    staleTime: 0, // live gate state
    placeholderData: keepPreviousData,
    refetchInterval: opts?.refetchInterval ? livePoll : false,
  });
}

export function useParkingViolations(cid: string | null, f: ViolationFilters) {
  return useQuery<Page<ParkingViolation>>({
    queryKey: [...vehicleKeys.violations(cid), f],
    queryFn: async () =>
      toPage(
        await vehiclesApi.violationsPage({
          community_id: cid ?? undefined,
          violation_status: f.status || undefined,
          plate: f.plate || undefined,
          page: f.page ?? 1,
          page_size: f.pageSize ?? 20,
        }),
      ),
    enabled: !!cid,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useVehicleRegistry(
  cid: string | null,
  f: { q?: string; page?: number; pageSize?: number },
) {
  return useQuery<Page<Vehicle>>({
    queryKey: [...vehicleKeys.registry(cid), f],
    queryFn: async () =>
      toPage(
        await vehiclesApi.registryPage({
          community_id: cid ?? undefined,
          q: f.q || undefined,
          page: f.page ?? 1,
          page_size: f.pageSize ?? 20,
        }),
      ),
    enabled: !!cid,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Plate pre-check at the gate: the exact registration (if any) for a typed plate. */
export function usePlateLookup(cid: string | null, plate: string) {
  return useQuery<Vehicle | null>({
    queryKey: [...vehicleKeys.registry(cid), "lookup", plate],
    queryFn: async () => {
      const res = await vehiclesApi.registryPage({
        community_id: cid ?? undefined,
        q: plate,
        page_size: 10,
      });
      return (res.data || []).find((v) => v.registration_number === plate) ?? null;
    },
    enabled: !!cid && plate.length >= 4,
    staleTime: 30_000,
  });
}

/** Slots + active allocations (≤100 each — the parking inventory of one community). */
export function useParkingInventory(cid: string | null) {
  const slots = useQuery<ParkingSlot[]>({
    queryKey: vehicleKeys.slots(cid),
    queryFn: async () =>
      (await vehiclesApi.slotsPage({ community_id: cid ?? undefined, page_size: 100 })).data || [],
    enabled: !!cid,
    staleTime: 60_000,
  });
  const allocations = useQuery<ParkingAllocation[]>({
    queryKey: vehicleKeys.allocations(cid),
    queryFn: async () =>
      (
        await vehiclesApi.allocationsPage({
          community_id: cid ?? undefined,
          active_only: true,
          page_size: 100,
        })
      ).data || [],
    enabled: !!cid,
    staleTime: 60_000,
  });
  return { slots, allocations };
}

/** Gate + unit lookups used to label rows (rarely change — minutes of staleness is fine). */
export function useVehicleLookups(cid: string | null) {
  const gates = useQuery({
    queryKey: ["communities", cid, "gates"],
    queryFn: async () => (cid ? await communitiesApi.gates(cid) : []),
    enabled: !!cid,
    staleTime: 5 * 60_000,
  });
  const units = useQuery({
    queryKey: ["communities", cid, "units", "lookup"],
    queryFn: async () => {
      if (!cid) return [];
      const res: any = await communitiesApi.communityUnits(cid, { page_size: 100 });
      return (Array.isArray(res) ? res : res?.data || []) as { id: string; unit_number: string }[];
    },
    enabled: !!cid,
    staleTime: 5 * 60_000,
  });
  const gateName = new Map((gates.data || []).map((g: any) => [g.id, g.name || g.code]));
  const unitName = new Map((units.data || []).map((u) => [u.id, u.unit_number]));
  return { gates: gates.data || [], gateName, unitName };
}

// -- mutations ------------------------------------------------------------------------ //
/**
 * Duplicate-submit guard (AGENTS.md §5.4): `isPending` is React state and lags a
 * double-click by a render; the ref is checked synchronously before `.mutate()`.
 */
function useInFlight() {
  const ref = useRef<Set<string>>(new Set());
  return {
    begin: (key: string) => {
      if (ref.current.has(key)) return false;
      ref.current.add(key);
      return true;
    },
    end: (key: string) => ref.current.delete(key),
  };
}

export function useRecordVehicleEntry(cid: string | null) {
  const qc = useQueryClient();
  const guard = useInFlight();
  const m = useMutation({
    mutationFn: (payload: RecordEntryPayload) => vehiclesApi.recordEntry(payload, cid ?? undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.entries(cid) }),
  });
  return {
    ...m,
    submit: (payload: RecordEntryPayload, cb?: Parameters<typeof m.mutate>[1]) => {
      if (!guard.begin("entry")) return;
      m.mutate(payload, {
        ...cb,
        onSettled: (...a) => (guard.end("entry"), cb?.onSettled?.(...a)),
      });
    },
  };
}

export function useRecordVehicleExit(cid: string | null) {
  const qc = useQueryClient();
  const guard = useInFlight();
  const m = useMutation({
    mutationFn: (entryId: string) => vehiclesApi.recordExit(entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.entries(cid) }),
  });
  return {
    ...m,
    submit: (entryId: string, cb?: Parameters<typeof m.mutate>[1]) => {
      if (!guard.begin(entryId)) return;
      m.mutate(entryId, {
        ...cb,
        onSettled: (...a) => (guard.end(entryId), cb?.onSettled?.(...a)),
      });
    },
  };
}

export function useReportViolation(cid: string | null) {
  const qc = useQueryClient();
  const guard = useInFlight();
  const m = useMutation({
    mutationFn: (payload: ReportViolationPayload) => vehiclesApi.report(payload, cid ?? undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.violations(cid) }),
  });
  return {
    ...m,
    submit: (payload: ReportViolationPayload, cb?: Parameters<typeof m.mutate>[1]) => {
      if (!guard.begin("report")) return;
      m.mutate(payload, {
        ...cb,
        onSettled: (...a) => (guard.end("report"), cb?.onSettled?.(...a)),
      });
    },
  };
}

export function useTransitionViolation(cid: string | null) {
  const qc = useQueryClient();
  const guard = useInFlight();
  const m = useMutation({
    mutationFn: (v: { id: string; status: ViolationStatus }) =>
      vehiclesApi.setViolationStatus(v.id, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: vehicleKeys.violations(cid) }),
  });
  return {
    ...m,
    submit: (v: { id: string; status: ViolationStatus }, cb?: Parameters<typeof m.mutate>[1]) => {
      if (!guard.begin(v.id)) return;
      m.mutate(v, { ...cb, onSettled: (...a) => (guard.end(v.id), cb?.onSettled?.(...a)) });
    },
  };
}
