"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { visitorsApi, type VisitorRecord } from "@/lib/api";

export default function SecuritySupervisorVisitorManagementPage() {
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await visitorsApi.requests();
      setVisitors(
        (data || []).map((v: any) => ({
          id: v.id,
          pass_code: v.id ? `REQ-${v.id.slice(0, 6).toUpperCase()}` : "PASS",
          name: v.visitor?.full_name || v.visitor_name || "Visitor",
          phone: v.visitor?.phone || v.phone || "—",
          type: v.visitor_type
            ? v.visitor_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "Guest",
          unit: `Unit ${v.unit_id ? v.unit_id.slice(0, 6) : "Direct"}`,
          status:
            v.status === "pending"
              ? "Pending Approval"
              : v.status
                ? v.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                : "Expected",
        })),
      );
    } catch {
      setVisitors([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: string, name: string) => {
    setActionMessage(null);
    try {
      await visitorsApi.approve(id, "Approved by Security Supervisor");
      setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: "Approved" } : v)));
      setActionMessage({ type: "success", text: `Visitor request approved for ${name}.` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to approve visitor request." });
    }
  };

  const handleReject = async (id: string, name: string) => {
    setActionMessage(null);
    try {
      await visitorsApi.reject(id, "Rejected by Security Supervisor");
      setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: "Rejected" } : v)));
      setActionMessage({ type: "success", text: `Visitor request rejected for ${name}.` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to reject visitor request." });
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      (v.name && v.name.toLowerCase().includes(q)) ||
      (v.phone && v.phone.toLowerCase().includes(q)) ||
      (v.pass_code && v.pass_code.toLowerCase().includes(q)) ||
      (v.unit && v.unit.toLowerCase().includes(q));
    const matchStatus =
      statusFilter === "all" || (v.status && v.status.toLowerCase() === statusFilter.toLowerCase());
    return matchSearch && matchStatus;
  });

  const columns: Column<VisitorRecord>[] = [
    {
      key: "pass_code",
      header: "Pass Code",
      sortable: true,
      render: (v) => <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{v.pass_code}</span>,
    },
    {
      key: "name",
      header: "Visitor Name",
      sortable: true,
      render: (v) => <span style={{ fontWeight: 600, color: "var(--fg)" }}>👤 {v.name}</span>,
    },
    {
      key: "phone",
      header: "Contact Phone",
      sortable: true,
      render: (v) => <span>{v.phone}</span>,
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (v) => <span>{v.type}</span>,
    },
    {
      key: "unit",
      header: "Destination Unit",
      sortable: true,
      render: (v) => <span>{v.unit}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (v) => <StatusBadge status={v.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (v) => (
        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
          {v.status === "Pending Approval" ? (
            <>
              <button
                className="btn btn-primary"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                onClick={() => handleApprove(v.id, v.name)}
              >
                Approve
              </button>
              <button
                className="btn btn-danger"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                onClick={() => handleReject(v.id, v.name)}
              >
                Reject
              </button>
            </>
          ) : (
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Visitor Lifecycle Management"
        subtitle="Review visitor access requests, pass verifications, pending approvals, and historical entry logs"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Visitor Management" },
        ]}
      />

      {actionMessage && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            borderRadius: "var(--radius)",
            background: actionMessage.type === "success" ? "var(--success-light)" : "var(--danger-light)",
            border: `1px solid ${actionMessage.type === "success" ? "var(--success-border)" : "var(--danger-border)"}`,
            color: actionMessage.type === "success" ? "#065f46" : "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            {actionMessage.type === "success" ? "✅" : "⚠️"} {actionMessage.text}
          </span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Registered Visitor Passes</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredVisitors.length} visitor passes
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search visitor name/pass/phone…"
              />
            </div>

            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Statuses</option>
              <option value="Expected">Expected</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Inside">Inside</option>
              <option value="Exited">Exited</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredVisitors}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Visitor Records Found"
          emptyDescription="There are no visitor records matching your search or status filter."
          emptyIcon="👥"
        />
      </div>
    </div>
  );
}
