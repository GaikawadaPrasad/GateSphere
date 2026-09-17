"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SearchInput } from "@/components/forms/SearchInput";
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
  const pageSize = 15;

  useEffect(() => {
    setCommunityId(activeCommunityId || "");
    setPage(1);
  }, [activeCommunityId]);

  const { data: communities } = useCommunities();
  const { data: tickets, isLoading } = useComplaints({
    community_id: communityId || undefined,
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
      key: "raised_by_name",
      header: "Raised By (Complainant)",
      render: (t) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--fg)" }}>
            {t.raised_by_name || "Resident"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {t.unit_number ? `Unit ${t.unit_number}` : "–"}
            {t.raised_by_phone
              ? ` · 📞 ${t.raised_by_phone}`
              : t.raised_by_email
                ? ` · ✉️ ${t.raised_by_email}`
                : ""}
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
              <SearchInput value={search} onChange={setSearch} placeholder="Search tickets…" />
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
          emptyTitle="No complaints found"
          emptyDescription="There are no tickets matching your current filter."
        />
      </div>
    </div>
  );
}
