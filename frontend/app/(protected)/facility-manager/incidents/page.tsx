"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { incidentsApi } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Incident, IncidentType, IncidentSeverity, IncidentStatus } from "@/types/incidents";

// Real backend enums from backend/app/modules/incidents/models.py
const INCIDENT_TYPES: IncidentType[] = ["medical", "fire", "theft", "suspicious", "breach", "lift_entrapment", "assault", "natural", "other"] as IncidentType[];
const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const TERMINAL_STATUSES: IncidentStatus[] = ["closed", "false_alarm"];
const ACTION_TYPES = ["note", "dispatch", "escalation", "authority_contacted", "evacuation", "medical_aid", "update"] as const;

// Valid transitions matching backend IncidentStatus state machine
const VALID_INCIDENT_TRANSITIONS: Record<string, IncidentStatus[]> = {
  reported: ["acknowledged", "false_alarm"],
  acknowledged: ["responding", "false_alarm"],
  responding: ["contained", "resolved", "false_alarm"],
  contained: ["resolved", "false_alarm"],
  resolved: ["closed"],
  closed: [],
  false_alarm: [],
};

export default function FacilityManagerIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [incidentType, setIncidentType] = useState<IncidentType>("other" as IncidentType);
  const [severity, setSeverity] = useState<IncidentSeverity>("high" as IncidentSeverity);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Log Action modal
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionIncidentId, setActionIncidentId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<string>("note");
  const [actionDetails, setActionDetails] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const loadIncidents = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await incidentsApi.list();
      setIncidents(
        (res || []).sort(
          (a: Incident, b: Incident) =>
            new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime(),
        ),
      );
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load incidents.");
    } finally {
      setIsLoading(false);
    }
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: IncidentStatus) => {
    try {
      await incidentsApi.transition(id, { status: newStatus });
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === id ? { ...inc, status: newStatus } : inc)),
      );
    } catch (err: any) {
      alert(err?.message || "Failed to update incident status.");
    }
  };

  const openActionModal = (incidentId: string) => {
    setActionIncidentId(incidentId);
    setActionType("note");
    setActionDetails("");
    setIsActionModalOpen(true);
  };

  const handleLogAction = async () => {
    if (!actionIncidentId) return;
    setIsSubmittingAction(true);
    try {
      await incidentsApi.addAction(actionIncidentId, { action_type: actionType, details: actionDetails || undefined });
      setIsActionModalOpen(false);
    } catch (err: any) {
      alert(err?.message || "Failed to log action.");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const filtered = incidents.filter((inc) => {
    const q = search.toLowerCase();
    const matchSearch =
      inc.incident_number?.toLowerCase().includes(q) ||
      (inc.description || "").toLowerCase().includes(q) ||
      (inc.location_text || "").toLowerCase().includes(q);
    const matchType = typeFilter === "all" || inc.incident_type === typeFilter;
    const matchSeverity = severityFilter === "all" || inc.severity === severityFilter;
    return matchSearch && matchType && matchSeverity;
  });

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
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Operational Incident Logs</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>{filtered.length} incidents</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 220 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search incident #, description…"
              />
            </div>
            <select
              className="select-field"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Types</option>
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              className="select-field"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Severities</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
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
                    style={{ textAlign: "center", padding: "2rem", color: "var(--danger, #dc2626)" }}
                  >
                    {loadError}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No incidents found.
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => (
                  <tr key={inc.id}>
                    <td style={{ fontWeight: 600 }}>{inc.incident_number}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {inc.incident_type.replace(/_/g, " ")}
                    </td>
                    <td>
                      <StatusBadge status={inc.severity} />
                    </td>
                    <td>{inc.location_text || "—"}</td>
                    <td>{formatDate(inc.reported_at)}</td>
                    <td>
                      <StatusBadge status={inc.status} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                        {TERMINAL_STATUSES.includes(inc.status as IncidentStatus) ? (
                          <StatusBadge status={inc.status} />
                        ) : (
                          <select
                            className="select-field"
                            value={inc.status}
                            onChange={(e) => handleStatusChange(inc.id, e.target.value as IncidentStatus)}
                            style={{ height: 28, fontSize: "0.75rem" }}
                          >
                            <option value={inc.status}>{inc.status.replace(/_/g, " ")}</option>
                            {(VALID_INCIDENT_TRANSITIONS[inc.status] || []).map((s) => (
                              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                            ))}
                          </select>
                        )}
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: "0.72rem", padding: "0.15rem 0.4rem", height: 28 }}
                          onClick={() => openActionModal(inc.id)}
                        >
                          + Action
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Action Modal */}
      <Modal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        title="Log Corrective Action"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsActionModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleLogAction} disabled={isSubmittingAction}>
              {isSubmittingAction ? "Logging…" : "Log Action"}
            </button>
          </>
        }
      >
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>Action Type</label>
            <select className="select-field" value={actionType} onChange={(e) => setActionType(e.target.value)}>
              {ACTION_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>Details</label>
            <textarea className="input-field" style={{ minHeight: 70 }} placeholder="Describe the action taken…" value={actionDetails} onChange={(e) => setActionDetails(e.target.value)} />
          </div>
        </div>
      </Modal>

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
              type="submit"
              form="log-incident-form"
              disabled={isSubmitting || !description.trim()}
            >
              {isSubmitting ? "Logging…" : "Log Incident"}
            </button>
          </>
        }
      >
        <form id="log-incident-form" onSubmit={handleCreateIncident}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}
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
                style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}
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
                style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}
              >
                Severity
              </label>
              <select
                className="select-field"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label
              style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}
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
