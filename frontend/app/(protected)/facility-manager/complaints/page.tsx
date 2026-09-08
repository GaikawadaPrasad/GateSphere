"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { complaintsApi, serviceRequestsApi, type ServiceRequest } from "@/lib/api";

export default function FacilityManagerComplaintsPage() {
  const [complaints, setComplaints] = useState<ServiceRequest[]>([]);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const data = await complaintsApi.list();
    setComplaints(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    await complaintsApi.updateStatus(id, status);
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: status as any } : c)));
  };

  const filteredComplaints = complaints.filter((c) => {
    const matchSearch =
      c.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || c.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  return (
    <div>
      <PageHeader
        title="Complaints Management & Escalations"
        subtitle="Review resident complaints, assign vendors/patrols, and track SLA escalations"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Complaints" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Resident Complaints Log</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredComplaints.length} active complaints
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 220 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search complaint/title…" />
            </div>

            <select
              className="select-field"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Complaint #</th>
                <th>Subject / Title</th>
                <th>Category</th>
                <th>Unit / Location</th>
                <th>Priority</th>
                <th>SLA Status</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading complaints…
                  </td>
                </tr>
              ) : filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No complaints found.
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.ticket_number}</td>
                    <td style={{ fontWeight: 500, color: "var(--fg)" }}>{c.title}</td>
                    <td>{c.category}</td>
                    <td>{c.unit || "Common Area"}</td>
                    <td>
                      <StatusBadge status={c.priority} />
                    </td>
                    <td>
                      <StatusBadge status={c.sla_status} />
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      {c.status !== "Closed" && (
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleStatusChange(c.id, "In Progress")}
                          >
                            Start Work
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem" }}
                            onClick={() => handleStatusChange(c.id, "Resolved")}
                          >
                            Resolve
                          </button>
                        </div>
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
