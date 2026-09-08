"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { maintenanceApi, vendorsApi, type MaintenanceRecord, type Vendor } from "@/lib/api";

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  Scheduled: ["Vendor Assigned", "In Progress", "Cancelled"],
  "Vendor Assigned": ["In Progress", "Cancelled"],
  "In Progress": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export default function FacilityManagerMaintenancePage() {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);

  // Form fields
  const [facilityName, setFacilityName] = useState("");
  const [category, setCategory] = useState("Preventive");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Emergency">("Medium");
  const [scheduledDate, setScheduledDate] = useState("");
  const [selectedVendorName, setSelectedVendorName] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    const [recData, venData] = await Promise.all([maintenanceApi.list(), vendorsApi.list()]);
    setRecords(recData);
    setVendors(venData);
    if (venData.length > 0) setSelectedVendorName(venData[0].name);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityName.trim()) return;
    await maintenanceApi.create({
      facility_name: facilityName,
      category,
      priority,
      scheduled_date: scheduledDate || new Date().toISOString().split("T")[0],
    });
    setIsCreateModalOpen(false);
    setFacilityName("");
    loadData();
  };

  const handleStatusTransition = async (recordId: string, currentStatus: string, newStatus: string) => {
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      alert(`Invalid status transition from ${currentStatus} to ${newStatus}`);
      return;
    }
    await maintenanceApi.updateStatus(recordId, newStatus);
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, status: newStatus as any } : r))
    );
  };

  const handleAssignVendor = async () => {
    if (!selectedRecord || !selectedVendorName) return;
    await maintenanceApi.assignVendor(selectedRecord.id, selectedVendorName);
    await maintenanceApi.updateStatus(selectedRecord.id, "Vendor Assigned");
    setIsAssignModalOpen(false);
    loadData();
  };

  const filteredRecords = records.filter((r) => {
    const matchSearch =
      r.maintenance_id.toLowerCase().includes(search.toLowerCase()) ||
      r.facility_name.toLowerCase().includes(search.toLowerCase()) ||
      r.vendor_name.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || r.priority === priorityFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchPriority && matchStatus;
  });

  return (
    <div>
      <PageHeader
        title="Maintenance Management"
        subtitle="Schedule preventive maintenance, dispatch vendors, and record completion workflows"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Maintenance" }]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(true)}>
              ➕ Schedule Maintenance
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                setPriority("Emergency");
                setIsCreateModalOpen(true);
              }}
            >
              🚨 Emergency Maintenance
            </button>
          </div>
        }
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
              <SearchInput value={search} onChange={setSearch} placeholder="Search ID/facility/vendor…" />
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
              <option value="Emergency">Emergency</option>
            </select>

            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Vendor Assigned">Vendor Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Maintenance ID</th>
                <th>Facility</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Assigned Vendor</th>
                <th>Scheduled Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading maintenance records…
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No maintenance records found.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const allowedTransitions = VALID_STATUS_TRANSITIONS[r.status] || [];
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.maintenance_id}</td>
                      <td style={{ fontWeight: 500, color: "var(--fg)" }}>{r.facility_name}</td>
                      <td>{r.category}</td>
                      <td>
                        <StatusBadge status={r.priority} />
                      </td>
                      <td>{r.vendor_name || "Unassigned"}</td>
                      <td>{r.scheduled_date}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          {r.status !== "Completed" && r.status !== "Cancelled" && (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem", height: 26 }}
                              onClick={() => {
                                setSelectedRecord(r);
                                setIsAssignModalOpen(true);
                              }}
                            >
                              Assign Vendor
                            </button>
                          )}
                          {allowedTransitions.map((nextSt) => (
                            <button
                              key={nextSt}
                              className={nextSt === "Completed" ? "btn btn-primary" : "btn btn-secondary"}
                              style={{ fontSize: "0.75rem", padding: "0.2rem 0.45rem", height: 26 }}
                              onClick={() => handleStatusTransition(r.id, r.status, nextSt)}
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

      {/* Schedule Maintenance Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule Facility Maintenance"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateMaintenance}>
              Create Maintenance Ticket
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateMaintenance}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Facility Name *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Swimming Pool Filter Plant"
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Maintenance Category
              </label>
              <select className="select-field" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Preventive">Preventive</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Priority
              </label>
              <select
                className="select-field"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Scheduled Date
            </label>
            <input
              type="date"
              className="input-field"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Assign Vendor Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Vendor to ${selectedRecord?.maintenance_id}`}
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
            Select a verified vendor to assign to <strong>{selectedRecord?.facility_name}</strong>:
          </p>
          <select
            className="select-field"
            value={selectedVendorName}
            onChange={(e) => setSelectedVendorName(e.target.value)}
          >
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
