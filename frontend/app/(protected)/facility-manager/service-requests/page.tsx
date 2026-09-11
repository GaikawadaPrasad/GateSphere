"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { serviceRequestsApi, complaintsApi } from "@/lib/api";
import { deriveTicketEscalationState } from "@/lib/utils";

interface ServiceTicket {
  id: string;
  ticket_number: string;
  subject: string;
  category_name: string;
  priority: string;
  status: string;
  escalation_state: string;
}

// Real backend enum (backend/app/modules/complaints/models.py TICKET_STATUS)
const VALID_REQUEST_TRANSITIONS: Record<string, string[]> = {
  created: ["assigned", "cancelled"],
  assigned: ["acknowledged", "in_progress", "cancelled"],
  acknowledged: ["in_progress", "cancelled"],
  in_progress: ["resolved", "cancelled"],
  resolved: ["closed", "reopened"],
  reopened: ["assigned", "in_progress"],
  closed: [],
  cancelled: [],
};

export default function FacilityManagerServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceTicket[]>([]);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [vendorName, setVendorName] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [tickets, categories] = await Promise.all([
        serviceRequestsApi.list(),
        complaintsApi.categories(),
      ]);
      const categoryMap = new Map<string, string>();
      for (const c of categories || []) if (c?.id) categoryMap.set(c.id, c.name);
      setRequests(
        (tickets || []).map((t: any) => ({
          id: t.id,
          ticket_number: t.ticket_number,
          subject: t.subject,
          category_name: categoryMap.get(t.category_id) || "Uncategorized",
          priority: t.priority,
          status: t.status,
          escalation_state: deriveTicketEscalationState(t),
        })),
      );
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load service requests.");
    }
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
    try {
      await serviceRequestsApi.updateStatus(id, nextStatus);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)));
    } catch (err: any) {
      alert(err?.message || "Failed to update status.");
    }
  };

  const handleAssignVendor = async () => {
    if (!selectedTicket || !vendorName.trim()) return;
    try {
      await serviceRequestsApi.assignVendor(selectedTicket.id, vendorName.trim());
      setIsAssignModalOpen(false);
      setVendorName("");
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to assign vendor.");
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchSearch =
      r.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase()) ||
      r.category_name.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || r.priority === priorityFilter;
    const matchSla = slaFilter === "all" || r.escalation_state === slaFilter;
    return matchSearch && matchPriority && matchSla;
  });

  return (
    <div>
      <PageHeader
        title="Service Requests Triage"
        subtitle="Manage resident & facility service tickets, SLA warnings, and vendor assignments"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Facility Manager" },
          { label: "Service Requests" },
        ]}
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
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search ticket/subject/category…"
              />
            </div>

            <select
              className="select-field"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select
              className="select-field"
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All SLA Statuses</option>
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
              <option value="breached">Breached</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Priority</th>
                <th>SLA Status</th>
                <th>Ticket Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading service requests…
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "var(--danger, #dc2626)",
                    }}
                  >
                    {loadError}
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No service requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => {
                  const allowed = VALID_REQUEST_TRANSITIONS[r.status] || [];
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.ticket_number}</td>
                      <td style={{ fontWeight: 500, color: "var(--fg)" }}>{r.subject}</td>
                      <td>{r.category_name}</td>
                      <td>
                        <StatusBadge status={r.priority} />
                      </td>
                      <td>
                        <StatusBadge status={r.escalation_state} />
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          {r.status !== "closed" && r.status !== "cancelled" && (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem", height: 26 }}
                              onClick={() => {
                                setSelectedTicket(r);
                                setVendorName("");
                                setIsAssignModalOpen(true);
                              }}
                            >
                              Assign Vendor
                            </button>
                          )}
                          {allowed.map((nextSt) => (
                            <button
                              key={nextSt}
                              className={
                                nextSt === "resolved" ? "btn btn-primary" : "btn btn-secondary"
                              }
                              style={{
                                fontSize: "0.75rem",
                                padding: "0.2rem 0.45rem",
                                height: 26,
                                textTransform: "capitalize",
                              }}
                              onClick={() => handleStatusChange(r.id, r.status, nextSt)}
                            >
                              {nextSt.replace(/_/g, " ")}
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
        title={`Assign Vendor to Ticket ${selectedTicket?.ticket_number || ""}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAssignVendor}
              disabled={!vendorName.trim()}
            >
              Confirm Assignment
            </button>
          </>
        }
      >
        <div>
          <p style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
            Enter the vendor or contractor name to resolve{" "}
            <strong>{selectedTicket?.subject}</strong>:
          </p>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Apex Water Treatment Solutions"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
