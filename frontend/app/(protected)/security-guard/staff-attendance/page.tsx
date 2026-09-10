"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { staffApi } from "@/lib/api";

export default function SecurityGuardStaffAttendancePage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    const data = await staffApi.list();
    setStaff(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCheckIn = async (id: string) => {
    await staffApi.checkIn(id);
    setStaff((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: "Checked In",
              check_in_time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : s,
      ),
    );
  };

  const handleCheckOut = async (id: string) => {
    await staffApi.checkOut(id);
    setStaff((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: "Checked Out",
              check_out_time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : s,
      ),
    );
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Domestic Staff Gate Attendance Console"
        subtitle="Verify domestic staff identity, verify unit access permissions, and record check-in / check-out timestamps"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Guard" },
          { label: "Staff Attendance" },
        ]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Domestic Staff Verification</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredStaff.length} staff records
            </p>
          </div>
          <div style={{ width: "100%", maxWidth: 220 }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search staff name/role…"
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Role / Service</th>
                <th>Assigned Units</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading staff records…
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>🪪 {s.name}</td>
                    <td>{s.role}</td>
                    <td>{s.assigned_units ? s.assigned_units.join(", ") : "Unassigned"}</td>
                    <td>{s.check_in_time || "—"}</td>
                    <td>{s.check_out_time || "—"}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>
                      {s.status === "Checked Out" ? (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          onClick={() => handleCheckIn(s.id)}
                        >
                          Check In
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          onClick={() => handleCheckOut(s.id)}
                        >
                          Check Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
