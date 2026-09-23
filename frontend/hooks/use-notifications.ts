"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import type { NotificationPreference } from "@/types/notifications";

export function useMyNotifications(params?: {
  unread_only?: boolean;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: () => notificationsApi.list(params),
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}

/**
 * Unread badge count. Lives under the `["notifications"]` prefix so every mark-read /
 * mark-all-read invalidation refreshes it together with the Notification Center list.
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationsApi.unreadCount(),
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 1,
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
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => notificationsApi.preferences(),
    staleTime: 60_000,
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
