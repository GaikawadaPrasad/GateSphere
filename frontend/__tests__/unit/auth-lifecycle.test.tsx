/**
 * Auth lifecycle — the three places that produced unexpected 401s in the browser console:
 *  1. /login (or any public page) asked `/auth/me` with no session cookie at all.
 *  2. Sign-out cleared the query cache while the dashboard was mounted, so the header's
 *     queries (community details, notifications, unread count) refetched against the
 *     just-revoked session.
 *  3. The global 401 handler did the same clear, and redirected once per failing query.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/navigation", () => ({ hardNavigate: vi.fn() }));

import { useLogout, useMe } from "@/hooks/use-auth";
import { ApiError, hasSessionCookie } from "@/lib/api";
import { hardNavigate } from "@/lib/navigation";
import { redirectToLoginOnUnauthorized } from "@/lib/query";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setCookie(cookie: string) {
  document.cookie = cookie;
}

function clearCookies() {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

function wrapperFor(client: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientTestWrapper";
  return Wrapper;
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(hardNavigate).mockReset();
  clearCookies();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearCookies();
});

describe("hasSessionCookie", () => {
  it("is false with no GateSphere CSRF cookie", () => {
    setCookie("unrelated=1");
    expect(hasSessionCookie()).toBe(false);
  });

  it("recognises role-bucketed and legacy CSRF cookies", () => {
    setCookie("gatesphere_facility_manager_csrf=abc");
    expect(hasSessionCookie()).toBe(true);
    clearCookies();
    setCookie("gs_csrf=abc");
    expect(hasSessionCookie()).toBe(true);
  });
});

describe("useMe", () => {
  it("resolves to null without calling /auth/me when no session cookie exists", async () => {
    const { result } = renderHook(() => useMe(), { wrapper: wrapperFor(newClient()) });
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(result.current.data).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the backend when a session cookie exists, and maps its 401 to null", async () => {
    setCookie("gatesphere_facility_manager_csrf=abc");
    fetchMock.mockResolvedValue(
      jsonResponse(401, { success: false, message: "Not authenticated", data: null }),
    );
    const { result } = renderHook(() => useMe(), { wrapper: wrapperFor(newClient()) });
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(result.current.data).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/auth/me");
  });
});

describe("useLogout", () => {
  it("does not refetch mounted dashboard queries and hard-navigates to /login", async () => {
    setCookie("gatesphere_facility_manager_csrf=abc");
    const client = newClient();
    const headerQuery = vi.fn().mockResolvedValue(["notification"]);
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: "OK", data: null }));

    // A mounted header query (stands in for notifications / community details) + logout.
    const { result } = renderHook(
      () => ({
        header: useQuery({ queryKey: ["notifications"], queryFn: headerQuery }),
        logout: useLogout(),
      }),
      { wrapper: wrapperFor(client) },
    );
    await waitFor(() => expect(result.current.header.isSuccess).toBe(true));
    expect(headerQuery).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.logout.mutateAsync();
    });

    expect(hardNavigate).toHaveBeenCalledTimes(1);
    expect(hardNavigate).toHaveBeenCalledWith("/login");
    // The only network call is the logout itself — no refetch burst after the revoke.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/auth/logout");
    expect(headerQuery).toHaveBeenCalledTimes(1);
  });

  it("still leaves for /login when the logout request itself fails", async () => {
    setCookie("gatesphere_facility_manager_csrf=abc");
    fetchMock.mockRejectedValue(new TypeError("network down"));
    const { result } = renderHook(() => useLogout(), { wrapper: wrapperFor(newClient()) });
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });
    expect(hardNavigate).toHaveBeenCalledWith("/login");
  });
});

describe("redirectToLoginOnUnauthorized", () => {
  it("redirects once, with `next`, however many queries 401 together", async () => {
    window.history.replaceState(null, "", "/facility-manager/dashboard?tab=1");
    const client = newClient();
    const unsubscribe = redirectToLoginOnUnauthorized(client);
    const unauthorized = () => Promise.reject(new ApiError(401, "Not authenticated"));

    await Promise.all([
      client.fetchQuery({ queryKey: ["notifications"], queryFn: unauthorized }).catch(() => null),
      client.fetchQuery({ queryKey: ["communities", "x"], queryFn: unauthorized }).catch(() => null),
      client.fetchQuery({ queryKey: ["unread"], queryFn: unauthorized }).catch(() => null),
    ]);

    expect(hardNavigate).toHaveBeenCalledTimes(1);
    expect(hardNavigate).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent("/facility-manager/dashboard?tab=1")}`,
    );
    unsubscribe();
  });

  it("ignores non-401 errors and does nothing while already on /login", async () => {
    const client = newClient();
    const unsubscribe = redirectToLoginOnUnauthorized(client);

    window.history.replaceState(null, "", "/facility-manager/dashboard");
    await client
      .fetchQuery({ queryKey: ["a"], queryFn: () => Promise.reject(new ApiError(500, "boom")) })
      .catch(() => null);

    window.history.replaceState(null, "", "/login");
    await client
      .fetchQuery({ queryKey: ["b"], queryFn: () => Promise.reject(new ApiError(401, "no")) })
      .catch(() => null);

    expect(hardNavigate).not.toHaveBeenCalled();
    unsubscribe();
  });
});
