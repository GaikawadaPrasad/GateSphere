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
      // Identity changed — drop every cached query before seeding the new user.
      clearQueryCache(qc);
      qc.setQueryData(authKeys.me, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearQueryCache(qc);
      qc.setQueryData(authKeys.me, null);
    },
  });
}
