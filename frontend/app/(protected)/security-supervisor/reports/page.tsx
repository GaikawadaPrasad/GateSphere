"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { gateApi, visitorsApi, deliveriesApi, blacklistApi, auditApi, incidentsApi } from "@/lib/api";
import { BrandButton } from "@/components/common/BrandButton";

export default function SecuritySupervisorReportsPage() {
  const [reportType, setReportType] = useState("gate_traffic");
  const [timeframe, setTimeframe] = useState("today");
  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        let items: any[] = [];
        if (reportType === "gate_traffic") {
          const eventsRes = await gateApi.events({ page_size: 100 }).catch(() => []);
          items = Array.isArray(eventsRes) ? eventsRes : [];
        } else if (reportType === "visitor_activity") {
          const entriesRes = await visitorsApi.entries({ page_size: 100 }).catch(() => []);
          items = Array.isArray(entriesRes) ? entriesRes : [];
        } else if (reportType === "delivery_records") {
          const delRes = await deliveriesApi.list({ page_size: 100 }).catch(() => []);
          items = Array.isArray(delRes) ? delRes : [];
        } else if (reportType === "blacklist_attempts") {
          const blRes = await blacklistApi.list({ page_size: 100 }).catch(() => []);
          items = Array.isArray(blRes) ? blRes : [];
        } else if (reportType === "incident_reports") {
          const incRes = await incidentsApi.list({ page_size: 100 }).catch(() => []);
          items = Array.isArray(incRes) ? incRes : [];
        } else {
          const logsRes = await auditApi.logs({ page_size: 100 }).catch(() => []);
          items = Array.isArray(logsRes) ? logsRes : [];
        }

        // Timeframe filtering
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = startOfToday - 7 * 24 * 3600 * 1000;
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        const filtered = items.filter((item) => {
          const dt = item.created_at || item.occurred_at || item.entry_time;
          if (!dt) return true;
          const t = new Date(dt).getTime();
          if (isNaN(t)) return true;

          if (timeframe === "today") return t >= startOfToday;
          if (timeframe === "this_week") return t >= startOfWeek;
          if (timeframe === "this_month") return t >= startOfMonth;
          return true;
        });

        if (reportType === "gate_traffic") {
          const gateGroups = new Map<string, { zone: string; entries: number; exits: number; denied: number; peak: string }>();
          for (const e of filtered) {
            const zone = e.gate_name || e.gate?.name || (e.gate_id ? `Gate #${e.gate_id.slice(0, 8)}` : "Main Gate");
            if (!gateGroups.has(zone)) {
              gateGroups.set(zone, { zone, entries: 0, exits: 0, denied: 0, peak: "10:00 - 11:00" });
            }
            const group = gateGroups.get(zone)!;
            const evType = (e.event_type || "").toLowerCase();
            if (evType.includes("deny") || evType.includes("denied") || evType.includes("block")) {
              group.denied++;
            } else if (evType.includes("exit") || evType.includes("out")) {
              group.exits++;
            } else {
              group.entries++;
            }
          }
          setReportData(Array.from(gateGroups.values()));
        } else {
          setReportData(filtered.map((item, idx) => ({
            id: item.id || String(idx),
            label: item.visitor_name || item.courier_company || item.phone || item.action || `Record #${idx + 1}`,
            type: item.visitor_type || item.delivery_type || item.event_type || reportType,
            status: item.status || item.decision || "logged",
            date: item.created_at || item.entry_time || item.occurred_at || "Recent",
          })));
        }
      } catch {
        setReportData([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [reportType, timeframe]);

  return (
    <div>
      <PageHeader
        title="Security & Gate Analytics Reports"
        subtitle="Exportable analytical reports for gate traffic, visitor volume, guard attendance, and incident frequency"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Security Supervisor" },
          { label: "Reports" },
        ]}
      />

      <div className="card" style={{ marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--muted)",
                marginBottom: "0.25rem",
              }}
            >
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
              <option value="delivery_records">Delivery Protocol Log</option>
              <option value="blacklist_attempts">Blacklist Block Attempts</option>
              <option value="incident_reports">Security Incident Reports</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--muted)",
                marginBottom: "0.25rem",
              }}
            >
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
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            Security Analytics Data — {reportType.replace(/_/g, " ").toUpperCase()} ({timeframe})
          </h3>
          <BrandButton
            size="sm"
            variant="outline"
            disabled={reportData.length === 0}
            onClick={() => {
              if (reportData.length === 0) return;
              let csvContent = "";
              if (reportType === "gate_traffic") {
                const headers = ["Gate / Zone", "Total Entries", "Total Exits", "Denied / Blocked", "Peak Hour"];
                const rows = reportData.map((r) => [r.zone, r.entries, r.exits, r.denied, r.peak]);
                csvContent = [headers.join(","), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
              } else {
                const headers = ["Reference / Subject", "Category / Type", "Status", "Logged Date"];
                const rows = reportData.map((r) => [r.label, r.type, r.status, r.date]);
                csvContent = [headers.join(","), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
              }
              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute("download", `security_report_${reportType}_${timeframe}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            📥 Export CSV
          </BrandButton>
        </div>

        <div className="table-container">
          <table className="data-table">
            {reportType === "gate_traffic" ? (
              <>
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
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>Loading analytics data…</td></tr>
                  ) : reportData.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>No analytics records logged.</td></tr>
                  ) : (
                    reportData.map((r, idx) => (
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
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th>Reference / Subject</th>
                    <th>Category / Type</th>
                    <th>Status</th>
                    <th>Logged Date</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem" }}>Loading records…</td></tr>
                  ) : reportData.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>No matching records found for selected period.</td></tr>
                  ) : (
                    reportData.map((r, idx) => (
                      <tr key={r.id || idx}>
                        <td style={{ fontWeight: 600 }}>{r.label}</td>
                        <td><span className="badge badge-secondary">{r.type}</span></td>
                        <td><span className="badge badge-neutral">{r.status}</span></td>
                        <td>{r.date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
