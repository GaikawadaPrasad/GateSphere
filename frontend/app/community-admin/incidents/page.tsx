"use client";

import { useState } from "react";
import { useUiStore } from "@/store/ui";
import {
  useIncidents,
  useIncidentDetails,
  useIncidentHistory,
  useIncidentActions,
  useCreateIncident,
  useTransitionIncident,
  useAddIncidentAction,
} from "@/hooks/use-incidents";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterPanel } from "@/components/common/FilterPanel";
import { Modal } from "@/components/common/Modal";
import type {
  Incident,
  IncidentAction,
  IncidentHistory,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
} from "@/types/incidents";
import { formatDateTime } from "@/lib/utils";

const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  reported: ["acknowledged", "false_alarm"],
  acknowledged: ["responding", "false_alarm"],
  responding: ["contained", "resolved", "false_alarm"],
  contained: ["resolved", "responding"],
  resolved: ["closed", "responding"],
  closed: [],
  false_alarm: [],
};

export default function CommunityAdminIncidentsPage() {
  const { activeCommunityId } = useUiStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  // Queries
  const { data: incidents, isLoading: incidentsLoading, refetch: refetchIncidents } = useIncidents({
    community_id: activeCommunityId || undefined,
    incident_status: statusFilter || undefined,
    severity: severityFilter || undefined,
    q: searchTerm || undefined,
  });

  const { data: incidentDetail, refetch: refetchDetail } = useIncidentDetails(selectedIncidentId || undefined);
  const { data: history, refetch: refetchHistory } = useIncidentHistory(selectedIncidentId || undefined);
  const { data: actions, refetch: refetchActions } = useIncidentActions(selectedIncidentId || undefined);

  // Mutations
  const createIncident = useCreateIncident();
  const transitionIncident = useTransitionIncident();
  const addAction = useAddIncidentAction();

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [newIncidentForm, setNewIncidentForm] = useState<{
    incident_type: IncidentType;
    severity: IncidentSeverity;
    location_text: string;
    description: string;
  }>({
    incident_type: "suspicious",
    severity: "medium",
    location_text: "",
    description: "",
  });

  const [transitionStatus, setTransitionStatus] = useState<IncidentStatus>("acknowledged");
  const [transitionReason, setTransitionReason] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [newActionText, setNewActionText] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle Create Incident
  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await createIncident.mutateAsync({
        incident_type: newIncidentForm.incident_type,
        severity: newIncidentForm.severity,
        location_text: newIncidentForm.location_text ? newIncidentForm.location_text.trim() : undefined,
        description: newIncidentForm.description.trim(),
        community_id: activeCommunityId || undefined,
      });
      setIsCreateModalOpen(false);
      setNewIncidentForm({ incident_type: "suspicious", severity: "medium", location_text: "", description: "" });
      refetchIncidents();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to log incident");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Transition
  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentId) return;
    if (transitionStatus === "resolved" && !resolutionSummary.trim()) {
      setErrorMessage("A resolution summary is required when marking an incident as resolved.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await transitionIncident.mutateAsync({
        id: selectedIncidentId,
        payload: {
          status: transitionStatus,
          reason: transitionReason.trim() || undefined,
          resolution_summary: transitionStatus === "resolved" ? resolutionSummary.trim() : undefined,
        },
      });
      setIsTransitionModalOpen(false);
      setTransitionReason("");
      setResolutionSummary("");
      refetchIncidents();
      refetchDetail();
      refetchHistory();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Action Log
  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentId || !newActionText.trim()) return;
    try {
      await addAction.mutateAsync({
        id: selectedIncidentId,
        payload: {
          action_type: "note",
          details: newActionText.trim(),
        },
      });
      setNewActionText("");
      refetchActions();
    } catch (err) {
      console.error(err);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <span className="badge badge-danger">Critical 🚨</span>;
      case "high":
        return <span className="badge badge-warning">High</span>;
      case "medium":
        return <span className="badge badge-primary">Medium</span>;
      default:
        return <span className="badge badge-neutral">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "reported":
        return <span className="badge badge-danger">Reported</span>;
      case "acknowledged":
        return <span className="badge badge-warning">Acknowledged</span>;
      case "responding":
        return <span className="badge badge-primary">Responding</span>;
      case "contained":
        return <span className="badge badge-primary">Contained</span>;
      case "resolved":
        return <span className="badge badge-success">Resolved ✓</span>;
      case "closed":
        return <span className="badge badge-neutral">Closed</span>;
      case "false_alarm":
        return <span className="badge badge-neutral">False Alarm</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  // Table Columns
  const incidentColumns: Column<Incident>[] = [
    {
      key: "incident_number",
      header: "Incident #",
      render: (i) => <strong>{i.incident_number || i.id.slice(0, 8)}</strong>,
    },
    {
      key: "incident_type",
      header: "Type & Location",
      render: (i) => (
        <div>
          <strong style={{ textTransform: "capitalize" }}>{i.incident_type} Incident</strong>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>📍 {i.location_text || "Community Grounds"}</div>
        </div>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      render: (i) => getSeverityBadge(i.severity),
    },
    {
      key: "status",
      header: "Lifecycle Status",
      render: (i) => getStatusBadge(i.status),
    },
    {
      key: "reported_at",
      header: "Reported At",
      render: (i) => formatDateTime(i.reported_at || i.created_at),
    },
    {
      key: "actions",
      header: "Action",
      render: (i) => (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedIncidentId(i.id);
            setErrorMessage(null);
          }}
        >
          View Log →
        </button>
      ),
    },
  ];

  const currentAllowedTransitions = incidentDetail
    ? ALLOWED_TRANSITIONS[incidentDetail.status as IncidentStatus] || []
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <PageHeader
        title="Emergency &amp; Incident Logs"
        description="Community security incident tracking, escalation logs, action timelines, and resolution workflows."
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="btn btn-primary" onClick={() => { setErrorMessage(null); setIsCreateModalOpen(true); }}>
              🚨 Log Incident Report
            </button>
          </div>
        }
      />

      <FilterPanel
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search incident by type or location..."
        filterValue={severityFilter}
        onFilterChange={setSeverityFilter}
        filterLabel="Severity"
        filterOptions={[
          { label: "Critical 🚨", value: "critical" },
          { label: "High", value: "high" },
          { label: "Medium", value: "medium" },
          { label: "Low", value: "low" },
        ]}
        secondaryFilterValue={statusFilter}
        onSecondaryFilterChange={setStatusFilter}
        secondaryFilterLabel="Status"
        secondaryFilterOptions={[
          { label: "Reported", value: "reported" },
          { label: "Acknowledged", value: "acknowledged" },
          { label: "Responding", value: "responding" },
          { label: "Contained", value: "contained" },
          { label: "Resolved", value: "resolved" },
          { label: "Closed", value: "closed" },
        ]}
      />

      <DataTable
        columns={incidentColumns}
        data={incidents as (Incident & Record<string, unknown>)[]}
        isLoading={incidentsLoading}
        emptyTitle="No incidents found"
        emptyDescription="No safety, security, or facility incidents reported matching your query."
      />

      {/* Incident Detail & Timeline Modal */}
      <Modal
        isOpen={Boolean(selectedIncidentId)}
        onClose={() => setSelectedIncidentId(null)}
        title={incidentDetail ? `Incident: ${incidentDetail.incident_number || "Detail"}` : "Incident Detail"}
      >
        {incidentDetail && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {getSeverityBadge(incidentDetail.severity)}
                  {getStatusBadge(incidentDetail.status)}
                </div>
                {currentAllowedTransitions.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                    onClick={() => {
                      setErrorMessage(null);
                      setTransitionStatus(currentAllowedTransitions[0]);
                      setIsTransitionModalOpen(true);
                    }}
                  >
                    Update Lifecycle Status →
                  </button>
                )}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--fg)", marginTop: "0.5rem" }}>
                <strong>Type:</strong> <span style={{ textTransform: "capitalize" }}>{incidentDetail.incident_type}</span>
              </div>
              {incidentDetail.description && (
                <div style={{ fontSize: "0.85rem", color: "var(--fg)", marginTop: "0.3rem" }}>
                  <strong>Description:</strong> {incidentDetail.description}
                </div>
              )}
              {incidentDetail.resolution_summary && (
                <div style={{ fontSize: "0.85rem", color: "#065f46", marginTop: "0.3rem", background: "#ecfdf5", padding: "0.5rem", borderRadius: "var(--radius-sm)" }}>
                  <strong>Resolution Summary:</strong> {incidentDetail.resolution_summary}
                </div>
              )}
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.5rem" }}>
                📍 Location: {incidentDetail.location_text || "Community Grounds"} · Reported {formatDateTime(incidentDetail.reported_at || incidentDetail.created_at)}
              </div>
            </div>

            {/* Actions Timeline */}
            <div>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>📋 Actions Taken &amp; Investigation Log</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 180, overflowY: "auto", marginBottom: "0.75rem" }}>
                {actions && actions.length > 0 ? (
                  actions.map((act: IncidentAction) => (
                    <div key={act.id} style={{ padding: "0.5rem 0.75rem", background: "#ffffff", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "0.7rem" }}>
                        <span style={{ textTransform: "capitalize" }}>{act.action_type}</span>
                        <span>{formatDateTime(act.action_at || act.created_at)}</span>
                      </div>
                      <div style={{ color: "var(--fg)", marginTop: "0.2rem" }}>{act.details || "Action noted"}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>No action notes logged yet.</div>
                )}
              </div>

              {/* Add Action Input */}
              <form onSubmit={handleAddAction} style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Add investigation note or action taken..."
                  value={newActionText}
                  onChange={(e) => setNewActionText(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8rem" }} disabled={!newActionText.trim()}>
                  Post
                </button>
              </form>
            </div>

            {/* Lifecycle History */}
            <div>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>🕒 Lifecycle Status Transitions</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {history && history.length > 0 ? (
                  history.map((h: IncidentHistory) => (
                    <div key={h.id} style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      • Transitioned {h.old_status ? `from ${h.old_status} ` : ""}→ <strong style={{ textTransform: "capitalize" }}>{h.new_status}</strong> on {formatDateTime(h.changed_at || h.created_at)}
                      {h.reason && <span> ({h.reason})</span>}
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>No status changes recorded.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Log New Incident Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="🚨 Log Security Incident Report"
      >
        <form onSubmit={handleCreateIncident} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {errorMessage && (
            <div style={{ padding: "0.6rem 0.8rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-sm)", color: "#b91c1c", fontSize: "0.85rem" }}>
              {errorMessage}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Incident Category
              </label>
              <select
                className="select-field"
                value={newIncidentForm.incident_type}
                onChange={(e) => setNewIncidentForm({ ...newIncidentForm, incident_type: e.target.value as IncidentType })}
              >
                <option value="suspicious">Suspicious Activity</option>
                <option value="breach">Security Breach</option>
                <option value="theft">Theft / Burglary</option>
                <option value="fire">Fire Emergency</option>
                <option value="medical">Medical Emergency</option>
                <option value="vandalism">Vandalism</option>
                <option value="noise">Noise Disturbance</option>
                <option value="parking">Parking Violation</option>
                <option value="other">Other Incident</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Severity
              </label>
              <select
                className="select-field"
                value={newIncidentForm.severity}
                onChange={(e) => setNewIncidentForm({ ...newIncidentForm, severity: e.target.value as IncidentSeverity })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical 🚨</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Location Text
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Tower B Basement Parking / Main Gate"
              value={newIncidentForm.location_text}
              onChange={(e) => setNewIncidentForm({ ...newIncidentForm, location_text: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Detailed Description
            </label>
            <textarea
              className="input-field"
              rows={4}
              required
              placeholder="Describe the incident, people involved, and initial observations..."
              value={newIncidentForm.description}
              onChange={(e) => setNewIncidentForm({ ...newIncidentForm, description: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Logging…" : "Submit Incident Report"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transition Modal */}
      <Modal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        title="Update Incident Lifecycle Status"
      >
        <form onSubmit={handleTransition} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {errorMessage && (
            <div style={{ padding: "0.6rem 0.8rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-sm)", color: "#b91c1c", fontSize: "0.85rem" }}>
              {errorMessage}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              New Status
            </label>
            <select
              className="select-field"
              value={transitionStatus}
              onChange={(e) => {
                setErrorMessage(null);
                setTransitionStatus(e.target.value as IncidentStatus);
              }}
            >
              {currentAllowedTransitions.map((st) => (
                <option key={st} value={st} style={{ textTransform: "capitalize" }}>
                  {st.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Transition Reason (Optional)
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Guard dispatched to location / False alarm verified"
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
            />
          </div>

          {transitionStatus === "resolved" && (
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
                Resolution Summary <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                className="input-field"
                rows={3}
                required
                placeholder="Document findings, corrective actions taken, and final outcome..."
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsTransitionModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Updating…" : "Confirm Transition"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
