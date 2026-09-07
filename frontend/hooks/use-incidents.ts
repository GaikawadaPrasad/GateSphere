"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { incidentsApi } from "@/lib/api";
import type { IncidentCreate, IncidentTransition } from "@/types/incidents";

export function useIncidents(params?: {
  community_id?: string;
  incident_status?: string;
  severity?: string;
  q?: string;
  page?: number;
  page_size?: number;
}) {
  return useQuery({
    queryKey: ["incidents", params],
    queryFn: () => incidentsApi.list(params),
    staleTime: 15_000,
  });
}

export function useIncidentDetails(id?: string) {
  return useQuery({
    queryKey: ["incidents", id],
    queryFn: () => (id ? incidentsApi.get(id) : null),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useIncidentHistory(id?: string) {
  return useQuery({
    queryKey: ["incidents", id, "history"],
    queryFn: () => (id ? incidentsApi.history(id) : []),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useIncidentActions(id?: string) {
  return useQuery({
    queryKey: ["incidents", id, "actions"],
    queryFn: () => (id ? incidentsApi.actions(id) : []),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IncidentCreate) => incidentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useTransitionIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: IncidentTransition }) =>
      incidentsApi.transition(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["incidents", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["incidents", variables.id, "history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useAddIncidentAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { action_type: string; details?: string } }) =>
      incidentsApi.addAction(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["incidents", variables.id, "actions"] });
    },
  });
}
