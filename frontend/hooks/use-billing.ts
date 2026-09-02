"use client";

import { useQuery } from "@tanstack/react-query";
import { billingApi } from "@/lib/api";
import type { ListQueryParams } from "@/types/api";

export const billingKeys = {
  all: ["billing"] as const,
  invoices: (params?: ListQueryParams) => [...billingKeys.all, "invoices", params] as const,
  payments: (params?: ListQueryParams) => [...billingKeys.all, "payments", params] as const,
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
