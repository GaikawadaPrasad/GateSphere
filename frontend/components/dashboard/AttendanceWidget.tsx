"use client";

import Link from "next/link";
import type { StaffAttendance } from "@/types/staff";
import { formatDateTime } from "@/lib/utils";

interface AttendanceWidgetProps {
  attendance?: StaffAttendance[];
  totalStaff?: number;
  isLoading?: boolean;
}

export function AttendanceWidget({ attendance, totalStaff = 0, isLoading }: AttendanceWidgetProps) {
  if (isLoading) {
    return (
      <div className="card" style={{ height: "100%", minHeight: 280 }}>
        <div className="skeleton" style={{ width: 180, height: 24, marginBottom: "1.5rem" }} />
        <div className="skeleton" style={{ width: "100%", height: 180 }} />
      </div>
    );
  }

  const activeStaff = attendance?.filter((a) => !a.check_out_at) || [];
  const presentCount = activeStaff.length;
  const attendanceRate = totalStaff > 0 ? Math.min(100, Math.round((presentCount / totalStaff) * 100)) : 0;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="card-header">
        <div>
          <h3 className="card-title">🛠️ Staff Presence &amp; Attendance</h3>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            Real-time on-duty workforce
          </p>
        </div>
        <Link href="/community-admin/staff" className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
          Manage Staff →
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0.75rem 0", background: "#f8fafc", padding: "0.85rem 1rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>Active On-Duty</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--fg)", marginTop: "0.15rem" }}>
            {presentCount} <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 400 }}>/ {totalStaff} total</span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 500 }}>Attendance Rate</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#10b981", marginTop: "0.15rem" }}>
            {attendanceRate}%
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", maxHeight: 180 }}>
        {activeStaff.length === 0 ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--muted)", fontSize: "0.85rem" }}>
            No staff currently checked in.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {activeStaff.slice(0, 5).map((staff) => (
              <div
                key={staff.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.75rem",
                  background: "#ffffff",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.825rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "#e0f2fe",
                      color: "#0369a1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                    }}
                  >
                    👤
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--fg)" }}>{staff.staff_name || "Domestic Staff"}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "capitalize" }}>
                      {staff.staff_type || "Staff"}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right", fontSize: "0.7rem", color: "var(--muted)" }}>
                  <span className="badge badge-success" style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}>
                    In
                  </span>
                  <div style={{ marginTop: "0.15rem" }}>{formatDateTime(staff.check_in_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
