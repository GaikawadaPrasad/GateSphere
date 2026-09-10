"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { visitorsApi, type VisitorRecord } from "@/lib/api";

export default function SecuritySupervisorVisitorManagementPage() {
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

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
      // fallback
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await visitorsApi.approve(id, "Approved by Security Supervisor");
      setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: "Approved" } : v)));
    } catch (err: any) {
      alert(err?.message || "Failed to approve visitor request.");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await visitorsApi.reject(id, "Rejected by Security Supervisor");
      setVisitors((prev) => prev.map((v) => (v.id === id ? { ...v, status: "Rejected" } : v)));
    } catch (err: any) {
      alert(err?.message || "Failed to reject visitor request.");
    }
  };

  const filteredVisitors = visitors.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.phone && v.phone.toLowerCase().includes(search.toLowerCase())) ||
      (v.pass_code && v.pass_code.toLowerCase().includes(search.toLowerCase()));
    const matchStatus =
      statusFilter === "all" || v.status.toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <PageHeader
        title="Visitor Lifecycle Management"
        subtitle="Review visitor access requests, pass verifications, pending approvals, and historical entry logs"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Visitor Management" },
        ]}
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

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pass Code</th>
                <th>Visitor Name</th>
                <th>Contact Phone</th>
                <th>Type</th>
                <th>Destination Unit</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading visitors…
                  </td>
                </tr>
              ) : filteredVisitors.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No visitor records found.
                  </td>
                </tr>
              ) : (
                filteredVisitors.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, fontFamily: "monospace" }}>{v.pass_code}</td>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{v.name}</td>
                    <td>{v.phone}</td>
                    <td>{v.type}</td>
                    <td>{v.unit}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>
                      {v.status === "Pending Approval" ? (
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleApprove(v.id)}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleReject(v.id)}
                          >
                            Reject
                          </button>
                        </div>
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
