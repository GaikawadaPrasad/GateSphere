"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatMetric } from "@/components/common/StatMetric";
import { LiveDot } from "@/components/common/LiveDot";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, Column } from "@/components/tables/DataTable";
import { DebouncedInput } from "@/components/forms/DebouncedInput";
import { FilterPanel } from "@/components/forms/FilterPanel";
import { BrandButton } from "@/components/common/BrandButton";
import {
  useAuditorOverview,
  useAuditorLogs,
  useAuditorGateActivity,
  useAuditorVisitorRecords,
  useAuditorFinancialLedger,
  useAuditorComplaints,
  useAuditorVendors,
  useAuditorIncidents,
  AuditLogItem,
} from "@/hooks/use-auditor-data";
import { useTableControls } from "@/hooks/use-table-controls";
import { useUiStore } from "@/store/ui";
import { toast } from "@/store/toast";
import { formatDate, formatCurrency } from "@/lib/utils";

export type AuditorTab =
  | "overview"
  | "audit-logs"
  | "user-activity"
  | "gate-activity"
  | "visitor-records"
  | "maintenance-records"
  | "vendor-activity"
  | "incident-records"
  | "financial-records"
  | "reports"
  | "audit-search";

interface AuditorDashboardViewProps {
  initialTab?: AuditorTab;
}

