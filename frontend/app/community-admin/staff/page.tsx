"use client";

import { useState, useEffect } from "react";
import { useUiStore } from "@/store/ui";
import {
  useStaffList,
  useStaffAttendance,
  useStaffAssignments,
  useCheckInStaff,
  useCheckOutStaff,
  useCreateStaff,
  useCreateStaffAssignment,
  useEndStaffAssignment,
  useDeleteStaff,
} from "@/hooks/use-staff";
import { useGates, useCommunityUnits } from "@/hooks/use-communities";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterPanel } from "@/components/common/FilterPanel";
import { Modal } from "@/components/common/Modal";
import { OperationalStaffView } from "@/components/community-admin/OperationalStaffView";
import { UpdateUserCredentialsModal, type CredentialUser } from "@/components/common/UpdateUserCredentialsModal";
import { useOperationalStaff } from "@/hooks/use-operational-staff";
import type {
  Staff,
  StaffAttendance,
  StaffAssignment,
  StaffType,
  VerificationStatus,
} from "@/types/staff";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function CommunityAdminStaffPage() {
  const { activeCommunityId } = useUiStore();
  const [activeTab, setActiveTab] = useState<"directory" | "committee" | "security" | "attendance">("directory");
  const [credentialUser, setCredentialUser] = useState<CredentialUser | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (
        tab === "committee" ||
        tab === "association" ||
        tab === "association-committee" ||
        tab === "association_committee" ||
        tab === "associate-committee"
      ) {
        setActiveTab("committee");
      } else if (tab === "security" || tab === "operational" || tab === "facility") {
        setActiveTab("security");
      } else if (tab === "attendance") {
        setActiveTab("attendance");
      }
    }
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  // Queries
  const {
    data: staffList,
    isLoading: staffLoading,
    refetch: refetchStaff,
  } = useStaffList({
    community_id: activeCommunityId || undefined,
    q: searchTerm || undefined,
    page_size: 100,
  });

  const { data: operationalStaff = [] } = useOperationalStaff(activeCommunityId || undefined);
  const committeeMembers = operationalStaff.filter((u) =>
    u.roles.some((r) => r.role_slug === "association_committee")
  );
  const facilityAndSecurityStaff = operationalStaff.filter((u) =>
    u.roles.some((r) => r.role_slug !== "association_committee")
  );

  const {
    data: attendance,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useStaffAttendance({
    community_id: activeCommunityId || undefined,
    page_size: 100,
  });

  const { data: assignments } = useStaffAssignments({ staff_id: selectedStaff?.id });
  const { data: gates } = useGates(activeCommunityId || undefined);

  // Mutations
  const checkIn = useCheckInStaff();
  const checkOut = useCheckOutStaff();
  const createStaff = useCreateStaff();
  const createAssignment = useCreateStaffAssignment();
  const endAssignment = useEndStaffAssignment();
  const deleteStaff = useDeleteStaff();
  const { data: communityUnits } = useCommunityUnits(activeCommunityId || undefined);

  // Modals state
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [isAssignUnitModalOpen, setIsAssignUnitModalOpen] = useState(false);
  const [assignUnitId, setAssignUnitId] = useState("");
  const [assignWorkType, setAssignWorkType] = useState<string>("part_time");
  const [assignDays, setAssignDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  const [checkInForm, setCheckInForm] = useState<{ staff_id: string; gate_id: string }>({
    staff_id: "",
    gate_id: "",
  });
  const [newStaffForm, setNewStaffForm] = useState<{
    full_name: string;
    phone: string;
    email: string;
    password: string;
    staff_type: StaffType;
    id_type: string;
    id_number: string;
    police_verification_status: VerificationStatus;
  }>({
    full_name: "",
    phone: "",
    email: "",
    password: "",
    staff_type: "maid",
    id_type: "Aadhaar",
    id_number: "",
    police_verification_status: "not_started",
  });
  const [showStaffPassword, setShowStaffPassword] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete Staff State
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Handle Check-in
  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInForm.staff_id) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await checkIn.mutateAsync({
        staff_id: checkInForm.staff_id,
        gate_id: checkInForm.gate_id || undefined,
      });
      setIsCheckInModalOpen(false);
      setCheckInForm({ staff_id: "", gate_id: "" });
      refetchAttendance();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to record check-in");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Check-out
  const handleCheckOut = async (attendanceId: string) => {
    try {
      await checkOut.mutateAsync(attendanceId);
      refetchAttendance();
    } catch (err) {
      console.error(err);
    }
  };

  const [staffFieldErrors, setStaffFieldErrors] = useState<Record<string, string>>({});

  const validateStaffForm = () => {
    const errors: Record<string, string> = {};
    const trimmedName = newStaffForm.full_name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.full_name = "Staff member name must be at least 2 characters.";
    }

    const trimmedPhone = newStaffForm.phone.trim();
    if (!trimmedPhone || !/^\+?[0-9\s\-()]{7,20}$/.test(trimmedPhone)) {
      errors.phone = "Please enter a valid phone number.";
    }

    const trimmedEmail = newStaffForm.email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    setStaffFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle Add Staff
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) return;

    if (!validateStaffForm()) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const nameFirst = newStaffForm.full_name.trim().split(" ")[0].toLowerCase() || "staff";
      const resolvedDefaultPassword = `${nameFirst}@Gate2026!`;

      await createStaff.mutateAsync({
        data: {
          full_name: newStaffForm.full_name.trim(),
          staff_type: newStaffForm.staff_type,
          phone: newStaffForm.phone.trim(),
          email: newStaffForm.email.trim() || undefined,
          password:
            newStaffForm.password.trim() ||
            (newStaffForm.email.trim() ? resolvedDefaultPassword : undefined),
          id_type: newStaffForm.id_type ? newStaffForm.id_type.trim() : undefined,
          id_number: newStaffForm.id_number ? newStaffForm.id_number.trim() : undefined,
          police_verification_status: newStaffForm.police_verification_status,
        },
        communityId: activeCommunityId,
      });
      setIsAddStaffModalOpen(false);
      setShowStaffPassword(true);
      setStaffFieldErrors({});
      setNewStaffForm({
        full_name: "",
        phone: "",
        email: "",
        password: "staff@Gate2026!",
        staff_type: "maid",
        id_type: "Aadhaar",
        id_number: "",
        police_verification_status: "not_started",
      });
      refetchStaff();
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        const mappedErrors: Record<string, string> = {};
        for (const [fKey, fVal] of Object.entries(err.fields)) {
          const key = fKey.replace(/^body\./, "").replace(/^data\./, "");
          mappedErrors[key] = Array.isArray(fVal) ? fVal.join(", ") : String(fVal);
        }
        setStaffFieldErrors(mappedErrors);
        setErrorMessage(null);
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Failed to register staff");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteStaff.mutateAsync(staffToDelete.id);
      setStaffToDelete(null);
      setSelectedStaff(null);
      refetchStaff();
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete staff profile.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Directory Columns
  const staffColumns: Column<Staff>[] = [
    {
      key: "full_name",
      header: "Staff Member",
      sortable: true,
      render: (s) => (
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#e0f2fe",
              color: "#0369a1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: "0.8rem",
            }}
          >
            {s.full_name?.charAt(0)?.toUpperCase() || "S"}
          </div>
          <div>
            <strong>{s.full_name}</strong>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>📞 {s.phone}</div>
          </div>
        </div>
      ),
    },
    {
      key: "staff_type",
      header: "Role / Skill",
      sortable: true,
      render: (s) => (
        <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
          {s.staff_type}
        </span>
      ),
    },
    {
      key: "police_verification_status",
      header: "Police Verification",
      sortable: true,
      render: (s) => {
        const status = s.police_verification_status;
        const isVerified = status === "verified";
        const isPending = status === "pending";
        const isRejected = status === "rejected";
        return (
          <span
            className={`badge ${isVerified ? "badge-success" : isRejected ? "badge-danger" : isPending ? "badge-warning" : "badge-neutral"}`}
            style={{ textTransform: "capitalize" }}
          >
            {isVerified ? "Verified ✓" : status?.replace("_", " ") || "Not Started"}
          </span>
        );
      },
    },
    {
      key: "is_active",
      header: "Status",
      sortable: true,
      render: (s) => (
        <span className={`badge ${s.is_active ? "badge-success" : "badge-danger"}`}>
          {s.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      render: (s) => (
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            onClick={() => setSelectedStaff(s)}
          >
            View Profile →
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", background: "#f8fafc" }}
            onClick={() =>
              setCredentialUser({
                id: s.user_id || s.id,
                full_name: s.full_name,
                email: s.email || "",
                phone: s.phone || "",
                roleName: s.staff_type || "Domestic Staff",
              })
            }
            title="Update Credentials"
          >
            🔑 Credentials
          </button>
        </div>
      ),
    },
  ];

  // Attendance Columns
  const attendanceColumns: Column<StaffAttendance>[] = [
    {
      key: "staff_name",
      header: "Staff Member",
      render: (a) => {
        const staff = staffList?.find((s) => s.id === a.staff_id);
        const name = a.staff_name || staff?.full_name || "Domestic Staff";
        const role = a.staff_type || staff?.staff_type || "Staff";
        return (
          <div>
            <strong>{name}</strong>
            <div
              style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "capitalize" }}
            >
              {role}
            </div>
          </div>
        );
      },
    },
    {
      key: "check_in_at",
      header: "Check-In Time",
      render: (a) => formatDateTime(a.check_in_at),
    },
    {
      key: "check_out_at",
      header: "Check-Out Time",
      render: (a) =>
        a.check_out_at ? (
          formatDateTime(a.check_out_at)
        ) : (
          <span className="badge badge-success">Currently In</span>
        ),
    },
    {
      key: "attendance_status",
      header: "Status",
      render: (a) => (
        <span
          className={`badge ${!a.check_out_at ? "badge-success" : "badge-neutral"}`}
          style={{ textTransform: "capitalize" }}
        >
          {a.attendance_status || (!a.check_out_at ? "Checked In" : "Checked Out")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Action",
      render: (a) => (
        <div>
          {!a.check_out_at && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
              onClick={() => handleCheckOut(a.id)}
            >
              Check Out
            </button>
          )}
        </div>
      ),
    },
  ];

  const filteredStaff = staffList?.filter((s) => !typeFilter || s.staff_type === typeFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <PageHeader
        title={
          activeTab === "committee"
            ? "Association Committee"
            : activeTab === "security"
            ? "Facility & Security Personnel"
            : activeTab === "attendance"
            ? "Live Attendance Log"
            : "Domestic & Support Staff"
        }
        description={
          activeTab === "committee"
            ? "Governance oversight, elected committee members, assessment reviewers, and policy administrators."
            : activeTab === "security"
            ? "Facility managers, security supervisors, and gate guard personnel."
            : activeTab === "attendance"
            ? "Daily workforce check-in and check-out logs recorded at security checkpoints."
            : "Workforce registry, daily gate attendance tracking, police verification, and unit service assignments."
        }
        action={
          activeTab === "directory" ? (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setErrorMessage(null);
                  setIsCheckInModalOpen(true);
                }}
              >
                ⏱️ Record Check-In
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setErrorMessage(null);
                  setNewStaffForm({
                    full_name: "",
                    phone: "",
                    email: "",
                    password: "staff@Gate2026!",
                    staff_type: "maid",
                    id_type: "Aadhaar",
                    id_number: "",
                    police_verification_status: "not_started",
                  });
                  setShowStaffPassword(true);
                  setIsAddStaffModalOpen(true);
                }}
              >
                + Register Staff
              </button>
            </div>
          ) : activeTab === "attendance" ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setErrorMessage(null);
                setIsCheckInModalOpen(true);
              }}
            >
              ⏱️ Record Check-In
            </button>
          ) : null
        }
      />

      {/* Navigation Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "1.5rem", overflowX: "auto" }}>
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "directory" ? 700 : 500,
            color: activeTab === "directory" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "directory" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          🛠️ Domestic Staff ({staffList?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("committee")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "committee" ? 700 : 500,
            color: activeTab === "committee" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "committee" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          🏛️ Association Committee ({committeeMembers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "security" ? 700 : 500,
            color: activeTab === "security" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "security" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          🛡️ Facility &amp; Security Personnel ({facilityAndSecurityStaff.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("attendance")}
          style={{
            padding: "0.75rem 0",
            border: "none",
            background: "transparent",
            fontSize: "0.95rem",
            fontWeight: activeTab === "attendance" ? 700 : 500,
            color: activeTab === "attendance" ? "var(--primary)" : "var(--muted)",
            borderBottom:
              activeTab === "attendance" ? "2px solid var(--primary)" : "2px solid transparent",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ⏱️ Live Attendance Log ({attendance?.length || 0})
        </button>
      </div>

      {activeTab === "directory" && (
        <div>
          <FilterPanel
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search staff by name or phone..."
            filterValue={typeFilter}
            onFilterChange={setTypeFilter}
            filterLabel="Staff Role"
            filterOptions={[
              { label: "Maid / Housekeeper", value: "maid" },
              { label: "Cook / Chef", value: "cook" },
              { label: "Driver", value: "driver" },
              { label: "Gardener", value: "gardener" },
              { label: "Caretaker", value: "caretaker" },
              { label: "Nanny", value: "nanny" },
              { label: "Nurse", value: "nurse" },
              { label: "Other", value: "other" },
            ]}
          />

          <DataTable
            columns={staffColumns}
            data={filteredStaff as (Staff & Record<string, unknown>)[]}
            isLoading={staffLoading}
            emptyTitle="No staff registered"
            emptyDescription="Register domestic helpers and support technicians for this community."
            enableClientPagination={true}
          />
        </div>
      )}

      {activeTab === "committee" && (
        <div style={{ marginTop: "0.5rem" }}>
          <OperationalStaffView
            embeddedInTab={true}
            allowedRoleSlugs={["association_committee"]}
            title="🏛️ Association Committee Members"
            description="View, register, and provision elected Association Committee members for community governance, budgets, assessments, and policy approvals."
            addButtonText="+ Add Committee Member"
            defaultAddRole="association_committee"
          />
        </div>
      )}

      {activeTab === "security" && (
        <div style={{ marginTop: "0.5rem" }}>
          <OperationalStaffView
            embeddedInTab={true}
            allowedRoleSlugs={["facility_manager", "security_supervisor", "security_guard"]}
            title="🛡️ Facility & Security Personnel"
            description="View and provision Facility Managers, Security Supervisors, and Security Guards for this community."
            addButtonText="+ Add Personnel"
            defaultAddRole="security_guard"
          />
        </div>
      )}

      {activeTab === "attendance" && (
        <DataTable
          columns={attendanceColumns}
          data={attendance as (StaffAttendance & Record<string, unknown>)[]}
          isLoading={attendanceLoading}
          emptyTitle="No attendance records"
          emptyDescription="Daily check-ins recorded at security gates will appear here."
          enableClientPagination={true}
        />
      )}

      {/* Staff Profile & Assigned Units Modal */}
      <Modal
        isOpen={Boolean(selectedStaff)}
        onClose={() => setSelectedStaff(null)}
        title={selectedStaff ? `Staff Profile: ${selectedStaff.full_name}` : "Staff Profile"}
      >
        {selectedStaff && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Role / Category</div>
                <div style={{ fontWeight: 600, textTransform: "capitalize", marginTop: "0.2rem" }}>
                  {selectedStaff.staff_type}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Phone Contact</div>
                <div style={{ fontWeight: 600, marginTop: "0.2rem" }}>{selectedStaff.phone}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Police Verification
                </div>
                <div style={{ marginTop: "0.2rem" }}>
                  <span
                    className={`badge ${selectedStaff.police_verification_status === "verified" ? "badge-success" : selectedStaff.police_verification_status === "rejected" ? "badge-danger" : "badge-warning"}`}
                    style={{ textTransform: "capitalize" }}
                  >
                    {selectedStaff.police_verification_status === "verified"
                      ? "Verified ✓"
                      : selectedStaff.police_verification_status?.replace("_", " ") || "Pending"}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>ID Document</div>
                <div style={{ fontWeight: 500, marginTop: "0.2rem" }}>
                  {selectedStaff.id_type ? `${selectedStaff.id_type}: ` : ""}
                  {selectedStaff.id_number || "–"}
                </div>
              </div>
            </div>

            {/* Assigned Units */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  🚪 Assigned Residential Units
                </h4>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                  onClick={() => setIsAssignUnitModalOpen(true)}
                >
                  + Assign Unit
                </button>
              </div>
              {assignments && assignments.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {assignments.map((asg: StaffAssignment) => (
                    <div
                      key={asg.id}
                      style={{
                        padding: "0.5rem 0.75rem",
                        background: "#ffffff",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div>
                        <strong>Unit {asg.unit_number || asg.unit_id}</strong> (
                        {asg.tower_name || "Tower"})
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.5rem" }}>
                          {asg.work_type}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <span className={`badge ${asg.is_active ? "badge-success" : "badge-neutral"}`}>
                          {asg.is_active ? "Active" : "Ended"}
                        </span>
                        {asg.is_active && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem", color: "#dc2626" }}
                            onClick={async () => {
                              if (confirm("End this staff assignment?")) {
                                await endAssignment.mutateAsync(asg.id);
                              }
                            }}
                          >
                            End
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>
                  No residential units currently assigned.
                </div>
              )}
            </div>

            {/* Danger Zone — Delete Profile */}
            <div
              style={{
                borderTop: "1px solid #fecaca",
                paddingTop: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div style={{ fontSize: "0.775rem", color: "#b91c1c" }}>
                ⚠️ Permanently removes this staff profile and all associated access records.
              </div>
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.85rem", flexShrink: 0 }}
                onClick={() => setStaffToDelete(selectedStaff)}
              >
                🗑️ Delete Profile
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Staff Confirmation Modal */}
      <Modal
        isOpen={Boolean(staffToDelete)}
        onClose={() => {
          setStaffToDelete(null);
          setDeleteError("");
        }}
        title="⚠️ Delete Staff Profile"
      >
        {staffToDelete && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🗑️</span>
                <strong style={{ fontSize: "0.95rem", color: "#991b1b" }}>
                  This action is permanent and cannot be undone.
                </strong>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#7f1d1d", margin: 0, lineHeight: 1.5 }}>
                You are about to permanently delete the profile of{" "}
                <strong>{staffToDelete.full_name}</strong> ({staffToDelete.staff_type}).
              </p>
              <p style={{ fontSize: "0.8rem", color: "#991b1b", margin: 0 }}>
                This will remove their gate access, attendance records, and all unit assignments.
              </p>
            </div>

            {deleteError && (
              <div
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--radius-sm)",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setStaffToDelete(null);
                  setDeleteError("");
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteStaff}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Yes, Delete Permanently"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Unit Modal */}
      <Modal
        isOpen={isAssignUnitModalOpen}
        onClose={() => {
          setIsAssignUnitModalOpen(false);
          setAssignUnitId("");
        }}
        title={`Assign Unit to ${selectedStaff?.full_name}`}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selectedStaff?.id || !assignUnitId) return;
            try {
              setIsSubmitting(true);
              setErrorMessage(null);
              await createAssignment.mutateAsync({
                staff_id: selectedStaff.id,
                unit_id: assignUnitId,
                work_type: assignWorkType,
                days_of_week: assignDays,
              });
              setIsAssignUnitModalOpen(false);
              setAssignUnitId("");
            } catch (err: unknown) {
              console.error(err);
              setErrorMessage(err instanceof Error ? err.message : "Failed to assign unit");
            } finally {
              setIsSubmitting(false);
            }
          }}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {errorMessage && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                color: "#b91c1c",
                fontSize: "0.85rem",
              }}
            >
              {errorMessage}
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Select Residential Unit *
            </label>
            <select
              className="select-field"
              required
              value={assignUnitId}
              onChange={(e) => setAssignUnitId(e.target.value)}
            >
              <option value="">-- Choose Unit --</option>
              {communityUnits?.map((u: any) => (
                <option key={u.id} value={u.id}>
                  Unit {u.unit_number} {u.tower_name ? `(${u.tower_name})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.25rem" }}>
              Service / Work Type
            </label>
            <select
              className="select-field"
              value={assignWorkType}
              onChange={(e) => setAssignWorkType(e.target.value)}
            >
              <option value="part_time">Part Time</option>
              <option value="full_time">Full Time</option>
              <option value="daily_help">Daily Help</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "0.85rem", fontWeight: 600, display: "block", marginBottom: "0.4rem" }}>
              Working Days
            </label>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => {
                const isSelected = assignDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setAssignDays(assignDays.filter((d) => d !== day));
                      } else {
                        setAssignDays([...assignDays, day]);
                      }
                    }}
                    style={{
                      padding: "0.3rem 0.55rem",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: isSelected ? "var(--primary)" : "var(--border)",
                      backgroundColor: isSelected ? "var(--primary)" : "transparent",
                      color: isSelected ? "#ffffff" : "inherit",
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAssignUnitModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Assigning..." : "Assign Unit"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Gate Check-in Modal */}
      <Modal
        isOpen={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        title="Record Staff Gate Check-In"
      >
        <form
          onSubmit={handleCheckIn}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          {errorMessage && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "var(--radius-sm)",
                color: "#b91c1c",
                fontSize: "0.85rem",
              }}
            >
              {errorMessage}
            </div>
          )}

          <div>
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Select Staff Member
            </label>
            <select
              className="select-field"
              required
              value={checkInForm.staff_id}
              onChange={(e) => setCheckInForm({ ...checkInForm, staff_id: e.target.value })}
            >
              <option value="">-- Choose Staff --</option>
              {staffList?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.staff_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "block",
                marginBottom: "0.25rem",
              }}
            >
              Entry Gate (Optional)
            </label>
            <select
              className="select-field"
              value={checkInForm.gate_id}
              onChange={(e) => setCheckInForm({ ...checkInForm, gate_id: e.target.value })}
            >
              <option value="">-- Main Gate / Default --</option>
              {gates?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              marginTop: "1rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCheckInModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !checkInForm.staff_id}
            >
              {isSubmitting ? "Recording…" : "Confirm Check-In"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Register Staff Modal */}
      <Modal
        isOpen={isAddStaffModalOpen}
        onClose={() => setIsAddStaffModalOpen(false)}
        title="👤 Register New Domestic Staff"
        size="lg"
        maxWidth={680}
      >
        <form
          onSubmit={handleAddStaff}
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxHeight: "80vh", overflowY: "auto", paddingRight: "0.25rem" }}
        >
          {errorMessage && (
            <div
              style={{
                padding: "0.75rem 1rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#b91c1c",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Section 1: Staff Identity & Dashboard Credentials */}
          <div
            style={{
              padding: "1rem",
              background: "#F8FAFC",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span>👤</span> 1. Staff Identity &amp; Portal Login
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div>
                <label
                  htmlFor="staff_full_name"
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  Full Name <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  id="staff_full_name"
                  type="text"
                  className="input-field"
                  required
                  aria-invalid={Boolean(staffFieldErrors.full_name)}
                  aria-describedby={staffFieldErrors.full_name ? "staff_full_name_error" : undefined}
                  placeholder="e.g. Ramesh Kumar"
                  value={newStaffForm.full_name}
                  onChange={(e) => {
                    const val = e.target.value;
                    const cleanName = val.trim().replace(/[^a-zA-Z0-9]/g, "");
                    const firstName = cleanName.length > 0 ? cleanName.toLowerCase() : "staff";
                    const newPwd = `${firstName}@Gate2026!`;

                    setNewStaffForm((prev) => ({
                      ...prev,
                      full_name: val,
                      password: newPwd,
                    }));
                  }}
                  style={{
                    borderColor: staffFieldErrors.full_name ? "#EF4444" : undefined,
                  }}
                />
                {staffFieldErrors.full_name && (
                  <span
                    id="staff_full_name_error"
                    role="alert"
                    title={staffFieldErrors.full_name}
                    style={{ fontSize: "0.75rem", color: "#EF4444", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                  >
                    <span>⚠️</span> {staffFieldErrors.full_name}
                  </span>
                )}
              </div>

              <div>
                <label
                  htmlFor="staff_phone"
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  Phone Number <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  id="staff_phone"
                  type="tel"
                  className="input-field"
                  required
                  aria-invalid={Boolean(staffFieldErrors.phone)}
                  aria-describedby={staffFieldErrors.phone ? "staff_phone_error" : undefined}
                  placeholder="+91 9876543210"
                  value={newStaffForm.phone}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                  style={{
                    borderColor: staffFieldErrors.phone ? "#EF4444" : undefined,
                  }}
                />
                {staffFieldErrors.phone && (
                  <span
                    id="staff_phone_error"
                    role="alert"
                    title={staffFieldErrors.phone}
                    style={{ fontSize: "0.75rem", color: "#EF4444", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                  >
                    <span>⚠️</span> {staffFieldErrors.phone}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
              <div>
                <label
                  htmlFor="staff_email"
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  Email Address <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>(For Dashboard Login)</span>
                </label>
                <input
                  id="staff_email"
                  type="email"
                  className="input-field"
                  aria-invalid={Boolean(staffFieldErrors.email)}
                  aria-describedby={staffFieldErrors.email ? "staff_email_error" : undefined}
                  placeholder="e.g. ramesh.maid@gatesphere.com"
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  style={{
                    borderColor: staffFieldErrors.email ? "#EF4444" : undefined,
                  }}
                />
                {staffFieldErrors.email && (
                  <span
                    id="staff_email_error"
                    role="alert"
                    title={staffFieldErrors.email}
                    style={{ fontSize: "0.75rem", color: "#EF4444", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
                  >
                    <span>⚠️</span> {staffFieldErrors.email}
                  </span>
                )}
              </div>

              <div>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  Initial Password{" "}
                  <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>
                    (Editable)
                  </span>
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type={showStaffPassword ? "text" : "password"}
                    className="input-field"
                    style={{ paddingRight: "2.5rem" }}
                    placeholder="e.g. ramesh@Gate2026!"
                    value={newStaffForm.password}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    aria-label={showStaffPassword ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute",
                      right: "0.6rem",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--muted)",
                      padding: "0.2rem",
                    }}
                  >
                    {showStaffPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)" }}>
              💡 Providing an email allows this staff member to sign in to the <strong>Domestic Staff Dashboard</strong> to view unit assignments and check-in logs.
            </p>
          </div>

          {/* Section 2: Role & Government Identification */}
          <div
            style={{
              padding: "1rem",
              background: "#F8FAFC",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "0.85rem",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--primary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span>🛠️</span> 2. Profession &amp; Identification
            </div>

            <div>
              <label
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.3rem",
                }}
              >
                Role / Profession <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <select
                className="select-field"
                value={newStaffForm.staff_type}
                onChange={(e) =>
                  setNewStaffForm({ ...newStaffForm, staff_type: e.target.value as StaffType })
                }
              >
                <option value="maid">Maid / Housekeeper</option>
                <option value="cook">Cook / Chef</option>
                <option value="driver">Driver</option>
                <option value="gardener">Gardener</option>
                <option value="caretaker">Caretaker</option>
                <option value="nanny">Nanny</option>
                <option value="nurse">Nurse</option>
                <option value="other">Other Support Staff</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.85rem" }}>
              <div>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  Govt ID Type
                </label>
                <select
                  className="select-field"
                  value={newStaffForm.id_type}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, id_type: e.target.value })}
                >
                  <option value="Aadhaar">Aadhaar</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Passport">Passport</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    display: "block",
                    marginBottom: "0.3rem",
                  }}
                >
                  ID Number
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder={
                    newStaffForm.id_type === "Aadhaar"
                      ? "e.g. 1234-5678-9012"
                      : newStaffForm.id_type === "Voter ID"
                        ? "e.g. ABC1234567"
                        : newStaffForm.id_type === "PAN Card"
                          ? "e.g. ABCDE1234F"
                          : newStaffForm.id_type === "Driving License"
                            ? "e.g. DL-1420110012345"
                            : newStaffForm.id_type === "Passport"
                              ? "e.g. A12345678"
                              : "e.g. ID Document Number"
                  }
                  value={newStaffForm.id_number}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, id_number: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Verification & Security */}
          <div
            style={{
              padding: "0.85rem 1rem",
              background: "#F8FAFC",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <input
              type="checkbox"
              id="police_verified"
              checked={newStaffForm.police_verification_status === "verified"}
              onChange={(e) =>
                setNewStaffForm({
                  ...newStaffForm,
                  police_verification_status: e.target.checked ? "verified" : "not_started",
                })
              }
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            <label htmlFor="police_verified" style={{ fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", color: "var(--fg)" }}>
              🛡️ Police background verification completed
            </label>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.65rem",
              marginTop: "0.5rem",
              borderTop: "1px solid var(--border)",
              paddingTop: "1rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddStaffModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Registering…" : "Register Staff"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Credentials Modal */}
      <UpdateUserCredentialsModal
        isOpen={Boolean(credentialUser)}
        onClose={() => setCredentialUser(null)}
        user={credentialUser}
        onSuccess={() => refetchStaff()}
      />
    </div>
  );
}
