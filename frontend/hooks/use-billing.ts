"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "@/lib/api";
import type { ListQueryParams } from "@/types/api";
import type { MaintenanceInvoice } from "@/types/billing";

export const billingKeys = {
  all: ["billing"] as const,
  invoices: (params?: ListQueryParams) => [...billingKeys.all, "invoices", params] as const,
  payments: (params?: ListQueryParams) => [...billingKeys.all, "payments", params] as const,
  chargeHeads: (communityId?: string) => [...billingKeys.all, "charge-heads", communityId] as const,
  rules: (communityId?: string) => [...billingKeys.all, "rules", communityId] as const,
  unitLedger: (unitId: string, params?: ListQueryParams) =>
    [...billingKeys.all, "ledger", unitId, params] as const,
};

export function useInvoices(params?: ListQueryParams) {
  return useQuery({
    queryKey: billingKeys.invoices(params),
    queryFn: () => billingApi.invoices(params),
    staleTime: 30_000,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof billingApi.createInvoice>[0]) =>
      billingApi.createInvoice(data),
    onSuccess: (newInvoice) => {
      qc.setQueriesData<MaintenanceInvoice[]>(
        { queryKey: billingKeys.all },
        (old) => {
          if (!old || !Array.isArray(old)) return old;
          if (old.some((i) => i.id === newInvoice.id)) return old;
          return [newInvoice, ...old];
        },
      );
      qc.invalidateQueries({ queryKey: billingKeys.all });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function usePostInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => billingApi.postInvoice(invoiceId),
    onSuccess: (updated) => {
      qc.setQueriesData<MaintenanceInvoice[]>(
        { queryKey: billingKeys.all },
        (old) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((i) => (i.id === updated.id ? { ...i, ...updated } : i));
        },
      );
      qc.invalidateQueries({ queryKey: billingKeys.all });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function useCancelInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => billingApi.cancelInvoice(invoiceId),
    onSuccess: (updated) => {
      qc.setQueriesData<MaintenanceInvoice[]>(
        { queryKey: billingKeys.all },
        (old) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((i) => (i.id === updated.id ? { ...i, ...updated } : i));
        },
      );
      qc.invalidateQueries({ queryKey: billingKeys.all });
      qc.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });
}

export function usePayments(params?: ListQueryParams) {
  return useQuery({
    queryKey: billingKeys.payments(params),
    queryFn: () => billingApi.payments(params),
    staleTime: 30_000,
  });
}

export function useChargeHeads(communityId?: string) {
  return useQuery({
    queryKey: billingKeys.chargeHeads(communityId),
    queryFn: () => billingApi.chargeHeads(communityId),
    staleTime: 60_000,
  });
}

export function useBillingRules(communityId?: string) {
  return useQuery({
    queryKey: billingKeys.rules(communityId),
    queryFn: () => billingApi.rules(communityId),
    staleTime: 60_000,
  });
}

export function useUnitLedger(unitId?: string, params?: ListQueryParams) {
  return useQuery({
    queryKey: billingKeys.unitLedger(unitId || "", params),
    queryFn: () => (unitId ? billingApi.unitLedger(unitId, params) : []),
    enabled: Boolean(unitId),
    staleTime: 30_000,
  });
}
