"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";

interface SecurityIncident {
  id: string;
  incident_number: string;
  title: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  assigned_guard: string;
  reported_time: string;
  status: "Reported" | "Assigned" | "Investigating" | "Action Taken" | "Resolved" | "Closed";
}

export default function SecuritySupervisorIncidentsPage() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([
    {
      id: "inc-s1",
      incident_number: "SEC-801",
      title: "Unauthorized Perimeter Fence Crossing near Gate B",
      severity: "Critical",
      assigned_guard: "Guard Vikram Singh",
      reported_time: "2026-09-03 09:10",
      status: "Investigating",
    },
    {
      id: "inc-s2",
      incident_number: "SEC-802",
      title: "Tailgating Attempt at Main Gate North",
      severity: "High",
      assigned_guard: "Guard Somnath Patil",
      reported_time: "2026-09-03 08:20",
      status: "Action Taken",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<"Low" | "Medium" | "High" | "Critical">("High");
  const [assignedGuard, setAssignedGuard] = useState("Guard Somnath Patil");

  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const newInc: SecurityIncident = {
      id: `inc-s-${Date.now()}`,
      incident_number: `SEC-${Math.floor(Math.random() * 900 + 100)}`,
      title,
      severity,
      assigned_guard: assignedGuard,
      reported_time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "Reported",
    };
    setIncidents([newInc, ...incidents]);
    setIsModalOpen(false);
    setTitle("");
  };

  const handleStatusChange = (id: string, status: any) => {
    setIncidents((prev) => prev.map((inc) => (inc.id === id ? { ...inc, status } : inc)));
  };

  return (
    <div>
      <PageHeader
        title="Security Incidents & Breach Response"
        subtitle="Log security breaches, assign security personnel, record corrective actions, and track investigation timeline"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Incidents" }]}
        actions={
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            ⚠️ Log Security Incident
          </button>
        }
      />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Security Breach & Incident Log</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Incident #</th>
                <th>Breach Summary</th>
                <th>Severity</th>
                <th>Assigned Responder</th>
                <th>Reported Time</th>
                <th>Investigation Status</th>
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
                  <td>{inc.assigned_guard}</td>
                  <td>{inc.reported_time}</td>
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
                      <option value="Reported">Reported</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Investigating">Investigating</option>
                      <option value="Action Taken">Action Taken</option>
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
        title="Log Security Incident"
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
              Incident / Breach Title *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Unattended Package at South Service Gate"
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
                Assign Responder Guard
              </label>
              <select
                className="select-field"
                value={assignedGuard}
                onChange={(e) => setAssignedGuard(e.target.value)}
              >
                <option value="Guard Somnath Patil">Guard Somnath Patil</option>
                <option value="Guard Vikram Singh">Guard Vikram Singh</option>
                <option value="Supervisor Devraj">Supervisor Devraj</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
