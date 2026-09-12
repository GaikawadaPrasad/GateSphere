"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/forms/SearchInput";
import { StatusBadge } from "@/components/common/StatusBadge";
import { staffApi } from "@/lib/api";

import { DataTable, type Column } from "@/components/tables/DataTable";

export default function SecuritySupervisorDomesticStaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [staffRes, attendanceRes] = await Promise.allSettled([
        staffApi.list({ page_size: 100 }),
        staffApi.attendance({ page_size: 100 }),
      ]);

      const staffList = staffRes.status === "fulfilled" ? staffRes.value : [];
      const attendanceList = attendanceRes.status === "fulfilled" ? attendanceRes.value : [];

      const latestAttByStaff = new Map<string, any>();
      for (const att of attendanceList || []) {
        if (att.staff_id && !latestAttByStaff.has(att.staff_id)) {
          latestAttByStaff.set(att.staff_id, att);
        }
      }

      setStaff(
        (staffList || []).map((s: any) => {
          const att = latestAttByStaff.get(s.id);
          const isInside = att && !att.check_out_at;
          return {
            id: s.id,
            name: s.full_name || "Domestic Staff",
            role: s.service_type || s.staff_type
              ? (s.service_type || s.staff_type).replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
              : "Housekeeping",
            assigned_units: s.assigned_units && s.assigned_units.length > 0 ? s.assigned_units : ["Verified Staff"],
            check_in_time: att?.check_in_at
              ? new Date(att.check_in_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null,
            check_out_time: att?.check_out_at
              ? new Date(att.check_out_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null,
            status: isInside ? "Inside Premises" : "Checked Out",
          };
        }),
      );
    } catch {
      // fallback
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredStaff = staff.filter((s) => {
    const q = search.toLowerCase();
    return (
      !search ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.role && s.role.toLowerCase().includes(q))
    );
  });

  const columns: Column<any>[] = [
    {
      key: "name",
      header: "Staff Name",
      sortable: true,
      render: (s) => <span style={{ fontWeight: 600, color: "var(--fg)" }}>🪪 {s.name}</span>,
    },
    {
      key: "role",
      header: "Role / Service",
      sortable: true,
      render: (s) => <span>{s.role}</span>,
    },
    {
      key: "assigned_units",
      header: "Assigned Units",
      render: (s) => <span>{s.assigned_units ? s.assigned_units.join(", ") : "Unassigned"}</span>,
    },
    {
      key: "check_in_time",
      header: "Check-In Time",
      sortable: true,
      render: (s) => <span>{s.check_in_time || "—"}</span>,
    },
    {
      key: "check_out_time",
      header: "Check-Out Time",
      sortable: true,
      render: (s) => <span>{s.check_out_time || "—"}</span>,
    },
    {
      key: "status",
      header: "Attendance Status",
      sortable: true,
      render: (s) => <StatusBadge status={s.status === "Inside Premises" ? "approved" : "completed"} label={s.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Domestic Staff Attendance & Monitoring"
        subtitle="Monitor daily housekeeping, cooks, drivers, unit access permissions, and check-in/out timestamps"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Domestic Staff" },
        ]}
      />

      <div className="card">
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">Registered Domestic Staff</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredStaff.length} staff profiles
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

        <DataTable
          columns={columns}
          data={filteredStaff}
          isLoading={isLoading}
          enableClientPagination={true}
          pageSize={10}
          emptyTitle="No Domestic Staff Records Found"
          emptyDescription="There are no registered domestic staff members matching your search query."
          emptyIcon="🪪"
        />
      </div>
    </div>
  );
}
