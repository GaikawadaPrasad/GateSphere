/**
 * GateSphere Frontend — TanStack Query Configuration
 */

import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

let _activeQueryClient: QueryClient | null = null;

export function getActiveQueryClient(): QueryClient | null {
  return _activeQueryClient;
}

export function setActiveQueryClient(client: QueryClient | null): void {
  _activeQueryClient = client;
}

export function makeQueryClient(): QueryClient {
  const client = new QueryClient({
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
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      },
    },
  });
  _activeQueryClient = client;
  return client;
}

export function clearQueryCache(queryClient?: QueryClient): void {
  const target = queryClient || _activeQueryClient;
  if (target) {
    target.clear();
  }
}
