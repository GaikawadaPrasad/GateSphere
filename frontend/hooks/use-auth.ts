"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, getActiveRole, setActiveRole, type CurrentUser } from "@/lib/api";
import { clearQueryCache } from "@/lib/query";

export const authKeys = {
  me: ["auth", "me"] as const,
};

/** Current user. `null` when unauthenticated (a 401 is an expected result, not an error state). */
export function useMe(options?: { enabled?: boolean }) {
  return useQuery<CurrentUser | null>({
    queryKey: authKeys.me,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (err: any) {
        if (err?.isUnauthenticated || err?.status === 401) {
          return null;
        }
        if (err?.code === "AMBIGUOUS_SESSION") {
          const activeRole = getActiveRole();
          if (activeRole) {
            try {
              return await authApi.me(activeRole);
            } catch (retryErr: any) {
              if (retryErr?.isUnauthenticated || retryErr?.status === 401) return null;
            }
          }
          return null;
        }
        // Re-throw genuine errors (e.g. 500) so UI exposes error state (FE-014)
        throw err;
      }
    },
    staleTime: 60_000,
    retry: (failureCount, error: any) => {
      if (error?.isUnauthenticated || error?.status === 401 || error?.status === 400) {
        return false;
      }
      return failureCount < 2;
    },
    enabled: options?.enabled,
  });
}


export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password, role }: { email: string; password: string; role?: string }) =>
      authApi.login(email, password, role),
    onSuccess: (user) => {
      const activeRole = user?.active_role || (user?.is_superadmin ? "super_admin" : null);
      if (typeof window !== "undefined" && activeRole) {
        setActiveRole(activeRole);
      }
      // Seed the auth cache FIRST so navigating components see the user immediately.
      // Then clear all other stale data from any previous session so cross-tenant
      // data can never leak (AGENTS.md §5.3).
      qc.setQueryData(authKeys.me, user);
      // Remove all queries except the auth/me key we just set
      qc.removeQueries({
        predicate: (query) => JSON.stringify(query.queryKey) !== JSON.stringify(authKeys.me),
      });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      if (typeof window !== "undefined") {
        setActiveRole(null);
      }
      clearQueryCache(qc);
      qc.setQueryData(authKeys.me, null);
    },
  });
}