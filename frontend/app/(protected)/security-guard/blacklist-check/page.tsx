"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { blacklistApi } from "@/lib/api";
import { toast } from "@/store/toast";

export default function SecurityGuardBlacklistCheckPage() {
  const [query, setQuery] = useState("");
  const [queryError, setQueryError] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setQueryError("Please enter a name, phone number, or vehicle plate to check.");
      toast.error("Please enter a search term.");
      return;
    }
    if (cleanQuery.length < 2) {
      setQueryError("Search term must be at least 2 characters.");
      toast.error("Search term must be at least 2 characters.");
      return;
    }
    setQueryError("");
    setIsChecking(true);
    try {
      const res = await blacklistApi.check(cleanQuery);
      setResult(res);
      if (res?.blacklisted) {
        toast.error("🚨 Restricted entry! Match found in security blacklist.");
      } else {
        toast.success("✅ Clear to enter. No blacklist match found.");
      }
    } catch (err: any) {
      setResult(null);
      toast.error(err?.message || "Failed to query blacklist registry.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Instant Blacklist Lookup Console"
        subtitle="Perform high-speed identity and vehicle plate checks against the security blacklist registry"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Guard" },
          { label: "Blacklist Check" },
        ]}
      />

      <div
        className="card"
        style={{ marginBottom: "1.75rem", background: "linear-gradient(135deg, #ffffff, #f8fafc)" }}
      >
        <h3 className="card-title" style={{ marginBottom: "1rem" }}>
          🔍 Instant Identity / Vehicle Check
        </h3>

        <form onSubmit={handleSearch} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                className="input-field"
                placeholder="Search Name, Phone (+91...), or Vehicle Plate (e.g. KA-02-Z-9999)..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (queryError) setQueryError("");
                }}
                style={{ fontSize: "1.05rem", padding: "0.75rem 1rem", fontWeight: 600 }}
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isChecking}
              style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", fontWeight: 700 }}
            >
              {isChecking ? "Checking…" : "SEARCH REGISTRY"}
            </button>
          </div>
          {queryError && (
            <span style={{ color: "var(--danger, #ef4444)", fontSize: "0.8rem", fontWeight: 500 }}>
              {queryError}
            </span>
          )}
        </form>
      </div>

      {result && (
        <div>
          {result.blacklisted ? (
            <div
              className="card"
              style={{
                background: "var(--danger-light)",
                border: "2px solid var(--danger)",
                color: "#991b1b",
                padding: "1.5rem",
              }}
            >
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  marginBottom: "0.75rem",
                  color: "#991b1b",
                }}
              >
                🚨 ENTRY RESTRICTED — MATCH FOUND IN BLACKLIST REGISTRY
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>
                    Blacklisted Person / Entity
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{result.entry.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>
                    Vehicle Plate #
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "monospace" }}>
                    {result.entry.vehicle_number || "N/A"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>
                    Recorded Security Reason
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{result.entry.reason}</div>
                </div>
              </div>
              <div
                style={{
                  padding: "0.75rem",
                  background: "#fee2e2",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid #fca5a5",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                }}
              >
                🛑 MANDATORY ACTION: DO NOT ALLOW GATE ENTRY. Notify Security Supervisor
                immediately.
              </div>
            </div>
          ) : (
            <div
              className="card"
              style={{
                background: "var(--success-light)",
                border: "1px solid var(--success-border)",
                color: "#065f46",
                padding: "1.5rem",
              }}
            >
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  marginBottom: "0.5rem",
                  color: "#065f46",
                }}
              >
                ✅ NO RESTRICTIONS FOUND
              </h3>
              <p style={{ color: "#047857", fontSize: "0.9rem" }}>
                No blacklist entries or security violations match &quot;{query}&quot;. Normal gate
                verification workflow may proceed.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
