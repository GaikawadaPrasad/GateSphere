"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { PasswordField } from "@/components/forms/PasswordField";
import { usersApi } from "@/lib/api";
import { toast } from "@/store/toast";
import { isValidPersonName } from "@/lib/utils";

export interface CredentialUser {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  roleName?: string;
}

interface UpdateUserCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: CredentialUser | null;
  onSuccess?: () => void;
}

export function UpdateUserCredentialsModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: UpdateUserCredentialsModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && isOpen) {
      setFullName(user.full_name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setPassword("");
      setErrorMsg("");
      setFieldErrors({});
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const validate = () => {
    const errs: Record<string, string> = {};
    const trimmed = fullName.trim();
    if (!trimmed || trimmed.length < 2) {
      errs.fullName = "Full name must be at least 2 characters.";
    } else if (!isValidPersonName(trimmed)) {
      errs.fullName = "Full name must contain only alphabets and spaces.";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address.";
    }
    if (password && password.length < 8) {
      errs.password = "Password must be at least 8 characters.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!validate()) return;

    try {
      setIsSubmitting(true);
      await usersApi.update(user.id, {
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password: password.trim() || undefined,
      });

      toast.success(`Updated credentials for ${fullName.trim()}.`, "Credentials Updated");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to update credentials:", err);
      setErrorMsg(err?.message || "Failed to update credentials. Please check inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`🔑 Update Credentials — ${user.full_name}`}
      maxWidth={520}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", width: "100%" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" form="update-credentials-form" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Save Credentials"}
          </button>
        </div>
      }
    >
      <form id="update-credentials-form" onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "0.6rem 0.85rem",
                borderRadius: "6px",
                fontSize: "0.82rem",
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              fontSize: "0.8rem",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>Target Account:</span> {user.full_name}
            </div>
            {user.roleName && (
              <span className="badge badge-primary" style={{ fontSize: "0.7rem", textTransform: "capitalize" }}>
                {user.roleName.replace(/_/g, " ")}
              </span>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "0.3rem" }}>
              Full Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              required
            />
            {fieldErrors.fullName && (
              <span style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.2rem", display: "block" }}>
                {fieldErrors.fullName}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "0.3rem" }}>
                Login Email
              </label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
              {fieldErrors.email && (
                <span style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.2rem", display: "block" }}>
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "0.3rem" }}>
                Phone Number
              </label>
              <input
                type="number"
                className="input-field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div>
            <PasswordField
              label="New Password"
              subLabel="(Leave blank to keep existing password)"
              value={password}
              onChange={(val) => setPassword(val)}
              placeholder="Enter new password (min 8 chars)"
              helperText="💡 Changing password will revoke active sessions and require the user to sign in with their new credentials."
            />
            {fieldErrors.password && (
              <span style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.2rem", display: "block" }}>
                {fieldErrors.password}
              </span>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
