"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatDateTime } from "@/lib/utils";
import { useAuditLogs } from "@/hooks/use-audit";
import { useCommunities } from "@/hooks/use-communities";
import { auditApi } from "@/lib/api";
import type { AuditLog } from "@/types/audit";

export default function AuditLogsPage() {
  const [module, setModule] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const pageSize = 20;

  const { data: communities } = useCommunities();
  const { data: logs, isLoading } = useAuditLogs({
    module: module || undefined,
    community_id: communityId || undefined,
    page,
    page_size: pageSize,
  });

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const csvData = await auditApi.exportCsv({
        module: module || undefined,
        community_id: communityId || undefined,
      });

      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `gatesphere_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setIsExporting(false);
    }
  };

  const columns: Column<AuditLog>[] = [
    {
      key: "created_at",
      header: "Timestamp",
      render: (log) => <span style={{ fontSize: "0.8rem" }}>{formatDateTime(log.created_at)}</span>,
    },
    {
      key: "module",
      header: "Module",
      render: (log) => <span className="badge badge-primary">{log.module}</span>,
    },
    {
      key: "action",
      header: "Action",
      render: (log) => <span style={{ fontWeight: 600, color: "var(--fg)" }}>{log.action}</span>,
    },
    {
      key: "entity_type",
      header: "Target Entity",
      render: (log) => (
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          {log.entity_type} #{log.entity_id?.slice(0, 8) || "–"}
        </span>
      ),
    },
    {
      key: "user_email",
      header: "Actor",
      render: (log) => <span>{log.user_email || log.user_name || "System"}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Immutable security trail and administrative activity tracking"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Audit Logs" }]}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCsv}
            disabled={isExporting}
          >
            {isExporting ? "Exporting…" : "📥 Export CSV"}
          </button>
        }
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Activity Trail</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {logs?.length || 0} audit events recorded
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <select
              className="select-field"
              value={module}
              onChange={(e) => {
                setModule(e.target.value);
                setPage(1);
              }}
              style={{ width: "auto", height: 36, padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
            >
              <option value="">All Modules</option>
              <option value="auth">Auth</option>
              <option value="communities">Communities</option>
              <option value="residents">Residents</option>
              <option value="visitors">Visitors</option>
              <option value="gate">Gate</option>
              <option value="billing">Billing</option>
              <option value="complaints">Complaints</option>
              <option value="amenities">Amenities</option>
            </select>

            <select
              className="select-field"
              value={communityId}
              onChange={(e) => {
                setCommunityId(e.target.value);
                setPage(1);
              }}
              style={{ width: "auto", height: 36, padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
            >
              <option value="">All Communities</option>
              {communities?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={logs as unknown as Record<string, unknown>[]}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          total={logs?.length || 0}
          onPageChange={setPage}
          emptyTitle="No audit records"
          emptyDescription="No actions found matching your criteria."
        />
      </div>
    </div>
  );
}
