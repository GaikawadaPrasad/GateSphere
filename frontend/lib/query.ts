/**
 * GateSphere Frontend — TanStack Query Configuration
 */

import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

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
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
    },
  });
}

export function clearQueryCache(queryClient: QueryClient): void {
  queryClient.clear();
}
