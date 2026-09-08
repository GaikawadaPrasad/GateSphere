"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { gateApi, type PanicAlert } from "@/lib/api";

export default function SecuritySupervisorEmergencyAlertsPage() {
  const [alerts, setAlerts] = useState<PanicAlert[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [alertType, setAlertType] = useState("Medical Emergency");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAlerts = async () => {
    const data = await gateApi.alerts();
    if (data) setAlerts(data);
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleTriggerAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await gateApi.triggerEmergency({
        type: alertType,
        location: location || "Community Main Grounds",
        description: description || undefined,
        severity: "critical",
      });
      setIsModalOpen(false);
      setLocation("");
      setDescription("");
      await fetchAlerts();
    } catch {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: "Active" | "Acknowledged" | "Resolving" | "Resolved") => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));

    if (status === "Acknowledged") {
      await gateApi.acknowledgeAlert(id);
    } else if (status === "Resolved") {
      await gateApi.resolveAlert(id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Emergency Alerts Command Console"
        subtitle="Manage live panic alerts, fan out emergency security broadcasts, and coordinate responder dispatch"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Emergency Alerts" }]}
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
                <th>Emergency Type</th>
                <th>Location / Unit</th>
                <th>Triggered Time</th>
                <th>Reported By</th>
                <th>Assigned Responder</th>
                <th>Alert Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} style={{ background: a.status === "Active" ? "var(--danger-light)" : undefined }}>
                  <td style={{ fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                    {a.reference_id || `SOS-${a.id.slice(0, 4).toUpperCase()}`}
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--danger)" }}>🚨 {a.alert_type}</td>
                  <td style={{ fontWeight: 600 }}>{a.location}</td>
                  <td>{a.timestamp}</td>
                  <td>{a.reported_by}</td>
                  <td>{a.assigned_responder || "Supervisor Devraj"}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>
                    <select
                      className="select-field"
                      value={a.status}
                      onChange={(e) => handleStatusChange(a.id, e.target.value as PanicAlert["status"])}
                      style={{ height: 28, fontSize: "0.75rem" }}
                    >
                      <option value="Active">Active</option>
                      <option value="Acknowledged">Acknowledged</option>
                      <option value="Resolving">Resolving</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
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
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
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
            ⚠️ Confirmation required: Triggering an emergency alert will immediately notify all guards on duty and display panic indicators on active consoles.
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Emergency Category *
            </label>
            <select className="select-field" value={alertType} onChange={(e) => setAlertType(e.target.value)}>
              <option value="Medical Emergency">Medical Emergency</option>
              <option value="Fire">Fire</option>
              <option value="Security Threat">Security Threat</option>
              <option value="Unauthorized Person">Unauthorized Person</option>
              <option value="Accident">Accident</option>
              <option value="Suspicious Activity">Suspicious Activity</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Location / Building Block *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Tower A Floor 12"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
              Additional Description <span style={{ color: "var(--muted)", fontWeight: 400 }}>(Optional)</span>
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

