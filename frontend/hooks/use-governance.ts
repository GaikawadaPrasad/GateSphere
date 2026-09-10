"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardsApi, billingApi, incidentsApi, assessmentsApi, ApiError } from "@/lib/api";
import type {
  SpecialAssessment,
  SpecialAssessmentCreate,
  GovernanceOverviewData,
  CollectionAuditSummary,
} from "@/types/governance";
import type { MaintenanceInvoice, Payment } from "@/types/billing";
import type { Incident } from "@/types/incidents";

export const governanceKeys = {
  all: ["governance"] as const,
  overview: (communityId?: string) => [...governanceKeys.all, "overview", communityId] as const,
  assessments: (communityId?: string, status?: string) =>
    [...governanceKeys.all, "assessments", communityId, status] as const,
  assessmentDetail: (id: string) => [...governanceKeys.all, "assessment", id] as const,
  collectionAudit: (communityId?: string) =>
    [...governanceKeys.all, "collection-audit", communityId] as const,
  incidentsReview: (communityId?: string, status?: string, severity?: string) =>
    [...governanceKeys.all, "incidents", communityId, status, severity] as const,
};

/**
 * Fetch high-level governance overview data for Association Committee landing page.
 */
export function useGovernanceOverview(communityId?: string | null) {
  return useQuery<GovernanceOverviewData>({
    queryKey: governanceKeys.overview(communityId || undefined),
    queryFn: async () => {
      if (!communityId) {
        return {
          pendingAssessmentsCount: 0,
          openIncidentsCount: 0,
          totalBilled: "0.00",
          totalCollected: "0.00",
          outstandingBalance: "0.00",
          recentIncidents: [],
          activeAssessments: [],
          recentPayments: [],
        };
      }

      // Fetch financial dashboard, recent incidents, recent payments and invoices in parallel
      const [financialStats, incidentsRes, paymentsRes, invoicesRes, assessmentsRes] =
        await Promise.allSettled([
          dashboardsApi.financial(communityId),
          incidentsApi.list({ community_id: communityId, page_size: 5 }),
          billingApi.payments({ community_id: communityId, page_size: 5 }),
          billingApi.invoices({ community_id: communityId, page_size: 10 }),
          assessmentsApi.list({ community_id: communityId }).catch(() => [] as SpecialAssessment[]),
        ]);

      const finData = financialStats.status === "fulfilled" ? financialStats.value : undefined;
      const incidentsList: Incident[] =
        incidentsRes.status === "fulfilled" ? incidentsRes.value || [] : [];
      const paymentsList: Payment[] =
        paymentsRes.status === "fulfilled" ? paymentsRes.value || [] : [];
      const invoicesList: MaintenanceInvoice[] =
        invoicesRes.status === "fulfilled" ? invoicesRes.value || [] : [];
      const assessmentsList: SpecialAssessment[] =
        assessmentsRes.status === "fulfilled" ? assessmentsRes.value || [] : [];

      const totalBilled = finData?.total_billed ? String(finData.total_billed) : "0.00";
      const totalCollected = finData?.total_collected ? String(finData.total_collected) : "0.00";
      const outstandingBalance = finData?.outstanding_balance
        ? String(finData.outstanding_balance)
        : "0.00";

      const openIncidents = incidentsList.filter(
        (i) => i.status !== "resolved" && i.status !== "closed" && i.status !== "false_alarm",
      );
      const pendingAssessments = assessmentsList.filter(
        (a) => a.status === "under_review" || a.status === "draft",
      );

      return {
        financialStats: finData,
        pendingAssessmentsCount: pendingAssessments.length,
        openIncidentsCount: openIncidents.length,
        totalBilled,
        totalCollected,
        outstandingBalance,
        recentIncidents: incidentsList.slice(0, 5),
        activeAssessments: assessmentsList,
        recentPayments: paymentsList.slice(0, 5),
      };
    },
    enabled: Boolean(communityId),
    staleTime: 30_000,
  });
}

/**
 * Hook to list Special Assessments. The backend has no dedicated assessments module
 * (no /billing/assessments route or table) — this surfaces as a real empty state rather
 * than fabricating placeholder records.
 */
