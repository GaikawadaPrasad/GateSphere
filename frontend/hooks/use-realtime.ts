"use client";

/**
 * Realtime → TanStack Query bridge (AGENTS.md §5.7).
 *
 * A hint names the backend module that changed; it is routed to the query-key prefixes that
 * render that module's data and invalidated with `refetchType: "active"` — only queries on
 * screen refetch, everything else is merely marked stale (no request until it's shown).
 * Hints are coalesced for `DEBOUNCE_MS`, so a burst of changes costs one refetch per key.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { realtime, type RealtimeHint, type RealtimeStatus } from "@/lib/realtime";
import { useMe } from "@/hooks/use-auth";
import { useUiStore } from "@/store/ui";

const DEBOUNCE_MS = 750;

/** Backend module (audit `module` / notification-type prefix) → query-key prefixes. */
export const MODULE_QUERY_KEYS: Record<string, QueryKey[]> = {
  visitors: [
    ["visitors"],
    ["resident", "visitors"],
    ["resident", "overview"],
    ["dashboards"],
    ["auditor", "visitor-records"],
    ["auditor", "overview"],
  ],
  gate: [
    ["gate"],
    ["resident", "alerts"],
    ["dashboards"],
    ["auditor", "gate-activity"],
    ["auditor", "overview"],
  ],
  vehicles: [["vehicles"], ["resident", "vehicles"], ["dashboards"]],
  deliveries: [
    ["deliveries"],
    ["resident", "deliveries"],
    ["resident", "overview"],
    ["dashboards"],
  ],
  domestic_staff: [
    ["staff"],
    ["staff-attendance"],
    ["staff-assignments"],
    ["resident", "domestic-staff"],
    ["community", "staff-directory"],
    ["dashboards"],
  ],
  billing: [
    ["billing"],
    ["resident", "invoices"],
    ["resident", "ledger"],
    ["resident", "overview"],
    ["dashboards"],
    ["governance"],
    ["auditor", "financial"],
    ["auditor", "overview"],
  ],
  complaints: [
    ["complaints"],
    ["resident", "complaints"],
    ["resident", "overview"],
    ["dashboards"],
    ["auditor", "complaints"],
    ["auditor", "vendors"],
  ],
  amenities: [
    ["amenities"],
    ["resident", "my-bookings"],
    ["resident", "amenity-slots"],
    ["resident", "amenities-list"],
    ["resident", "overview"],
    ["dashboards"],
  ],
  communication: [["announcements"], ["polls"], ["resident-groups"], ["group-members"]],
  incidents: [["incidents"], ["dashboards"], ["governance"], ["auditor", "incidents"]],
  notifications: [["notifications"]],
  residents: [
    ["residents"],
    ["resident", "family-members"],
    ["resident", "me-profile"],
    ["family-members"],
    ["occupancies"],
    ["move-records"],
    ["emergency-contacts"],
    ["dashboards"],
  ],
  communities: [["communities"], ["towers"], ["floors"], ["units"], ["community-units"], ["gates"]],
  users: [["users"], ["operational-staff"]],
  rbac: [["rbac"], ["roles"], ["permissions"]],
  onboarding: [["community-invitations"]],
};
/** Every audited change adds an audit row: audit screens refresh (only if on screen). */
const ALWAYS_KEYS: QueryKey[] = [["audit"], ["auditor", "logs"]];

function subscribeStatus(cb: () => void) {
  return realtime.onStatus(cb);
}

/** Live connection state (for UI + polling fallback decisions). */
export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(
    subscribeStatus,
    () => realtime.getStatus(),
    () => "idle",
  );
}

/**
 * `refetchInterval` for live data: `false` while the socket is open (hints drive refreshes),
 * the fallback interval otherwise. `whileOpenMs` keeps a slow safety net for safety-critical
 * data (SOS) even with a healthy socket. Use instead of a fixed number everywhere.
 */
export function useLivePollInterval(
  fallbackMs: number,
  whileOpenMs: number | false = false,
): number | false {
  return useRealtimeStatus() === "open" ? whileOpenMs : fallbackMs;
}

/**
 * For screens that load with `useState` + effects rather than TanStack Query: call `reload`
 * when a hint for one of `modules` arrives (debounced), and poll every `fallbackMs` only while
 * the socket is down. Replaces hand-rolled `setInterval` loops.
 */
export function useRealtimeRefresh(
  modules: string[],
  reload: () => void,
  fallbackMs = 30_000,
  enabled = true,
): void {
  const status = useRealtimeStatus();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const key = modules.join(",");

  useEffect(() => {
    if (!enabled) return;
    const wanted = new Set(key.split(","));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = realtime.onHint((hint) => {
      // A user-channel hint is always a new notification for this user.
      const hinted =
        hint.scope === "user" && wanted.has("notifications") ? "notifications" : hint.module;
      if (hint.type === "resync" || (hinted && wanted.has(hinted))) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => reloadRef.current(), DEBOUNCE_MS);
      }
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || status === "open") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") reloadRef.current();
    }, fallbackMs);
    return () => clearInterval(id);
  }, [status, fallbackMs, enabled]);
}

/**
 * Mounted once (in `Providers`): runs the socket while signed in, follows the active
 * community, and turns hints into debounced, active-only invalidations.
 */
export function useRealtimeBridge(): void {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const activeCommunityId = useUiStore((s) => s.activeCommunityId);
  const userId = me?.id ?? null;

  useEffect(() => {
    if (!userId) {
      realtime.stop();
      return;
    }
    realtime.start();
    return () => realtime.stop(); // identity change / sign-out: new ticket for the new user
  }, [userId]);

  useEffect(() => {
    const cid = activeCommunityId || me?.community_ids?.[0] || null;
    realtime.subscribe(cid);
  }, [activeCommunityId, me?.community_ids]);

  // Hints sent while the socket was down were missed: after a *re*connect, refresh what is
  // on screen once (the very first open needs nothing — data was just loaded).
  useEffect(() => {
    let wasDown = false;
    return realtime.onStatus((status) => {
      if (status === "closed") wasDown = true;
      if (status === "open" && wasDown) {
        wasDown = false;
        void queryClient.invalidateQueries({ refetchType: "active" });
      }
    });
  }, [queryClient]);

  useEffect(() => {
    const pending = new Map<string, QueryKey>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let resync = false;

    const flush = () => {
      timer = null;
      // Someone else's change must not clobber a local mutation in flight: mark stale only;
      // the mutation's own onSuccess/onSettled invalidation refetches afterwards.
      const refetchType = queryClient.isMutating() > 0 ? "none" : "active";
      if (resync) {
        resync = false;
        pending.clear();
        void queryClient.invalidateQueries({ refetchType });
        return;
      }
      pending.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey, refetchType }));
      pending.clear();
    };

    const off = realtime.onHint((hint: RealtimeHint) => {
      if (hint.type === "resync") {
        resync = true;
      } else {
        const keys = MODULE_QUERY_KEYS[hint.module ?? ""];
        if (!keys) return; // unknown module: ignore (forward compatible)
        for (const k of [...keys, ...ALWAYS_KEYS]) pending.set(JSON.stringify(k), k);
        if (hint.scope === "user") pending.set('["notifications"]', ["notifications"]);
      }
      if (!timer) timer = setTimeout(flush, DEBOUNCE_MS);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [queryClient]);
}
