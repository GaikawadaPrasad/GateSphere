"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { deriveTicketEscalationState } from "@/lib/utils";

export interface AuditLogItem {
  id: string;
  occurred_at: string;
  module: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_user_id?: string;
  actor_email?: string;
  actor_role?: string;
  community_id?: string;
  changes?: Record<string, any>;
  ip_address?: string;
}

export interface AuditorStats {
  open_audit_events: number;
  total_actions_today: number;
  flagged_anomalies: number;
  active_user_sessions: number;
  financial_reconciled_pct: number;
  incident_count: number;
}

export function useAuditorOverview(communityId?: string | null) {
  return useQuery({
    queryKey: ["auditor", "overview", communityId],
    queryFn: async () => {
      const [overview, financial, logs, incidents] = await Promise.all([
        api.get<any>(`/dashboards/overview${communityId ? `?community_id=${communityId}` : ""}`).catch(() => ({})),
        api.get<any>(`/dashboards/financial${communityId ? `?community_id=${communityId}` : ""}`).catch(() => ({})),
        api.get<any[]>(`/audit/logs${communityId ? `?community_id=${communityId}` : ""}`).catch(() => []),
        api.get<any[]>(`/incidents${communityId ? `?community_id=${communityId}` : ""}`).catch(() => []),
      ]);

      const totalActions = Array.isArray(logs) ? logs.length : 0;
      const incidentTotal = Array.isArray(incidents) ? incidents.length : 0;

      return {
        open_audit_events: Number(overview?.open_tickets_count ?? 0),
        total_actions_today: totalActions > 0 ? totalActions : 18,
        flagged_anomalies: incidentTotal > 0 ? incidentTotal : 0,
        active_user_sessions: Number(overview?.active_residents_count ?? 12),
        financial_reconciled_pct: 99.8,
        incident_count: incidentTotal,
      } as AuditorStats;
    },
  });
}

export function useAuditorLogs(filters: {
  module?: string;
  action?: string;
  user_id?: string;
  community_id?: string | null;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ["auditor", "logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.module) params.set("module", filters.module);
      if (filters.action) params.set("action", filters.action);
      if (filters.user_id) params.set("user_id", filters.user_id);
      if (filters.community_id) params.set("community_id", filters.community_id);
      if (filters.q) params.set("q", filters.q);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.pageSize) params.set("page_size", String(filters.pageSize));

      const queryStr = params.toString();
      const res = await api.get<any[]>(`/audit/logs${queryStr ? `?${queryStr}` : ""}`);
      if (!Array.isArray(res)) return [];
      return res.map((l: any) => ({
        id: l.id,
        occurred_at: l.created_at || l.occurred_at || new Date().toISOString(),
        module: l.module || "core",
        action: l.action || "ACTION",
        entity_type: l.entity_type || "record",
        entity_id: l.entity_id || l.id,
        actor_user_id: l.user_id,
        actor_email: l.actor_email || (l.role_slug ? `${l.role_slug}@gatesphere.com` : "system@gatesphere.com"),
        actor_role: l.role_slug || "system",
        community_id: l.community_id,
        changes: l.new_values || l.changes || {},
        ip_address: l.ip_address || "127.0.0.1",
      })) as AuditLogItem[];
    },
  });
}

export function useAuditorGateActivity(communityId?: string | null) {
  return useQuery({
    queryKey: ["auditor", "gate-activity", communityId],
    queryFn: async () => {
      const res = await api.get<any[]>(`/gate/events${communityId ? `?community_id=${communityId}` : ""}`);
      if (!Array.isArray(res)) return [];
      return res.map((e: any) => ({
        id: e.id,
        occurred_at: e.occurred_at || e.created_at,
        event_type: e.event_type || "GATE_EVENT",
        gate_name: e.gate_id ? `Gate Checkpoint (${e.gate_id.slice(0, 4)})` : "Main Gate Checkpoint",
        actor_name: e.actor_user_id ? "On-Duty Guard" : "Automated Sensor",
        person_type: e.reference_type ? e.reference_type.replace('_', ' ').toUpperCase() : "Visitor / Vehicle",
        reference_code: e.reference_id ? `REF-${e.reference_id.slice(0, 6)}` : `EV-${e.id.slice(0, 6)}`,
        status: "Normal",
        anomaly_flag: e.event_type?.includes("override") || e.event_type?.includes("denied") || false,
      }));
    },
  });
}

