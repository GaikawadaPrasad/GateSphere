import type { FinancialStats } from "@/types/dashboards";
import type { MaintenanceInvoice, Payment } from "@/types/billing";
import type { Incident } from "@/types/incidents";

export type AssessmentStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "rejected"
  | "active"
  | "completed";

export interface SpecialAssessment {
  id: string;
  community_id: string;
  title: string;
  purpose: string;
  description?: string;
  target_amount: string;
  amount_collected: string;
  per_unit_amount: string;
  effective_date: string;
  due_date?: string;
  affected_units_count: number;
  status: AssessmentStatus;
  created_at: string;
  updated_at: string;
  approved_by_user_id?: string;
  approved_at?: string;
  approval_notes?: string;
  rejection_reason?: string;
}

export interface SpecialAssessmentCreate {
  title: string;
  purpose: string;
  description?: string;
  target_amount: string;
  effective_date: string;
  due_date?: string;
}

export interface GovernanceOverviewData {
  financialStats?: FinancialStats;
  pendingAssessmentsCount: number;
  openIncidentsCount: number;
  totalBilled: string;
  totalCollected: string;
  outstandingBalance: string;
  recentIncidents: Incident[];
  activeAssessments: SpecialAssessment[];
  recentPayments: Payment[];
}

export interface CollectionAuditSummary {
  total_collections: string;
  collection_count: number;
  payment_methods_breakdown: Record<string, { count: number; total_amount: string }>;
  outstanding_invoices_count: number;
  total_outstanding_amount: string;
  recent_payments: Payment[];
  overdue_invoices: MaintenanceInvoice[];
}
