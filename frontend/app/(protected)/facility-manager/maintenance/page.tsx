"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { maintenanceApi, complaintsApi } from "@/lib/api";
import { deriveTicketEscalationState, formatDate } from "@/lib/utils";

interface MaintenanceTicket {
  id: string;
  ticket_number: string;
  subject: string;
  category_name: string;
  priority: string;
  status: string;
  escalation_state: string;
  created_at: string;
}

// Real backend enum (backend/app/modules/complaints/models.py TICKET_STATUS)
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  created: ["assigned", "cancelled"],
  assigned: ["acknowledged", "in_progress", "cancelled"],
  acknowledged: ["in_progress", "cancelled"],
  in_progress: ["resolved", "cancelled"],
  resolved: ["closed", "reopened"],
  reopened: ["assigned", "in_progress"],
  closed: [],
  cancelled: [],
};

export default function FacilityManagerMaintenancePage() {
  const [records, setRecords] = useState<MaintenanceTicket[]>([]);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceTicket | null>(null);
  const [vendorName, setVendorName] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [tickets, categories] = await Promise.all([
        maintenanceApi.list(),
        complaintsApi.categories(),
      ]);
      const categoryMap = new Map<string, string>();
      for (const c of categories || []) if (c?.id) categoryMap.set(c.id, c.name);
      setRecords(
        (tickets || []).map((t: any) => ({
          id: t.id,
          ticket_number: t.ticket_number,
          subject: t.subject,
          category_name: categoryMap.get(t.category_id) || "Uncategorized",
          priority: t.priority,
          status: t.status,
          escalation_state: deriveTicketEscalationState(t),
          created_at: t.created_at,
        }))
      );
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load maintenance tickets.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusTransition = async (recordId: string, currentStatus: string, newStatus: string) => {
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      alert(`Invalid status transition from ${currentStatus} to ${newStatus}`);
      return;
    }
    try {
      await maintenanceApi.updateStatus(recordId, newStatus);
      setRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, status: newStatus } : r)));
    } catch (err: any) {
      alert(err?.message || "Failed to update status.");
    }
  };

  const handleAssignVendor = async () => {
    if (!selectedRecord || !vendorName.trim()) return;
    try {
      await maintenanceApi.assignVendor(selectedRecord.id, vendorName.trim());
      setIsAssignModalOpen(false);
      setVendorName("");
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to assign vendor.");
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchSearch =
      r.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase()) ||
      r.category_name.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || r.priority === priorityFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchPriority && matchStatus;
  });

  return (
    <div>
      <PageHeader
        title="Maintenance Tickets"
        subtitle="Real-time service tickets for plumbing, electrical, lifts and housekeeping — assign vendors and track resolution"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Maintenance" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Maintenance Records & Tickets</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredRecords.length} records found
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 220 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Search ticket #, subject, category…" />
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Statuses</option>
              {Object.keys(VALID_STATUS_TRANSITIONS).map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
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
                <th>SLA</th>
                <th>Raised</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading maintenance tickets…
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--danger, #dc2626)" }}>
                    {loadError}
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No maintenance tickets found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const allowedTransitions = VALID_STATUS_TRANSITIONS[r.status] || [];
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
                      <td>{formatDate(r.created_at)}</td>
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
                                setSelectedRecord(r);
                                setVendorName("");
                                setIsAssignModalOpen(true);
                              }}
                            >
                              Assign Vendor
                            </button>
                          )}
                          {allowedTransitions.map((nextSt) => (
                            <button
                              key={nextSt}
                              className={nextSt === "resolved" ? "btn btn-primary" : "btn btn-secondary"}
                              style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem", height: 26, textTransform: "capitalize" }}
                              onClick={() => handleStatusTransition(r.id, r.status, nextSt)}
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
        title={`Assign Vendor to ${selectedRecord?.ticket_number || ""}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAssignVendor} disabled={!vendorName.trim()}>
              Confirm Assignment
            </button>
          </>
        }
      >
        <div>
          <p style={{ marginBottom: "1rem", fontSize: "0.875rem" }}>
            Enter the vendor or contractor name to assign to <strong>{selectedRecord?.subject}</strong>:
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
