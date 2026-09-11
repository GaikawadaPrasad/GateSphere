"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { QrCodeSvg } from "@/components/common/QrCodeSvg";
import { complaintsApi, authApi, type CurrentUser } from "@/lib/api";

export default function VendorDashboardPage() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ticketsRes, meRes] = await Promise.allSettled([
        complaintsApi.tickets({ page_size: 50 }),
        authApi.me("vendor_technician"),
      ]);

      if (ticketsRes.status === "fulfilled" && Array.isArray(ticketsRes.value)) {
        setTickets(ticketsRes.value);
      } else {
        setTickets([]);
      }

      if (meRes.status === "fulfilled" && meRes.value) {
        setCurrentUser(meRes.value);
      }
    } catch {
      setTickets([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const assignedTickets = tickets.filter(
    (t) => t.status === "assigned" || t.status === "acknowledged" || t.status === "created",
  );
  const inProgressTickets = tickets.filter((t) => t.status === "in_progress");
  const completedTickets = tickets.filter(
    (t) => t.status === "resolved" || t.status === "resident_confirmation" || t.status === "closed",
  );

  const activeJob = inProgressTickets[0] || assignedTickets[0] || null;
  const passCode = activeJob
    ? `PASS-${(activeJob.ticket_number || activeJob.id.slice(0, 6)).toUpperCase()}`
    : "NO-ACTIVE-JOB";

  const highPriorityCount = assignedTickets.filter(
    (t) => t.priority === "high" || t.priority === "critical",
  ).length;

  return (
    <div>
      <PageHeader
        title="Vendor / Technician Work Console"
        subtitle="Assigned service contracts, work status progression, gate entry passes, and completion signoffs"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Vendor" }, { label: "Dashboard" }]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-secondary" onClick={handleRefresh} disabled={isRefreshing}>
              🔄 {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button className="btn btn-primary" onClick={() => setIsPassModalOpen(true)}>
              🪪 Digital Gate Pass
            </button>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem",
          marginBottom: "1.75rem",
        }}
      >
        <KpiCard
          title="Assigned Tickets"
          value={isLoading ? "…" : String(assignedTickets.length)}
          subtext={`${highPriorityCount} High / Critical`}
          icon="🎫"
          onClick={() => router.push("/vendor-technician/assigned-tickets")}
        />
        <KpiCard
          title="Jobs In Progress"
          value={isLoading ? "…" : String(inProgressTickets.length)}
          subtext={
            inProgressTickets[0]?.subject ||
            (inProgressTickets.length === 0 ? "None active" : "Multiple active")
          }
          icon="⏳"
          trend={inProgressTickets.length > 0 ? "primary" : undefined}
          trendValue={inProgressTickets.length > 0 ? "Active Now" : "Idle"}
          onClick={() => router.push("/vendor-technician/work-progress")}
        />
        <KpiCard
          title="Active Gate Pass"
          value={activeJob ? passCode : "None"}
          subtext={
            activeJob ? `Valid for ${activeJob.ticket_number || "Active Job"}` : "No pass generated"
          }
          icon="🪪"
          onClick={() => router.push("/vendor-technician/entry-pass")}
        />
        <KpiCard
          title="Completed Jobs"
          value={isLoading ? "…" : String(completedTickets.length)}
          subtext="Resolved & Signed Off"
          icon="✅"
          onClick={() => router.push("/vendor-technician/service-history")}
        />
      </div>

      {/* Quick Actions Bar */}
      <div
        className="card"
        style={{
          marginBottom: "1.75rem",
          padding: "1rem 1.25rem",
          background: "linear-gradient(135deg, #ffffff, #f8fafc)",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.875rem",
            color: "var(--fg)",
            marginBottom: "0.75rem",
          }}
        >
          ⚡ Technician Quick Actions
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/vendor-technician/assigned-tickets")}
          >
            🎫 View Assigned Tickets
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/vendor-technician/work-progress")}
          >
            ⏳ Update Work Status
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/vendor-technician/entry-pass")}
          >
            🪪 Show Digital Entry Pass
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/vendor-technician/work-completion")}
          >
            ✅ Submit Work Completion
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/vendor-technician/profile")}
          >
            👤 Manage Technician Profile
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: "1.75rem",
          alignItems: "start",
        }}
      >
        {/* Left Side: Active Assigned Tickets Table */}
        <div style={{ minWidth: 0 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Assigned Service Tickets</h3>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                onClick={() => router.push("/vendor-technician/assigned-tickets")}
              >
                View All
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Task Summary</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}
                      >
                        Loading tickets from backend…
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}
                      >
                        No service tickets assigned at present.
                      </td>
                    </tr>
                  ) : (
                    tickets.slice(0, 5).map((t) => (
                      <tr
                        key={t.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => router.push("/vendor-technician/work-progress")}
                      >
                        <td style={{ fontWeight: 600, fontFamily: "monospace" }}>
                          {t.ticket_number || `TKT-${t.id.slice(0, 6)}`}
                        </td>
                        <td style={{ fontWeight: 500, color: "var(--fg)" }}>
                          {t.subject || "Service Ticket"}
                        </td>
                        <td>
                          <StatusBadge status={(t.priority || "medium").toUpperCase()} />
                        </td>
                        <td>
                          <StatusBadge
                            status={(t.status || "created").replace(/_/g, " ").toUpperCase()}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Active Entry Pass QR Card */}
        <div style={{ maxWidth: 460, width: "100%" }}>
          <div
            className="card"
            style={{
              marginBottom: "1.5rem",
              background: "linear-gradient(135deg, #0b1329, #121e3d)",
              color: "white",
            }}
          >
            <div className="card-header" style={{ borderBottom: "1px solid #1e293b" }}>
              <h3 className="card-title" style={{ color: "white" }}>
                🪪 Active Gate Entry Pass
              </h3>
              <StatusBadge status={activeJob ? "Active" : "Inactive"} />
            </div>

            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase" }}>
                Pass Code
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  color: "#60a5fa",
                }}
              >
                {passCode}
              </div>
              <div
                style={{
                  margin: "1rem auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {activeJob ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <QrCodeSvg
                      value={`GS-PASS-${activeJob.ticket_number || "TKT"}-${activeJob.id.slice(0, 8).toUpperCase()}`}
                      size={130}
                    />
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontFamily: "monospace",
                        marginTop: "6px",
                        color: "#94a3b8",
                      }}
                    >
                      {activeJob.ticket_number || "QR PASS"}
                    </span>
                  </div>
                ) : (
                  <span style={{ color: "#94a3b8", fontSize: "0.85rem", padding: "1.5rem 0" }}>
                    No active job
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>
                {activeJob
                  ? `Show at Security Gate for service on ticket ${activeJob.ticket_number || activeJob.id.slice(0, 6)}`
                  : "Pass generates automatically when a service ticket is assigned"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Entry Pass Modal */}
      <Modal
        isOpen={isPassModalOpen}
        onClose={() => setIsPassModalOpen(false)}
        title="🪪 Technician Digital Gate Entry Pass"
        footer={
          <button className="btn btn-primary" onClick={() => setIsPassModalOpen(false)}>
            Close Pass
          </button>
        }
      >
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Authorized Vendor Technician
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--fg)" }}>
            {currentUser?.full_name || "Vendor Technician"}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "0.25rem" }}>
            {currentUser?.email || "technician@gatesphere.com"}
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              fontFamily: "monospace",
              color: "var(--primary)",
              marginTop: "0.75rem",
            }}
          >
            {passCode}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: activeJob ? "var(--success)" : "var(--muted)",
              fontWeight: 600,
              marginTop: "0.2rem",
            }}
          >
            {activeJob ? "● Valid Today — Single Work Entry" : "○ Inactive — No Active Job"}
          </div>
        </div>
      </Modal>
    </div>
  );
}
