"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { gateApi, blacklistApi } from "@/lib/api";

export default function SecurityGuardLiveGatePage() {
  const [passInput, setPassInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleVerifyPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passInput.trim()) return;
    setIsVerifying(true);
    setErrorMessage("");
    setSuccessMessage("");
    setVerificationResult(null);

    // 1. Blacklist Check
    const blCheck = await blacklistApi.check(passInput.trim());
    if (blCheck.blacklisted) {
      setErrorMessage(`🚨 DENIED: Entity is on Blacklist (${blCheck.entry?.reason})`);
      setIsVerifying(false);
      return;
    }

    // 2. Pass Verification
    const res = await gateApi.verifyPass(passInput.trim());
    if (!res.valid) {
      setErrorMessage(`❌ ${res.reason || "Invalid Pass Code"}`);
    } else {
      setVerificationResult(res.visitor);
      setSuccessMessage(`✅ Pass Valid: ${res.visitor.name} for ${res.visitor.unit}`);
    }
    setIsVerifying(false);
  };

  const handleRecordEntry = async () => {
    if (!verificationResult) return;
    await gateApi.recordEntry({ visitor_name: verificationResult.name, pass_code: passInput });
    alert(`Entry recorded for ${verificationResult.name} at Main Gate North`);
    setVerificationResult(null);
    setPassInput("");
    setSuccessMessage("");
  };

  const handleRecordExit = async () => {
    if (!verificationResult) return;
    await gateApi.recordExit({ visitor_name: verificationResult.name, pass_code: passInput });
    alert(`Exit recorded for ${verificationResult.name}`);
    setVerificationResult(null);
    setPassInput("");
    setSuccessMessage("");
  };

  return (
    <div>
      <PageHeader
        title="Live Security Gate Verification Console"
        subtitle="Operational pass & QR verification, instant blacklist checks, resident approval verification, and entry/exit logging"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Live Gate" }]}
      />

      {/* Pass Verification Form Card */}
      <div className="card" style={{ marginBottom: "1.75rem", background: "linear-gradient(135deg, #ffffff, #f8fafc)" }}>
        <h3 className="card-title" style={{ marginBottom: "1rem" }}>
          🔍 Fast Pass / QR Code Verification
        </h3>

        <form onSubmit={handleVerifyPass} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Enter Pass Code / OTP / Vehicle Plate (e.g. GP-9912)..."
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              style={{ fontSize: "1.05rem", padding: "0.75rem 1rem", fontWeight: 600, fontFamily: "monospace" }}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isVerifying || !passInput.trim()}
            style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", fontWeight: 700 }}
          >
            {isVerifying ? "Verifying…" : "CHECK PASS"}
          </button>
        </form>

        {/* Feedback Banners */}
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
      {verificationResult && (
        <div className="card" style={{ marginBottom: "1.75rem", border: "2px solid var(--primary)" }}>
          <div className="card-header">
            <h3 className="card-title">Pass Verification Result</h3>
            <StatusBadge status="Valid Pass" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Visitor Name</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{verificationResult.name}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Destination Unit</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{verificationResult.unit}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Host Resident</div>
              <div style={{ fontWeight: 600 }}>{verificationResult.resident}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Vehicle Number</div>
              <div style={{ fontWeight: 600, fontFamily: "monospace" }}>{verificationResult.vehicle || "N/A"}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              className="btn btn-primary"
              style={{ padding: "0.75rem 2rem", fontSize: "1rem", fontWeight: 700 }}
              onClick={handleRecordEntry}
            >
              ✅ ALLOW ENTRY
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: "0.75rem 2rem", fontSize: "1rem", fontWeight: 700 }}
              onClick={handleRecordExit}
            >
              🚪 RECORD EXIT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
