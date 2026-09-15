"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { SearchInput } from "@/components/forms/SearchInput";
import { incidentsApi } from "@/lib/api";

const INCIDENT_CATEGORIES = [
  { value: "breach", label: "Security Breach / Unauthorized Entry" },
  { value: "suspicious", label: "Suspicious Activity / Intruder" },
  { value: "theft", label: "Theft / Property Loss" },
  { value: "medical", label: "Medical Emergency" },
  { value: "fire", label: "Fire / Smoke Hazard" },
  { value: "lift_entrapment", label: "Lift Entrapment" },
  { value: "assault", label: "Physical Altercation / Assault" },
  { value: "other", label: "Other Incident" },
];

const SEVERITIES = [
  { value: "low", label: "Low (Minor / Informational)" },
  { value: "medium", label: "Medium (Prompt Action Needed)" },
  { value: "high", label: "High (Urgent Response Required)" },
  { value: "critical", label: "Critical (Life Safety / Immediate Threat)" },
];

const STATUS_OPTIONS = [
  { value: "reported", label: "Reported" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "responding", label: "Responding" },
  { value: "contained", label: "Contained" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "false_alarm", label: "False Alarm" },
];

interface SecurityIncident {
  id: string;
  incident_number: string;
  title: string;
  incident_type: string;
  severity: string;
  assigned_guard: string;
  reported_time: string;
  status: string;
  location: string;
}

export default function SecuritySupervisorIncidentsPage() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("high");
  const [incidentType, setIncidentType] = useState("breach");
  const [locationText, setLocationText] = useState("Main Gate Perimeter");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Resolution Modal
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolvingIncident, setResolvingIncident] = useState<SecurityIncident | null>(null);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await incidentsApi.list();
      setIncidents(
        (data || []).map((inc: any) => ({
          id: inc.id,
          incident_number: inc.incident_number || `INC-${inc.id.slice(0, 6).toUpperCase()}`,
          title: inc.description || inc.title || "Security Incident",
          incident_type: inc.incident_type || "breach",
          severity: inc.severity || "high",
          assigned_guard: inc.responder_user_id
            ? `Responder (${inc.responder_user_id.slice(0, 6)})`
            : "Duty Security Team",
          reported_time: inc.reported_at || inc.created_at
            ? new Date(inc.reported_at || inc.created_at).toLocaleString([], {
                dateStyle: "short",
                timeStyle: "short",
              })
            : "Recent",
          status: inc.status || "reported",
          location: inc.location_text || "Perimeter",
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
        incident_type: incidentType as any,
        severity: severity as any,
        location_text: locationText.trim() || undefined,
        description: title.trim(),
      });
      setIsModalOpen(false);
      setTitle("");
      setLocationText("Main Gate Perimeter");
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to log security incident.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (inc: SecurityIncident, newStatusSlug: string) => {
    if (newStatusSlug === "resolved") {
      setResolvingIncident(inc);
      setResolutionSummary("");
      setIsResolveModalOpen(true);
      return;
    }
    setUpdatingId(inc.id);
    try {
      await incidentsApi.transition(inc.id, {
        status: newStatusSlug as any,
        reason: "Supervisor status transition",
      });
      setIncidents((prev) =>
        prev.map((item) => (item.id === inc.id ? { ...item, status: newStatusSlug } : item)),
      );
    } catch (err: any) {
      alert(err?.message || "Failed to update incident status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingIncident || !resolutionSummary.trim()) {
      alert("Please provide a resolution summary.");
      return;
    }
    setIsResolving(true);
    try {
      await incidentsApi.transition(resolvingIncident.id, {
        status: "resolved",
        resolution_summary: resolutionSummary.trim(),
        reason: "Supervisor incident resolution",
      });
      setIsResolveModalOpen(false);
      setResolvingIncident(null);
      setResolutionSummary("");
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to resolve security incident.");
    } finally {
      setIsResolving(false);
    }
  };

  const filteredIncidents = incidents.filter((inc) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      inc.title.toLowerCase().includes(q) ||
      inc.incident_number.toLowerCase().includes(q) ||
      inc.location.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || inc.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Security Breach & Incident Log</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredIncidents.length} incidents recorded
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: "100%", maxWidth: 240 }}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search incident #, summary…"
              />
            </div>

            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", height: 36 }}
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
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
                <th>Breach Summary</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Location</th>
                <th>Reported Time</th>
                <th>Investigation Status</th>
                <th>Status Transition</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading security incidents…
                  </td>
                </tr>
              ) : filteredIncidents.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No incidents matching filter.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => (
                  <tr key={inc.id}>
                    <td style={{ fontWeight: 600, fontFamily: "monospace" }}>{inc.incident_number}</td>
                    <td style={{ fontWeight: 500, color: "var(--fg)", maxWidth: 220 }}>{inc.title}</td>
                    <td>
                      <span style={{ fontSize: "0.8rem", textTransform: "capitalize" }}>
                        {inc.incident_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={inc.severity} />
                    </td>
                    <td style={{ fontSize: "0.8rem" }}>{inc.location}</td>
                    <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{inc.reported_time}</td>
                    <td>
                      <StatusBadge status={inc.status} />
                    </td>
                    <td>
                      <select
                        className="select-field"
                        value={inc.status}
                        onChange={(e) => handleStatusChange(inc, e.target.value)}
                        disabled={updatingId === inc.id}
                        style={{ height: 30, fontSize: "0.75rem", padding: "0.15rem 0.4rem" }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
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
        title="⚠️ Log Security Breach / Incident"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCreateIncident}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Logging…" : "Log Security Incident"}
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
              Incident / Breach Summary *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Unattended suspicious bag found at South Gate perimeter"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
                Incident Category *
              </label>
              <select
                className="select-field"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
              >
                {INCIDENT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
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
                Severity Level *
              </label>
              <select
                className="select-field"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
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
              Physical Location / Checkpoint
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Gate 2 / Tower C Basement"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Resolve Incident Modal */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title={`Resolve Incident — ${resolvingIncident?.incident_number}`}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsResolveModalOpen(false)}
              disabled={isResolving}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmResolve}
              disabled={isResolving}
            >
              {isResolving ? "Resolving…" : "Confirm Resolution"}
            </button>
          </>
        }
      >
        <form onSubmit={handleConfirmResolve}>
          <div
            style={{
              padding: "0.75rem",
              background: "rgba(59, 130, 246, 0.08)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              color: "var(--primary)",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            ℹ️ Resolving an incident requires a documented resolution summary and findings for compliance audit.
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}>
              {resolvingIncident?.title}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Location: {resolvingIncident?.location} | Severity: {resolvingIncident?.severity}
            </div>
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
              Resolution Summary & Action Taken *
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. Perimeter inspected by duty guards. Unattended item verified and returned to rightful owner. Area secured."
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
