"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/common/Modal";
import { usersApi } from "@/lib/api";
import type { Role } from "@/types/rbac";
import { toast } from "@/store/toast";
import { isValidPersonName } from "@/constants/locations";

const INCOMPATIBLE_ROLE_PAIRS: [string, string][] = [
  ["security_guard", "vendor_technician"],
  ["security_supervisor", "vendor_technician"],
  ["security_guard", "domestic_staff"],
  ["vendor_technician", "domestic_staff"],
];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  super_admin: "Super Admin",
  community_admin: "Community Admin",
  association_committee: "Association Committee",
  facility_manager: "Facility Manager",
  security_supervisor: "Security Supervisor",
  security_guard: "Security Guard",
  resident: "Resident",
  domestic_staff: "Domestic Staff",
  vendor_technician: "Vendor/Technician",
  auditor: "Auditor",
};

function getIncompatibleRoleError(
  activeRoleSlugs: string[],
  targetRoleSlug: string,
): string | null {
  for (const [r1, r2] of INCOMPATIBLE_ROLE_PAIRS) {
    if (targetRoleSlug === r1 && activeRoleSlugs.includes(r2)) {
      return `First revoke the ${ROLE_DISPLAY_NAMES[r2] || r2} role, then ${ROLE_DISPLAY_NAMES[r1] || r1} can be granted.`;
    }
    if (targetRoleSlug === r2 && activeRoleSlugs.includes(r1)) {
      return `First revoke the ${ROLE_DISPLAY_NAMES[r1] || r1} role, then ${ROLE_DISPLAY_NAMES[r2] || r2} can be granted.`;
    }
  }
  return null;
}

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
  created_at?: string;
  updated_at?: string;
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
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [assignedRoles, setAssignedRoles] = useState<UserRoleGrant[]>(user?.roles || []);

  const [selectedRoleSlug, setSelectedRoleSlug] = useState("");
  const [communityIdInput, setCommunityIdInput] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGrantingRole, setIsGrantingRole] = useState(false);
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setIsActive(user.is_active !== false);
      setAssignedRoles(user.roles || []);
      setConfirmDelete(false);
      setErrorMessage(null);
    }
  }, [user]);

  const activeRoleSlugs = assignedRoles.map((r) => r.role_slug);
  const selectedRoleConflict = selectedRoleSlug
    ? getIncompatibleRoleError(activeRoleSlugs, selectedRoleSlug)
    : null;

  if (!user || !isOpen) return null;

  const validateProfile = () => {
    const errors: Record<string, string> = {};
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.fullName = "Full name must be at least 2 characters long.";
    } else if (!isValidPersonName(trimmedName)) {
      errors.fullName = "Full name must contain only alphabets and spaces.";
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address.";
    }
    if (phone.trim() && !/^[+0-9][0-9 \-]{4,19}$/.test(phone.trim())) {
      errors.phone = "Phone must be 5-20 digits (e.g. +91 9876543210).";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateProfile()) return;

    if (selectedRoleSlug) {
      const conflictMsg = getIncompatibleRoleError(activeRoleSlugs, selectedRoleSlug);
      if (conflictMsg) {
        setErrorMessage(conflictMsg);
        toast.error(conflictMsg, "Role Assignment Blocked");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await usersApi.update(user.id, {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        is_active: isActive,
      });

      if (selectedRoleSlug && !activeRoleSlugs.includes(selectedRoleSlug)) {
        const targetCommunityId =
          communityIdInput ||
          assignedRoles.find((r) => r.community_id)?.community_id ||
          user.roles?.find((r) => r.community_id)?.community_id ||
          undefined;

        await usersApi.grantRole(user.id, {
          role_slug: selectedRoleSlug,
          community_id: targetCommunityId,
        });
      }

      toast.success(`Updated profile and access for ${fullName.trim()}.`, "User Updated");
      await queryClient.invalidateQueries({ queryKey: ["users"], refetchType: "all" });
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || "Failed to update user profile";
      setErrorMessage(msg);
      toast.error(msg, "Update Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGrantRole = async () => {
    if (!selectedRoleSlug) return;
    setErrorMessage(null);

    const conflictMsg = getIncompatibleRoleError(activeRoleSlugs, selectedRoleSlug);
    if (conflictMsg) {
      setErrorMessage(conflictMsg);
      toast.error(conflictMsg, "Role Assignment Blocked");
      return;
    }

    const targetCommunityId =
      communityIdInput ||
      assignedRoles.find((r) => r.community_id)?.community_id ||
      user.roles?.find((r) => r.community_id)?.community_id ||
      undefined;

    setIsGrantingRole(true);
    try {
      const res = await usersApi.grantRole(user.id, {
        role_slug: selectedRoleSlug,
        community_id: targetCommunityId,
      });
      toast.success(`Role "${selectedRoleSlug}" granted to ${user.full_name}.`, "Role Assigned");

      const grantedRole = availableRoles.find((r) => r.slug === selectedRoleSlug);
      const newGrant: UserRoleGrant = {
        id: (res as any)?.id || `${user.id}-${selectedRoleSlug}-${Date.now()}`,
        role_slug: selectedRoleSlug,
        role_name: grantedRole?.name || selectedRoleSlug,
        community_id: targetCommunityId || null,
      };
      setAssignedRoles((prev) => [
        ...prev.filter((r) => r.role_slug !== selectedRoleSlug),
        newGrant,
      ]);

      setSelectedRoleSlug("");
      setCommunityIdInput("");
      await queryClient.invalidateQueries({ queryKey: ["users"], refetchType: "all" });
      onSuccess();
    } catch (err: any) {
      const msg = err?.message || "Failed to grant role";
      setErrorMessage(msg);
      toast.error(msg, "Grant Role Failed");
    } finally {
      setIsGrantingRole(false);
    }
  };

  const handleRevokeRole = async (grantId: string) => {
    setIsRevokingId(grantId);
    setErrorMessage(null);
    try {
      await usersApi.revokeRole(user.id, grantId);
      toast.success(`Role assignment revoked from ${user.full_name}.`, "Role Revoked");
      setAssignedRoles((prev) => prev.filter((r) => r.id !== grantId));
      await queryClient.invalidateQueries({ queryKey: ["users"], refetchType: "all" });
      onSuccess();
    } catch (err: any) {
      const msg = err?.message || "Failed to revoke role";
      setErrorMessage(msg);
      toast.error(msg, "Revoke Role Failed");
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
      toast.success(`User account for ${user.full_name} deleted.`, "User Deleted");
      await queryClient.invalidateQueries({ queryKey: ["users"], refetchType: "all" });
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || "Failed to delete user";
      setErrorMessage(msg);
      toast.error(msg, "Delete User Failed");
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            alignItems: "center",
          }}
        >
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
        <form
          onSubmit={handleUpdateProfile}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <h4
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "var(--brand-heading)",
              marginBottom: "-0.25rem",
            }}
          >
            1. User Profile Details
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label
                htmlFor="edit-user-fullname"
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--brand-heading)",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Full Name
              </label>
              <input
                id="edit-user-fullname"
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
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  {fieldErrors.fullName}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-user-email"
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--brand-heading)",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Email Address
              </label>
              <input
                id="edit-user-email"
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
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-user-phone"
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--brand-heading)",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Phone Number
              </label>
              <input
                id="edit-user-phone"
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
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#ef4444",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  {fieldErrors.phone}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-user-status"
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--brand-heading)",
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                Account Status
              </label>
              <select
                id="edit-user-status"
                className="form-control"
                value={isActive ? "active" : "inactive"}
                onChange={(e) => setIsActive(e.target.value === "active")}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--border-standard)",
                }}
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

          {assignedRoles && assignedRoles.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {assignedRoles.map((grant) => (
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
                      Scope:{" "}
                      {grant.community_id ? `Community: ${grant.community_id}` : "Platform-Global"}
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
              <label
                htmlFor="select-role-to-grant"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--brand-heading)",
                  display: "block",
                  marginBottom: "0.2rem",
                }}
              >
                Select Role to Grant
              </label>
              <select
                id="select-role-to-grant"
                className="form-control"
                value={selectedRoleSlug}
                onChange={(e) => setSelectedRoleSlug(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.45rem 0.65rem",
                  fontSize: "0.85rem",
                  borderRadius: "var(--radius-input)",
                  border: "1px solid var(--border-standard)",
                }}
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

          {selectedRoleConflict && (
            <div
              style={{
                padding: "0.5rem 0.75rem",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                color: "#991b1b",
                borderRadius: "var(--radius-input)",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span>⚠️</span>
              <span>{selectedRoleConflict}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
