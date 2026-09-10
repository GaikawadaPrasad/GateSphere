"use client";

import { useState } from "react";
import { useUiStore } from "@/store/ui";
import {
  useStaffList,
  useStaffAttendance,
  useStaffAssignments,
  useCheckInStaff,
  useCheckOutStaff,
  useCreateStaff,
} from "@/hooks/use-staff";
import { useGates } from "@/hooks/use-communities";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterPanel } from "@/components/common/FilterPanel";
import { Modal } from "@/components/common/Modal";
import type {
  Staff,
  StaffAttendance,
  StaffAssignment,
  StaffType,
  VerificationStatus,
} from "@/types/staff";
import { formatDateTime } from "@/lib/utils";

export default function CommunityAdminStaffPage() {
  const { activeCommunityId } = useUiStore();
  const [activeTab, setActiveTab] = useState<"directory" | "attendance">("directory");
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
  });

  const {
    data: attendance,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useStaffAttendance({
    community_id: activeCommunityId || undefined,
  });

  const { data: assignments } = useStaffAssignments({ staff_id: selectedStaff?.id });
  const { data: gates } = useGates(activeCommunityId || undefined);

  // Mutations
  const checkIn = useCheckInStaff();
  const checkOut = useCheckOutStaff();
  const createStaff = useCreateStaff();

  // Modals state
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [checkInForm, setCheckInForm] = useState<{ staff_id: string; gate_id: string }>({
    staff_id: "",
    gate_id: "",
  });
  const [newStaffForm, setNewStaffForm] = useState<{
    full_name: string;
    phone: string;
    staff_type: StaffType;
    id_type: string;
    id_number: string;
    police_verification_status: VerificationStatus;
  }>({
    full_name: "",
    phone: "",
    staff_type: "maid",
    id_type: "Aadhaar",
    id_number: "",
    police_verification_status: "not_started",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Handle Add Staff
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunityId) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await createStaff.mutateAsync({
        data: {
          full_name: newStaffForm.full_name.trim(),
          staff_type: newStaffForm.staff_type,
          phone: newStaffForm.phone.trim(),
          id_type: newStaffForm.id_type ? newStaffForm.id_type.trim() : undefined,
          id_number: newStaffForm.id_number ? newStaffForm.id_number.trim() : undefined,
          police_verification_status: newStaffForm.police_verification_status,
        },
        communityId: activeCommunityId,
      });
      setIsAddStaffModalOpen(false);
      setNewStaffForm({
        full_name: "",
        phone: "",
        staff_type: "maid",
        id_type: "Aadhaar",
        id_number: "",
        police_verification_status: "not_started",
      });
      refetchStaff();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to register staff");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Directory Columns
  const staffColumns: Column<Staff>[] = [
    {
      key: "name",
      header: "Staff Member",
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
      render: (s) => (
        <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
          {s.staff_type}
        </span>
      ),
    },
    {
      key: "police_verification_status",
      header: "Police Verification",
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
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
          onClick={() => setSelectedStaff(s)}
        >
          View Profile →
        </button>
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
        title="Domestic &amp; Support Staff"
        description="Workforce registry, daily gate attendance tracking, police verification, and unit service assignments."
        action={
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
                setIsAddStaffModalOpen(true);
              }}
            >
              + Register Staff
            </button>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: "1.5rem" }}>
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
          }}
        >
          🛠️ Staff Directory ({staffList?.length || 0})
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
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                🚪 Assigned Residential Units
              </h4>
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
                        fontSize: "0.85rem",
                      }}
                    >
                      <span>
                        <strong>Unit {asg.unit_number || asg.unit_id}</strong> (
                        {asg.tower_name || "Tower"})
                      </span>
                      <span className="badge badge-success">Active Service</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>
                  No residential units currently assigned.
                </div>
              )}
            </div>
          </div>
        )}
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
        title="Register New Domestic Staff"
      >
        <form
          onSubmit={handleAddStaff}
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
              Full Name
            </label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="e.g. Ramesh Kumar"
              value={newStaffForm.full_name}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, full_name: e.target.value })}
            />
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
              Phone Number
            </label>
            <input
              type="tel"
              className="input-field"
              required
              placeholder="+91 9876543210"
              value={newStaffForm.phone}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
            />
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
              Role / Profession
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

          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "0.75rem" }}>
            <div>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
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
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.25rem",
                }}
              >
                ID Number
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 1234-5678-9012"
                value={newStaffForm.id_number}
                onChange={(e) => setNewStaffForm({ ...newStaffForm, id_number: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
            />
            <label htmlFor="police_verified" style={{ fontSize: "0.85rem", cursor: "pointer" }}>
              Police background verification completed
            </label>
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
    </div>
  );
}
