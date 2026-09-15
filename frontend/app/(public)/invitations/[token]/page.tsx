"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onboardingApi } from "@/lib/api";

interface InvitationDetails {
  token: string;
  community_id: string;
  community_name?: string;
  unit_number?: string;
  invited_email: string;
  invited_phone?: string;
  full_name?: string;
  occupancy_role?: string;
  status: string;
  expires_at?: string;
}

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === "string" ? params.token : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InvitationDetails | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation token");
      setLoading(false);
      return;
    }

    onboardingApi
      .viewInvitation(token)
      .then((res: any) => {
        setInvite(res);
        if (res.full_name) setFullName(res.full_name);
        if (res.invited_phone) setPhone(res.invited_phone);
      })
      .catch((err: any) => {
        setError(err?.message || "Invitation not found or has expired");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters long.";
    }
    if (phone && !/^\+?[0-9\s\-()]{7,20}$/.test(phone)) {
      errors.phone = "Invalid phone number format.";
    }
    if (password) {
      if (password.length < 8) {
        errors.password = "Password must be at least 8 characters long.";
      } else if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
        errors.password = "Password must contain at least one letter and one digit.";
      }
      if (password !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!validateForm()) return;

    try {
      isSubmittingRef.current = true;
      setSubmitting(true);
      setError(null);

      await onboardingApi.acceptInvitation(token, {
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        password: password || undefined,
      });

      setAccepted(true);
    } catch (err: any) {
      setError(err?.message || "Failed to accept invitation. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--surface-ground, #f8fafc)",
        padding: "2rem 1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)",
          padding: "2rem",
          border: "1px solid var(--border-light, #e2e8f0)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-main, #0f172a)" }}>
            GateSphere Community Invitation
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted, #64748b)", marginTop: "0.25rem" }}>
            Join your residential community portal
          </p>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-muted)" }}>
            Verifying invitation token...
          </div>
        )}

        {error && !accepted && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              color: "#991b1b",
              fontSize: "0.875rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {accepted && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#dcfce7",
                color: "#166534",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                marginBottom: "1rem",
              }}
            >
              ✓
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#15803d" }}>
              Invitation Accepted!
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#475569", margin: "0.5rem 0 1.5rem" }}>
              Your account has been set up successfully. You can now sign in to access your community dashboard.
            </p>
            <Link href="/login">
              <button className="btn btn-primary" style={{ width: "100%" }}>Proceed to Sign In</button>
            </Link>
          </div>
        )}

        {!loading && invite && !accepted && (
          <div>
            <div
              style={{
                background: "#f8fafc",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1.5rem",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.875rem" }}>
                <div>
                  <span style={{ color: "#64748b" }}>Invited Email: </span>
                  <strong>{invite.invited_email}</strong>
                </div>
                {invite.unit_number && (
                  <div>
                    <span style={{ color: "#64748b" }}>Assigned Unit: </span>
                    <strong>{invite.unit_number}</strong>
                  </div>
                )}
                {invite.occupancy_role && (
                  <div>
                    <span style={{ color: "#64748b" }}>Role: </span>
                    <strong style={{ textTransform: "capitalize" }}>{invite.occupancy_role}</strong>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "0.35rem",
                  }}
                >
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: `1px solid ${fieldErrors.fullName ? "#ef4444" : "#cbd5e1"}`,
                  }}
                />
                {fieldErrors.fullName && (
                  <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>
                    {fieldErrors.fullName}
                  </span>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "0.35rem",
                  }}
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: `1px solid ${fieldErrors.phone ? "#ef4444" : "#cbd5e1"}`,
                  }}
                />
                {fieldErrors.phone && (
                  <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>
                    {fieldErrors.phone}
                  </span>
                )}
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "0.35rem",
                  }}
                >
                  Password (Optional if already registered)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a secure password"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: `1px solid ${fieldErrors.password ? "#ef4444" : "#cbd5e1"}`,
                  }}
                />
                {fieldErrors.password && (
                  <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              {password && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      marginBottom: "0.35rem",
                    }}
                  >
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: `1px solid ${fieldErrors.confirmPassword ? "#ef4444" : "#cbd5e1"}`,
                    }}
                  />
                  {fieldErrors.confirmPassword && (
                    <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>
                      {fieldErrors.confirmPassword}
                    </span>
                  )}
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ marginTop: "0.5rem", width: "100%" }}>
                {submitting ? "Accepting..." : "Accept Invitation & Activate Account"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
