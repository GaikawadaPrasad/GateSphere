"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { visitorsApi, type VisitorRecord } from "@/lib/api";

export default function SecuritySupervisorVisitorManagementPage() {
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRecord | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res: any = await visitorsApi.requests({ page_size: 100 });
      const data = Array.isArray(res) ? res : res?.data || [];
      setVisitors(
        (data || []).map((v: any) => ({
          id: v.id,
          pass_code: v.id ? `REQ-${v.id.slice(0, 6).toUpperCase()}` : "PASS",
          name: v.visitor_name || v.visitor?.full_name || v.full_name || "Visitor",
          phone: v.phone || v.visitor?.phone || v.visitor_phone || "—",
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
          rawStatus: v.status,
          purpose: v.purpose || v.notes || "Personal Visit",
          expected_at: v.expected_at ? new Date(v.expected_at).toLocaleString() : (v.valid_from ? new Date(v.valid_from).toLocaleString() : "—"),
          valid_until: v.valid_until ? new Date(v.valid_until).toLocaleString() : (v.valid_to ? new Date(v.valid_to).toLocaleString() : "—"),
          created_at: v.created_at ? new Date(v.created_at).toLocaleString() : "—",
          vehicle_number: v.vehicle_number || "None",
          photo_url: v.photo_url || v.visitor?.photo_url || undefined,
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
          <button
            type="button"
            className="btn btn-outline"
            style={{
              fontSize: "0.75rem",
              padding: "0.2rem 0.55rem",
              border: "1px solid var(--border, #e2e8f0)",
              background: "#ffffff",
              color: "var(--fg, #0f172a)",
              borderRadius: "6px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              cursor: "pointer",
            }}
            onClick={() => setSelectedVisitor(v)}
          >
            <span>👁</span>
            <span>View</span>
          </button>
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
        actions={
          <Link href="/security-supervisor/blacklist" className="btn btn-danger" style={{ fontSize: "0.85rem" }}>
            🚫 Blacklist Registry & Restricted Entry
          </Link>
        }
      />

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

      {selectedVisitor && (
        <Modal
          isOpen={Boolean(selectedVisitor)}
          onClose={() => setSelectedVisitor(null)}
          title="Visitor Pass Details"
          size="md"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedVisitor(null)}
              >
                Close
              </button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Header summary */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem 1rem",
                background: "var(--bg-subtle, #f8fafc)",
                borderRadius: "var(--radius, 8px)",
                border: "1px solid var(--border, #e2e8f0)",
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--fg)" }}>
                  👤 {selectedVisitor.name}
                </h4>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "var(--muted)", fontFamily: "monospace" }}>
                  {selectedVisitor.phone}
                </p>
              </div>
              <StatusBadge status={selectedVisitor.status} />
            </div>

            {/* Resident approval notice for pending passes */}
            {selectedVisitor.status === "Pending Approval" && (
              <div
                style={{
                  padding: "0.65rem 0.85rem",
                  background: "#fffbeb",
                  border: "1px solid #fef3c7",
                  borderRadius: "6px",
                  color: "#92400e",
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>ℹ️</span>
                <span>
                  <strong>Pending Resident Approval:</strong> This visitor pass is awaiting confirmation from the resident/owner of {selectedVisitor.unit}. Approval and rejection actions are reserved for the respective resident.
                </span>
              </div>
            )}

            {/* Details Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Pass Code
                </div>
                <div style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--fg)", marginTop: "0.15rem" }}>
                  {selectedVisitor.pass_code}
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Destination Unit
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem" }}>
                  🏢 {selectedVisitor.unit}
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Visitor Type
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem" }}>
                  {selectedVisitor.type}
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Vehicle Number
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem" }}>
                  🚗 {selectedVisitor.vehicle_number || "None"}
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "0.6rem 0.8rem", borderRadius: "6px", gridColumn: "span 2" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Purpose of Visit
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem" }}>
                  {selectedVisitor.purpose || "Personal Visit"}
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Expected Arrival
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem", fontSize: "0.8rem" }}>
                  {selectedVisitor.expected_at || "—"}
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.725rem", textTransform: "uppercase", fontWeight: 600 }}>
                  Valid Until
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem", fontSize: "0.8rem" }}>
                  {selectedVisitor.valid_until || "—"}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
