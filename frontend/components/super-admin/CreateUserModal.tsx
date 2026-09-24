"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/common/Modal";
import { toast } from "@/store/toast";
import { usersApi, communitiesApi } from "@/lib/api";
import type { Role } from "@/types/rbac";
import { isValidPersonName } from "@/constants/locations";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRoleSlug?: string;
  preselectedCommunityId?: string;
  lockCommunity?: boolean;
  availableRoles?: Role[];
  onSuccess: () => void;
}

export function CreateUserModal({
  isOpen,
  onClose,
  defaultRoleSlug = "community_admin",
  preselectedCommunityId = "",
  lockCommunity = false,
  availableRoles = [],
  onSuccess,
}: CreateUserModalProps) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("GateSphere2026!");
  const [phone, setPhone] = useState("");
  const [roleSlug, setRoleSlug] = useState(defaultRoleSlug);
  const [communityId, setCommunityId] = useState(preselectedCommunityId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (preselectedCommunityId) {
        setCommunityId(preselectedCommunityId);
      }
      if (defaultRoleSlug) {
        setRoleSlug(defaultRoleSlug);
      }
      setErrorMessage(null);
      setFieldErrors({});
    }
  }, [isOpen, preselectedCommunityId, defaultRoleSlug]);

  const { data: communities } = useQuery({
    queryKey: ["communities"],
    queryFn: () => communitiesApi.list(),
  });

  if (!isOpen) return null;

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.fullName = "Full name must be at least 2 characters long.";
    } else if (!isValidPersonName(trimmedName)) {
      errors.fullName = "Full name must contain only alphabets and spaces.";
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password || password.length < 10) {
      errors.password = "Password must be at least 10 characters long.";
    } else if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      errors.password = "Password must contain at least one letter and one digit.";
    }

    if (!phone.trim()) {
      errors.phone = "Phone number is required.";
    } else if (!/^[+0-9][0-9 \-]{4,19}$/.test(phone.trim())) {
      errors.phone = "Phone must be 5-20 digits (e.g. +91 9876543210).";
    }

    if (roleSlug !== "super_admin" && !communityId) {
      errors.communityId = "A community must be selected for community-assigned roles.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (roleSlug === "community_admin" && communityId) {
        // Provision directly via community admin endpoint or user create
        await usersApi.create({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || undefined,
          role_slug: roleSlug,
          community_id: communityId,
        });
      } else {
        await usersApi.create({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || undefined,
          role_slug: roleSlug || undefined,
          community_id: communityId || undefined,
        });
      }

      toast.success(`User "${fullName.trim()}" created successfully!`);
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["users"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["dashboards"], refetchType: "all" }),
      ]);

      onSuccess();
      onClose();
      // Reset form
      setFullName("");
      setEmail("");
      setPhone("");
      setCommunityId("");
      setFieldErrors({});
    } catch (err: any) {
      const msg = err?.message || "Failed to create admin / user";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        roleSlug === "community_admin" ? "Create New Community Admin" : "Create User & Assign Role"
      }
      size="md"
      footer={
        <>
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
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create & Assign"}
          </button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
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
            ⚠️ {errorMessage}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label
              htmlFor="createUserFullName"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--brand-heading)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Full Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="createUserFullName"
              type="text"
              className="form-control"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rajesh Kumar"
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
              htmlFor="createUserEmail"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--brand-heading)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Email Address <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="createUserEmail"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@community.com"
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
              htmlFor="createUserPassword"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--brand-heading)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Initial Password <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="createUserPassword"
              type="text"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-input)",
                border: `1px solid ${fieldErrors.password ? "#ef4444" : "var(--border-standard)"}`,
              }}
            />
            {fieldErrors.password && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#ef4444",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                {fieldErrors.password}
              </span>
            )}
          </div>

          <div>
            <label
              htmlFor="createUserPhone"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--brand-heading)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Phone Number
            </label>
            <input
              id="createUserPhone"
              type="text"
              className="form-control"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              required
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
              htmlFor="createUserRole"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--brand-heading)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Assign Role <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <select
              id="createUserRole"
              className="form-control"
              value={roleSlug}
              onChange={(e) => setRoleSlug(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-input)",
                border: "1px solid var(--border-standard)",
              }}
            >
              <optgroup label="Community Administrative & Management">
                <option value="community_admin">Community Admin (community_admin)</option>
                <option value="association_committee">
                  Association Committee (association_committee)
                </option>
                <option value="facility_manager">Facility Manager (facility_manager)</option>
              </optgroup>
              <optgroup label="Operations, Compliance & Staff">
                <option value="vendor_technician">Vendor Technician (vendor_technician)</option>
                <option value="auditor">Auditor — Read-Only (auditor)</option>
                <option value="domestic_staff">Domestic Staff (domestic_staff)</option>
                <option value="security_supervisor">
                  Security Supervisor (security_supervisor)
                </option>
                <option value="security_guard">Security Guard (security_guard)</option>
              </optgroup>
              <optgroup label="Platform System">
                <option value="super_admin">Super Admin (super_admin)</option>
              </optgroup>
              {availableRoles
                .filter(
                  (r) =>
                    ![
                      "community_admin",
                      "super_admin",
                      "association_committee",
                      "facility_manager",
                      "vendor_technician",
                      "auditor",
                      "domestic_staff",
                      "security_supervisor",
                      "security_guard",
                    ].includes(r.slug),
                )
                .map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name} ({r.slug})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="createUserCommunity"
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--brand-heading)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Assigned Community{" "}
              {roleSlug !== "super_admin" && <span style={{ color: "var(--danger)" }}>*</span>}
            </label>
            <select
              id="createUserCommunity"
              className="form-control"
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              disabled={lockCommunity}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-input)",
                border: `1px solid ${fieldErrors.communityId ? "#ef4444" : "var(--border-standard)"}`,
                backgroundColor: lockCommunity ? "var(--surface-muted, #f8fafc)" : "inherit",
              }}
            >
              <option value="">-- Platform-Global / Select Community --</option>
              {(communities || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            {fieldErrors.communityId && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#ef4444",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                {fieldErrors.communityId}
              </span>
            )}
            {lockCommunity && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  marginTop: "0.25rem",
                  display: "block",
                }}
              >
                🔒 Locked to active community
              </span>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
