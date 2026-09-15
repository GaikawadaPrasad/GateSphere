"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { usersApi } from "@/lib/api";
import type { Role } from "@/types/rbac";

export interface UserRoleGrant {
  id: string;
  role_id?: string;
  role_slug: string;
  role_name?: string;
  community_id?: string | null;
}

export interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active?: boolean;
  is_superadmin?: boolean;
  roles?: UserRoleGrant[];
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserRecord | null;
  availableRoles?: Role[];
  onSuccess: () => void;
}

export function EditUserModal({
  isOpen,
  onClose,
  user,
  availableRoles = [],
  onSuccess,
}: EditUserModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [selectedRoleSlug, setSelectedRoleSlug] = useState("");
  const [communityIdInput, setCommunityIdInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGrantingRole, setIsGrantingRole] = useState(false);
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setIsActive(user.is_active !== false);
      setConfirmDelete(false);
      setErrorMessage(null);
    }
  }, [user]);

  if (!user || !isOpen) return null;

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateProfile = () => {
    const errors: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = "Full name must be at least 2 characters long.";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    if (phone.trim() && !/^\+?[0-9\s\-()]{7,20}$/.test(phone.trim())) {
      errors.phone = "Invalid phone number format.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateProfile()) return;

    setIsSubmitting(true);
    try {
      await usersApi.update(user.id, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        is_active: isActive,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update user profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGrantRole = async () => {
    if (!selectedRoleSlug) return;
    setIsGrantingRole(true);
    setErrorMessage(null);
    try {
      await usersApi.grantRole(user.id, {
        role_slug: selectedRoleSlug,
        community_id: communityIdInput || undefined,
      });
      setSelectedRoleSlug("");
      setCommunityIdInput("");
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to grant role");
    } finally {
      setIsGrantingRole(false);
    }
  };

  const handleRevokeRole = async (grantId: string) => {
    setIsRevokingId(grantId);
    setErrorMessage(null);
    try {
      await usersApi.revokeRole(user.id, grantId);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to revoke role");
    } finally {
      setIsRevokingId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsDeletingUser(true);
    setErrorMessage(null);
    try {
      await usersApi.delete(user.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to delete user");
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit User Access — ${user.full_name}`}
      size="lg"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-danger"
            style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}
            onClick={handleDeleteUser}
            disabled={isDeletingUser || isSubmitting}
          >
            {isDeletingUser
              ? "Deleting..."
              : confirmDelete
              ? "⚠️ Confirm Delete Person"
              : "Delete Person"}
          </button>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUpdateProfile}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {errorMessage && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
              borderRadius: "var(--radius-input)",
              fontSize: "0.85rem",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* User Profile Details */}
        <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--brand-heading)", marginBottom: "-0.25rem" }}>
            1. User Profile Details
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--brand-heading)", display: "block", marginBottom: "0.25rem" }}>
                Full Name
              </label>
              <input
                type="text"
                className="form-control"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-input)",
                  border: `1px solid ${fieldErrors.fullName ? "#ef4444" : "var(--border-standard)"}`,
                }}
              />
              {fieldErrors.fullName && (
                <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>
                  {fieldErrors.fullName}
                </span>
              )}
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--brand-heading)", display: "block", marginBottom: "0.25rem" }}>
                Email Address
              </label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-input)",
                  border: `1px solid ${fieldErrors.email ? "#ef4444" : "var(--border-standard)"}`,
                }}
              />
              {fieldErrors.email && (
                <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--brand-heading)", display: "block", marginBottom: "0.25rem" }}>
                Phone Number
              </label>
              <input
                type="text"
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-input)",
                  border: `1px solid ${fieldErrors.phone ? "#ef4444" : "var(--border-standard)"}`,
                }}
              />
              {fieldErrors.phone && (
                <span style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "0.25rem", display: "block" }}>
                  {fieldErrors.phone}
                </span>
              )}
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--brand-heading)", display: "block", marginBottom: "0.25rem" }}>
                Account Status
              </label>
              <select
                className="form-control"
                value={isActive ? "active" : "inactive"}
                onChange={(e) => setIsActive(e.target.value === "active")}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-input)", border: "1px solid var(--border-standard)" }}
              >
                <option value="active">Active Access</option>
                <option value="inactive">Disabled / Deactivated</option>
              </select>
            </div>
          </div>
        </form>

        <hr style={{ border: "0", borderTop: "1px solid var(--border-standard)" }} />

        {/* Assigned System Roles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--brand-heading)" }}>
            2. Assigned RBAC Roles & Grants
          </h4>

          {user.roles && user.roles.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {user.roles.map((grant) => (
                <div
                  key={grant.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.6rem 0.85rem",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid var(--border-standard)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                    <span className="badge badge-primary" style={{ fontSize: "0.75rem" }}>
                      {grant.role_name || grant.role_slug}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Scope: {grant.community_id ? `Community: ${grant.community_id}` : "Platform-Global"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.75rem", color: "#dc2626", padding: "0.2rem 0.5rem" }}
                    onClick={() => handleRevokeRole(grant.id)}
                    disabled={isRevokingId === grant.id}
                  >
                    {isRevokingId === grant.id ? "Revoking..." : "Revoke Grant"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "0.85rem", color: "var(--muted)", fontStyle: "italic" }}>
              No explicit roles assigned to this user.
            </div>
          )}

          {/* Grant New Role Controls */}
          <div
            style={{
              display: "flex",
              gap: "0.65rem",
              marginTop: "0.5rem",
              alignItems: "flex-end",
              background: "#f1f5f9",
              padding: "0.85rem",
              borderRadius: "6px",
            }}
          >
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--brand-heading)", display: "block", marginBottom: "0.2rem" }}>
                Select Role to Grant
              </label>
              <select
                className="form-control"
                value={selectedRoleSlug}
                onChange={(e) => setSelectedRoleSlug(e.target.value)}
                style={{ width: "100%", padding: "0.45rem 0.65rem", fontSize: "0.85rem", borderRadius: "var(--radius-input)", border: "1px solid var(--border-standard)" }}
              >
                <option value="">-- Choose Role --</option>
                {availableRoles.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name} ({r.slug})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: "0.5rem 0.85rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}
              onClick={handleGrantRole}
              disabled={!selectedRoleSlug || isGrantingRole}
            >
              {isGrantingRole ? "Granting..." : "+ Grant Role"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
