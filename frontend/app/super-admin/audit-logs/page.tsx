"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { formatDateTime } from "@/lib/utils";
import { useAuditLogs } from "@/hooks/use-audit";
import { useCommunities } from "@/hooks/use-communities";
import { auditApi } from "@/lib/api";
import { useUiStore } from "@/store/ui";
import { ScopeBanner } from "@/components/common/ScopeBanner";
import { Modal } from "@/components/common/Modal";
import type { AuditLog } from "@/types/audit";
import type { Community } from "@/types/communities";

export default function AuditLogsPage() {
  const { activeCommunityId, setActiveCommunity } = useUiStore();
  const [module, setModule] = useState("");
  const [communityId, setCommunityId] = useState(activeCommunityId || "");
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const pageSize = 20;

  useEffect(() => {
    setCommunityId(activeCommunityId || "");
    setPage(1);
  }, [activeCommunityId]);

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
      link.setAttribute(
        "download",
        `gatesphere_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`,
      );
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
      render: (log) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "var(--fg)" }}>
            {formatDateTime(log.created_at)}
          </span>
        </div>
      ),
    },
    {
      key: "community_name",
      header: "Community (Where)",
      render: (log) => {
        if (log.community_name) {
          return (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600, color: "var(--fg)", fontSize: "0.85rem" }}>
                {log.community_name}
              </span>
              {log.community_code && (
                <span
                  style={{ fontSize: "0.725rem", color: "var(--muted)", fontFamily: "monospace" }}
                >
                  {log.community_code}
                </span>
              )}
            </div>
          );
        }
        if (log.community_id) {
          const matched = communities?.find((c: Community) => c.id === log.community_id);
          if (matched) {
            return (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 600, color: "var(--fg)", fontSize: "0.85rem" }}>
                  {matched.name}
                </span>
                <span
                  style={{ fontSize: "0.725rem", color: "var(--muted)", fontFamily: "monospace" }}
                >
                  {matched.code}
                </span>
              </div>
            );
          }
          return (
            <span style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "var(--muted)" }}>
              #{log.community_id.slice(0, 8)}
            </span>
          );
        }
        return (
          <span
            className="badge"
            style={{
              background: "rgba(100, 116, 139, 0.12)",
              color: "var(--muted)",
              fontSize: "0.725rem",
              fontWeight: 600,
            }}
          >
            🌐 Global / Platform
          </span>
        );
      },
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
      key: "user_name",
      header: "Actor (Who)",
      render: (log) => {
        const hasUser = Boolean(log.user_name || log.user_email || log.user_id);
        const primaryName =
          log.user_name ||
          log.user_email ||
          (log.user_id ? `User #${log.user_id.slice(0, 8)}` : "System");
        const secondaryInfo = log.user_name && log.user_email ? log.user_email : null;
        const roleLabel = log.role_slug ? log.role_slug.replace(/_/g, " ") : null;

        return (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, color: "var(--fg)", fontSize: "0.85rem" }}>
                {primaryName}
              </span>
              {roleLabel && (
                <span
                  className="badge"
                  style={{
                    fontSize: "0.675rem",
                    padding: "1px 6px",
                    textTransform: "capitalize",
                    background: hasUser ? "rgba(59, 130, 246, 0.1)" : "rgba(100, 116, 139, 0.1)",
                    color: hasUser ? "var(--primary, #2563eb)" : "var(--muted)",
                  }}
                >
                  {roleLabel}
                </span>
              )}
            </div>
            {secondaryInfo && (
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{secondaryInfo}</span>
            )}
            {!hasUser && !roleLabel && (
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Automated System Task
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "id",
      header: "Details",
      align: "right",
      render: (log) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setSelectedLog(log)}
          style={{ fontSize: "0.775rem", padding: "0.25rem 0.6rem" }}
        >
          🔍 Inspect
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle={
          activeCommunityId
            ? "Immutable security trail and activity tracking for selected community"
            : "Immutable security trail and administrative activity tracking"
        }
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Audit Logs" },
        ]}
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

      {/* Active Scope Banner */}
      <ScopeBanner
        entityName="audit trail"
        onClear={() => {
          setCommunityId("");
          setPage(1);
        }}
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
                const val = e.target.value;
                setCommunityId(val);
                setActiveCommunity(val || null);
                setPage(1);
              }}
              style={{ width: "auto", height: 36, padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
            >
              <option value="">All Communities</option>
              {communities?.map((c: Community) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={logs}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          total={logs?.length || 0}
          onPageChange={setPage}
          emptyTitle="No audit records"
          emptyDescription="No actions found matching your criteria."
        />
      </div>

      {/* Forensic Audit Log Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Audit Event Inspection — ${selectedLog.module.toUpperCase()}:${selectedLog.action}`}
          size="lg"
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedLog(null)}
            >
              Close
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "0.85rem",
                padding: "0.85rem",
                background: "var(--surface-muted, #f8fafc)",
                borderRadius: "8px",
                border: "1px solid var(--border, #e2e8f0)",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Date & Local Time
                </span>
                <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "0.15rem" }}>
                  {formatDateTime(selectedLog.created_at)}
                </div>
                <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)" }}>
                  {new Date(selectedLog.created_at).toISOString()}
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Community (Where)
                </span>
                <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "0.15rem" }}>
                  {selectedLog.community_name ||
                    communities?.find((c: Community) => c.id === selectedLog.community_id)?.name ||
                    (selectedLog.community_id ? "Unknown Community" : "Global / Platform")}
                </div>
                {selectedLog.community_code && (
                  <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)" }}>
                    Code: {selectedLog.community_code}
                  </div>
                )}
                {selectedLog.community_id && (
                  <div style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--muted)" }}>
                    ID: {selectedLog.community_id}
                  </div>
                )}
              </div>

              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Actor (Who)
                </span>
                <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "0.15rem" }}>
                  {selectedLog.user_name ||
                    selectedLog.user_email ||
                    (selectedLog.user_id ? "Registered User" : "System Service")}
                </div>
                {selectedLog.user_email && selectedLog.user_name && (
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {selectedLog.user_email}
                  </div>
                )}
                <div
                  style={{ fontSize: "11px", color: "var(--primary, #2563eb)", fontWeight: 500 }}
                >
                  Role:{" "}
                  {selectedLog.role_slug ? selectedLog.role_slug.replace(/_/g, " ") : "automated"}
                </div>
                {selectedLog.user_id && (
                  <div style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--muted)" }}>
                    User ID: {selectedLog.user_id}
                  </div>
                )}
              </div>

              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Target Entity Record
                </span>
                <div style={{ fontSize: "13px", fontWeight: 600, marginTop: "0.15rem" }}>
                  {selectedLog.entity_type || "–"}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                    color: "var(--primary, #2563eb)",
                  }}
                >
                  {selectedLog.entity_id || "–"}
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  Client IP Address
                </span>
                <div style={{ fontSize: "12px", fontFamily: "monospace", marginTop: "0.15rem" }}>
                  {selectedLog.ip_address || "–"}
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                >
                  User Agent
                </span>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--muted)",
                    marginTop: "0.15rem",
                    wordBreak: "break-all",
                    maxHeight: "44px",
                    overflow: "hidden",
                  }}
                  title={selectedLog.user_agent || ""}
                >
                  {selectedLog.user_agent || "–"}
                </div>
              </div>
            </div>

            {/* {(selectedLog.new_values || selectedLog.old_values || selectedLog.changes) && (
              <div>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    display: "block",
                    marginBottom: "0.4rem",
                    color: "var(--fg)",
                  }}
                >
                  Mutation Payload & State Values (JSON)
                </span>
                <pre
                  style={{
                    background: "#0f172a",
                    color: "#38bdf8",
                    padding: "0.85rem",
                    borderRadius: "6px",
                    fontSize: "12px",
                    maxHeight: "220px",
                    overflow: "auto",
                    fontFamily: "monospace",
                  }}
                >
                  {JSON.stringify(
                    selectedLog.new_values || selectedLog.changes || selectedLog.old_values || {},
                    null,
                    2
                  )}
                </pre>
              </div>
            )} */}
          </div>
        </Modal>
      )}
    </div>
  );
}
