"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { gateApi, type PanicAlert } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/store/toast";

// Real backend enum (backend/app/modules/gate/models.py ALERT_TYPES)
const ALERT_TYPES = [
  { label: "Medical Emergency", value: "medical" },
  { label: "Fire", value: "fire" },
  { label: "Security Threat", value: "security" },
  { label: "Unauthorized Person / Intrusion", value: "intrusion" },
  { label: "Other", value: "other" },
];

export default function SecuritySupervisorEmergencyAlertsPage() {
  const [alerts, setAlerts] = useState<PanicAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alertType, setAlertType] = useState("medical");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resolution modal state
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [alertToResolve, setAlertToResolve] = useState<PanicAlert | null>(null);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [resolutionSummaryError, setResolutionSummaryError] = useState("");

  const fetchAlerts = async () => {
    setIsLoading(true);
    const data = await gateApi.alerts();
    if (data) setAlerts(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const [alertFieldError, setAlertFieldError] = useState<string | null>(null);

  const handleTriggerAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!location.trim() && !description.trim()) {
      setAlertFieldError("Please specify either a location or description for the alert.");
      toast.error("Please specify either a location or description for the alert.");
      return;
    }

    setIsSubmitting(true);
    setAlertFieldError(null);

    try {
      const message = [location.trim() && `Location: ${location.trim()}`, description.trim()]
        .filter(Boolean)
        .join(" — ");
      await gateApi.triggerEmergency({
        alert_type: alertType,
        severity: "critical",
        message: message || undefined,
      });
      toast.success("🚨 Emergency broadcast dispatched to security network!");
      setIsModalOpen(false);
      setLocation("");
      setDescription("");
      await fetchAlerts();
    } catch (err: any) {
      toast.error(err?.message || "Failed to broadcast emergency alert.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await gateApi.acknowledgeAlert(id);
      toast.success("Emergency alert acknowledged.");
      fetchAlerts();
    } catch (err: any) {
      toast.error(err?.message || "Failed to acknowledge alert.");
    }
  };

  const handleOpenResolve = (alertItem: PanicAlert) => {
    setAlertToResolve(alertItem);
    setResolutionSummary("");
    setResolutionSummaryError("");
    setIsResolveModalOpen(true);
  };

  const handleConfirmResolve = async () => {
    if (!alertToResolve || isSubmitting) return;
    const cleanSummary = resolutionSummary.trim();
    if (!cleanSummary || cleanSummary.length < 5) {
      setResolutionSummaryError("Please provide a resolution summary (min 5 characters).");
      toast.error("Resolution summary must be at least 5 characters.");
      return;
    }
    setIsSubmitting(true);
    try {
      await gateApi.resolveAlert(alertToResolve.id, cleanSummary);
      toast.success("Emergency incident marked as resolved.");
      setIsResolveModalOpen(false);
      setAlertToResolve(null);
      setResolutionSummary("");
      setResolutionSummaryError("");
      await fetchAlerts();
    } catch (err: any) {
      toast.error(err?.message || "Failed to resolve alert.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Emergency Alerts Command Console"
        subtitle="Manage live panic alerts, fan out emergency security broadcasts, and coordinate responder dispatch"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Emergency Alerts" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              onClick={fetchAlerts}
              disabled={isLoading}
            >
              🔄 {isLoading ? "Refreshing…" : "Refresh"}
            </button>
            <button className="btn btn-danger" onClick={() => setIsModalOpen(true)}>
              🚨 Broadcast Emergency Alert
            </button>
          </div>
        }
      />

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Live & Historical Emergency Broadcasts</h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref ID</th>
                <th>Type</th>
                <th>Details</th>
                <th>Triggered Time</th>
                <th>Alert Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading…
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}
                  >
                    No emergency alerts recorded.
                  </td>
                </tr>
              ) : (
                alerts.map((a) => (
                  <tr
                    key={a.id}
                    style={{
                      background: a.status === "active" ? "var(--danger-light)" : undefined,
                    }}
                  >
                    <td style={{ fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      SOS-{a.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color: "var(--danger)",
                        textTransform: "capitalize",
                      }}
                    >
                      🚨 {a.alert_type}
                    </td>
                    <td style={{ fontWeight: 600 }}>{a.message || "—"}</td>
                    <td>{formatDateTime(a.triggered_at)}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        {a.status === "active" && (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                            onClick={() => handleAcknowledge(a.id)}
                          >
                            Acknowledge
                          </button>
                        )}
                        {(a.status === "active" || a.status === "acknowledged") && (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                            onClick={() => handleOpenResolve(a)}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Emergency Trigger Confirmation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="🚨 Broadcast Emergency Security Alert"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleTriggerAlert} disabled={isSubmitting}>
              {isSubmitting ? "Broadcasting..." : "🚨 Confirm Emergency Broadcast"}
            </button>
          </>
        }
      >
        <form onSubmit={handleTriggerAlert}>
          <div
            style={{
              padding: "0.75rem",
              background: "var(--danger-light)",
              border: "1px solid var(--danger-border)",
              borderRadius: "var(--radius-sm)",
              color: "#991b1b",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            ⚠️ Confirmation required: Triggering an emergency alert will immediately notify all
            guards on duty and display panic indicators on active consoles.
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Emergency Category *
            </label>
            <select
              className="select-field"
              value={alertType}
              onChange={(e) => setAlertType(e.target.value)}
            >
              {ALERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Location / Building Block
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Tower A Floor 12"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
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
              Additional Description{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="Optional notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Resolve Incident Confirmation Modal */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => !isSubmitting && setIsResolveModalOpen(false)}
        title="🛡️ RESOLVE EMERGENCY INCIDENT"
        maxWidth={500}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsResolveModalOpen(false);
                setAlertToResolve(null);
                setResolutionSummary("");
              }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmResolve}
              disabled={isSubmitting}
              style={{ fontWeight: 700 }}
            >
              {isSubmitting ? "Resolving..." : "Confirm Resolution"}
            </button>
          </>
        }
      >
        <div>
          {alertToResolve && (
            <div
              style={{
                padding: "0.85rem 1rem",
                background: "#f8fafc",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ color: "var(--muted)" }}>Incident Ref:</span>
                <strong style={{ fontFamily: "monospace" }}>
                  SOS-{alertToResolve.id.slice(0, 8).toUpperCase()}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ color: "var(--muted)" }}>Category:</span>
                <strong style={{ color: "var(--danger)", textTransform: "capitalize" }}>
                  🚨 {alertToResolve.alert_type}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Details:</span>
                <span>{(alertToResolve as any).message || "—"}</span>
              </div>
            </div>
          )}

          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Resolution Summary / Actions Taken
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. Attended by on-duty medical response, resident safe and stable."
              value={resolutionSummary}
              onChange={(e) => {
                setResolutionSummary(e.target.value);
                if (resolutionSummaryError) setResolutionSummaryError("");
              }}
            />
            {resolutionSummaryError && (
              <span style={{ color: "var(--danger, #ef4444)", fontSize: "0.75rem", display: "block", marginTop: "0.25rem" }}>
                {resolutionSummaryError}
              </span>
            )}
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              This summary will be permanently stamped on the emergency incident audit record.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
