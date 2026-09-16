"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { visitorsApi, communitiesApi, authApi, type VisitorRecord } from "@/lib/api";
import { Modal } from "@/components/common/Modal";
import { formatDateTime } from "@/lib/utils";

interface SupervisorVisitorRow {
  id: string;
  pass_code: string;
  name: string;
  phone: string;
  type: string;
  unit: string;
  status: string;
  rawStatus: string;
  vehicle_number?: string;
  purpose?: string;
  party_size?: number;
  expected_at?: string;
  valid_until?: string;
  created_at?: string;
  photo_url?: string;
}

export default function SecuritySupervisorVisitorManagementPage() {
  const [visitors, setVisitors] = useState<SupervisorVisitorRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<SupervisorVisitorRow | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [res, directoryRes, me] = await Promise.all([
        visitorsApi.requests({ page_size: 100 }),
        visitorsApi.directory({ page_size: 100 }).catch(() => []),
        authApi.me().catch(() => null),
      ]);
      const data = Array.isArray(res) ? res : (res as any)?.data || [];
      const directory = Array.isArray(directoryRes) ? directoryRes : (directoryRes as any)?.data || [];

      let cid = me?.community_ids?.[0] || (me as any)?.community_id;
      if (!cid && me?.roles && Array.isArray(me.roles)) {
        cid = me.roles.find((r: any) => r.community_id)?.community_id;
      }

      const unitMap = new Map<string, string>();
      if (cid) {
        try {
          const uRes: any = await communitiesApi.communityUnits(cid, { page_size: 100 });
          const uList = Array.isArray(uRes) ? uRes : uRes?.data || uRes?.items || [];
          for (const u of uList) {
            if (u?.id) unitMap.set(u.id, u.unit_number);
          }
        } catch {
          // unit fallback
        }
      }

      const visitorMap = new Map<string, any>();
      for (const v of directory || []) if ((v as any)?.id) visitorMap.set((v as any).id, v);

      setVisitors(
        (data || []).map((v: any) => {
          const directoryVisitor = visitorMap.get(v.visitor_id);
          const name =
            v.visitor_name ||
            v.visitor?.full_name ||
            v.full_name ||
            directoryVisitor?.full_name ||
            "Visitor";
          const phone =
            v.phone ||
            v.visitor?.phone ||
            v.visitor_phone ||
            directoryVisitor?.phone ||
            "—";
          const unit = unitMap.get(v.unit_id) || (v.unit_id ? `Unit #${v.unit_id.slice(0, 6)}` : "—");
          const photoUrl =
            v.photo_url ||
            v.visitor?.photo_url ||
            directoryVisitor?.photo_url ||
            undefined;

          return {
            id: v.id,
            pass_code: v.id ? `REQ-${v.id.slice(0, 6).toUpperCase()}` : "PASS",
            name,
            phone,
            type: v.visitor_type
              ? v.visitor_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
              : "Guest",
            unit,
            status:
              v.status === "pending"
                ? "Pending Approval"
                : v.status
                  ? v.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                  : "Expected",
            rawStatus: v.status || "pending",
            vehicle_number: v.vehicle_number || v.visitor?.vehicle_number || "—",
            purpose: v.purpose || "—",
            party_size: v.party_size || 1,
            expected_at: v.expected_at ? formatDateTime(v.expected_at) : "—",
            valid_until: v.valid_until ? formatDateTime(v.valid_until) : "—",
            created_at: v.created_at ? formatDateTime(v.created_at) : "—",
            photo_url: photoUrl,
          };
        }),
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
      setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: "Approved", rawStatus: "approved" } : v)));
      setActionMessage({ type: "success", text: `Visitor request approved for ${name}.` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to approve visitor request." });
    }
  };

  const handleReject = async (id: string, name: string) => {
    setActionMessage(null);
    try {
      await visitorsApi.reject(id, "Rejected by Security Supervisor");
      setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: "Rejected", rawStatus: "rejected" } : v)));
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

  const columns: Column<SupervisorVisitorRow>[] = [
    {
      key: "pass_code",
      header: "Pass Code",
      sortable: true,
      render: (v) => (
        <span style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--primary, #2563eb)" }}>
          {v.pass_code}
        </span>
      ),
    },
    {
      key: "name",
      header: "Visitor Name",
      sortable: true,
      render: (v) => (
        <button
          type="button"
          onClick={() => setSelectedVisitor(v)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontWeight: 600,
            color: "var(--primary, #2563eb)",
            textAlign: "left",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
          title="Click to view full visitor details"
        >
          👤 {v.name}
        </button>
      ),
    },
    {
      key: "phone",
      header: "Contact Phone",
      sortable: true,
      render: (v) => <span style={{ fontFamily: "monospace", fontWeight: 500 }}>{v.phone}</span>,
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
      render: (v) => <span style={{ fontWeight: 600, color: "var(--fg)" }}>🏢 {v.unit}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (v) => <StatusBadge status={v.rawStatus || v.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (v) => (
        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
            onClick={() => setSelectedVisitor(v)}
            title="View full visitor details"
          >
            👁️ View
          </button>
          {v.status === "Pending Approval" ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                onClick={() => handleApprove(v.id, v.name)}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                onClick={() => handleReject(v.id, v.name)}
              >
                Reject
              </button>
            </>
          ) : null}
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

      {/* Supervisor Visitor Details Modal */}
      {selectedVisitor && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedVisitor(null)}
          title="Visitor Pass & Entry Details"
          size="md"
          footer={
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", width: "100%" }}>
              {selectedVisitor.status === "Pending Approval" && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      handleApprove(selectedVisitor.id, selectedVisitor.name);
                      setSelectedVisitor(null);
                    }}
                  >
                    Approve Request
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      handleReject(selectedVisitor.id, selectedVisitor.name);
                      setSelectedVisitor(null);
                    }}
                  >
                    Reject Request
                  </button>
                </>
              )}
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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.85rem 1rem",
                background: "var(--bg-subtle, #f8fafc)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                {selectedVisitor.photo_url ? (
                  <a
                    href={selectedVisitor.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Click to view full photograph"
                    style={{ position: "relative", display: "inline-block", flexShrink: 0 }}
                  >
                    <img
                      src={selectedVisitor.photo_url}
                      alt={selectedVisitor.name}
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        border: "2px solid #86efac",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        cursor: "pointer",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        bottom: "-4px",
                        right: "-4px",
                        background: "#059669",
                        color: "white",
                        fontSize: "0.55rem",
                        padding: "1px 4px",
                        borderRadius: "3px",
                        fontWeight: 700,
                      }}
                    >
                      📷 PHOTO
                    </span>
                  </a>
                ) : (
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "8px",
                      background: "#e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      color: "#94a3b8",
                      border: "1px dashed #cbd5e1",
                      flexShrink: 0,
                    }}
                    title="No photograph attached"
                  >
                    👤
                  </div>
                )}
                <div>
                  <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)" }}>
                    {selectedVisitor.name}
                  </h4>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "var(--muted)", fontFamily: "monospace" }}>
                    {selectedVisitor.phone}
                  </p>
                  {selectedVisitor.photo_url ? (
                    <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: 600, display: "block", marginTop: "0.2rem" }}>
                      ✓ Verified Photo Attached
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: 600, display: "block", marginTop: "0.2rem" }}>
                      ⚠️ No Photo Attached
                    </span>
                  )}
                </div>
              </div>
              <StatusBadge status={selectedVisitor.rawStatus || selectedVisitor.status} />
            </div>

            {/* Dedicated Visitor Photograph Card */}
            {selectedVisitor.photo_url && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "0.85rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                  <a
                    href={selectedVisitor.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Click to view full size"
                  >
                    <img
                      src={selectedVisitor.photo_url}
                      alt={selectedVisitor.name}
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        border: "2px solid #86efac",
                        cursor: "pointer",
                      }}
                    />
                  </a>
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#166534" }}>
                      📷 Visitor Identity Photograph
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#15803d", marginTop: "0.15rem" }}>
                      Mandatory face photo captured during gate registration
                    </div>
                  </div>
                </div>
                <a
                  href={selectedVisitor.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm"
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.4rem 0.75rem",
                    background: "#059669",
                    color: "#ffffff",
                    textDecoration: "none",
                    borderRadius: "6px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  🔍 View Full Size
                </a>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.75rem",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Destination Unit
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem" }}>
                  🏢 {selectedVisitor.unit}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Visitor Type
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem", textTransform: "capitalize" }}>
                  {selectedVisitor.type}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Pass Code
                </div>
                <div style={{ fontWeight: 600, color: "var(--primary, #2563eb)", marginTop: "0.15rem", fontFamily: "monospace" }}>
                  {selectedVisitor.pass_code}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Vehicle Number
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem", fontFamily: "monospace" }}>
                  🚗 {selectedVisitor.vehicle_number}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Party Size
                </div>
                <div style={{ fontWeight: 600, color: "var(--fg)", marginTop: "0.15rem" }}>
                  👥 {selectedVisitor.party_size} person(s)
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Expected At
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem", fontSize: "0.8rem" }}>
                  {selectedVisitor.expected_at}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px", gridColumn: "span 2" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Purpose of Visit
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem" }}>
                  {selectedVisitor.purpose}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Valid Until
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem", fontSize: "0.8rem" }}>
                  {selectedVisitor.valid_until}
                </div>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.6rem 0.8rem", borderRadius: "6px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  Pass Created
                </div>
                <div style={{ fontWeight: 500, color: "var(--fg)", marginTop: "0.15rem", fontSize: "0.8rem" }}>
                  {selectedVisitor.created_at}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
