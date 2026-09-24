"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import {
  type OperationalStaffUser,
  getRoleMeta,
  useUpdateOperationalStaff,
} from "@/hooks/use-operational-staff";
import { toast } from "@/store/toast";
import { formatDateTime } from "@/lib/utils";

interface OperationalStaffDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: OperationalStaffUser | null;
  communityId?: string;
  onUpdated?: () => void;
}

export function OperationalStaffDetailsModal({
  isOpen,
  onClose,
  staff,
  communityId,
  onUpdated,
}: OperationalStaffDetailsModalProps) {
  const [isToggling, setIsToggling] = useState(false);
  const updateMutation = useUpdateOperationalStaff();

  if (!isOpen || !staff) return null;

  const primaryRole = staff.roles[0]?.role_slug || "security_guard";
  const roleMeta = getRoleMeta(primaryRole);

  const handleToggleStatus = async () => {
    try {
      setIsToggling(true);
      const newStatus = !staff.is_active;
      await updateMutation.mutateAsync({
        userId: staff.id,
        communityId,
        data: { is_active: newStatus },
      });

      toast.success(
        `${staff.full_name} is now ${newStatus ? "Active" : "Deactivated"}.`,
        "Status Updated",
      );

      if (onUpdated) onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status", "Error");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Staff Personnel Profile"
      size="md"
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <button
            type="button"
            className={staff.is_active ? "btn btn-danger" : "btn btn-secondary"}
            onClick={handleToggleStatus}
            disabled={isToggling}
            style={{ fontSize: "0.85rem" }}
          >
            {isToggling
              ? "Updating..."
              : staff.is_active
                ? "Deactivate Account"
                : "Activate Account"}
          </button>

          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Header Avatar & Identity */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "1rem",
            background: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {roleMeta.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)" }}>
                {staff.full_name}
              </h3>
              <span
                className={`badge ${staff.is_active ? "badge-success" : "badge-danger"}`}
                style={{ fontSize: "0.75rem" }}
              >
                {staff.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              {staff.email}
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            background: "var(--bg-muted)",
            padding: "1rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
          }}
        >
          <div>
            <span
              style={{
                color: "var(--muted)",
                display: "block",
                fontSize: "0.75rem",
                marginBottom: "0.15rem",
              }}
            >
              Assigned Role
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--fg)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span>{roleMeta.icon}</span> {roleMeta.name}
            </span>
          </div>

          <div>
            <span
              style={{
                color: "var(--muted)",
                display: "block",
                fontSize: "0.75rem",
                marginBottom: "0.15rem",
              }}
            >
              Contact Phone
            </span>
            <span style={{ fontWeight: 600, color: "var(--fg)" }}>
              {staff.phone || "Not provided"}
            </span>
          </div>

          <div>
            <span
              style={{
                color: "var(--muted)",
                display: "block",
                fontSize: "0.75rem",
                marginBottom: "0.15rem",
              }}
            >
              User ID
            </span>
            <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--muted)" }}>
              {staff.id.substring(0, 18)}...
            </span>
          </div>

          <div>
            <span
              style={{
                color: "var(--muted)",
                display: "block",
                fontSize: "0.75rem",
                marginBottom: "0.15rem",
              }}
            >
              Registered On
            </span>
            <span style={{ fontWeight: 500, color: "var(--fg)" }}>
              {staff.created_at ? formatDateTime(staff.created_at) : "System Seed"}
            </span>
          </div>
        </div>

        {/* Role Responsibilities */}
        <div>
          <h4
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--fg)",
            }}
          >
            Operational Scope &amp; Responsibilities
          </h4>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>
            {roleMeta.description}
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.2rem",
              fontSize: "0.8rem",
              color: "var(--muted)",
              lineHeight: 1.5,
            }}
          >
            {roleMeta.responsibilities.map((resp, idx) => (
              <li key={idx}>{resp}</li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
