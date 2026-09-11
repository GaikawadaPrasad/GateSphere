"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { complaintsApi, amenitiesApi, communitiesApi, authApi } from "@/lib/api";
import { deriveTicketEscalationState, formatDate } from "@/lib/utils";

interface DashboardTicket {
  id: string;
  ticket_number: string;
  subject: string;
  category_name: string;
  priority: string;
  status: string;
  escalation_state: string;
  created_at: string;
}

export default function FacilityManagerDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<DashboardTicket[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; unit_number: string }[]>([]);
  const [amenitiesCount, setAmenitiesCount] = useState(0);
  const [bookingsToday, setBookingsToday] = useState(0);

  // Quick ticket modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reqSubject, setReqSubject] = useState("");
  const [reqDescription, setReqDescription] = useState("");
  const [reqCategoryId, setReqCategoryId] = useState("");
  const [reqUnitId, setReqUnitId] = useState("");
  const [reqPriority, setReqPriority] = useState("medium");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const loadData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setIsLoading(true);
    setLoadError(null);
    try {
      const [ticketsRes, categoriesRes, amenitiesRes, bookingsRes, meRes] =
        await Promise.allSettled([
          complaintsApi.list(),
          complaintsApi.categories(),
          amenitiesApi.list(),
          amenitiesApi.bookings(),
          authApi.me(),
        ]);

      if (categoriesRes.status === "fulfilled") {
        setCategories((categoriesRes.value || []).map((c: any) => ({ id: c.id, name: c.name })));
      }

      const commId =
        meRes.status === "fulfilled" && meRes.value?.community_ids?.[0]
          ? meRes.value.community_ids[0]
          : null;

      if (commId) {
        try {
          const uList = await communitiesApi.communityUnits(commId);
          setUnits((uList || []).map((u: any) => ({ id: u.id, unit_number: u.unit_number })));
        } catch {
          // graceful fallback
        }
      }

    if (ticketsRes.status === "fulfilled") {
      const categoryMap = new Map<string, string>();
      if (categoriesRes.status === "fulfilled") {
        for (const c of categoriesRes.value || []) if (c?.id) categoryMap.set(c.id, c.name);
      }
      setTickets(
        (ticketsRes.value || []).map((t: any) => ({
          id: t.id,
          ticket_number: t.ticket_number,
          subject: t.subject,
          category_name: categoryMap.get(t.category_id) || "Uncategorized",
          priority: t.priority,
          status: t.status,
          escalation_state: deriveTicketEscalationState(t),
          created_at: t.created_at,
        })),
      );
    } else {
      setLoadError((ticketsRes as any).reason?.message || "Failed to load tickets.");
    }

    if (amenitiesRes.status === "fulfilled") setAmenitiesCount((amenitiesRes.value || []).length);

    if (bookingsRes.status === "fulfilled") {
      const today = new Date().toISOString().split("T")[0];
      setBookingsToday(
        (bookingsRes.value || []).filter((b: any) => {
          const bookingDate =
            b.booking_date || (b.start_at ? String(b.start_at).split("T")[0] : "");
          return bookingDate === today;
        }).length,
      );
    }

    } catch (err: any) {
      setLoadError(err?.message || "Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(false); // don't blank KPI cards during refresh
    setIsRefreshing(false);
  };

  const handleQuickCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqSubject.trim()) return;
    const effectiveUnitId = reqUnitId || units[0]?.id;
    if (!effectiveUnitId) {
      alert("No unit available for this ticket.");
      return;
    }
    const effectiveCatId = reqCategoryId || categories[0]?.id;
    if (!effectiveCatId) {
      alert("Please select a category.");
      return;
    }
    setIsSubmittingTicket(true);
    try {
      await complaintsApi.create({
        unit_id: effectiveUnitId,
        category_id: effectiveCatId,
        subject: reqSubject,
        description: reqDescription,
        priority: reqPriority,
      });
      setIsModalOpen(false);
      setReqSubject("");
      setReqDescription("");
      loadData();
      router.push("/facility-manager/service-requests");
    } catch (err: any) {
      alert(err?.message || "Failed to create ticket.");
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const openTickets = tickets.filter(
    (t) => !["resolved", "closed", "cancelled"].includes(t.status),
  );
  const slaWarnings = tickets.filter(
    (t) => t.escalation_state === "at_risk" || t.escalation_state === "breached",
  );
  const highPriorityOpen = openTickets.filter(
    (t) => t.priority === "high" || t.priority === "critical",
  );

  return (
    <div>
      <PageHeader
        title="Facility Manager Dashboard"
        subtitle="Operational facilities oversight, service tickets & SLA warnings"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Facility Manager" },
          { label: "Dashboard" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              🔄 {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              ➕ Quick Service Ticket
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
          title="Total Facilities"
          value={isLoading ? "…" : String(amenitiesCount)}
          subtext="Managed amenities & common areas"
          icon="🏢"
          onClick={() => router.push("/facility-manager/facilities")}
        />
        <KpiCard
          title="Open Service Tickets"
          value={isLoading ? "…" : String(openTickets.length)}
          subtext={`${highPriorityOpen.length} high/critical priority`}
          icon="📋"
          trend={highPriorityOpen.length > 0 ? "warning" : undefined}
          trendValue={
            highPriorityOpen.length > 0 ? `${highPriorityOpen.length} needs triage` : undefined
          }
          onClick={() => router.push("/facility-manager/service-requests")}
        />
        <KpiCard
          title="SLA At Risk / Breached"
          value={isLoading ? "…" : String(slaWarnings.length)}
          subtext="Tickets needing attention"
          icon="⚠️"
          trend={slaWarnings.length > 0 ? "danger" : undefined}
          trendValue={slaWarnings.length > 0 ? "Review now" : undefined}
          onClick={() => router.push("/facility-manager/maintenance")}
        />
        <KpiCard
          title="Amenity Bookings Today"
          value={isLoading ? "…" : String(bookingsToday)}
          subtext="Slots reserved for today"
          icon="🏊"
          onClick={() => router.push("/facility-manager/amenities")}
        />
      </div>

      {/* Quick Actions Panel */}
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
          ⚡ Quick Management Actions
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/facilities")}
          >
            🏢 Add / Edit Facility
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/maintenance")}
          >
            🔧 Maintenance Tickets
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/service-requests")}
          >
            📋 Service Requests
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/amenities")}
          >
            🏊 Manage Amenity Bookings
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/complaints")}
          >
            🎫 View Complaints
          </button>
        </div>
      </div>

      {/* Grid Layout matching Super Admin */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: "1.75rem",
          alignItems: "start",
        }}
      >
        {/* Left Side: Open Tickets */}
        <div style={{ minWidth: 0 }}>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div className="card-header">
              <h3 className="card-title">Open Service Tickets</h3>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                onClick={() => router.push("/facility-manager/service-requests")}
              >
                View All
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Subject</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Raised</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "1.5rem" }}>
                        Loading…
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "1.5rem", color: "var(--danger, #dc2626)" }}>
                        {loadError}
                      </td>
                    </tr>
                  ) : openTickets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ textAlign: "center", padding: "1.5rem", color: "var(--muted)" }}
                      >
                        No open tickets.
                      </td>
                    </tr>
                  ) : (
                    openTickets.slice(0, 5).map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600 }}>{t.ticket_number}</td>
                        <td>{t.subject}</td>
                        <td>{t.category_name}</td>
                        <td><StatusBadge status={t.priority} /></td>
                        <td><StatusBadge status={t.status} /></td>
                        <td style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{formatDate(t.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: SLA Warnings */}
        <div style={{ maxWidth: 460, width: "100%" }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">⚠️ SLA Warnings & Action Items</h3>
            </div>
            {isLoading ? (
              <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Loading…</p>
            ) : slaWarnings.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                No tickets at risk or breached right now.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {slaWarnings.slice(0, 5).map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: "0.75rem",
                      borderRadius: "var(--radius-sm)",
                      background:
                        t.escalation_state === "breached"
                          ? "var(--danger-light)"
                          : "var(--warning-light)",
                      border: `1px solid ${t.escalation_state === "breached" ? "var(--danger-border)" : "var(--warning-border)"}`,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: t.escalation_state === "breached" ? "#991b1b" : "#92400e",
                      }}
                    >
                      {t.escalation_state === "breached" ? "🚨 SLA Breached" : "⚠️ SLA At Risk"}:{" "}
                      {t.subject} ({t.ticket_number})
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: t.escalation_state === "breached" ? "#b91c1c" : "#b45309",
                        marginTop: "0.25rem",
                      }}
                    >
                      {t.category_name} · Raised {formatDate(t.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Ticket Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Service Ticket"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              form="quick-ticket-form"
              disabled={isSubmittingTicket || units.length === 0}
              title={units.length === 0 ? "No units available — seed units via Super Admin first" : undefined}
            >
              {isSubmittingTicket ? "Creating…" : "Create Ticket"}
            </button>
          </>
        }
      >
        <form id="quick-ticket-form" onSubmit={handleQuickCreateRequest}>
          {communities.length > 1 && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                Community
              </label>
              <select
                className="select-field"
                value={selectedCommunityId}
                onChange={(e) => handleCommunityChange(e.target.value)}
              >
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Subject / Issue *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Main Gate Barrier Arm Stuck"
              value={reqSubject}
              onChange={(e) => setReqSubject(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Description
            </label>
            <textarea
              className="input-field"
              style={{ minHeight: 70 }}
              value={reqDescription}
              onChange={(e) => setReqDescription(e.target.value)}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
                Category *
              </label>
              <select
                className="select-field"
                value={reqCategoryId}
                onChange={(e) => setReqCategoryId(e.target.value)}
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  marginBottom: "0.35rem",
                }}
              >
                Target Unit / Common Area *
              </label>
              <select
                className="select-field"
                value={reqUnitId}
                onChange={(e) => setReqUnitId(e.target.value)}
              >
                <option value="">Select unit…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unit_number}
                  </option>
                ))}
              </select>
              {units.length === 0 && (
                <p style={{ fontSize: "0.75rem", color: "var(--danger, #dc2626)", marginTop: "0.25rem" }}>
                  No units found — create units via Super Admin first.
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "0.35rem",
              }}
            >
              Priority
            </label>
            <select
              className="select-field"
              value={reqPriority}
              onChange={(e) => setReqPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
