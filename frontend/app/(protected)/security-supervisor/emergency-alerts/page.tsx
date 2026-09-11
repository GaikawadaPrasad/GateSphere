"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { gateApi, type PanicAlert } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

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

  const fetchAlerts = async () => {
    setIsLoading(true);
    const data = await gateApi.alerts();
    if (data) setAlerts(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleTriggerAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const message = [location.trim() && `Location: ${location.trim()}`, description.trim()]
        .filter(Boolean)
        .join(" — ");
      await gateApi.triggerEmergency({
        alert_type: alertType,
        severity: "critical",
        message: message || undefined,
      });
      setIsModalOpen(false);
      setLocation("");
      setDescription("");
      await fetchAlerts();
    } catch (err: any) {
      alert(err?.message || "Failed to broadcast emergency alert.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await gateApi.acknowledgeAlert(id);
      fetchAlerts();
    } catch (err: any) {
      alert(err?.message || "Failed to acknowledge alert.");
    }
  };

  const handleResolve = async (id: string) => {
    const summary = window.prompt("Resolution summary (optional):") || undefined;
    try {
      await gateApi.resolveAlert(id, summary);
      fetchAlerts();
    } catch (err: any) {
      alert(err?.message || "Failed to resolve alert.");
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
          <button className="btn btn-danger" onClick={() => setIsModalOpen(true)}>
            🚨 Broadcast Emergency Alert
          </button>
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
                            onClick={() => handleResolve(a.id)}
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
    </div>
  );
}
