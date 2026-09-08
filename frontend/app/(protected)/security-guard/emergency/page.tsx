"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { gateApi, type PanicAlert } from "@/lib/api";

const EMERGENCY_TYPES = [
  { label: "Medical Emergency", icon: "🚑" },
  { label: "Fire", icon: "🔥" },
  { label: "Security Threat", icon: "🚨" },
  { label: "Unauthorized Person", icon: "🚷" },
  { label: "Accident", icon: "💥" },
  { label: "Suspicious Activity", icon: "👁️" },
  { label: "Other", icon: "⚠️" },
];

export default function SecurityGuardEmergencyPage() {
  const [alertsList, setAlertsList] = useState<PanicAlert[]>([]);
  const [activeSos, setActiveSos] = useState<PanicAlert | null>(null);

  const [emergencyType, setEmergencyType] = useState("Medical Emergency");
  const [location, setLocation] = useState("Main Gate North");
  const [description, setDescription] = useState("");

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dispatchedAlert, setDispatchedAlert] = useState<PanicAlert | null>(null);

  // Fetch emergency alerts
  useEffect(() => {
    let mounted = true;
    gateApi.alerts().then((data) => {
      if (mounted && data) {
        setAlertsList(data);
        const live = data.find((a) => (a.status as string) === "Active" || (a.status as string) === "Acknowledged" || a.status === "acknowledged");
        if (live) setActiveSos(live);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      setErrorMessage("Please enter an emergency location.");
      return;
    }
    setErrorMessage(null);
    setIsConfirmModalOpen(true);
  };

  const handleDispatchEmergency = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const sosRecord = await gateApi.triggerEmergency({
        type: emergencyType,
        location: location.trim(),
        description: description.trim() || undefined,
        severity: "critical",
      });

      setDispatchedAlert(sosRecord);
      setActiveSos(sosRecord);
      setAlertsList((prev) => {
        const filtered = prev.filter((a) => a.id !== sosRecord.id && a.reference_id !== sosRecord.reference_id);
        return [sosRecord, ...filtered];
      });
      setIsConfirmModalOpen(false);
      setDescription("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send SOS emergency alert. Please retry.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="SOS Emergency & Panic Command Console"
        subtitle="Immediate emergency alert dispatch, active alert status monitoring, and Security Supervisor escalation"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Emergency" }]}
      />

      {/* ACTIVE SOS BANNER */}
      {activeSos && (
        <div
          style={{
            padding: "1.25rem 1.5rem",
            marginBottom: "1.75rem",
            background: "linear-gradient(135deg, #7f1d1d, #991b1b)",
            border: "2px solid #ef4444",
            borderRadius: "var(--radius-lg)",
            color: "white",
            boxShadow: "0 10px 25px -5px rgba(220, 38, 38, 0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#f87171",
                  boxShadow: "0 0 0 4px rgba(248, 113, 113, 0.4)",
                  animation: "pulse 1.5s infinite",
                  display: "inline-block",
                }}
              />
              <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>SOS STATUS: ACTIVE</span>
            </div>
            <span
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                padding: "0.2rem 0.6rem",
                borderRadius: "var(--radius-full)",
                fontSize: "0.8rem",
                fontWeight: 700,
                fontFamily: "monospace",
                whiteSpace: "nowrap",
              }}
            >
              REFERENCE: {activeSos.reference_id || `SOS-${activeSos.id.slice(0, 4).toUpperCase()}`}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", fontSize: "0.9rem" }}>
            <div>
              <span style={{ opacity: 0.8, fontSize: "0.75rem", display: "block" }}>Emergency Type</span>
              <strong>🚨 {activeSos.alert_type}</strong>
            </div>
            <div>
              <span style={{ opacity: 0.8, fontSize: "0.75rem", display: "block" }}>Location</span>
              <strong>📍 {activeSos.location}</strong>
            </div>
            <div>
              <span style={{ opacity: 0.8, fontSize: "0.75rem", display: "block" }}>Time Sent</span>
              <strong>⏱️ {activeSos.timestamp}</strong>
            </div>
            <div>
              <span style={{ opacity: 0.8, fontSize: "0.75rem", display: "block" }}>Current Escalation</span>
              <strong>🛡️ {activeSos.status} ({activeSos.assigned_responder || "Security Supervisor"})</strong>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH SUCCESS NOTIFICATION */}
      {dispatchedAlert && (
        <div
          style={{
            padding: "1.25rem",
            marginBottom: "1.75rem",
            background: "var(--danger-light)",
            border: "2px solid var(--danger)",
            borderRadius: "var(--radius)",
            color: "#991b1b",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.4rem" }}>
                🚨 SOS EMERGENCY ALERT DISPATCHED
              </h3>
              <p style={{ fontSize: "0.9rem", color: "#b91c1c" }}>
                Reference ID: <strong>{dispatchedAlert.reference_id}</strong> | Type: <strong>{dispatchedAlert.alert_type}</strong> at <strong>{dispatchedAlert.location}</strong>. Alert broadcasted to Security Supervisor and active response team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDispatchedAlert(null)}
              style={{ background: "none", border: "none", color: "#991b1b", fontWeight: 700, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.75rem" }}>
        {/* SOS Dispatch Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🚨 Dispatch SOS Emergency Broadcast</h3>
          </div>

          {errorMessage && (
            <div
              style={{
                padding: "0.75rem 1rem",
                marginBottom: "1.25rem",
                background: "var(--danger-light)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--radius-sm)",
                color: "#991b1b",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleOpenConfirm}>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Emergency Type *
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.6rem" }}>
                {EMERGENCY_TYPES.map((item) => {
                  const isSelected = emergencyType === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setEmergencyType(item.label)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.75rem",
                        borderRadius: "var(--radius-sm)",
                        border: isSelected ? "2px solid var(--danger)" : "1px solid var(--border)",
                        background: isSelected ? "var(--danger-light)" : "white",
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: "0.85rem",
                        color: isSelected ? "#991b1b" : "var(--fg)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Location *
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Tower B Floor 12 / Main Gate North"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Description <span style={{ color: "var(--muted)", fontWeight: 400 }}>(Optional)</span>
              </label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Provide relevant details for response team..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-danger"
              style={{ width: "100%", padding: "0.85rem", fontSize: "1rem", fontWeight: 700 }}
            >
              🚨 SEND SOS EMERGENCY ALERT
            </button>
          </form>
        </div>

        {/* Incident Activity List */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Emergency & SOS Activity</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref ID</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alertsList.map((a) => (
                  <tr key={a.id} style={{ background: a.status === "Active" ? "var(--danger-light)" : undefined }}>
                    <td style={{ fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {a.reference_id || `SOS-${a.id.slice(0, 4).toUpperCase()}`}
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--danger)" }}>🚨 {a.alert_type}</td>
                    <td>{a.location}</td>
                    <td>{a.timestamp}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !isSubmitting && setIsConfirmModalOpen(false)}
        title="⚠️ CONFIRM EMERGENCY DISPATCH"
        maxWidth={480}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={handleDispatchEmergency}
              disabled={isSubmitting}
              style={{ fontWeight: 700 }}
            >
              {isSubmitting ? "Sending SOS..." : "Send SOS"}
            </button>
          </>
        }
      >
        <div>
          <div
            style={{
              padding: "1rem",
              background: "var(--danger-light)",
              border: "1.5px solid var(--danger-border)",
              borderRadius: "var(--radius-sm)",
              color: "#991b1b",
              marginBottom: "1rem",
            }}
          >
            <p style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.35rem" }}>
              Are you sure you want to send an SOS emergency alert?
            </p>
            <p style={{ fontSize: "0.85rem", color: "#b91c1c" }}>
              This will escalate an urgent alert to the Security Supervisor and trigger emergency notifications.
            </p>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "0.85rem",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
              <span style={{ color: "var(--muted)" }}>Emergency Type:</span>
              <strong style={{ color: "var(--danger)" }}>🚨 {emergencyType}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Location:</span>
              <strong>📍 {location}</strong>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

