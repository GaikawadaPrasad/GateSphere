"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SearchInput } from "@/components/forms/SearchInput";
import { Modal } from "@/components/common/Modal";
import { formatDate } from "@/lib/utils";
import { useComplaints } from "@/hooks/use-complaints";
import { useCommunities } from "@/hooks/use-communities";
import { useUiStore } from "@/store/ui";
import { ScopeBanner } from "@/components/common/ScopeBanner";
import type { ServiceTicket } from "@/types/complaints";

export default function ComplaintsPage() {
  const { activeCommunityId, setActiveCommunity } = useUiStore();
  const [search, setSearch] = useState("");
  const [communityId, setCommunityId] = useState(activeCommunityId || "");
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const pageSize = 15;

  useEffect(() => {
    setCommunityId(activeCommunityId || "");
    setPage(1);
  }, [activeCommunityId]);

  const { data: communities } = useCommunities();
  const { data: tickets, isLoading } = useComplaints({
    community_id: communityId || undefined,
    q: search.trim() || undefined,
    page,
    page_size: pageSize,
  });

  const columns: Column<ServiceTicket>[] = [
    {
      key: "title",
      header: "Complaint / Ticket",
      render: (t) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--fg)" }}>
            {t.subject || t.title || t.ticket_number}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            #{t.ticket_number} · {t.category_name || "General"}
          </div>
        </div>
      ),
    },
    {
      key: "community_name",
      header: "Community (Where)",
      render: (t) => {
        const commName =
          t.community_name ||
          communities?.find((c) => c.id === t.community_id)?.name ||
          "–";
        return (
          <div>
            <div
              style={{
                fontWeight: 600,
                color: "var(--fg)",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span>🏢</span>
              <span>{commName}</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {t.unit_number ? `Unit ${t.unit_number}` : "Common / Unassigned"}
            </div>
          </div>
        );
      },
    },
    {
      key: "raised_by_name",
      header: "Raised By (Who)",
      render: (t) => (
        <div>
          <div
            style={{
              fontWeight: 600,
              color: "var(--fg)",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <span>👤</span>
            <span>{t.raised_by_name || "Resident"}</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {t.raised_by_phone
              ? `📞 ${t.raised_by_phone}`
              : t.raised_by_email
                ? `✉️ ${t.raised_by_email}`
                : t.unit_number
                  ? `Unit ${t.unit_number}`
                  : "–"}
          </div>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      align: "center",
      render: (t) => <StatusBadge status={t.priority} />,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: "created_at",
      header: "Date Created",
      align: "right",
      render: (t) => <span>{formatDate(t.created_at)}</span>,
    },
    {
      key: "actions",
      header: "Action",
      align: "center",
      render: (t) => (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.2rem 0.55rem" }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTicket(t);
          }}
        >
          View Details
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Complaints & Service Tickets"
        subtitle={
          activeCommunityId
            ? "Maintenance, facilities, and service tickets for selected community"
            : "Global maintenance, facilities, and service requests tracker"
        }
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Complaints" },
        ]}
      />

      {/* Active Scope Banner */}
      <ScopeBanner
        entityName="tickets & complaints"
        onClear={() => {
          setCommunityId("");
          setPage(1);
        }}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Service Tickets</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {isLoading ? "Loading tickets…" : `${tickets?.length || 0} tickets tracked`}
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                placeholder="Search tickets…"
              />
            </div>

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
          data={tickets as unknown as Record<string, unknown>[]}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          total={tickets?.length || 0}
          onPageChange={setPage}
          onRowClick={(item) => setSelectedTicket(item as unknown as ServiceTicket)}
          emptyTitle="No complaints found"
          emptyDescription="There are no tickets matching your current filter."
        />
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <Modal
          isOpen={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          title={`Ticket #${selectedTicket.ticket_number}`}
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelectedTicket(null)}
            >
              Close
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Header info */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                paddingBottom: "0.75rem",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
                  {selectedTicket.subject || selectedTicket.title}
                </h4>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  Category: {selectedTicket.category_name || "General Maintenance"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <StatusBadge status={selectedTicket.priority} />
                <StatusBadge status={selectedTicket.status} />
              </div>
            </div>

            {/* Where & Who Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "1rem",
              }}
            >
              {/* Where: Community & Unit */}
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  background: "var(--surface, #f8fafc)",
                  border: "1px solid var(--border, #e2e8f0)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    marginBottom: "0.4rem",
                  }}
                >
                  🏢 Where (Community & Unit)
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                  {selectedTicket.community_name ||
                    communities?.find((c) => c.id === selectedTicket.community_id)?.name ||
                    "Community"}
                </div>
                <div style={{ fontSize: "0.825rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                  {selectedTicket.unit_number ? `Unit ${selectedTicket.unit_number}` : "Common Area"}
                </div>
              </div>

              {/* Who: Complainant */}
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  background: "var(--surface, #f8fafc)",
                  border: "1px solid var(--border, #e2e8f0)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    marginBottom: "0.4rem",
                  }}
                >
                  👤 Who (Complainant)
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                  {selectedTicket.raised_by_name || "Resident"}
                </div>
                <div style={{ fontSize: "0.825rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                  {selectedTicket.raised_by_phone && (
                    <div>📞 {selectedTicket.raised_by_phone}</div>
                  )}
                  {selectedTicket.raised_by_email && (
                    <div>✉️ {selectedTicket.raised_by_email}</div>
                  )}
                  {!selectedTicket.raised_by_phone && !selectedTicket.raised_by_email && (
                    <div>No direct contact registered</div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedTicket.description && (
              <div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Description
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    padding: "0.75rem",
                    background: "var(--surface, #f8fafc)",
                    borderRadius: "6px",
                  }}
                >
                  {selectedTicket.description}
                </p>
              </div>
            )}

            {/* Metadata & Dates */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "0.75rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--border)",
                fontSize: "0.8rem",
              }}
            >
              <div>
                <span style={{ color: "var(--muted)" }}>Created: </span>
                <span style={{ fontWeight: 500 }}>{formatDate(selectedTicket.created_at)}</span>
              </div>
              {selectedTicket.resolved_at && (
                <div>
                  <span style={{ color: "var(--muted)" }}>Resolved: </span>
                  <span style={{ fontWeight: 500 }}>{formatDate(selectedTicket.resolved_at)}</span>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
