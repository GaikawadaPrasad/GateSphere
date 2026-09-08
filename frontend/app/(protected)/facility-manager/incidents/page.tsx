"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";

interface OperationalIncident {
  id: string;
  incident_number: string;
  title: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  location: string;
  reported_at: string;
  assigned_to: string;
  status: "Open" | "Investigating" | "Action In Progress" | "Resolved" | "Closed";
}

export default function FacilityManagerIncidentsPage() {
  const [incidents, setIncidents] = useState<OperationalIncident[]>([
    {
      id: "inc-1",
      incident_number: "INC-901",
      title: "Basement Parking B2 Water Pipe Burst",
      severity: "Critical",
      location: "Basement B2 Pillar 14",
      reported_at: "2026-09-03 07:45",
      assigned_to: "Alexander Wright (Facility Mgr)",
      status: "Action In Progress",
    },
    {
      id: "inc-2",
      incident_number: "INC-902",
      title: "Main Gate CCTV Camera 3 Signal Loss",
      severity: "Medium",
      location: "North Gate Entrance",
      reported_at: "2026-09-02 22:15",
      assigned_to: "Supervisor Devraj",
      status: "Investigating",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState<"Low" | "Medium" | "High" | "Critical">("High");

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const newInc: OperationalIncident = {
      id: `inc-${Date.now()}`,
      incident_number: `INC-${Math.floor(Math.random() * 900 + 100)}`,
      title,
      severity,
      location: location || "Facility Grounds",
      reported_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      assigned_to: "Alexander Wright",
      status: "Open",
    };
    setIncidents([newInc, ...incidents]);
    setIsModalOpen(false);
    setTitle("");
    setLocation("");
  };

  const handleStatusChange = (id: string, newStatus: any) => {
    setIncidents((prev) => prev.map((inc) => (inc.id === id ? { ...inc, status: newStatus } : inc)));
  };

  return (
    <div>
      <PageHeader
        title="Facility Incidents"
        subtitle="Log operational incidents, record corrective actions, track severity and resolution"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Incidents" }]}
        actions={
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            ⚠️ Log Facility Incident
          </button>
        }
      />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Operational Incident Logs</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Incident #</th>
                <th>Title / Summary</th>
                <th>Severity</th>
                <th>Location</th>
                <th>Reported Time</th>
                <th>Assigned Responder</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id}>
                  <td style={{ fontWeight: 600 }}>{inc.incident_number}</td>
                  <td style={{ fontWeight: 500, color: "var(--fg)" }}>{inc.title}</td>
                  <td>
                    <StatusBadge status={inc.severity} />
                  </td>
                  <td>{inc.location}</td>
                  <td>{inc.reported_at}</td>
                  <td>{inc.assigned_to}</td>
                  <td>
                    <StatusBadge status={inc.status} />
                  </td>
                  <td>
                    <select
                      className="select-field"
                      value={inc.status}
                      onChange={(e) => handleStatusChange(inc.id, e.target.value)}
                      style={{ height: 28, fontSize: "0.75rem" }}
                    >
                      <option value="Open">Open</option>
                      <option value="Investigating">Investigating</option>
                      <option value="Action In Progress">Action In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Incident Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log New Operational Incident"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateIncident}>
              Log Incident
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateIncident}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Incident Title *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Main Transformer Oil Pressure Warning"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Severity
              </label>
              <select
                className="select-field"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Specific Location
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Substation Room 1"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
