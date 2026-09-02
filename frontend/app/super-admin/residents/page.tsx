"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { residentsApi } from "@/lib/api";
import { useCommunities } from "@/hooks/use-communities";
import type { ResidentProfile } from "@/types/residents";

export default function ResidentsPage() {
  const [search, setSearch] = useState("");
  const [communityId, setCommunityId] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data: communities } = useCommunities();

  const { data: residents, isLoading } = useQuery({
    queryKey: ["residents", "list", { page, page_size: pageSize, community_id: communityId }],
    queryFn: () => residentsApi.list({ page, page_size: pageSize, community_id: communityId || undefined }),
  });

  const columns: Column<ResidentProfile>[] = [
    {
      key: "full_name",
      header: "Resident Name",
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--fg)" }}>{r.full_name}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{r.email || r.phone || "No contact"}</div>
        </div>
      ),
    },
    {
      key: "resident_type",
      header: "Role / Type",
      align: "center",
      render: (r) => (
        <span className="badge badge-primary" style={{ textTransform: "capitalize" }}>
          {r.resident_type?.replace(/_/g, " ") || "Resident"}
        </span>
      ),
    },
    {
      key: "unit_number",
      header: "Unit / Tower",
      align: "center",
      render: (r) => <span>{r.unit_number ? `Unit ${r.unit_number}` : "–"}</span>,
    },
    {
      key: "primary_occupant",
      header: "Primary Occupant",
      align: "center",
      render: (r) => <span>{r.primary_occupant ? "✅ Yes" : "No"}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (r) => <StatusBadge status={r.status || "active"} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Global Residents Directory"
        subtitle="View registered owners, tenants, and family occupants across communities"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Residents" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Resident Profiles</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {residents?.length || 0} residents listed
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 240 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search name or unit…" />
            </div>

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
              {communities?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={residents as unknown as Record<string, unknown>[]}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          total={residents?.length || 0}
          onPageChange={setPage}
          emptyTitle="No residents found"
          emptyDescription="There are no resident records matching your query."
        />
      </div>
    </div>
  );
}
