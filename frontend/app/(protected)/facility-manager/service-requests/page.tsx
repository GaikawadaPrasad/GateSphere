"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { serviceRequestsApi, vendorsApi, type ServiceRequest, type Vendor } from "@/lib/api";

const VALID_REQUEST_TRANSITIONS: Record<string, string[]> = {
  Created: ["Assigned", "In Progress", "Closed"],
  Assigned: ["Acknowledged", "In Progress", "Closed"],
  Acknowledged: ["In Progress", "Resolved"],
  "In Progress": ["Resolved", "Closed"],
  Resolved: ["Closed"],
  Closed: [],
};

export default function FacilityManagerServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ServiceRequest | null>(null);
  const [selectedVendor, setSelectedVendor] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    const [reqs, vens] = await Promise.all([serviceRequestsApi.list(), vendorsApi.list()]);
    setRequests(reqs);
    setVendors(vens);
    if (vens.length > 0) setSelectedVendor(vens[0].name);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (id: string, currentStatus: string, nextStatus: string) => {
    const allowed = VALID_REQUEST_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      alert(`Invalid workflow transition from ${currentStatus} to ${nextStatus}`);
      return;
    }
    await serviceRequestsApi.updateStatus(id, nextStatus);
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus as any } : r)));
  };

  const handleAssignVendor = async () => {
    if (!selectedTicket || !selectedVendor) return;
    await serviceRequestsApi.assignVendor(selectedTicket.id, selectedVendor);
    await serviceRequestsApi.updateStatus(selectedTicket.id, "Assigned");
    setIsAssignModalOpen(false);
    loadData();
  };

  const filteredRequests = requests.filter((r) => {
    const matchSearch =
      r.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.category.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || r.priority === priorityFilter;
    const matchSla = slaFilter === "all" || r.sla_status === slaFilter;
    return matchSearch && matchPriority && matchSla;
  });

  return (
    <div>
      <PageHeader
        title="Service Requests Triage"
        subtitle="Manage resident & facility service tickets, SLA warnings, and vendor assignments"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Service Requests" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">All Service Tickets</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredRequests.length} tickets listed
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 220 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search ticket/title/category…" />
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

            <select
              className="select-field"
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All SLA Statuses</option>
              <option value="On Track">On Track</option>
              <option value="At Risk">At Risk</option>
              <option value="Breached">Breached</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Title / Issue</th>
                <th>Category</th>
                <th>Priority</th>
                <th>SLA Status</th>
                <th>Assigned Vendor</th>
                <th>Ticket Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading service requests…
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No service requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => {
                  const allowed = VALID_REQUEST_TRANSITIONS[r.status] || [];
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.ticket_number}</td>
                      <td style={{ fontWeight: 500, color: "var(--fg)" }}>{r.title}</td>
                      <td>{r.category}</td>
                      <td>
                        <StatusBadge status={r.priority} />
                      </td>
                      <td>
                        <StatusBadge status={r.sla_status} />
                      </td>
                      <td>{r.assigned_vendor || "Unassigned"}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          {r.status !== "Closed" && (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem", height: 26 }}
                              onClick={() => {
                                setSelectedTicket(r);
                                setIsAssignModalOpen(true);
                              }}
                            >
                              Assign Vendor
                            </button>
                          )}
                          {allowed.map((nextSt) => (
                            <button
                              key={nextSt}
                              className={nextSt === "Resolved" ? "btn btn-primary" : "btn btn-secondary"}
                              style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem", height: 26 }}
                              onClick={() => handleStatusChange(r.id, r.status, nextSt)}
                            >
                              {nextSt}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Vendor Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Vendor to Ticket ${selectedTicket?.ticket_number}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAssignVendor}>
              Confirm Assignment
            </button>
          </>
        }
      >
        <div>
          <p style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
            Select vendor to resolve <strong>{selectedTicket?.title}</strong>:
          </p>
          <select className="select-field" value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)}>
            {vendors.map((v) => (
              <option key={v.id} value={v.name}>
                {v.name} ({v.category}) — Rating: {v.rating}★
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
