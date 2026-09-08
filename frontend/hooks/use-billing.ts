"use client";

import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/lib/api";
import type { ListQueryParams } from "@/types/api";

export const billingKeys = {
  all: ["billing"] as const,
  invoices: (params?: ListQueryParams) => [...billingKeys.all, "invoices", params] as const,
  payments: (params?: ListQueryParams) => [...billingKeys.all, "payments", params] as const,
  chargeHeads: (communityId?: string) => [...billingKeys.all, "charge-heads", communityId] as const,
  rules: (communityId?: string) => [...billingKeys.all, "rules", communityId] as const,
  unitLedger: (unitId: string, params?: ListQueryParams) => [...billingKeys.all, "ledger", unitId, params] as const,
};

export function useInvoices(params?: ListQueryParams) {
  return useQuery({
    queryKey: billingKeys.invoices(params),
    queryFn: () => billingApi.invoices(params),
    staleTime: 30_000,
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
