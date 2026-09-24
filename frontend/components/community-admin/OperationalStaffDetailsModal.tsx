"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import {
  type OperationalStaffUser,
  getRoleMeta,
  useUpdateOperationalStaff,
} from "@/hooks/use-operational-staff";
import { useComplaints } from "@/hooks/use-complaints";
import { useGateEvents } from "@/hooks/use-gate";
import { toast } from "@/store/toast";
import { formatDateTime } from "@/lib/utils";
import {
  UpdateUserCredentialsModal,
  type CredentialUser,
} from "@/components/common/UpdateUserCredentialsModal";

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
  const [credentialStaff, setCredentialStaff] = useState<CredentialUser | null>(null);
  const updateMutation = useUpdateOperationalStaff();

  // Queries for vendor work orders and gate movements
  const { data: ticketsData } = useComplaints({
    community_id: communityId,
    page_size: 100,
  });
  const { data: gateEventsData } = useGateEvents({
    community_id: communityId,
    page_size: 100,
  });

  if (!isOpen || !staff) return null;

  const primaryRole = staff.roles[0]?.role_slug || "security_guard";
  const roleMeta = getRoleMeta(primaryRole);
  const isVendor = staff.roles.some((r) => r.role_slug === "vendor_technician");

  // Extract raw tickets list
  const rawTickets: any[] = Array.isArray(ticketsData)
    ? ticketsData
    : Array.isArray((ticketsData as any)?.data)
      ? (ticketsData as any).data
      : [];

  // Filter tickets assigned to this vendor
  const vendorTickets = isVendor
    ? rawTickets.filter(
        (t: any) =>
          t.assigned_to_user_id === staff.id ||
          (t.vendor_name && t.vendor_name.toLowerCase() === staff.full_name.toLowerCase()),
      )
    : [];

  // Extract raw gate events
  const rawEvents: any[] = Array.isArray(gateEventsData)
    ? gateEventsData
    : Array.isArray((gateEventsData as any)?.data)
      ? (gateEventsData as any).data
      : [];

  // Filter gate events for this vendor/staff
  const staffGateEvents = rawEvents.filter((e: any) => {
    const meta = e.metadata || {};
    const refMatch = e.reference_id === staff.id || e.actor_user_id === staff.id;
    const nameMatch =
      (meta.visitor_name && meta.visitor_name.toLowerCase().includes(staff.full_name.toLowerCase())) ||
      (meta.vendor_name && meta.vendor_name.toLowerCase().includes(staff.full_name.toLowerCase())) ||
      (meta.name && meta.name.toLowerCase().includes(staff.full_name.toLowerCase()));
    return refMatch || nameMatch;
  });

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
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isVendor ? "🛠️ Vendor Technician Profile & Logs" : "Staff Personnel Profile"}
        size={isVendor ? "lg" : "md"}
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem" }}>
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
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setCredentialStaff({
                    id: staff.id,
                    full_name: staff.full_name,
                    email: staff.email,
                    phone: staff.phone || "",
                    roleName: roleMeta.name,
                  })
                }
                style={{ fontSize: "0.85rem", background: "#f8fafc" }}
              >
                🔑 Edit Credentials
              </button>
            </div>

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
                background:
                  primaryRole === "vendor_technician"
                    ? "linear-gradient(135deg, #f59e0b, #d97706)"
                    : primaryRole === "facility_manager"
                      ? "linear-gradient(135deg, #8b5cf6, #6d28d9)"
                      : primaryRole === "security_supervisor"
                        ? "linear-gradient(135deg, #f59e0b, #b45309)"
                        : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
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
                {isVendor && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "999px",
                      background: "#fef3c7",
                      color: "#92400e",
                      fontWeight: 600,
                      border: "1px solid #fde68a",
                    }}
                  >
                    🛠️ Facility Vendor
                  </span>
                )}
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
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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
                {staff.id.substring(0, 16)}...
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
                {staff.created_at ? formatDateTime(staff.created_at) : "System Provision"}
              </span>
            </div>
          </div>

          {/* Vendor Specific: Assigned Units, Towers & Work Orders */}
          {isVendor && (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                background: "var(--card-bg)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "var(--fg)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  📍 Unit Visits &amp; Assigned Work Orders ({vendorTickets.length})
                </h4>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Dispatched by Facility Manager
                </span>
              </div>

              {vendorTickets.length === 0 ? (
                <div
                  style={{
                    padding: "1.25rem",
                    textAlign: "center",
                    background: "var(--bg-muted)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  No residential units or repair tickets assigned to this technician yet.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {vendorTickets.map((t: any) => (
                    <div
                      key={t.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.6rem 0.75rem",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-muted)",
                        fontSize: "0.8rem",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: "var(--primary)",
                              fontFamily: "monospace",
                            }}
                          >
                            {t.ticket_number || `TKT-${t.id.slice(0, 6)}`}
                          </span>
                          <span
                            style={{
                              background: "#e0f2fe",
                              color: "#0369a1",
                              padding: "0.15rem 0.45rem",
                              borderRadius: "4px",
                              fontWeight: 600,
                              fontSize: "0.75rem",
                            }}
                          >
                            🏢 Unit {t.unit_number || "—"} {t.tower_name ? `(${t.tower_name})` : ""}
                          </span>
                        </div>
                        <div style={{ color: "var(--fg)", fontWeight: 500, marginTop: "0.2rem" }}>
                          {t.subject}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          className={`badge ${
                            t.status === "resolved" || t.status === "closed"
                              ? "badge-success"
                              : t.status === "in_progress"
                                ? "badge-warning"
                                : "badge-neutral"
                          }`}
                          style={{ fontSize: "0.7rem", textTransform: "capitalize" }}
                        >
                          {t.status?.replace(/_/g, " ")}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {t.created_at ? formatDateTime(t.created_at).split(",")[0] : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Gate Logs for this Staff / Vendor */}
          {staffGateEvents.length > 0 && (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                background: "var(--card-bg)",
              }}
            >
              <h4
                style={{
                  margin: "0 0 0.75rem",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: "var(--fg)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                🚪 Gate Entry &amp; Movement Logs ({staffGateEvents.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {staffGateEvents.slice(0, 5).map((ev: any) => (
                  <div
                    key={ev.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-muted)",
                      fontSize: "0.78rem",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                        {ev.event_type?.replace(/_/g, " ").toUpperCase()}
                      </span>
                      <span style={{ color: "var(--muted)", marginLeft: "0.5rem" }}>
                        {ev.metadata?.gate_name || "Main Gate"}
                      </span>
                    </div>
                    <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>
                      {ev.occurred_at ? formatDateTime(ev.occurred_at) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

      {/* Embedded Credentials Modal */}
      <UpdateUserCredentialsModal
        isOpen={Boolean(credentialStaff)}
        onClose={() => setCredentialStaff(null)}
        user={credentialStaff}
        onSuccess={() => {
          if (onUpdated) onUpdated();
        }}
      />
    </>
  );
}
