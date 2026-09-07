"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi, type CurrentUser } from "@/lib/api";
import { clearQueryCache } from "@/lib/query";

export const authKeys = {
  me: ["auth", "me"] as const,
};

/** Current user. `null` when unauthenticated (a 401 is an expected result, not an error state). */
export function useMe() {
  return useQuery<CurrentUser | null>({
    queryKey: authKeys.me,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (user) => {
      if (typeof window !== "undefined" && user?.active_role) {
        localStorage.setItem("gatesphere_active_role", user.active_role);
      }
      // Seed the auth cache FIRST so navigating components see the user immediately.
      // Then clear all other stale data from any previous session so cross-tenant
      // data can never leak (AGENTS.md §5.3).
      qc.setQueryData(authKeys.me, user);
      // Remove all queries except the auth/me key we just set
      qc.removeQueries({
        predicate: (query) =>
          JSON.stringify(query.queryKey) !== JSON.stringify(authKeys.me),
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
        localStorage.removeItem("gatesphere_active_role");
      }
      clearQueryCache(qc);
      qc.setQueryData(authKeys.me, null);
    },
  });
}
