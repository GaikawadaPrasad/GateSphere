"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { staffApi } from "@/lib/api";

export default function SecuritySupervisorDomesticStaffPage() {
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

  const filteredStaff = staff.filter((s) => {
    return (
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div>
      <PageHeader
        title="Domestic Staff Attendance & Monitoring"
        subtitle="Monitor daily housekeeping, cooks, drivers, unit access permissions, and check-in/out timestamps"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Domestic Staff" }]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Registered Domestic Staff</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredStaff.length} staff profiles
            </p>
          </div>

          <div style={{ width: 220 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search staff name/role…" />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Role / Service</th>
                <th>Assigned Units</th>
                <th>Check-In Time</th>
                <th>Check-Out Time</th>
                <th>Attendance Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading domestic staff…
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No domestic staff records found.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, color: "var(--fg)" }}>{s.name}</td>
                    <td>{s.role}</td>
                    <td>{s.assigned_units ? s.assigned_units.join(", ") : "Unassigned"}</td>
                    <td>{s.check_in_time || "—"}</td>
                    <td>{s.check_out_time || "—"}</td>
                    <td>
                      <StatusBadge status={s.status} />
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
