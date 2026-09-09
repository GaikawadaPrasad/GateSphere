"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { gateApi, dashboardsApi } from "@/lib/api";

export default function SecuritySupervisorReportsPage() {
  const [reportType, setReportType] = useState("gate_traffic");
  const [timeframe, setTimeframe] = useState("today");
  const [trafficRows, setTrafficRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const [eventsRes, statsRes] = await Promise.allSettled([
          gateApi.events({ page_size: 100 }),
          dashboardsApi.security(),
        ]);

        const events = eventsRes.status === "fulfilled" && Array.isArray(eventsRes.value) ? eventsRes.value : [];

        if (events.length === 0) {
          setTrafficRows([]);
        } else {
          const gateGroups = new Map<
            string,
            {
              zone: string;
              entries: number;
              exits: number;
              denied: number;
              hourlyCounts: Record<number, number>;
            }
          >();

          for (const e of events) {
            const zone =
              (e as any).gate_name ||
              (e as any).gate?.name ||
              (e.metadata as any)?.gate_name ||
              (e.gate_id ? `Gate #${e.gate_id.slice(0, 8)}` : "Main Gate");

            if (!gateGroups.has(zone)) {
              gateGroups.set(zone, {
                zone,
                entries: 0,
                exits: 0,
                denied: 0,
                hourlyCounts: {},
              });
            }

            const group = gateGroups.get(zone)!;
            const evType = (e.event_type || "").toLowerCase();

            if (evType.includes("deny") || evType.includes("denied") || evType.includes("block")) {
              group.denied++;
            } else if (evType.includes("entry") || evType.includes("in") || evType === "gate_open") {
              group.entries++;
            } else if (evType.includes("exit") || evType.includes("out") || evType === "gate_close") {
              group.exits++;
            } else {
              group.entries++;
            }

            const timestamp = e.occurred_at || e.created_at;
            if (timestamp) {
              const hour = new Date(timestamp).getHours();
              if (!isNaN(hour)) {
                group.hourlyCounts[hour] = (group.hourlyCounts[hour] || 0) + 1;
              }
            }
          }

          const rows = Array.from(gateGroups.values()).map((g) => {
            let peakHour = -1;
            let maxCount = 0;
            for (const [hStr, count] of Object.entries(g.hourlyCounts)) {
              if (count > maxCount) {
                maxCount = count;
                peakHour = parseInt(hStr, 10);
              }
            }

            const peak =
              peakHour >= 0
                ? `${String(peakHour).padStart(2, "0")}:00 - ${String((peakHour + 1) % 24).padStart(2, "0")}:00`
                : "N/A";

            return {
              zone: g.zone,
              entries: g.entries,
              exits: g.exits,
              denied: g.denied,
              peak,
            };
          });

          setTrafficRows(rows);
        }
      } catch {
        setTrafficRows([]);
      }
      setIsLoading(false);
    })();
  }, [reportType, timeframe]);

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
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                    Loading analytics data…
                  </td>
                </tr>
              ) : trafficRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
                    No analytics records logged.
                  </td>
                </tr>
              ) : (
                trafficRows.map((r, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{r.zone}</td>
                    <td>{r.entries} Entries</td>
                    <td>{r.exits} Exits</td>
                    <td style={{ color: r.denied > 0 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
                      {r.denied} Denied
                    </td>
                    <td>{r.peak}</td>
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
