"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
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
        if ((e as any).request_id && !(e as any).exit_at) openEntryByRequest.set((e as any).request_id, e);
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
        })
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
    try {
      await visitorsApi.recordEntry({ request_id: v.id });
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to record entry.");
    }
  };

  const handleMarkExit = async (v: VisitorRow) => {
    if (!v.entryId) return;
    try {
      await visitorsApi.recordExit(v.entryId);
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to record exit.");
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    const q = search.toLowerCase();
    return v.name.toLowerCase().includes(q) || v.visitorType.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Visitor Gate Verification"
        subtitle="Review resident-approved visitor requests, and log visitor gate entry / exit"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Visitors" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Today&apos;s Visitors</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredVisitors.length} visitors
            </p>
          </div>

          <div style={{ width: 220 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search name/type…" />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Visitor Name</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading visitors…
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--danger, #dc2626)" }}>
                    {loadError}
                  </td>
                </tr>
              ) : filteredVisitors.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No visitor requests found.
                  </td>
                </tr>
              ) : (
                filteredVisitors.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{v.name}</td>
                    <td>{v.phone}</td>
                    <td style={{ textTransform: "capitalize" }}>{v.visitorType}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>
                      {v.status === "approved" ? (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          onClick={() => handleMarkEntry(v)}
                        >
                          Mark Entry
                        </button>
                      ) : v.status === "entered" && v.entryId ? (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          onClick={() => handleMarkExit(v)}
                        >
                          Mark Exit
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
