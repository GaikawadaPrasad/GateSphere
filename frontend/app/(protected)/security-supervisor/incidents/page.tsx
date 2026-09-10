"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { incidentsApi } from "@/lib/api";

interface SecurityIncident {
  id: string;
  incident_number: string;
  title: string;
  severity: string;
  assigned_guard: string;
  reported_time: string;
  status: string;
}

export default function SecuritySupervisorIncidentsPage() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<any>("high");
  const [incidentType, setIncidentType] = useState<any>("breach");
  const [locationText, setLocationText] = useState("Main Gate Perimeter");
  const [assignedGuard, setAssignedGuard] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await incidentsApi.list();
      setIncidents(
        (data || []).map((inc: any) => ({
          id: inc.id,
          incident_number: inc.incident_number || `INC-${inc.id.slice(0, 6).toUpperCase()}`,
          title: inc.description || "Security Incident",
          severity: inc.severity
            ? inc.severity.replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "High",
          assigned_guard: inc.responder_user_id
            ? `Responder (${inc.responder_user_id.slice(0, 6)})`
            : "Duty Security Team",
          reported_time: inc.reported_at
            ? new Date(inc.reported_at).toLocaleString([], {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "Recent",
          status: inc.status
            ? inc.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "Reported",
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

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await incidentsApi.create({
        incident_type: incidentType,
        severity,
        location_text: locationText,
        description: title.trim(),
      });
      setIsModalOpen(false);
      setTitle("");
      setAssignedGuard("");
      loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to log security incident.");
    }
    setIsSubmitting(false);
  };

  const handleStatusChange = (id: string, status: any) => {
    setIncidents((prev) => prev.map((inc) => (inc.id === id ? { ...inc, status } : inc)));
  };

  return (
    <div>
      <PageHeader
        title="Security Incidents & Breach Response"
        subtitle="Log security breaches, assign security personnel, record corrective actions, and track investigation timeline"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Incidents" },
        ]}
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
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
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
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
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
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
                Assigned Responder
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter responder name"
                value={assignedGuard}
                onChange={(e) => setAssignedGuard(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
