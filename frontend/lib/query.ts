/**
 * GateSphere Frontend — TanStack Query Configuration
 */

import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { hardNavigate } from "./navigation";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.isUnauthenticated || error.isForbidden || error.isNotFound) {
              return false;
            }
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        refetchOnReconnect: true,
        staleTime: 30_000,
        gcTime: 5 * 60_000,
      },
    },
  });
}

/**
 * Global 401 handler: the first query that 401s (session expired, or revoked in another tab)
 * sends the browser to /login once, keeping the current page as `next`. It does not clear
 * the cache first — clearing while the dashboard is still mounted makes every mounted query
 * rebuild and refetch, turning one expected 401 into a burst; the page load discards the
 * cache instead. Returns the unsubscribe function.
 */
export function redirectToLoginOnUnauthorized(client: QueryClient): () => void {
  let redirecting = false;
  return client.getQueryCache().subscribe((event) => {
    if (redirecting || event.type !== "updated") return;
    const error = event.query.state.error;
    if (!(error instanceof ApiError) || !error.isUnauthenticated) return;
    if (window.location.pathname.startsWith("/login")) return;
    redirecting = true;
    void client.cancelQueries();
    hardNavigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  });
}
