export type InvoiceStatus =
  | "draft"
  | "posted"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export interface InvoiceItem {
  id: string;
  charge_head_id: string;
  charge_head_name?: string;
  description: string;
  amount: string;
}

export interface MaintenanceInvoice {
  id: string;
  community_id: string;
  community_name?: string;
  unit_id: string;
  unit_number?: string;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal: string;
  tax: string;
  total_amount: string;
  amount_paid: string;
  balance_due: string;
  due_date: string;
  created_at: string;
  items?: InvoiceItem[];
}

export interface Payment {
  id: string;
  community_id: string;
  payer_user_id: string;
  payer_name?: string;
  amount: string;
  payment_method: string;
  payment_reference: string;
  receipt_number?: string | null;
  payment_status: "success" | "pending" | "failed" | "refunded";
  status: string;
  paid_at: string;
  refunded_at?: string | null;
}

export interface ChargeHead {
  id: string;
  community_id: string;
  name: string;
  code: string;
  description?: string | null;
  charge_type: "fixed" | "per_sqft" | "utility" | "ad_hoc";
  default_amount: string;
  is_active: boolean;
}

export interface BillingRule {
  id: string;
  community_id: string;
  billing_frequency: "monthly" | "quarterly" | "annual";
  due_days: number;
  grace_period_days: number;
  late_fee_type: "fixed" | "percentage";
  late_fee_amount: string;
}

export interface UnitLedgerEntry {
  id: string;
  created_at: string;
  unit_id: string;
  entry_type: "debit" | "credit";
  amount: string;
  balance_after: string;
  reference_type: "invoice" | "payment" | "adjustment" | "refund";
  reference_id: string;
  description: string;
}
