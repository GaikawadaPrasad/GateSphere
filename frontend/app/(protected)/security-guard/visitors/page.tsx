"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { visitorsApi, type VisitorRecord } from "@/lib/api";

export default function SecurityGuardVisitorsPage() {
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const data = await visitorsApi.list();
    setVisitors(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkEntry = (id: string) => {
    setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: "Inside" } : v)));
  };

  const handleMarkExit = (id: string) => {
    setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: "Exited" } : v)));
  };

  const filteredVisitors = visitors.filter((v) => {
    return (
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.pass_code.toLowerCase().includes(search.toLowerCase()) ||
      v.unit.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div>
      <PageHeader
        title="Visitor Gate Verification"
        subtitle="Search visitor passes, check resident approval status, and log visitor gate entry / exit"
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
            <SearchInput value={search} onChange={setSearch} placeholder="Search pass/name/unit…" />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pass Code</th>
                <th>Visitor Name</th>
                <th>Phone</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading visitors…
                  </td>
                </tr>
              ) : (
                filteredVisitors.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 700, fontFamily: "monospace" }}>{v.pass_code}</td>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{v.name}</td>
                    <td>{v.phone}</td>
                    <td>{v.unit}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>
                      {v.status === "Approved" || v.status === "Expected" ? (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          onClick={() => handleMarkEntry(v.id)}
                        >
                          Mark Entry
                        </button>
                      ) : v.status === "Inside" ? (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          onClick={() => handleMarkExit(v.id)}
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
