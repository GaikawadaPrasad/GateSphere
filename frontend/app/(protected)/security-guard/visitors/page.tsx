"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { visitorsApi } from "@/lib/api";

interface VisitorRow {
  id: string;
  name: string;
  phone: string;
  visitorType: string;
  status: string;
  entryId?: string;
}

export default function SecurityGuardVisitorsPage() {
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [requests, directory, entries] = await Promise.all([
        visitorsApi.requests(),
        visitorsApi.directory(),
        visitorsApi.entries(),
      ]);
      const visitorMap = new Map<string, any>();
      for (const v of directory || []) if ((v as any)?.id) visitorMap.set((v as any).id, v);
      const openEntryByRequest = new Map<string, any>();
      for (const e of entries || []) {
        if ((e as any).request_id && !(e as any).exit_at)
          openEntryByRequest.set((e as any).request_id, e);
      }

      setVisitors(
        (requests || []).map((r: any) => {
          const visitor = visitorMap.get(r.visitor_id);
          const openEntry = openEntryByRequest.get(r.id);
          return {
            id: r.id,
            name: visitor?.full_name || "Visitor",
            phone: visitor?.phone || "—",
            visitorType: (r.visitor_type as string)?.replace(/_/g, " ") || "guest",
            status: r.status,
            entryId: openEntry?.id,
          };
        }),
      );
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load visitors.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkEntry = async (v: VisitorRow) => {
    setActionMessage(null);
    try {
      await visitorsApi.recordEntry({ request_id: v.id });
      setActionMessage({ type: "success", text: `Entry recorded for ${v.name}` });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to record entry." });
    }
  };

  const handleMarkExit = async (v: VisitorRow) => {
    if (!v.entryId) return;
    setActionMessage(null);
    try {
      await visitorsApi.recordExit(v.entryId);
      setActionMessage({ type: "success", text: `Exit recorded for ${v.name}` });
      loadData();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to record exit." });
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    const q = search.toLowerCase();
    return v.name.toLowerCase().includes(q) || v.visitorType.toLowerCase().includes(q) || v.phone.includes(q);
  });

  const columns: Column<VisitorRow>[] = [
    {
      key: "name",
      header: "Visitor Name",
      sortable: true,
      render: (v) => <span style={{ fontWeight: 600, color: "var(--fg)" }}>👤 {v.name}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      sortable: true,
      render: (v) => <span style={{ fontFamily: "monospace" }}>{v.phone}</span>,
    },
    {
      key: "visitorType",
      header: "Type",
      sortable: true,
      render: (v) => <span style={{ textTransform: "capitalize" }}>{v.visitorType}</span>,
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
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          {v.status === "approved" ? (
            <button
              className="btn btn-primary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
              onClick={() => handleMarkEntry(v)}
            >
              Mark Entry
            </button>
          ) : v.status === "entered" && v.entryId ? (
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
              onClick={() => handleMarkExit(v)}
            >
              Mark Exit
            </button>
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
        title="Visitor Gate Verification"
        subtitle="Review resident-approved visitor requests, and log visitor gate entry / exit"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Visitors" }]}
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

      {loadError && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            borderRadius: "var(--radius)",
            background: "var(--danger-light)",
            border: "1px solid var(--danger-border)",
            color: "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>⚠️ {loadError}</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
            onClick={loadData}
          >
            Retry
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Today&apos;s Visitors</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredVisitors.length} visitors registered
            </p>
          </div>

          <div style={{ width: "100%", maxWidth: 240 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search name/type/phone…" />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredVisitors}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Visitor Requests Found"
          emptyDescription="There are currently no visitor entry requests matching your search."
          emptyIcon="👥"
        />
      </div>
    </div>
  );
}
