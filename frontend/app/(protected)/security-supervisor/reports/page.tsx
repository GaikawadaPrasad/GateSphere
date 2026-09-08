"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SecuritySupervisorReportsPage() {
  const [reportType, setReportType] = useState("gate_traffic");
  const [timeframe, setTimeframe] = useState("today");

  return (
    <div>
      <PageHeader
        title="Security & Gate Analytics Reports"
        subtitle="Exportable analytical reports for gate traffic, visitor volume, guard attendance, and incident frequency"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Security Supervisor" }, { label: "Reports" }]}
      />

      <div className="card" style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>
              Report Category
            </label>
            <select
              className="select-field"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              style={{ height: 36, minWidth: 200 }}
            >
              <option value="gate_traffic">Gate Traffic Summary</option>
              <option value="visitor_activity">Visitor Activity & Pass Log</option>
              <option value="guard_attendance">Guard Shift Attendance</option>
              <option value="delivery_records">Delivery Protocol Log</option>
              <option value="blacklist_attempts">Blacklist Block Attempts</option>
              <option value="incident_reports">Security Incident Reports</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>
              Time Period
            </label>
            <select
              className="select-field"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              style={{ height: 36, minWidth: 150 }}
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            Security Analytics Data — {reportType.replace("_", " ").toUpperCase()} ({timeframe})
          </h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Gate / Zone</th>
                <th>Total Entries</th>
                <th>Total Exits</th>
                <th>Denied / Blocked</th>
                <th>Peak Hour</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Main Gate North</td>
                <td>142 Entries</td>
                <td>130 Exits</td>
                <td style={{ color: "var(--danger)", fontWeight: 600 }}>2 Denied</td>
                <td>09:00 - 10:00</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Service Gate South</td>
                <td>68 Entries</td>
                <td>65 Exits</td>
                <td style={{ color: "var(--success)", fontWeight: 600 }}>0 Denied</td>
                <td>10:00 - 11:00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
