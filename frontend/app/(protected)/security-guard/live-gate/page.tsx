"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { visitorsApi } from "@/lib/api";

interface VerifiedEntry {
  entryId: string;
  visitorName: string;
  category?: string;
  reason?: string;
  unitLabel: string;
  vehicleNumber?: string | null;
  status: string;
  enteredAt?: string;
}

export default function SecurityGuardLiveGatePage() {
  const [passInput, setPassInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedEntry, setVerifiedEntry] = useState<VerifiedEntry | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isExiting, setIsExiting] = useState(false);

  // Verifying a pass records the entry and exhausts/expires the single-use QR / OTP pass.
  const handleVerifyPass = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = passInput.trim();
    if (!raw) return;

    // Check if input is a JSON string from a QR code
    let extractedPin = "";
    let extractedToken = "";
    let extractedCategory = "";
    let extractedReason = "";

    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.token) extractedToken = parsed.token;
        if (parsed.pin) extractedPin = parsed.pin;
        if (parsed.category) extractedCategory = parsed.category;
        if (parsed.reason) extractedReason = parsed.reason;
      } catch {
        // Continue with raw string
      }
    }

    const tokenToUse = extractedToken || (raw.startsWith("QR-") ? raw.replace(/^QR-/, "") : "");
    const pinToUse = extractedPin || (/^\d{4,12}$/.test(raw) ? raw : "");
    const isPin = Boolean(pinToUse) && !tokenToUse;

    setIsVerifying(true);
    setErrorMessage("");
    setSuccessMessage("");
    setVerifiedEntry(null);

    try {
      const payload = isPin ? { pin: pinToUse } : { pass_token: tokenToUse || raw };
      const entry: any = await visitorsApi.recordEntry(payload);

      let visitorName = "Guest Visitor";
      let unitLabel = "Resident Unit";
      let category = extractedCategory || "Guest";
      let reason = extractedReason || "Visitor Entry";

      try {
        if (entry?.request_id) {
          const request: any = await visitorsApi.getRequest(String(entry.request_id));
          if (request) {
            if (request.purpose) reason = String(request.purpose);
            if (request.visitor_type) category = String(request.visitor_type).replace(/_/g, " ");
            unitLabel = (request.group_label as string) || (request.unit_id ? `Unit ${String(request.unit_id).slice(0, 6)}` : unitLabel);
            if (request.visitor_id) {
              const directory = await visitorsApi.directory({ q: undefined });
              const match = (directory || []).find((v: any) => v.id === request.visitor_id);
              if (match) visitorName = (match as any).full_name || visitorName;
            }
          }
        }
      } catch {
        // Non-fatal if detail lookup fails
      }

      setVerifiedEntry({
        entryId: String(entry?.id || ""),
        visitorName,
        category,
        reason,
        unitLabel,
        vehicleNumber: (entry?.vehicle_number as string | null) || null,
        status: String(entry?.status || "admitted"),
        enteredAt: String(entry?.entry_at || new Date().toISOString()),
      });
      setSuccessMessage(`✅ Entry Approved & Recorded for ${visitorName} — QR/OTP is now EXPIRED.`);
      setPassInput("");
    } catch (err: any) {
      const msg = err?.message || "Invalid pass / PIN, or visitor is blacklisted";
      setErrorMessage(`❌ NO ENTRY ALLOWED: ${msg}`);
    }
    setIsVerifying(false);
  };

  const handleRecordExit = async () => {
    if (!verifiedEntry) return;
    setIsExiting(true);
    try {
      await visitorsApi.recordExit(verifiedEntry.entryId);
      alert(`Exit recorded for ${verifiedEntry.visitorName}`);
      setVerifiedEntry(null);
      setPassInput("");
      setSuccessMessage("✓ Exit recorded successfully.");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to record exit.");
    }
    setIsExiting(false);
  };

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Live Security Gate Verification Console"
        subtitle="Pass / PIN verification doubles as entry recording, with blacklist screening enforced server-side"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Live Gate" }]}
      />

      {/* Pass Verification Form Card */}
      <div
        className="card"
        style={{ marginBottom: "1.75rem", background: "linear-gradient(135deg, #ffffff, #f8fafc)" }}
      >
        <h3 className="card-title" style={{ marginBottom: "1rem" }}>
          🔍 Verify & Record Entry (QR Token or PIN)
        </h3>

        <form
          onSubmit={handleVerifyPass}
          style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Scan QR token or enter 4-12 digit PIN..."
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              style={{
                fontSize: "1.05rem",
                padding: "0.75rem 1rem",
                fontWeight: 600,
                fontFamily: "monospace",
              }}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isVerifying || !passInput.trim()}
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", fontWeight: 700 }}
          >
            {isVerifying ? "Verifying…" : "VERIFY & ALLOW ENTRY"}
          </button>
        </form>

        {errorMessage && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "1rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--danger-light)",
              border: "1px solid var(--danger-border)",
              color: "#991b1b",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "1rem",
              borderRadius: "var(--radius-sm)",
              background: "var(--success-light)",
              border: "1px solid var(--success-border)",
              color: "#065f46",
              fontWeight: 700,
              fontSize: "0.95rem",
            }}
          >
            {successMessage}
          </div>
        )}
      </div>

      {/* Verification Result Card */}
      {verifiedEntry && (
        <div
          className="card"
          style={{ marginBottom: "1.75rem", border: "2px solid var(--success-border)", background: "#ffffff" }}
        >
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }}>🎟️</span>
              <h3 className="card-title" style={{ margin: 0 }}>Gate Entry Admitted & Pass Expired</h3>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ padding: "0.25rem 0.6rem", borderRadius: "6px", background: "#FEF2F2", color: "#991B1B", fontWeight: 700, fontSize: "11.5px", border: "1px solid #FECACA" }}>
                🔒 SINGLE-USE EXPIRED
              </span>
              <StatusBadge status={verifiedEntry.status} />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1.25rem",
              marginTop: "1rem",
              marginBottom: "1.5rem",
              padding: "1rem",
              background: "#F8FAFC",
              borderRadius: "8px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Visitor Name</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--brand-heading)", marginTop: "0.2rem" }}>
                {verifiedEntry.visitorName}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Category</div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--brand-primary)", marginTop: "0.2rem", textTransform: "capitalize" }}>
                {verifiedEntry.category || "Guest"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Reason / Purpose</div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--brand-heading)", marginTop: "0.2rem" }}>
                {verifiedEntry.reason || "Visitor Entry"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Destination / Unit</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--brand-heading)", marginTop: "0.2rem" }}>
                {verifiedEntry.unitLabel}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Vehicle Number</div>
              <div style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.95rem", marginTop: "0.2rem" }}>
                {verifiedEntry.vehicleNumber || "N/A (Pedestrian)"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>Entry Time</div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#065F46", marginTop: "0.2rem" }}>
                {verifiedEntry.enteredAt ? new Date(verifiedEntry.enteredAt).toLocaleTimeString() : "Just now"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              className="btn btn-secondary"
              style={{ padding: "0.6rem 1.25rem", fontSize: "0.95rem", fontWeight: 600 }}
              onClick={() => {
                setVerifiedEntry(null);
                setSuccessMessage("");
                setErrorMessage("");
              }}
            >
              ✓ Next Visitor / Scan
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: "0.6rem 1.5rem", fontSize: "0.95rem", fontWeight: 700, color: "#991B1B", borderColor: "#FECACA" }}
              onClick={handleRecordExit}
              disabled={isExiting}
            >
              🚪 {isExiting ? "Recording…" : "RECORD EXIT NOW"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
