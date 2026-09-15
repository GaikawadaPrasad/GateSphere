"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { staffApi } from "@/lib/api";

interface StaffRow {
  id: string;
  attendance_id?: string;
  name: string;
  role: string;
  phone?: string;
  assigned_units?: string[];
  check_in_time?: string;
  check_out_time?: string;
  status: string;
}

export default function SecurityGuardStaffAttendancePage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [staffList, assignments, attendanceList] = await Promise.all([
        staffApi.list({ page_size: 100 }),
        staffApi.assignments({ active_only: true }).catch(() => []),
        staffApi.attendance({ page_size: 100 }).catch(() => []),
      ]);

      // Map assignments to staff
      const unitMap: Record<string, string[]> = {};
      (assignments || []).forEach((a: any) => {
        const sid = a.staff_id;
        const unitLabel = a.unit?.unit_number || a.unit_id ? `Unit ${a.unit?.unit_number || a.unit_id.slice(0, 6)}` : "Assigned";
        if (!unitMap[sid]) unitMap[sid] = [];
        if (!unitMap[sid].includes(unitLabel)) unitMap[sid].push(unitLabel);
      });

      // Map latest open attendance to staff
      const openAttendanceMap: Record<string, any> = {};
      const latestClosedMap: Record<string, any> = {};
      (attendanceList || []).forEach((att: any) => {
        const sid = att.staff_id;
        if (!att.check_out_at && !openAttendanceMap[sid]) {
          openAttendanceMap[sid] = att;
        } else if (att.check_out_at && !latestClosedMap[sid]) {
          latestClosedMap[sid] = att;
        }
      });

      setStaff(
        (staffList || []).map((s: any) => {
          const openAtt = openAttendanceMap[s.id];
          const closedAtt = latestClosedMap[s.id];
          const isInside = Boolean(openAtt);

          return {
            id: s.id,
            attendance_id: openAtt?.id,
            name: s.full_name || s.name || "Domestic Staff",
            role: (s.staff_type || s.role || "Staff").replace(/_/g, " "),
            phone: s.phone,
            assigned_units: unitMap[s.id] || [],
            check_in_time: openAtt
              ? new Date(openAtt.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : closedAtt
              ? new Date(closedAtt.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : undefined,
            check_out_time: closedAtt?.check_out_at
              ? new Date(closedAtt.check_out_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : undefined,
            status: isInside ? "Checked In" : "Checked Out",
          };
        }),
      );
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load staff attendance.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCheckIn = async (id: string, name: string) => {
    setActionMessage(null);
    try {
      const res = await staffApi.checkIn(id);
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setStaff((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: "Checked In", attendance_id: res?.id, check_in_time: now, check_out_time: undefined }
            : s,
        ),
      );
      setActionMessage({ type: "success", text: `Check-in recorded for ${name} at ${now}` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to check in staff." });
    }
  };

  const handleCheckOut = async (s: StaffRow) => {
    setActionMessage(null);
    try {
      const targetId = s.attendance_id || s.id;
      await staffApi.checkOut(targetId);
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setStaff((prev) =>
        prev.map((item) =>
          item.id === s.id
            ? { ...item, status: "Checked Out", attendance_id: undefined, check_out_time: now }
            : item,
        ),
      );
      setActionMessage({ type: "success", text: `Check-out recorded for ${s.name} at ${now}` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err?.message || "Failed to check out staff." });
    }
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone && s.phone.includes(search)),
  );

  const columns: Column<StaffRow>[] = [
    {
      key: "name",
      header: "Staff Name",
      sortable: true,
      render: (s) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--fg)" }}>🪪 {s.name}</div>
          {s.phone && <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>📞 {s.phone}</div>}
        </div>
      ),
    },
    {
      key: "role",
      header: "Role / Service",
      sortable: true,
      render: (s) => <span className="capitalize">{s.role}</span>,
    },
    {
      key: "assigned_units",
      header: "Assigned Units",
      render: (s) => (
        <span>
          {s.assigned_units && s.assigned_units.length > 0
            ? s.assigned_units.join(", ")
            : "No Assigned Units"}
        </span>
      ),
    },
    {
      key: "check_in_time",
      header: "Check-In",
      sortable: true,
      render: (s) => <span>{s.check_in_time || "—"}</span>,
    },
    {
      key: "check_out_time",
      header: "Check-Out",
      sortable: true,
      render: (s) => <span>{s.check_out_time || "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (s) => (
        <StatusBadge
          status={s.status === "Checked In" ? "approved" : "completed"}
          label={s.status}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (s) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {s.status === "Checked Out" ? (
            <button
              className="btn btn-primary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
              onClick={() => handleCheckIn(s.id, s.name)}
            >
              Check In
            </button>
          ) : (
            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
              onClick={() => handleCheckOut(s)}
            >
              Check Out
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Domestic Staff Gate Attendance Console"
        subtitle="Verify domestic staff identity, verify unit access permissions, and record check-in / check-out timestamps"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Guard" },
          { label: "Staff Attendance" },
        ]}
      />

      {actionMessage && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            borderRadius: "var(--radius)",
            background: actionMessage.type === "success" ? "var(--success-light)" : "var(--danger-light)",
            border: `1px solid ${actionMessage.type === "success" ? "var(--success-border)" : "var(--danger-border)"}`,
            color: actionMessage.type === "success" ? "#065f46" : "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            {actionMessage.type === "success" ? "✅" : "⚠️"} {actionMessage.text}
          </span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {loadError && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            borderRadius: "var(--radius)",
            background: "var(--danger-light)",
            border: "1px solid var(--danger-border)",
            color: "#991b1b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>⚠️ {loadError}</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
            onClick={loadData}
          >
            Retry
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Domestic Staff Verification</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredStaff.length} staff records
            </p>
          </div>
          <div style={{ width: "100%", maxWidth: 240 }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search staff name/role…"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredStaff}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Staff Records Found"
          emptyDescription="There are no domestic staff members matching your search query."
          emptyIcon="🪪"
        />
      </div>
    </div>
  );
}
