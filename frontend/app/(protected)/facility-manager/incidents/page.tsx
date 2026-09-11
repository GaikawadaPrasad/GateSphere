"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { incidentsApi } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { Incident, IncidentType, IncidentSeverity, IncidentStatus } from "@/types/incidents";

// Real backend enum (backend/app/modules/incidents/models.py)
const INCIDENT_TYPES: IncidentType[] = [
  "medical",
  "fire",
  "theft",
  "suspicious",
  "breach",
  "other",
];
const INCIDENT_STATUSES: IncidentStatus[] = [
  "reported",
  "acknowledged",
  "responding",
  "contained",
  "resolved",
  "closed",
  "false_alarm",
];

export default function FacilityManagerIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [incidentType, setIncidentType] = useState<IncidentType>("other");
  const [severity, setSeverity] = useState<IncidentSeverity>("high");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadIncidents = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await incidentsApi.list();
      setIncidents(res || []);
    } catch (err: any) {
      // NOTE: facility_manager does not currently hold incidents:view in the backend
      // RBAC seed (backend/app/core/rbac.py) — this will 403 until granted. See the
      // integration report for the exact permission gap.
      setLoadError(err?.message || "Failed to load incidents.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setIsSubmitting(true);
    try {
      await incidentsApi.create({
        incident_type: incidentType,
        severity,
        location_text: locationText || undefined,
        description,
      });
      setIsModalOpen(false);
      setDescription("");
      setLocationText("");
      loadIncidents();
    } catch (err: any) {
      alert(err?.message || "Failed to log incident.");
    }
    setIsSubmitting(false);
  };

  const handleStatusChange = async (id: string, newStatus: IncidentStatus) => {
    try {
      await incidentsApi.transition(id, { status: newStatus });
      loadIncidents();
    } catch (err: any) {
      alert(err?.message || "Failed to update incident status.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Facility Incidents"
        subtitle="Log operational incidents, record corrective actions, track severity and resolution"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Facility Manager" },
          { label: "Incidents" },
        ]}
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
                <th>Type</th>
                <th>Severity</th>
                <th>Location</th>
                <th>Reported</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading incidents…
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
              ) : incidents.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No incidents logged.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td style={{ fontWeight: 600 }}>{inc.incident_number}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {inc.incident_type.replace(/_/g, " ")}
                    </td>
                    <td>
                      <StatusBadge status={inc.severity} />
                    </td>
                    <td>{inc.location_text || "—"}</td>
                    <td>{formatDateTime(inc.reported_at)}</td>
                    <td>
                      <StatusBadge status={inc.status} />
                    </td>
                    <td>
                      <select
                        className="select-field"
                        value={inc.status}
                        onChange={(e) =>
                          handleStatusChange(inc.id, e.target.value as IncidentStatus)
                        }
                        style={{ height: 28, fontSize: "0.75rem" }}
                      >
                        {INCIDENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
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
            <button
              className="btn btn-primary"
              onClick={handleCreateIncident}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Logging…" : "Log Incident"}
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
              Description *
            </label>
            <textarea
              className="input-field"
              style={{ minHeight: 70 }}
              placeholder="e.g. Main transformer oil pressure warning"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                Type
              </label>
              <select
                className="select-field"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
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
                Severity
              </label>
              <select
                className="select-field"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Specific Location
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Substation Room 1"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
