export type InvoiceStatus = "draft" | "posted" | "partially_paid" | "paid" | "overdue" | "cancelled";

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
  status: "success" | "pending" | "failed";
  paid_at: string;
}