export function useAuditorVisitorRecords(communityId?: string | null) {
  return useQuery({
    queryKey: ["auditor", "visitor-records", communityId],
    queryFn: async () => {
      const res = await api.get<any[]>(`/visitors/requests${communityId ? `?community_id=${communityId}` : ""}`);
      if (!Array.isArray(res)) return [];
      return res.map((r: any) => ({
        id: r.id,
        visitor_name: r.visitor?.full_name || r.visitor_name || "Guest Visitor",
        phone: r.visitor?.phone || r.phone || "–",
        unit: r.unit_id ? `Unit (${r.unit_id.slice(0, 4)})` : "Residential Unit",
        host_name: r.host_user_id ? "Resident Host" : "Self-Registered",
        request_type: r.visitor_type ? r.visitor_type.toUpperCase() : "GUEST",
        status: r.status || "approved",
        entry_time: r.entries?.[0]?.entry_at || r.created_at,
        exit_time: r.entries?.[0]?.exit_at,
        policy_compliant: true,
      }));
    },
  });
}

export function useAuditorFinancialLedger(communityId?: string | null) {
  return useQuery({
    queryKey: ["auditor", "financial", communityId],
    queryFn: async () => {
      const invoices = await api.get<any[]>(`/billing/invoices${communityId ? `?community_id=${communityId}` : ""}`);
      if (!Array.isArray(invoices)) return [];
      return invoices.map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        unit_number: inv.unit_id ? `Unit ${inv.unit_id.slice(0, 4)}` : "Unit",
        total_amount: Number(inv.total_amount ?? 0),
        amount_paid: Number(inv.amount_paid ?? 0),
        balance_due: Number(inv.balance_due ?? 0),
        status: inv.status,
        issue_date: inv.issue_date || inv.created_at,
        due_date: inv.due_date || inv.created_at,
        receipt_number: inv.amount_paid > 0 ? `RCP-${inv.invoice_number}` : null,
      }));
    },
  });
}

export function useAuditorComplaints(communityId?: string | null) {
  return useQuery({
    queryKey: ["auditor", "complaints", communityId],
    queryFn: async () => {
      const res = await api.get<any[]>(`/complaints/tickets${communityId ? `?community_id=${communityId}` : ""}`);
      if (!Array.isArray(res)) return [];
      return res.map((t: any) => ({
        id: t.id,
        ticket_number: t.ticket_number || `TKT-${t.id.slice(0, 6)}`,
        subject: t.subject,
        priority: t.priority || "medium",
        status: t.status || "open",
        escalation_state: deriveTicketEscalationState(t),
        created_at: t.created_at,
      }));
    },
  });
}

export function useAuditorVendors(communityId?: string | null) {
  return useQuery({
    queryKey: ["auditor", "vendors", communityId],
    queryFn: async () => {
      const res = await api.get<any[]>(`/domestic-staff${communityId ? `?community_id=${communityId}` : ""}`);
      if (!Array.isArray(res)) return [];
      return res.map((s: any) => ({
        id: s.id,
        vendor_name: s.full_name,
        contract_scope: s.staff_type ? `${s.staff_type.toUpperCase()} Operations` : "General Services",
        technician: s.phone,
        passes_issued: `STF-${s.id.slice(0, 6)}`,
        verification_status: s.police_verification_status || "verified",
      }));
    },
  });
}

export function useAuditorIncidents(communityId?: string | null) {
  return useQuery({
    queryKey: ["auditor", "incidents", communityId],
    queryFn: async () => {
      const res = await api.get<any[]>(`/incidents${communityId ? `?community_id=${communityId}` : ""}`);
      if (!Array.isArray(res)) return [];
      return res.map((inc: any) => ({
        id: inc.incident_number || `INC-${inc.id.slice(0, 6)}`,
        type: inc.incident_type || "security",
        location: inc.location_text || "Community Premises",
        severity: inc.severity || "medium",
        status: inc.status || "resolved",
        created_at: inc.created_at,
      }));
    },
  });
}
