"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import {
  gateApi,
  dashboardsApi,
  visitorsApi,
  deliveriesApi,
  type PanicAlert,
  type GuardRoster,
} from "@/lib/api";
import type { SecurityStats } from "@/types/dashboards";
import { formatDateTime } from "@/lib/utils";

// Real backend enum (backend/app/modules/gate/models.py ALERT_TYPES)
const EMERGENCY_TYPES = [
  { label: "Medical Emergency", value: "medical", icon: "🚑" },
  { label: "Fire", value: "fire", icon: "🔥" },
  { label: "Security Threat", value: "security", icon: "🚨" },
  { label: "Unauthorized Person / Intrusion", value: "intrusion", icon: "🚷" },
  { label: "Other", value: "other", icon: "⚠️" },
];

export default function SecurityGuardDashboardPage() {
  const router = useRouter();

  // Active Emergency State
  const [activeSos, setActiveSos] = useState<PanicAlert | null>(null);

  // Modal Step Control
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Form Fields
  const [emergencyType, setEmergencyType] = useState("medical");
  const [location, setLocation] = useState("Main Gate North");
  const [description, setDescription] = useState("");

  // UI Feedback States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Operational stats
  const [securityStats, setSecurityStats] = useState<SecurityStats | null>(null);
  const [pendingVisitors, setPendingVisitors] = useState<any[]>([]);
  const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0);
  const [activeRoster, setActiveRoster] = useState<GuardRoster | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Fetch initial active emergency alert + operational KPIs
  useEffect(() => {
    let mounted = true;
    gateApi
      .alerts()
      .then((alerts) => {
        if (mounted && alerts && alerts.length > 0) {
          const live = alerts.find((a) => a.status === "active" || a.status === "acknowledged");
          if (live) setActiveSos(live);
        }
      })
      .catch(() => {});

    Promise.allSettled([
      dashboardsApi.security(),
      visitorsApi.requests(),
      deliveriesApi.list(),
      gateApi.rosters(),
    ]).then(([statsRes, visitorsRes, deliveriesRes, rostersRes]) => {
      if (!mounted) return;
      if (statsRes.status === "fulfilled") setSecurityStats(statsRes.value);
      if (visitorsRes.status === "fulfilled") {
        setPendingVisitors((visitorsRes.value || []).filter((v: any) => v.status === "pending"));
      }
      if (deliveriesRes.status === "fulfilled") {
        setPendingDeliveryCount(
          (deliveriesRes.value || []).filter(
            (d: any) => d.status === "expected" || d.status === "at_gate",
          ).length,
        );
      }
      if (rostersRes.status === "fulfilled") {
        setActiveRoster((rostersRes.value || []).find((r) => r.status === "active") || null);
      }
      setIsLoadingStats(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenForm = () => {
    setErrorMessage(null);
    setIsFormModalOpen(true);
  };

  const handleProceedToConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      setErrorMessage("Please specify the emergency location.");
      return;
    }
    setErrorMessage(null);
    setIsFormModalOpen(false);
    setIsConfirmModalOpen(true);
  };

  const handleSendSos = async () => {
    if (isSubmitting) return; // Prevent duplicate submissions

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const message = [location.trim() && `Location: ${location.trim()}`, description.trim()]
        .filter(Boolean)
        .join(" — ");
      const sosRecord = await gateApi.triggerEmergency({
        alert_type: emergencyType,
        severity: "critical",
        message: message || undefined,
      });

      setActiveSos(sosRecord);
      setIsConfirmModalOpen(false);
      setSuccessMessage(
        `SOS Emergency Alert (${sosRecord.id.slice(0, 8).toUpperCase()}) dispatched successfully. Security Supervisor notified.`,
      );

      // Reset optional fields
      setDescription("");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to dispatch SOS alert. Please check connection and retry.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Security Guard Gate Console"
        subtitle="High-speed gate verification, instant pass checks, domestic staff logging, and SOS emergency alert escalation"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Guard" },
          { label: "Gate Console" },
        ]}
        actions={
          <button
            className="btn btn-danger"
            style={{
              fontWeight: 700,
              padding: "0.6rem 1.25rem",
              fontSize: "0.95rem",
              boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
            }}
            onClick={handleOpenForm}
          >
            🚨 SOS / EMERGENCY ALERT
          </button>
        }
      />

      {/* Success Notification Alert */}
      {successMessage && (
        <div
          style={{
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            background: "var(--success-light)",
            border: "1.5px solid var(--success-border)",
            borderRadius: "var(--radius)",
            color: "#065f46",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>✅ {successMessage}</div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            style={{
              background: "none",
              border: "none",
              color: "#065f46",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ACTIVE SOS STATUS CARD */}
      {activeSos && (
        <div
          style={{
            marginBottom: "1.75rem",
            padding: "1.25rem 1.5rem",
            background: "linear-gradient(135deg, #7f1d1d, #991b1b)",
            border: "2px solid #ef4444",
            borderRadius: "var(--radius-lg)",
            color: "white",
            boxShadow: "0 10px 25px -5px rgba(220, 38, 38, 0.4)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              marginBottom: "1rem",
              borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
              paddingBottom: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#f87171",
                  boxShadow: "0 0 0 4px rgba(248, 113, 113, 0.4)",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <span style={{ fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.5px" }}>
                SOS STATUS: ACTIVE
              </span>
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "var(--radius-full)",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  whiteSpace: "nowrap",
                }}
              >
                REF: SOS-{activeSos.id.slice(0, 8).toUpperCase()}
              </span>
            </div>

            <button
              className="btn"
              style={{
                background: "white",
                color: "#7f1d1d",
                fontWeight: 700,
                fontSize: "0.85rem",
                padding: "0.4rem 0.9rem",
              }}
              onClick={() => router.push("/security-guard/emergency")}
            >
              View Command Console →
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
              fontSize: "0.9rem",
            }}
          >
            <div>
              <span style={{ opacity: 0.8, fontSize: "0.75rem", display: "block" }}>
                Emergency Type
              </span>
              <strong style={{ fontSize: "1rem", color: "#fef2f2", textTransform: "capitalize" }}>
                🚨 {activeSos.alert_type}
              </strong>
            </div>
            <div>
              <span style={{ opacity: 0.8, fontSize: "0.75rem", display: "block" }}>Details</span>
              <strong style={{ fontSize: "1rem", color: "#fef2f2" }}>
                {(activeSos as any).message || "—"}
              </strong>
            </div>
            <div>
              <span style={{ opacity: 0.8, fontSize: "0.75rem", display: "block" }}>Time Sent</span>
              <strong style={{ fontSize: "0.95rem", color: "#fef2f2" }}>
                ⏱️ {formatDateTime((activeSos as any).triggered_at)}
              </strong>
            </div>
            <div>
              <span style={{ opacity: 0.8, fontSize: "0.75rem", display: "block" }}>
                Current Escalation / Response
              </span>
              <strong
                style={{ fontSize: "0.95rem", color: "#fecaca", textTransform: "capitalize" }}
              >
                🛡️ {activeSos.status}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Operational KPI Counters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        <KpiCard
          title="Active Visitors Inside"
          value={isLoadingStats ? "…" : String(securityStats?.visitors_inside ?? 0)}
          subtext={`${securityStats?.expected_visitors ?? 0} Expected Today`}
          icon="👥"
          onClick={() => router.push("/security-guard/visitors")}
        />
        <KpiCard
          title="Pending Approvals"
          value={isLoadingStats ? "…" : String(pendingVisitors.length)}
          subtext="Awaiting Resident Confirmation"
          icon="⏳"
          trend={pendingVisitors.length > 0 ? "warning" : undefined}
          trendValue={pendingVisitors.length > 0 ? "Check Desk" : undefined}
          onClick={() => router.push("/security-guard/live-gate")}
        />
        <KpiCard
          title="Pending Deliveries"
          value={isLoadingStats ? "…" : String(pendingDeliveryCount)}
          subtext="Expected or at gate desk"
          icon="📦"
          onClick={() => router.push("/security-guard/deliveries")}
        />
        <KpiCard
          title="Staff Inside"
          value={isLoadingStats ? "…" : String(securityStats?.staff_inside ?? 0)}
          subtext="Domestic staff currently on-site"
          icon="🪪"
          onClick={() => router.push("/security-guard/staff-attendance")}
        />
        <KpiCard
          title="Emergency Status"
          value={activeSos ? "ACTIVE SOS" : "NORMAL"}
          subtext={activeSos ? `${activeSos.alert_type} Reported` : "No Active Gate Alarms"}
          icon="🛡️"
          trend={activeSos ? "danger" : "success"}
          trendValue={activeSos ? "ALERT" : "All Secure"}
          onClick={() => router.push("/security-guard/emergency")}
        />
      </div>

      {/* High-Speed Operations Bar (Large Buttons) */}
      <div
        className="card"
        style={{
          marginBottom: "1.75rem",
          padding: "1.25rem",
          background: "linear-gradient(135deg, #0b1329, #121e3d)",
          color: "white",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: "1rem",
            color: "#60a5fa",
            marginBottom: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚡ HIGH-SPEED GATE ACTIONS</span>
          <button
            type="button"
            className="btn btn-danger"
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", fontWeight: 700 }}
            onClick={handleOpenForm}
          >
            🚨 SEND SOS ALERT
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1rem",
          }}
        >
          <button
            className="btn btn-primary"
            style={{
              padding: "0.85rem 1rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "var(--radius)",
            }}
            onClick={() => router.push("/security-guard/live-gate")}
          >
            🚪 Live Pass / PIN Verify
          </button>
          <button
            className="btn btn-secondary"
            style={{
              padding: "0.85rem 1rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "var(--radius)",
            }}
            onClick={() => router.push("/security-guard/visitors")}
          >
            👤 Visitor Entry / Exit
          </button>
          <button
            className="btn btn-secondary"
            style={{
              padding: "0.85rem 1rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "var(--radius)",
            }}
            onClick={() => router.push("/security-guard/deliveries")}
          >
            📦 Verify Delivery
          </button>
          <button
            className="btn btn-secondary"
            style={{
              padding: "0.85rem 1rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "var(--radius)",
            }}
            onClick={() => router.push("/security-guard/cab-taxi")}
          >
            🚖 Cab / Taxi Verify
          </button>
          <button
            className="btn btn-secondary"
            style={{
              padding: "0.85rem 1rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "var(--radius)",
            }}
            onClick={() => router.push("/security-guard/staff-attendance")}
          >
            🪪 Staff Check-in / Out
          </button>
          <button
            className="btn btn-secondary"
            style={{
              padding: "0.85rem 1rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "var(--radius)",
            }}
            onClick={() => router.push("/security-guard/blacklist-check")}
          >
            🔍 Blacklist Lookup
          </button>
        </div>
      </div>

      {/* Main Grid: Pending Gate Approvals & History */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
          gap: "1.75rem",
        }}
      >
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Pending Gate Verification Queue</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Visitor</th>
                  <th>Purpose</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingStats ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", padding: "1.5rem" }}>
                      Loading…
                    </td>
                  </tr>
                ) : pendingVisitors.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}
                    >
                      No pending gate approvals.
                    </td>
                  </tr>
                ) : (
                  pendingVisitors.slice(0, 5).map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 700 }}>
                        {v.visitor?.full_name || v.visitor_name || "Visitor"}
                      </td>
                      <td>{v.purpose || "—"}</td>
                      <td>
                        <StatusBadge status={v.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Current Duty Assignment</h3>
          </div>
          {isLoadingStats ? (
            <p style={{ padding: "0.5rem 0", color: "var(--muted)" }}>Loading…</p>
          ) : !activeRoster ? (
            <p style={{ padding: "0.5rem 0", color: "var(--muted)" }}>
              No active shift assignment found on today&apos;s roster.
            </p>
          ) : (
            <div style={{ padding: "0.5rem 0" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.75rem",
                }}
              >
                <span style={{ color: "var(--muted)" }}>Shift Date:</span>
                <span style={{ fontWeight: 600 }}>{activeRoster.shift_date}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Time:</span>
                <span style={{ fontWeight: 600 }}>
                  {activeRoster.shift_start} – {activeRoster.shift_end}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STEP 1: SOS EMERGENCY FORM MODAL */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title="🚨 DISPATCH SOS EMERGENCY ALERT"
        maxWidth={580}
      >
        <form onSubmit={handleProceedToConfirmation}>
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

          {/* Required Field: Emergency Type */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                fontSize: "0.9rem",
                marginBottom: "0.5rem",
              }}
            >
              Select Emergency Type *
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "0.6rem",
              }}
            >
              {EMERGENCY_TYPES.map((item) => {
                const isSelected = emergencyType === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setEmergencyType(item.value)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.75rem 0.85rem",
                      borderRadius: "var(--radius-sm)",
                      border: isSelected ? "2px solid var(--danger)" : "1px solid var(--border)",
                      background: isSelected ? "var(--danger-light)" : "white",
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: "0.85rem",
                      color: isSelected ? "#991b1b" : "var(--fg)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Required Field: Location */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                fontSize: "0.875rem",
                marginBottom: "0.35rem",
              }}
            >
              Location *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Tower B - 12th Floor / Main Gate North"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>

          {/* Optional Field: Description */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.875rem",
                marginBottom: "0.35rem",
              }}
            >
              Description <span style={{ color: "var(--muted)", fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="Provide additional situation details for emergency response team..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              borderTop: "1px solid var(--border)",
              paddingTop: "1rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsFormModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              style={{ padding: "0.65rem 1.25rem", fontWeight: 700, fontSize: "0.95rem" }}
            >
              Review SOS Alert →
            </button>
          </div>
        </form>
      </Modal>

      {/* STEP 2: CONFIRMATION DIALOG STEP */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !isSubmitting && setIsConfirmModalOpen(false)}
        title="⚠️ CONFIRM EMERGENCY DISPATCH"
        maxWidth={500}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleSendSos}
              disabled={isSubmitting}
              style={{ fontWeight: 700, padding: "0.65rem 1.25rem" }}
            >
              {isSubmitting ? "Broadcasting SOS..." : "🚨 Send SOS"}
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
              marginBottom: "1.25rem",
            }}
          >
            <p
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                marginBottom: "0.5rem",
                color: "#991b1b",
              }}
            >
              Are you sure you want to send an SOS emergency alert?
            </p>
            <p style={{ fontSize: "0.85rem", color: "#b91c1c" }}>
              This will immediately escalate a critical alert to the Security Supervisor, Gate
              Command Center, and all active duty guards.
            </p>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "1rem",
              fontSize: "0.875rem",
            }}
          >
            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}
            >
              <span style={{ color: "var(--muted)" }}>Emergency Type:</span>
              <strong style={{ color: "var(--danger)" }}>
                🚨 {EMERGENCY_TYPES.find((t) => t.value === emergencyType)?.label || emergencyType}
              </strong>
            </div>
            <div
              style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}
            >
              <span style={{ color: "var(--muted)" }}>Location:</span>
              <strong>📍 {location}</strong>
            </div>
            {description && (
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: "0.5rem",
                  marginTop: "0.5rem",
                }}
              >
                <span style={{ color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  Description:
                </span>
                <span style={{ color: "var(--fg)" }}>{description}</span>
              </div>
            )}
          </div>

          {errorMessage && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                background: "var(--danger-light)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--radius-sm)",
                color: "#991b1b",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
