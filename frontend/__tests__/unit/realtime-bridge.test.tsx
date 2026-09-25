import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// A controllable stand-in for the singleton socket client.
const fake = vi.hoisted(() => {
  const hint = new Set<(h: any) => void>();
  const status = new Set<(s: string) => void>();
  let current = "idle";
  return {
    hint,
    status,
    emit: (h: any) => hint.forEach((fn) => fn(h)),
    setStatus: (s: string) => {
      current = s;
      status.forEach((fn) => fn(s));
    },
    client: {
      getStatus: () => current,
      onHint: (fn: any) => (hint.add(fn), () => hint.delete(fn)),
      onStatus: (fn: any) => (status.add(fn), () => status.delete(fn)),
      start: vi.fn(),
      stop: vi.fn(),
      subscribe: vi.fn(),
    },
  };
});
vi.mock("@/lib/realtime", () => ({ realtime: fake.client }));
vi.mock("@/hooks/use-auth", () => ({
  useMe: () => ({ data: { id: "u1", community_ids: ["c1"] } }),
}));

import { useLivePollInterval, useRealtimeBridge, useRealtimeRefresh } from "@/hooks/use-realtime";

function setup() {
  const client = new QueryClient();
  const spy = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, spy, wrapper };
}

const keysOf = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.map((c: any[]) => JSON.stringify(c[0]?.queryKey));

describe("realtime bridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake.setStatus("idle");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("starts the socket for a signed-in user and follows their community", () => {
    const { wrapper } = setup();
    renderHook(() => useRealtimeBridge(), { wrapper });
    expect(fake.client.start).toHaveBeenCalled();
    expect(fake.client.subscribe).toHaveBeenCalledWith("c1");
  });

  it("coalesces a burst of hints into one active-only invalidation per mapped key", () => {
    const { spy, wrapper } = setup();
    renderHook(() => useRealtimeBridge(), { wrapper });
    act(() => {
      fake.emit({ type: "invalidate", scope: "community", module: "vehicles" });
      fake.emit({ type: "invalidate", scope: "community", module: "vehicles" });
    });
    expect(spy).not.toHaveBeenCalled(); // debounced
    act(() => void vi.advanceTimersByTime(800));
    const keys = keysOf(spy);
    expect(keys).toContain('["vehicles"]');
    expect(keys).toContain('["resident","vehicles"]');
    expect(keys.filter((k) => k === '["vehicles"]')).toHaveLength(1);
    expect(spy.mock.calls.every((c: any[]) => c[0].refetchType === "active")).toBe(true);
    expect(keys).not.toContain('["billing"]'); // unrelated modules untouched
  });

  it("ignores unknown modules and never blanket-invalidates for them", () => {
    const { spy, wrapper } = setup();
    renderHook(() => useRealtimeBridge(), { wrapper });
    act(() => {
      fake.emit({ type: "invalidate", scope: "community", module: "not_a_module" });
      vi.advanceTimersByTime(800);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("a user-channel hint also refreshes notifications", () => {
    const { spy, wrapper } = setup();
    renderHook(() => useRealtimeBridge(), { wrapper });
    act(() => {
      fake.emit({ type: "invalidate", scope: "user", module: "visitors" });
      vi.advanceTimersByTime(800);
    });
    expect(keysOf(spy)).toEqual(
      expect.arrayContaining(['["notifications"]', '["resident","visitors"]']),
    );
  });

  it("only marks stale (no refetch) while a local mutation is in flight", () => {
    const { client, spy, wrapper } = setup();
    vi.spyOn(client, "isMutating").mockReturnValue(1);
    renderHook(() => useRealtimeBridge(), { wrapper });
    act(() => {
      fake.emit({ type: "invalidate", scope: "community", module: "gate" });
      vi.advanceTimersByTime(800);
    });
    expect(spy.mock.calls.every((c: any[]) => c[0].refetchType === "none")).toBe(true);
  });

  it("refreshes what is on screen once after a reconnect (missed hints)", () => {
    const { spy, wrapper } = setup();
    renderHook(() => useRealtimeBridge(), { wrapper });
    act(() => fake.setStatus("open"));
    expect(spy).not.toHaveBeenCalled(); // first open: nothing missed
    act(() => {
      fake.setStatus("closed");
      fake.setStatus("open");
    });
    expect(spy).toHaveBeenCalledWith({ refetchType: "active" });
  });
});

describe("polling fallback", () => {
  afterEach(() => vi.useRealTimers());

  it("polls only while the socket is down", () => {
    fake.setStatus("closed");
    const { result } = renderHook(() => useLivePollInterval(5000, 60000));
    expect(result.current).toBe(5000);
    act(() => fake.setStatus("open"));
    expect(result.current).toBe(60000);
    const { result: plain } = renderHook(() => useLivePollInterval(5000));
    expect(plain.current).toBe(false);
  });

  it("useRealtimeRefresh reloads on a matching hint and does not poll while open", () => {
    vi.useFakeTimers();
    fake.setStatus("open");
    const reload = vi.fn();
    renderHook(() => useRealtimeRefresh(["deliveries"], reload, 5000));
    act(() => void vi.advanceTimersByTime(20_000));
    expect(reload).not.toHaveBeenCalled(); // no polling with a live socket
    act(() => {
      fake.emit({ type: "invalidate", scope: "community", module: "visitors" });
      fake.emit({ type: "invalidate", scope: "community", module: "deliveries" });
      vi.advanceTimersByTime(800);
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
