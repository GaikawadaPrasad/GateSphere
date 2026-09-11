"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { communicationApi } from "@/lib/api";
import type { AnnouncementCreate } from "@/types/communication";

export function useAnnouncements(params?: {
  community_id?: string;
  published_only?: boolean;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["announcements", params],
    queryFn: () => communicationApi.announcements(params),
    staleTime: 30_000,
  });
}

export function useAnnouncementDetails(id?: string) {
  return useQuery({
    queryKey: ["announcements", id],
    queryFn: () => (id ? communicationApi.getAnnouncement(id) : null),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, communityId }: { payload: AnnouncementCreate; communityId?: string }) =>
      communicationApi.createAnnouncement(payload, communityId),
    onSuccess: (newAnnouncement) => {
      queryClient.setQueriesData({ queryKey: ["announcements"] }, (old: any) => {
        if (Array.isArray(old)) {
          return [newAnnouncement, ...old];
        }
        return old;
      });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function usePublishAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => communicationApi.publishAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useExpireAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => communicationApi.expireAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function usePollResults(pollId?: string) {
  return useQuery({
    queryKey: ["polls", pollId, "results"],
    queryFn: () => (pollId ? communicationApi.pollResults(pollId) : null),
    enabled: Boolean(pollId),
    staleTime: 15_000,
  });
}

export function useCreatePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      question: string;
      description?: string;
      options: string[];
      expires_at?: string;
    }) => communicationApi.createPoll(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
  });
}

export function useResidentGroups(communityId?: string) {
  return useQuery({
    queryKey: ["resident-groups", communityId],
    queryFn: () => communicationApi.groups(communityId),
    staleTime: 60_000,
  });
}

export function useCreateResidentGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      communityId,
    }: {
      payload: { name: string; description?: string };
      communityId?: string;
    }) => communicationApi.createGroup(payload, communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resident-groups"] });
    },
  });
}
