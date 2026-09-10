"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { visitorsApi } from "@/lib/api";

interface VerifiedEntry {
  entryId: string;
  visitorName: string;
  unitLabel: string;
  vehicleNumber?: string | null;
  status: string;
}

export default function SecurityGuardLiveGatePage() {
  const [passInput, setPassInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedEntry, setVerifiedEntry] = useState<VerifiedEntry | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isExiting, setIsExiting] = useState(false);

  // Real backend: verifying a pass IS recording the entry — POST /visitors/entries accepts
  // a pass_token or pin and resolves the matching request server-side. There is no separate
  // /gate/verify-pass endpoint.
  const handleVerifyPass = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = passInput.trim();
    if (!raw) return;
    setIsVerifying(true);
    setErrorMessage("");
    setSuccessMessage("");
    setVerifiedEntry(null);

    try {
      const isPin = /^\d{4,12}$/.test(raw);
      const entry = await visitorsApi.recordEntry(isPin ? { pin: raw } : { pass_token: raw });

      let visitorName = "Visitor";
      let unitLabel = "—";
      try {
        if (entry.request_id) {
          const request = await visitorsApi.getRequest(entry.request_id as string);
          if (request?.visitor_id) {
            const directory = await visitorsApi.directory({ q: undefined });
            const match = (directory || []).find((v: any) => v.id === request.visitor_id);
            if (match) visitorName = (match as any).full_name || visitorName;
          }
          unitLabel = (request?.group_label as string) || (request?.visitor_type as string)?.replace(/_/g, " ") || unitLabel;
        }
      } catch {
        // Entry was recorded successfully even if the enrichment lookups fail — show what we have.
      }

      setVerifiedEntry({
        entryId: entry.id as string,
        visitorName,
        unitLabel,
        vehicleNumber: entry.vehicle_number as string | null,
        status: entry.status as string,
      });
      setSuccessMessage(`✅ Entry recorded for ${visitorName}`);
    } catch (err: any) {
      setErrorMessage(`❌ ${err?.message || "Invalid pass / PIN, or visitor is blacklisted"}`);
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
      setSuccessMessage("");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to record exit.");
    }
    setIsExiting(false);
  };

  return (
    <div>
      <PageHeader
        title="Live Security Gate Verification Console"
        subtitle="Pass / PIN verification doubles as entry recording, with blacklist screening enforced server-side"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Guard" }, { label: "Live Gate" }]}
      />

      {/* Pass Verification Form Card */}
      <div className="card" style={{ marginBottom: "1.75rem", background: "linear-gradient(135deg, #ffffff, #f8fafc)" }}>
        <h3 className="card-title" style={{ marginBottom: "1rem" }}>
          🔍 Verify & Record Entry (QR Token or PIN)
        </h3>

        <form onSubmit={handleVerifyPass} style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Scan QR token or enter 4-12 digit PIN..."
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
        <div className="card" style={{ marginBottom: "1.75rem", border: "2px solid var(--primary)" }}>
          <div className="card-header">
            <h3 className="card-title">Entry Recorded</h3>
            <StatusBadge status={verifiedEntry.status} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Visitor Name</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{verifiedEntry.visitorName}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Purpose / Group</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", textTransform: "capitalize" }}>{verifiedEntry.unitLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Vehicle Number</div>
              <div style={{ fontWeight: 600, fontFamily: "monospace" }}>{verifiedEntry.vehicleNumber || "N/A"}</div>
            </div>
          </div>

          <button
            className="btn btn-secondary"
            style={{ padding: "0.75rem 2rem", fontSize: "1rem", fontWeight: 700 }}
            onClick={handleRecordExit}
            disabled={isExiting}
          >
            🚪 {isExiting ? "Recording…" : "RECORD EXIT"}
          </button>
        </div>
      )}
    </div>
  );
}