export function useSpecialAssessments(params?: {
  community_id?: string | null;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  const cid = params?.community_id || undefined;
  return useQuery<SpecialAssessment[]>({
    queryKey: governanceKeys.assessments(cid, params?.status),
    queryFn: async () => {
      if (!cid) return [];
      try {
        const res = await assessmentsApi.list({
          community_id: cid,
          status: params?.status,
          page: params?.page,
          page_size: params?.page_size,
        });
        return Array.isArray(res) ? res : [];
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) return [];
        throw err;
      }
    },
    enabled: Boolean(cid),
    staleTime: 30_000,
  });
}

/**
 * Hook to get a single special assessment by ID. Returns null (not found) on 404 —
 * see useSpecialAssessments for why the endpoint doesn't exist yet.
 */
export function useSpecialAssessment(assessmentId: string, communityId?: string | null) {
  return useQuery<SpecialAssessment | null>({
    queryKey: governanceKeys.assessmentDetail(assessmentId),
    queryFn: async () => {
      try {
        return await assessmentsApi.get(assessmentId);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: Boolean(assessmentId),
  });
}

/**
 * Mutation to create/propose a special assessment.
 */
export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ payload, communityId }: { payload: any; communityId?: string }) => {
      return await assessmentsApi.create(payload, communityId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: governanceKeys.all });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

/**
 * Mutation to approve a special assessment.
 */
export function useApproveAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await assessmentsApi.approve(id, notes);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: governanceKeys.all });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

/**
 * Mutation to reject a special assessment.
 */
export function useRejectAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return await assessmentsApi.reject(id, reason);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: governanceKeys.all });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

/**
 * Hook for Collection Audit statistics and records.
 */
export function useCollectionAudit(communityId?: string | null) {
  return useQuery<CollectionAuditSummary>({
    queryKey: governanceKeys.collectionAudit(communityId || undefined),
    queryFn: async () => {
      if (!communityId) {
        return {
          total_collections: "0.00",
          collection_count: 0,
          payment_methods_breakdown: {},
          outstanding_invoices_count: 0,
          total_outstanding_amount: "0.00",
          recent_payments: [],
          overdue_invoices: [],
        };
      }

      const [payments, invoices] = await Promise.all([
        billingApi.payments({ community_id: communityId, page_size: 100 }),
        billingApi.invoices({ community_id: communityId, page_size: 100 }),
      ]);

      const successPayments = (payments || []).filter((p) => p.payment_status === "success");
      const totalCollectedNum = successPayments.reduce(
        (acc, p) => acc + parseFloat(p.amount || "0"),
        0,
      );

      const methodBreakdown: Record<string, { count: number; total_amount: string }> = {};
      for (const p of successPayments) {
        const method = (p.payment_method || "other").toUpperCase();
        if (!methodBreakdown[method]) {
          methodBreakdown[method] = { count: 0, total_amount: "0.00" };
        }
        methodBreakdown[method].count += 1;
        const currentSum = parseFloat(methodBreakdown[method].total_amount);
        methodBreakdown[method].total_amount = (currentSum + parseFloat(p.amount || "0")).toFixed(
          2,
        );
      }

      const overdueInvoices = (invoices || []).filter(
        (i) =>
          i.status === "overdue" || (i.status === "posted" && parseFloat(i.balance_due || "0") > 0),
      );
      const totalOutstandingNum = overdueInvoices.reduce(
        (acc, i) => acc + parseFloat(i.balance_due || "0"),
        0,
      );

      return {
        total_collections: totalCollectedNum.toFixed(2),
        collection_count: successPayments.length,
        payment_methods_breakdown: methodBreakdown,
        outstanding_invoices_count: overdueInvoices.length,
        total_outstanding_amount: totalOutstandingNum.toFixed(2),
        recent_payments: successPayments.slice(0, 20),
        overdue_invoices: overdueInvoices.slice(0, 20),
      };
    },
    enabled: Boolean(communityId),
    staleTime: 30_000,
  });
}
