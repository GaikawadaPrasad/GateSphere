"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { useMe } from "@/hooks/use-auth";
import { useLivePollInterval } from "@/hooks/use-realtime";
import type { NotificationPreference } from "@/types/notifications";

export function useMyNotifications(
  params?: {
    unread_only?: boolean;
    page?: number;
    page_size?: number;
  },
  opts?: { enabled?: boolean },
) {
  const { data: user } = useMe();
  // New notifications arrive as realtime hints on the user's channel; poll only as fallback.
  const livePoll = useLivePollInterval(30_000);
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: () => notificationsApi.list(params),
    enabled: !!user && (opts?.enabled ?? true),
    staleTime: 10_000,
    refetchInterval: user ? livePoll : false,
    refetchIntervalInBackground: false,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 1;
    },
  });
}

/**
 * Unread badge count. Lives under the `["notifications"]` prefix so every mark-read /
 * mark-all-read invalidation refreshes it together with the Notification Center list.
 * Only fires when the user is authenticated — callers do not need to add their own guard.
 */
export function useUnreadNotificationCount() {
  const { data: user } = useMe();
  const livePoll = useLivePollInterval(30_000);
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationsApi.unreadCount(),
    enabled: !!user,
    staleTime: 10_000,
    refetchInterval: user ? livePoll : false,
    refetchIntervalInBackground: false,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 1;
    },
  });
}

export function useDispatchNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      community_id?: string;
      recipient_user_id?: string;
      title: string;
      body: string;
      category?: string;
      action_url?: string;
    }) => notificationsApi.dispatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useNotificationPreferences() {
  const { data: user } = useMe();
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationsApi.preferences(),
    enabled: !!user,
    staleTime: 60_000,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 1;
    },
  });
}

export function useSetNotificationPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<NotificationPreference>) =>
      notificationsApi.setPreference(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}
