"use client";

import { PageHeader } from "@/components/layout/PageHeader";

interface AuditLog {
  id: string;
  user: string;
  action: string;
  module: string;
  previous_value?: string;
  new_value?: string;
  timestamp: string;
  ip_address: string;
}

export default function SecuritySupervisorAuditLogsPage() {
  const auditLogs: AuditLog[] = [
    {
      id: "aud-101",
      user: "Supervisor Devraj",
      action: "ADD_BLACKLIST_ENTRY",
      module: "blacklist",
      previous_value: "N/A",
      new_value: "Added Kishore Kumar (BL-8809)",
      timestamp: "2026-09-03 09:50:22",
      ip_address: "192.168.1.45",
    },
    {
      id: "aud-102",
      user: "Guard Somnath Patil",
      action: "GATE_ENTRY_APPROVE",
      module: "gate",
      previous_value: "Pending Pass GP-9912",
      new_value: "Entry Approved (Rohan Mehta)",
      timestamp: "2026-09-03 10:20:15",
      ip_address: "192.168.1.80",
    },
    {
      id: "aud-103",
      user: "Supervisor Devraj",
      action: "ACKNOWLEDGE_EMERGENCY",
      module: "emergency",
      previous_value: "Active Alert",
      new_value: "Status: Acknowledged (Tower B)",
      timestamp: "2026-09-03 09:46:00",
      ip_address: "192.168.1.45",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Security Audit Trail"
        subtitle="Immutable read-only log of security system actions, gate overrides, and supervisor commands"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Audit Logs" }]}
      />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Immutable Audit Trail (Read Only)</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Security User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Previous Value</th>
                <th>New Value</th>
                <th>Session / IP</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: "0.8rem" }}>{log.timestamp}</td>
                  <td style={{ fontWeight: 600, color: "var(--fg)" }}>{log.user}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--primary)" }}>{log.action}</td>
                  <td>{log.module}</td>
                  <td style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{log.previous_value || "—"}</td>
                  <td style={{ fontSize: "0.8rem" }}>{log.new_value || "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