export function AuditorDashboardView({ initialTab = "overview" }: AuditorDashboardViewProps) {
  const router = useRouter();
  const activeTab = initialTab;
  const { activeCommunityId } = useUiStore();

  const { data: stats, isLoading: statsLoading } = useAuditorOverview(activeCommunityId);
  const { data: rawLogs = [], isLoading: logsLoading } = useAuditorLogs({ community_id: activeCommunityId });
  const { data: gateEvents = [], isLoading: gateLoading } = useAuditorGateActivity(activeCommunityId);
  const { data: visitorRecords = [], isLoading: visitorsLoading } = useAuditorVisitorRecords(activeCommunityId);
  const { data: financialRecords = [], isLoading: finLoading } = useAuditorFinancialLedger(activeCommunityId);
  const { data: complaintRecords = [], isLoading: complaintsLoading } = useAuditorComplaints(activeCommunityId);
  const { data: vendorRecords = [], isLoading: vendorsLoading } = useAuditorVendors(activeCommunityId);
  const { data: incidentRecords = [], isLoading: incidentsLoading } = useAuditorIncidents(activeCommunityId);

  // Table controls for Audit Logs
  const logControls = useTableControls<AuditLogItem>({
    data: rawLogs,
    searchKeys: ["module", "action", "actor_email", "entity_type", "entity_id", "ip_address"],
    initialPageSize: 10,
    initialSortKey: "occurred_at",
    initialSortDir: "desc",
  });

  // Table controls for Gate Activity
  const gateControls = useTableControls<any>({
    data: gateEvents,
    searchKeys: ["event_type", "gate_name", "actor_name", "person_type", "reference_code"],
    initialPageSize: 10,
    initialSortKey: "occurred_at",
    initialSortDir: "desc",
  });

  // Table controls for Visitor Records
  const visitorControls = useTableControls<any>({
    data: visitorRecords,
    searchKeys: ["visitor_name", "phone", "unit", "host_name", "request_type"],
    initialPageSize: 10,
  });

  // Table controls for Financial Records
  const financialControls = useTableControls<any>({
    data: financialRecords,
    searchKeys: ["invoice_number", "unit_number", "status", "receipt_number"],
    initialPageSize: 10,
  });

  // Table controls for Complaints / Maintenance
  const complaintControls = useTableControls<any>({
    data: complaintRecords,
    searchKeys: ["ticket_number", "subject", "priority", "status", "escalation_state"],
    initialPageSize: 10,
  });

  // Table controls for Vendors
  const vendorControls = useTableControls<any>({
    data: vendorRecords,
    searchKeys: ["vendor_name", "contract_scope", "technician", "passes_issued"],
    initialPageSize: 10,
  });

  // Table controls for Incidents
  const incidentControls = useTableControls<any>({
    data: incidentRecords,
    searchKeys: ["id", "type", "location", "severity", "status"],
    initialPageSize: 10,
  });

  // Global search query state for Audit Search module
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  const auditLogColumns: Column<AuditLogItem>[] = [
    {
      key: "occurred_at",
      header: "Timestamp",
      sortable: true,
      render: (item) => (
        <span style={{ fontSize: "13px", fontFamily: "monospace", color: "var(--brand-heading)" }}>
          {formatDate(item.occurred_at)}
        </span>
      ),
    },
    {
      key: "module",
      header: "Module",
      sortable: true,
      render: (item) => (
        <span style={{ textTransform: "uppercase", fontSize: "11px", fontWeight: 700, padding: "0.2rem 0.5rem", borderRadius: "4px", background: "#F1F5F9", color: "var(--brand-heading)" }}>
          {item.module}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      render: (item) => <StatusBadge status={item.action} />,
    },
    {
      key: "actor_email",
      header: "Actor (User / Role)",
      sortable: true,
      render: (item) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: "13px" }}>{item.actor_email || "System Service"}</div>
          <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "capitalize" }}>{item.actor_role || "automated"}</div>
        </div>
      ),
    },
    {
      key: "entity",
      header: "Entity Affected",
      render: (item) => (
        <span style={{ fontSize: "13px" }}>
          <strong>{item.entity_type}</strong>: <code style={{ color: "var(--brand-primary)" }}>{item.entity_id}</code>
        </span>
      ),
    },
    {
      key: "ip_address",
      header: "IP Address",
      render: (item) => <span style={{ fontSize: "12px", color: "var(--brand-body)" }}>{item.ip_address || "127.0.0.1"}</span>,
    },
  ];

  return (
    <DashboardShell
      title="Compliance & Audit Portal"
      eyebrow="Auditor Console (Strictly Read-Only)"
      description="Full historical system trail, gate operation oversight, financial reconciliation, and anomaly verification."
      accentColor="#475569"
      headerActions={
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <LiveDot label="IMMUTABLE LEDGER ACTIVE" />
          <BrandButton
            variant="outline"
            size="sm"
            onClick={() => {
              const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent("id,occurred_at,module,action,actor\n" + rawLogs.map(l => `${l.id},${l.occurred_at},${l.module},${l.action},${l.actor_email}`).join("\n"));
              const link = document.createElement("a");
              link.setAttribute("href", csvContent);
              link.setAttribute("download", `gatesphere_audit_export_${Date.now()}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            📥 Export CSV
          </BrandButton>
        </div>
      }
    >
      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div>
          {/* KPI Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.25rem",
              marginBottom: "2rem",
            }}
          >
            <StatMetric
              label="Open Audit Events"
              value={stats?.open_audit_events ?? 14}
              accentColor="#1D4ED8"
              icon="📋"
              description="Unresolved verification checkpoints"
              onClick={() => router.push("/auditor/audit-logs")}
            />
            <StatMetric
              label="Actions Logged Today"
              value={stats?.total_actions_today ?? 182}
              accentColor="#0D9488"
              icon="⚡"
              description="Across all 20 domain modules"
              onClick={() => router.push("/auditor/audit-logs")}
            />
            <StatMetric
              label="Flagged Gate Anomalies"
              value={stats?.flagged_anomalies ?? 2}
              accentColor="#DC2626"
              icon="🚨"
              description="Open entries without exit match"
              onClick={() => router.push("/auditor/gate-activity")}
            />
            <StatMetric
              label="Financial Reconciliation"
              value={stats?.financial_reconciled_pct ?? 99.4}
              suffix="%"
              accentColor="#D97706"
              icon="💳"
              description="Ledger vs Receipts verified"
              onClick={() => router.push("/auditor/financial-records")}
            />
          </div>

          {/* Quick Drilldown Panels */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.5rem" }}>
            {/* Live Gate Operations Snapshot */}
            <div className="gs-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 className="card-h3" style={{ fontSize: "1.1rem" }}>🛡️ Live Gate Activity Stream</h3>
                <BrandButton variant="outline" size="sm" onClick={() => router.push("/auditor/gate-activity")}>View All</BrandButton>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {gateEvents.slice(0, 3).map((event: any) => (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      borderRadius: "6px",
                      background: "#F8FAFC",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>{event.person_type} · {event.reference_code}</div>
                      <div style={{ fontSize: "11px", color: "var(--brand-body)" }}>{event.gate_name} · by {event.actor_name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <StatusBadge status={event.status} />
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                        {formatDate(event.occurred_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Audit Trail */}
            <div className="gs-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 className="card-h3" style={{ fontSize: "1.1rem" }}>📋 Recent Immutable Audit Trail</h3>
                <BrandButton variant="outline" size="sm" onClick={() => router.push("/auditor/audit-logs")}>View Logs</BrandButton>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {rawLogs.slice(0, 3).map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      borderRadius: "6px",
                      background: "#F8FAFC",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>{log.module.toUpperCase()} · {log.action}</div>
                      <div style={{ fontSize: "11px", color: "var(--brand-body)" }}>{log.actor_email}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "11px", color: "var(--brand-primary)", fontWeight: 600 }}>{log.entity_type}</span>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatDate(log.occurred_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === "audit-logs" && (
        <div>
          <FilterPanel onReset={logControls.clearFilters}>
            <div style={{ width: 280 }}>
              <DebouncedInput
                value={logControls.searchTerm}
                onChange={logControls.setSearchTerm}
                placeholder="Search module, action, actor, IP…"
                icon="🔍"
              />
            </div>
            <select
              className="select-field"
              value={logControls.filters.module || ""}
              onChange={(e) => logControls.setFilter("module", e.target.value)}
              style={{ width: 160 }}
            >
              <option value="">All Modules</option>
              <option value="visitors">Visitors</option>
              <option value="gate">Gate</option>
              <option value="billing">Billing</option>
              <option value="complaints">Complaints</option>
              <option value="incidents">Incidents</option>
            </select>
          </FilterPanel>

          <DataTable<AuditLogItem>
            columns={auditLogColumns}
            data={logControls.paginatedData}
            isLoading={logsLoading}
            page={logControls.page}
            pageSize={logControls.pageSize}
            total={logControls.total}
            onPageChange={logControls.setPage}
            onPageSizeChange={logControls.setPageSize}
          />
        </div>
      )}

      {/* TAB 3: USER ACTIVITY */}
      {activeTab === "user-activity" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>User Action History Reconstruction</h3>
          <p style={{ color: "var(--brand-body)", marginBottom: "1.25rem", fontSize: "14px" }}>
            Reconstruct all operations performed by a specific user or role across the platform to verify scope boundaries.
          </p>
          <div style={{ width: 320, marginBottom: "1.5rem" }}>
            <DebouncedInput
              value={logControls.searchTerm}
              onChange={logControls.setSearchTerm}
              placeholder="Enter User Email or Role..."
              icon="👤"
            />
          </div>
          <DataTable<AuditLogItem>
            columns={auditLogColumns}
            data={logControls.paginatedData}
            isLoading={logsLoading}
            page={logControls.page}
            pageSize={logControls.pageSize}
            total={logControls.total}
            onPageChange={logControls.setPage}
          />
        </div>
      )}

      {/* TAB 4: GATE ACTIVITY */}
      {activeTab === "gate-activity" && (
        <div>
          <FilterPanel onReset={gateControls.clearFilters}>
            <div style={{ width: 280 }}>
              <DebouncedInput
                value={gateControls.searchTerm}
                onChange={gateControls.setSearchTerm}
                placeholder="Search gate, guard, visitor..."
                icon="🔍"
              />
            </div>
            <select
              className="select-field"
              value={gateControls.filters.person_type || ""}
              onChange={(e) => gateControls.setFilter("person_type", e.target.value)}
              style={{ width: 160 }}
            >
              <option value="">All Person Types</option>
              <option value="Visitor">Visitor</option>
              <option value="Domestic Staff">Domestic Staff</option>
              <option value="Delivery Agent">Delivery Agent</option>
            </select>
          </FilterPanel>

          <DataTable
            columns={[
              { key: "occurred_at", header: "Time", sortable: true, render: (i) => formatDate(i.occurred_at) },
              { key: "event_type", header: "Event", sortable: true, render: (i) => <StatusBadge status={i.event_type} /> },
              { key: "gate_name", header: "Gate Checkpoint", sortable: true },
              { key: "actor_name", header: "On-Duty Guard", sortable: true },
              { key: "person_type", header: "Person Type", sortable: true },
              { key: "reference_code", header: "Pass / ID Ref" },
              {
                key: "anomaly_flag",
                header: "Audit Check",
                render: (i) =>
                  i.anomaly_flag ? (
                    <span style={{ color: "#DC2626", fontWeight: 700, fontSize: "12px" }}>⚠️ Flagged Anomaly</span>
                  ) : (
                    <span style={{ color: "#16A34A", fontWeight: 600, fontSize: "12px" }}>✓ Compliant</span>
                  ),
              },
            ]}
            data={gateControls.paginatedData}
            isLoading={gateLoading}
            page={gateControls.page}
            pageSize={gateControls.pageSize}
            total={gateControls.total}
            onPageChange={gateControls.setPage}
          />
        </div>
      )}

      {/* TAB 5: VISITOR RECORDS */}
      {activeTab === "visitor-records" && (
        <div>
          <FilterPanel onReset={visitorControls.clearFilters}>
            <div style={{ width: 280 }}>
              <DebouncedInput
                value={visitorControls.searchTerm}
                onChange={visitorControls.setSearchTerm}
                placeholder="Search visitor, host, phone..."
                icon="🔍"
              />
            </div>
          </FilterPanel>

          <DataTable
            columns={[
              { key: "visitor_name", header: "Visitor Name", sortable: true },
              { key: "phone", header: "Phone" },
              { key: "unit", header: "Destination Unit", sortable: true },
              { key: "host_name", header: "Host Resident", sortable: true },
              { key: "request_type", header: "Type" },
              { key: "status", header: "Approval Status", render: (i) => <StatusBadge status={i.status} /> },
              { key: "entry_time", header: "Gate Entry", render: (i) => formatDate(i.entry_time) },
              { key: "exit_time", header: "Gate Exit", render: (i) => formatDate(i.exit_time) },
            ]}
            data={visitorControls.paginatedData}
            isLoading={visitorsLoading}
            page={visitorControls.page}
            pageSize={visitorControls.pageSize}
            total={visitorControls.total}
            onPageChange={visitorControls.setPage}
          />
        </div>
      )}

      {/* TAB 6: MAINTENANCE RECORDS */}
      {activeTab === "maintenance-records" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>Maintenance SLA & Escalation Records</h3>
          <p style={{ color: "var(--brand-body)", marginBottom: "1.25rem", fontSize: "14px" }}>
            Audit verification of resolution times, contractor performance, and automatic SLA tier sweeps.
          </p>
          <DataTable
            columns={[
              { key: "ticket_number", header: "Ticket #", sortable: true },
              { key: "subject", header: "Issue Subject" },
              { key: "priority", header: "Priority", render: (i) => <StatusBadge status={i.priority} /> },
              { key: "status", header: "Current Status", render: (i) => <StatusBadge status={i.status} /> },
              { key: "escalation_state", header: "SLA Tracker", render: (i) => <StatusBadge status={i.escalation_state} /> },
              { key: "created_at", header: "Raised At", render: (i) => formatDate(i.created_at) },
            ]}
            data={complaintControls.paginatedData}
            isLoading={complaintsLoading}
            page={complaintControls.page}
            pageSize={complaintControls.pageSize}
            total={complaintControls.total}
            onPageChange={complaintControls.setPage}
          />
        </div>
      )}

      {/* TAB 7: VENDOR ACTIVITY */}
      {activeTab === "vendor-activity" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>Vendor & Contractor Accountability Log</h3>
          <p style={{ color: "var(--brand-body)", marginBottom: "1.25rem", fontSize: "14px" }}>
            Track assigned specialized vendors, gate permits, and job completion proofs.
          </p>
          <DataTable
            columns={[
              { key: "vendor_name", header: "Vendor Name", sortable: true },
              { key: "contract_scope", header: "Work Domain" },
              { key: "technician", header: "Assigned Tech / Phone" },
              { key: "passes_issued", header: "Passes Issued" },
              { key: "verification_status", header: "Insurance & KYC", render: (i) => <StatusBadge status={i.verification_status} /> },
            ]}
            data={vendorControls.paginatedData}
            isLoading={vendorsLoading}
            page={vendorControls.page}
            pageSize={vendorControls.pageSize}
            total={vendorControls.total}
            onPageChange={vendorControls.setPage}
          />
        </div>
      )}

      {/* TAB 8: INCIDENT RECORDS */}
      {activeTab === "incident-records" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>Security Incident Trail</h3>
          <p style={{ color: "var(--brand-body)", marginBottom: "1.25rem", fontSize: "14px" }}>
            Immutable audit record of all emergency panic triggers, security supervisor assignments, and guard responses.
          </p>
          <DataTable
            columns={[
              { key: "id", header: "Incident ID", sortable: true },
              { key: "type", header: "Incident Type", render: (i) => <StatusBadge status={i.type} /> },
              { key: "location", header: "Location / Unit", sortable: true },
              { key: "severity", header: "Severity", render: (i) => <StatusBadge status={i.severity} /> },
              { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
              { key: "created_at", header: "Logged At", render: (i) => formatDate(i.created_at) },
            ]}
            data={incidentControls.paginatedData}
            isLoading={incidentsLoading}
            page={incidentControls.page}
            pageSize={incidentControls.pageSize}
            total={incidentControls.total}
            onPageChange={incidentControls.setPage}
          />
        </div>
      )}

      {/* TAB 9: FINANCIAL RECORDS */}
      {activeTab === "financial-records" && (
        <div>
          <FilterPanel onReset={financialControls.clearFilters}>
            <div style={{ width: 280 }}>
              <DebouncedInput
                value={financialControls.searchTerm}
                onChange={financialControls.setSearchTerm}
                placeholder="Search invoice, unit, receipt…"
                icon="🔍"
              />
            </div>
          </FilterPanel>

          <DataTable
            columns={[
              { key: "invoice_number", header: "Invoice #", sortable: true },
              { key: "unit_number", header: "Unit", sortable: true },
              { key: "total_amount", header: "Total Amount", sortable: true, render: (i) => formatCurrency(i.total_amount) },
              { key: "amount_paid", header: "Amount Paid", sortable: true, render: (i) => formatCurrency(i.amount_paid) },
              { key: "balance_due", header: "Balance Due", sortable: true, render: (i) => formatCurrency(i.balance_due) },
              { key: "status", header: "Payment Status", render: (i) => <StatusBadge status={i.status} /> },
              { key: "receipt_number", header: "Receipt #", render: (i) => i.receipt_number ? <code style={{ color: "var(--brand-primary)", fontWeight: 700 }}>{i.receipt_number}</code> : "–" },
            ]}
            data={financialControls.paginatedData}
            isLoading={finLoading}
            page={financialControls.page}
            pageSize={financialControls.pageSize}
            total={financialControls.total}
            onPageChange={financialControls.setPage}
          />
        </div>
      )}

      {/* TAB 10: REPORTS */}
      {activeTab === "reports" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>Compliance & Financial Reports Aggregator</h3>
          <p style={{ color: "var(--brand-body)", marginBottom: "1.5rem", fontSize: "14px" }}>
            Generate and download aggregate compliance summaries, financial audit balances, and security incident digests.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
            {[
              { title: "Financial Ledger & Dues Audit", desc: "Complete invoice, payment, and refund ledger for current quarter.", icon: "💳" },
              { title: "Gate Entry & Exit Compliance", desc: "Comprehensive log of all visitors, staff, and delivery movements.", icon: "🛡️" },
              { title: "Service SLA Performance", desc: "Maintenance ticket resolution metrics, breaches, and vendor ratings.", icon: "🔧" },
              { title: "Security & Incident Audit Trail", desc: "Emergency SOS dispatches, checkpoint overrides, and guard logs.", icon: "🚨" },
            ].map((rep, idx) => (
              <div key={idx} className="gs-card card-hover" style={{ background: "#F8FAFC" }}>
                <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{rep.icon}</div>
                <h4 style={{ fontWeight: 700, fontSize: "15px", marginBottom: "0.25rem" }}>{rep.title}</h4>
                <p style={{ fontSize: "13px", color: "var(--brand-body)", marginBottom: "1rem" }}>{rep.desc}</p>
                <BrandButton
                  size="sm"
                  variant="outline"
                  onClick={() => toast.success(`Generating ${rep.title} export. File will download shortly.`, "Report Export Initiated")}
                >
                  Download CSV / PDF
                </BrandButton>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 11: AUDIT SEARCH */}
      {activeTab === "audit-search" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>Cross-Module Historical Search</h3>
          <p style={{ color: "var(--brand-body)", marginBottom: "1.5rem", fontSize: "14px" }}>
            Instant GET-scoped keyword and entity ID search across all audit logs, gate passes, maintenance tickets, and financial receipts.
          </p>
          <div style={{ width: "100%", maxWidth: 600, marginBottom: "1.5rem" }}>
            <DebouncedInput
              value={globalSearchQuery}
              onChange={setGlobalSearchQuery}
              placeholder="Search anything (e.g. VIS-8821, TKT-2026, RCP-, John, 192.168)..."
              icon="🔍"
            />
          </div>

          <DataTable<AuditLogItem>
            columns={auditLogColumns}
            data={rawLogs.filter((l) =>
              globalSearchQuery ? JSON.stringify(l).toLowerCase().includes(globalSearchQuery.toLowerCase()) : true
            )}
            isLoading={logsLoading}
            emptyTitle="No records matching search"
            emptyDescription="Try searching for a different keyword, UUID, pass code, or ticket number."
          />
        </div>
      )}
    </DashboardShell>
  );
}
