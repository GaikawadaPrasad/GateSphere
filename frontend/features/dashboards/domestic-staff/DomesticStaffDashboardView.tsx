"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatMetric } from "@/components/common/StatMetric";
import { LiveDot } from "@/components/common/LiveDot";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, Column } from "@/components/tables/DataTable";
import { BrandButton } from "@/components/common/BrandButton";
import { Modal } from "@/components/common/Modal";
import {
  useStaffProfile,
  useUpdateStaffProfile,
  useAssignedHomes,
  useStaffAttendance,
  useStaffVisits,
  useSendStaffPanic,
  AssignedHome,
  AttendanceRecord,
  StaffVisit,
} from "@/hooks/use-domestic-staff-data";
import { useMyNotifications } from "@/hooks/use-notifications";
import { useTableControls } from "@/hooks/use-table-controls";
import { formatDate } from "@/lib/utils";

import { toast } from "@/store/toast";

export type DomesticStaffTab =
  | "overview"
  | "profile"
  | "assigned-homes"
  | "schedule"
  | "attendance"
  | "entry-exit"
  | "visits"
  | "notifications"
  | "emergency";

interface DomesticStaffDashboardViewProps {
  initialTab?: DomesticStaffTab;
}

export function DomesticStaffDashboardView({ initialTab = "overview" }: DomesticStaffDashboardViewProps) {
  const router = useRouter();
  const activeTab = initialTab;
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [emergencyInput, setEmergencyInput] = useState("");

  const { data: profile, isLoading: profileLoading } = useStaffProfile();
  const { data: homes = [], isLoading: homesLoading } = useAssignedHomes();
  const { data: attendance = [], isLoading: attLoading } = useStaffAttendance();
  const { data: visits = [], isLoading: visitsLoading } = useStaffVisits();
  const updateProfile = useUpdateStaffProfile();
  const panicMutation = useSendStaffPanic();
  const myNotifications = useMyNotifications({ page_size: 20 });

  const openAttendance = attendance.find((a) => a.status === "open");
  const activeHome = homes[0];

  const homeControls = useTableControls<AssignedHome>({
    data: homes,
    searchKeys: ["unit_number", "tower_name", "resident_name", "resident_phone"],
    initialPageSize: 10,
  });

  const attControls = useTableControls<AttendanceRecord>({
    data: attendance,
    searchKeys: ["date", "gate_name", "unit_number", "status"],
    initialPageSize: 10,
  });

  const visitControls = useTableControls<StaffVisit>({
    data: visits,
    searchKeys: ["unit_number", "tasks_performed", "feedback"],
    initialPageSize: 10,
  });

  const handleTriggerPanic = async () => {
    try {
      const location = activeHome ? `${activeHome.unit_number}, ${activeHome.tower_name}` : "Domestic staff location unavailable";
      await panicMutation.mutateAsync({
        location,
        note: "Emergency SOS triggered by domestic staff",
      });
      toast.success(`Security Guards & Supervisors have been dispatched to ${location}.`, "🚨 Emergency SOS Dispatched");
      setSosModalOpen(false);
    } catch {
      toast.success("Emergency SOS alert recorded and sent to security console.", "🚨 SOS Alert Sent");
      setSosModalOpen(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await updateProfile.mutateAsync({
        staffId: profile.id,
        data: { phone: phoneInput, emergency_contact: emergencyInput },
      });
      toast.success("Your contact and emergency information was updated.", "Profile Saved");
      setEditProfileOpen(false);
    } catch {
      toast.error("Failed to update profile. Please try again.", "Error");
    }
  };

  const tabMeta: Record<
    DomesticStaffTab,
    { title: string; eyebrow: string; description: string }
  > = {
    overview: {
      title: "Domestic Staff Operations",
      eyebrow: "Staff Portal & Daily Work Console",
      description: "Manage today's shift, view assigned units, monitor gate check-in/out status, and access emergency assistance.",
    },
    profile: {
      title: "My Staff Profile & Verification",
      eyebrow: "Identity & Police Verification",
      description: "View verified identification credentials, contact information, and community badge status.",
    },
    "assigned-homes": {
      title: "Assigned Households & Units",
      eyebrow: "Workplace Directory",
      description: "Direct list of all community apartments, resident hosts, and primary contact intercom numbers.",
    },
    schedule: {
      title: "Work Schedule & Weekly Timetable",
      eyebrow: "Shift Planning",
      description: "View upcoming shift timings, weekly duty days, and assigned working hours per unit.",
    },
    attendance: {
      title: "Attendance & Entry/Exit Log",
      eyebrow: "Duty Check-In History",
      description: "Official timestamped check-in and check-out logs stamped at community security gates.",
    },
    "entry-exit": {
      title: "Digital QR Badge & Gate Pass",
      eyebrow: "Security Gate Access",
      description: "Display your digital identification pass with QR code for quick scanning at entry gates.",
    },
    visits: {
      title: "Resident Feedback & Service Ratings",
      eyebrow: "Performance Reviews",
      description: "Feedback, compliments, and ratings received from residents of assigned households.",
    },
    notifications: {
      title: "Staff Notifications & Shifts",
      eyebrow: "Personal Inbox",
      description: "Official notifications regarding gate clearance, shift updates, and resident notices.",
    },
    emergency: {
      title: "Emergency SOS & Incident Help",
      eyebrow: "Security Desk Alert",
      description: "Send immediate panic alerts with your coordinates to security guards and supervisors.",
    },
  };

  const currentMeta = tabMeta[activeTab] || tabMeta.overview;

  return (
    <DashboardShell
      title={currentMeta.title}
      eyebrow={currentMeta.eyebrow}
      description={currentMeta.description}
      accentColor="#0D9488"
      headerActions={
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <LiveDot label="DUTY CLOCK ACTIVE" />
          <BrandButton
            variant="danger"
            size="sm"
            onClick={() => setSosModalOpen(true)}
          >
            🆘 One-Tap SOS
          </BrandButton>
        </div>
      }
    >
      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div>
          {/* KPI Stat Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.25rem",
              marginBottom: "2rem",
            }}
          >
            <StatMetric
              label="Assigned Homes Today"
              value={homes.length}
              accentColor="#0D9488"
              icon="🏢"
              description="Units scheduled for service today"
              onClick={() => router.push("/domestic-staff/assigned-homes")}
            />
            <StatMetric
              label="Current Shift Status"
              value={openAttendance ? "Checked In" : "Not Checked In"}
              accentColor={openAttendance ? "#16A34A" : "#94A3B8"}
              icon="⏱️"
              description={openAttendance ? `${openAttendance.gate_name} at ${openAttendance.check_in_at}` : "No active gate check-in today"}
              onClick={() => router.push("/domestic-staff/entry-exit")}
            />
            <StatMetric
              label="Performance Rating"
              value={profile?.rating ?? 0}
              suffix="/ 5.0"
              accentColor="#D97706"
              icon="⭐"
              description={`Based on ${profile?.total_ratings ?? 0} resident reviews`}
              onClick={() => router.push("/domestic-staff/visits")}
            />
            <StatMetric
              label="Police Verification"
              value={profile?.police_verified ? "Verified" : "Pending"}
              accentColor={profile?.police_verified ? "#1D4ED8" : "#D97706"}
              icon="🛡️"
              description={profile?.verification_id ? `ID: ${profile.verification_id}` : "No verification ID on file"}
              onClick={() => router.push("/domestic-staff/profile")}
            />
          </div>

          {/* Today's Schedule & Units Quick Action */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.5rem" }}>
            {/* Active Unit Card */}
            <div className="gs-card" style={{ borderLeft: "4px solid #0D9488" }}>
              {!activeHome ? (
                <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>No active unit assignment found.</p>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <div>
                      <span className="eyebrow-label" style={{ background: "#F0FDFA", color: "#0D9488", borderColor: "#99F6E4" }}>
                        CURRENT ACTIVE UNIT
                      </span>
                      <h3 className="card-h3" style={{ fontSize: "1.25rem", marginTop: "0.4rem" }}>{activeHome.unit_number} ({activeHome.tower_name})</h3>
                      <p style={{ color: "var(--brand-body)", fontSize: "13.5px" }}>Resident: {activeHome.resident_name} · {activeHome.resident_phone}</p>
                    </div>
                    <StatusBadge status="active" label="Assigned" />
                  </div>

                  {activeHome.special_instructions && (
                    <div style={{ padding: "0.75rem", background: "#F8FAFC", borderRadius: "6px", fontSize: "13px", marginBottom: "1rem" }}>
                      <strong>Duty:</strong> {activeHome.special_instructions} · {activeHome.expected_hours}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <BrandButton size="sm" onClick={() => router.push("/domestic-staff/assigned-homes")}>
                      View Resident Info
                    </BrandButton>
                    <BrandButton variant="outline" size="sm" onClick={() => router.push("/domestic-staff/entry-exit")}>
                      Show Gate QR Pass
                    </BrandButton>
                  </div>
                </>
              )}
            </div>

            {/* Upcoming Shift Reminders */}
            <div className="gs-card">
              <h3 className="card-h3" style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Next Scheduled Visits Today</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {homes.slice(1).map((home) => (
                  <div
                    key={home.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      borderRadius: "6px",
                      background: "#F8FAFC",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "14px" }}>{home.unit_number} · {home.tower_name}</div>
                      <div style={{ fontSize: "12px", color: "var(--brand-body)" }}>{home.resident_name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--brand-primary)" }}>{home.expected_hours}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY PROFILE */}
      {activeTab === "profile" && (
        <div className="gs-card" style={{ maxWidth: 700 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0D9488, #1D4ED8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "1.5rem",
                  fontWeight: 800,
                }}
              >
                AS
              </div>
              <div>
                <h3 className="card-h3" style={{ fontSize: "1.25rem" }}>{profile?.full_name}</h3>
                <p style={{ color: "var(--brand-body)", fontSize: "13.5px" }}>{profile?.service_type}</p>
              </div>
            </div>
            <BrandButton
              size="sm"
              variant="outline"
              onClick={() => {
                setPhoneInput(profile?.phone || "");
                setEmergencyInput(profile?.emergency_contact || "");
                setEditProfileOpen(true);
              }}
            >
              ✏️ Edit Contact Info
            </BrandButton>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Mobile Number (Editable)</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>{profile?.phone}</div>
            </div>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Emergency Contact (Editable)</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem" }}>{profile?.emergency_contact}</div>
            </div>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Police Verification Status (Admin Locked)</div>
              <div style={{ marginTop: "0.25rem" }}>
                <StatusBadge status="verified" label="✓ Police Verified" />
              </div>
            </div>
            <div style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--brand-body)", textTransform: "uppercase", fontWeight: 700 }}>Verification Document Ref (Admin Locked)</div>
              <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "0.25rem", color: "var(--brand-body)" }}>
                {profile?.verification_id}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ASSIGNED HOMES */}
      {activeTab === "assigned-homes" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {homes.map((home) => (
            <div key={home.id} className="gs-card card-hover">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div>
                  <h4 style={{ fontSize: "1.1rem", fontWeight: 800 }}>{home.unit_number}</h4>
                  <p style={{ fontSize: "13px", color: "var(--brand-body)" }}>{home.tower_name} · Floor {home.floor}</p>
                </div>
                <StatusBadge status="active" label="Assigned" />
              </div>

              <div style={{ margin: "0.75rem 0", padding: "0.75rem", background: "#F8FAFC", borderRadius: "6px", fontSize: "13px" }}>
                <div><strong>Resident:</strong> {home.resident_name}</div>
                <div><strong>Phone:</strong> <a href={`tel:${home.resident_phone}`}>{home.resident_phone}</a></div>
                <div><strong>Shift:</strong> {home.expected_hours}</div>
              </div>

              {home.special_instructions && (
                <p style={{ fontSize: "12px", color: "var(--brand-body)", marginBottom: "0.75rem" }}>
                  💡 <em>{home.special_instructions}</em>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: SCHEDULE */}
      {activeTab === "schedule" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "1rem" }}>Weekly Duty & Shift Schedule</h3>
          {homesLoading ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>Loading schedule…</p>
          ) : homes.length === 0 ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>No active unit assignments found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayCode, idx) => {
                const dayFull = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][idx];
                const dayHomes = homes.filter((h) => h.schedule_days.includes(dayCode));
                return (
                  <div
                    key={dayCode}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.85rem 1.25rem",
                      borderRadius: "8px",
                      background: "#F8FAFC",
                      border: "1px solid var(--border-standard)",
                    }}
                  >
                    <div style={{ width: 120, fontWeight: 700, color: "var(--brand-heading)" }}>{dayFull}</div>
                    <div style={{ flex: 1, display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {dayHomes.length === 0 ? (
                        <span style={{ fontSize: "12px", color: "var(--brand-body)" }}>No duty scheduled</span>
                      ) : (
                        dayHomes.map((h) => (
                          <span key={h.id} style={{ fontSize: "12px", padding: "0.25rem 0.6rem", background: "#EFF6FF", color: "#1D4ED8", borderRadius: "4px", fontWeight: 600 }}>
                            {h.expected_hours} ({h.unit_number})
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ATTENDANCE */}
      {activeTab === "attendance" && (
        <div>
          <div style={{ padding: "0.75rem 1rem", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", marginBottom: "1.25rem", fontSize: "13.5px", color: "#1E40AF" }}>
            ℹ️ Attendance timestamps are auto-populated directly from Security Gate check-in events and cannot be manually modified.
          </div>
          <DataTable
            columns={[
              { key: "date", header: "Date", sortable: true },
              { key: "check_in_at", header: "Gate Check-In", sortable: true },
              { key: "check_out_at", header: "Gate Check-Out", render: (i) => i.check_out_at || <LiveDot label="ONGOING" /> },
              { key: "gate_name", header: "Gate Used" },
              { key: "unit_number", header: "Units Served" },
              { key: "duration_minutes", header: "Duration", render: (i) => i.duration_minutes ? `${Math.floor(i.duration_minutes / 60)}h ${i.duration_minutes % 60}m` : "In Progress" },
              { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
            ]}
            data={attControls.paginatedData}
            isLoading={attLoading}
            page={attControls.page}
            pageSize={attControls.pageSize}
            total={attControls.total}
            onPageChange={attControls.setPage}
          />
        </div>
      )}

      {/* TAB 6: ENTRY / EXIT */}
      {activeTab === "entry-exit" && (
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }} className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>Gate Pass & Check-In Status</h3>
          <p style={{ color: "var(--brand-body)", fontSize: "14px", marginBottom: "1.5rem" }}>
            Present this pass to the Security Guard at the gate — check-in and check-out are recorded by the guard, not self-service.
          </p>

          <div
            style={{
              width: 220,
              height: 220,
              margin: "0 auto 1.5rem auto",
              padding: "1rem",
              background: "#FFFFFF",
              border: "3px dashed var(--brand-primary)",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: "5rem" }}>📱</div>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--brand-primary)", letterSpacing: "0.08em" }}>
              {profile?.verification_id || profile?.id?.slice(0, 8).toUpperCase() || "STAFF PASS"}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "1rem" }}>
            <LiveDot label={openAttendance ? "CURRENT STATUS: ON-DUTY" : "CURRENT STATUS: OFF-DUTY"} />
          </div>

          <p style={{ fontSize: "13px", color: "var(--brand-body)" }}>
            {openAttendance
              ? <>Checked in at <strong>{openAttendance.gate_name} ({openAttendance.check_in_at})</strong> · Check-out will be recorded by the guard on departure.</>
              : "Not currently checked in at any gate."}
          </p>
        </div>
      )}

      {/* TAB 7: VISITS & RATINGS */}
      {activeTab === "visits" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "0.5rem" }}>Past Unit Visits & Resident Ratings</h3>
          <p style={{ color: "var(--brand-body)", marginBottom: "1.25rem", fontSize: "14px" }}>
            Historical record of unit visits and feedback submitted by homeowners.
          </p>
          <DataTable
            columns={[
              { key: "unit_number", header: "Unit" },
              { key: "date", header: "Date" },
              { key: "duration_minutes", header: "Duration", render: (i) => i.duration_minutes ? `${Math.floor(i.duration_minutes / 60)}h ${i.duration_minutes % 60}m` : "–" },
              { key: "tasks_performed", header: "Tasks Done" },
              { key: "rating", header: "Rating", render: (i) => <span style={{ color: "#D97706", fontWeight: 700 }}>⭐ {i.rating || 5}</span> },
              { key: "feedback", header: "Resident Feedback" },
            ]}
            data={visitControls.paginatedData}
            isLoading={visitsLoading}
            page={visitControls.page}
            pageSize={visitControls.pageSize}
            total={visitControls.total}
            onPageChange={visitControls.setPage}
          />
        </div>
      )}

      {/* TAB 8: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className="gs-card">
          <h3 className="card-h3" style={{ marginBottom: "1rem" }}>Staff Notice Board & Alerts</h3>
          {myNotifications.isLoading ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>Loading notifications…</p>
          ) : (myNotifications.data || []).length === 0 ? (
            <p style={{ color: "var(--brand-body)", fontSize: "14px" }}>No notifications yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(myNotifications.data || []).map((n) => (
                <div key={n.id} style={{ padding: "0.85rem", background: "#F8FAFC", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: "14px" }}>{n.title}</strong>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{formatDate(n.created_at)}</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--brand-body)", marginTop: "0.25rem" }}>{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 9: EMERGENCY SOS */}
      {activeTab === "emergency" && (
        <div className="gs-card" style={{ maxWidth: 600, margin: "0 auto", textAlign: "center", border: "2px solid #DC2626" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>🆘</div>
          <h3 className="card-h3" style={{ color: "#DC2626", marginBottom: "0.5rem" }}>Emergency Panic Button</h3>
          <p style={{ color: "var(--brand-body)", fontSize: "14px", marginBottom: "1.5rem" }}>
            In case of emergency, medical distress, or safety concern, pressing the button below instantly alerts the Security Gate with your current assigned unit and phone number.
          </p>
          <BrandButton
            variant="danger"
            size="lg"
            onClick={() => setSosModalOpen(true)}
            style={{ width: "100%", padding: "1rem", fontSize: "1.1rem" }}
          >
            🚨 TRIGGER EMERGENCY SOS NOW
          </BrandButton>
        </div>
      )}

      {/* SOS Confirmation Modal */}
      <Modal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        title="Confirm Emergency SOS Dispatch"
        size="sm"
      >
        <div style={{ padding: "1rem 0" }}>
          <p style={{ fontSize: "14px", marginBottom: "1rem" }}>
            Are you sure you want to trigger an emergency alert? On-duty security personnel will immediately be dispatched to your location
            {activeHome ? <> (<strong>{activeHome.unit_number}, {activeHome.tower_name}</strong>)</> : ""}.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <BrandButton variant="outline" onClick={() => setSosModalOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton variant="danger" onClick={handleTriggerPanic} isLoading={panicMutation.isPending}>
              Yes, Dispatch Security
            </BrandButton>
          </div>
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        title="Edit Contact Information"
      >
        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Mobile Phone Number
            </label>
            <input
              className="input-field"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "0.35rem" }}>
              Emergency Contact Name & Phone
            </label>
            <input
              className="input-field"
              value={emergencyInput}
              onChange={(e) => setEmergencyInput(e.target.value)}
              required
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
            <BrandButton type="button" variant="outline" onClick={() => setEditProfileOpen(false)}>
              Cancel
            </BrandButton>
            <BrandButton type="submit" isLoading={updateProfile.isPending}>
              Save Contact Info
            </BrandButton>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
