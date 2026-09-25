import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const get = vi.hoisted(() => vi.fn().mockResolvedValue([]));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: { get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/realtime", () => ({
  realtime: { getStatus: () => "open", onHint: () => () => {}, onStatus: () => () => {} },
}));

import { useResidentVehicles, useResidentVisitors } from "@/hooks/use-owner-tenant-data";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("tab-gated resident queries", () => {
  it("a query for a tab that is not shown makes no request at all", async () => {
    renderHook(
      () => {
        useResidentVisitors({ enabled: false });
        useResidentVehicles({ enabled: false });
      },
      { wrapper },
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(get).not.toHaveBeenCalled();
  });

  it("the tab that is shown loads its data", async () => {
    renderHook(() => useResidentVehicles({ enabled: true }), { wrapper });
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls.some((c) => String(c[0]).startsWith("/vehicles"))).toBe(true);
  });
});
