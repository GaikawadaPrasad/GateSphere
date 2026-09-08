"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function FacilityManagerReportsPage() {
  const [reportType, setReportType] = useState("maintenance");
  const [dateRange, setDateRange] = useState("this_month");
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = () => {
    setIsApplying(true);
    setTimeout(() => setIsApplying(false), 400);
  };

  const handleReset = () => {
    setReportType("maintenance");
    setDateRange("this_month");
  };

  return (
    <div>
      <PageHeader
        title="Facility & Operational Reports"
        subtitle="Exportable analytical views for facility utilization, SLA compliance, and vendor performance"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Facility Manager" }, { label: "Reports" }]}
      />

      {/* Filter Control Bar */}
      <div className="card" style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>
              Report View
            </label>
            <select
              className="select-field"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              style={{ height: 36, minWidth: 220 }}
            >
              <option value="maintenance">Maintenance Reports</option>
              <option value="facility_utilization">Facility Utilization</option>
              <option value="vendor_performance">Vendor Performance</option>
              <option value="service_sla">Service Request SLA</option>
              <option value="complaint_status">Complaint Status</option>
              <option value="amenity_utilization">Amenity Utilization</option>
              <option value="incident_summary">Incident Summary</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>
              Timeframe
            </label>
            <select
              className="select-field"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={{ height: 36, minWidth: 160 }}
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_quarter">Last Quarter</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button className="btn btn-primary" onClick={handleApply} disabled={isApplying}>
              {isApplying ? "Filtering…" : "Apply Filters"}
            </button>
            <button className="btn btn-secondary" onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Generated Report Summary Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            Generated Report: {reportType.replace("_", " ").toUpperCase()} ({dateRange.replace("_", " ")})
          </h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category / Module</th>
                <th>Total Volume</th>
                <th>Completed / Resolved</th>
                <th>SLA On-Track %</th>
                <th>Average Resolution Time</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Plumbing & Water Systems</td>
                <td>24 Tickets</td>
                <td>22 Resolved</td>
                <td style={{ color: "var(--success)", fontWeight: 600 }}>91.6%</td>
                <td>4.2 Hours</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Elevators & Vertical Transport</td>
                <td>12 Tickets</td>
                <td>12 Resolved</td>
                <td style={{ color: "var(--success)", fontWeight: 600 }}>100%</td>
                <td>1.8 Hours</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Electrical & Power Generators</td>
                <td>18 Tickets</td>
                <td>15 Resolved</td>
                <td style={{ color: "var(--warning)", fontWeight: 600 }}>83.3%</td>
                <td>6.5 Hours</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Amenities & Event Spaces</td>
                <td>45 Bookings</td>
                <td>45 Completed</td>
                <td style={{ color: "var(--success)", fontWeight: 600 }}>100%</td>
                <td>N/A</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
