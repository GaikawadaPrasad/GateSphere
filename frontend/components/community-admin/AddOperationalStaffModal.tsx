"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import {
  OPERATIONAL_ROLES,
  type OperationalRoleSlug,
  useCreateOperationalStaff,
} from "@/hooks/use-operational-staff";
import { toast } from "@/store/toast";
import { isValidPersonName } from "@/lib/utils";

interface AddOperationalStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  onSuccess?: () => void;
}

export function AddOperationalStaffModal({
  isOpen,
  onClose,
  communityId,
  onSuccess,
}: AddOperationalStaffModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleSlug, setRoleSlug] = useState<OperationalRoleSlug>("security_guard");
  const [password, setPassword] = useState("GateSphere2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createMutation = useCreateOperationalStaff();

  if (!isOpen) return null;

  const handleRoleSelect = (slug: OperationalRoleSlug) => {
    setRoleSlug(slug);
    // Suggest an intuitive password if default was untouched
    if (password.startsWith("GateSphere2026!") || password.endsWith("@Gate2026!")) {
      const prefix =
        slug === "association_committee"
          ? "Committee"
          : slug === "facility_manager"
            ? "Facility"
            : slug === "security_supervisor"
              ? "Supervisor"
              : slug === "auditor"
                ? "Auditor"
                : slug === "vendor_technician"
                  ? "Vendor"
                  : "Guard";
      setPassword(`${prefix}@Gate2026!`);
    }
  };

  const handleReset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setRoleSlug("security_guard");
    setPassword("Guard@Gate2026!");
    setShowPassword(false);
    setErrorMessage(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage("Please provide a full name (at least 2 characters).");
      return;
    }

    if (!isValidPersonName(trimmedName)) {
      setErrorMessage("Full name must contain only alphabetic letters and spaces.");
      return;
    }

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 10) {
      setErrorMessage("Password must be at least 10 characters long.");
      return;
    }

    if (trimmedPhone && !/^[+0-9][0-9 \-]{4,19}$/.test(trimmedPhone)) {
      setErrorMessage(
        "Phone number must contain only digits, +, spaces or hyphens (5-20 characters).",
      );
      return;
    }

    if (!communityId) {
      setErrorMessage("No active community selected.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        full_name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone || undefined,
        password: password,
        role_slug: roleSlug,
        community_id: communityId,
      });

      toast.success(
        `Successfully registered ${trimmedName} as ${roleSlug.replace(/_/g, " ")}.`,
        "Staff Provisioned",
      );

      if (onSuccess) onSuccess();
      handleClose();
    } catch (err: any) {
      const detail = err?.message || "Failed to create staff member. Please verify the input.";
      setErrorMessage(detail);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Facility, Security, or Audit Staff"
      size="lg"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", width: "100%" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            {createMutation.isPending ? "Registering..." : "+ Register Personnel"}
          </button>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0 }}>
          Provision an operational user or statutory auditor with credentials to log into GateSphere
          for this community.
        </p>

        {errorMessage && (
          <div
            className="badge badge-danger"
            style={{
              display: "block",
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.85rem",
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Role Selector Cards */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Operational Role <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {OPERATIONAL_ROLES.map((r) => {
              const isSelected = roleSlug === r.slug;
              return (
                <div
                  key={r.slug}
                  onClick={() => handleRoleSelect(r.slug)}
                  style={{
                    padding: "0.85rem",
                    borderRadius: "var(--radius-md)",
                    border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: isSelected ? "rgba(37, 99, 235, 0.05)" : "var(--card-bg)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>{r.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--fg)" }}>
                      {r.name}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {r.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Basic Details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
              Full Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              required
              className="input"
              placeholder="e.g. Johnathan Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
              Email Address <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="email"
              required
              className="input"
              placeholder="e.g. j.vance@gatesphere.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
              Phone Number{" "}
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>(optional)</span>
            </label>
            <input
              type="number"
              className="input"
              placeholder="e.g. +1 555-019-2834"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.35rem",
              }}
            >
              <label style={{ fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>
                Initial Password <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={10}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%" }}
            />
            <span
              style={{
                fontSize: "0.7rem",
                color: "var(--muted)",
                marginTop: "0.2rem",
                display: "block",
              }}
            >
              Minimum 10 characters. Provide this to the staff member for initial login.
            </span>
          </div>
        </div>

        {/* Selected Role Summary Callout */}
        <div
          style={{
            background: "var(--bg-muted)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "0.75rem 1rem",
            fontSize: "0.8rem",
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--fg)", marginBottom: "0.25rem" }}>
            Assigned Capabilities:
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--muted)", lineHeight: 1.5 }}>
            {OPERATIONAL_ROLES.find((r) => r.slug === roleSlug)?.responsibilities.map((resp, i) => (
              <li key={i}>{resp}</li>
            ))}
          </ul>
        </div>
      </form>
    </Modal>
  );
}
