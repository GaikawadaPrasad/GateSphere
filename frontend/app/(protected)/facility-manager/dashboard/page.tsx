"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Skeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
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

  const openTickets = useMemo(
    () => tickets.filter((t) => !["resolved", "closed", "cancelled"].includes(t.status)),
    [tickets],
  );
  const slaWarnings = useMemo(
    () => tickets.filter((t) => t.escalation_state === "at_risk" || t.escalation_state === "breached"),
    [tickets],
  );
  const highPriorityOpen = useMemo(
    () => openTickets.filter((t) => t.priority === "high" || t.priority === "critical"),
    [openTickets],
  );

  const ticketColumns: Column<DashboardTicket>[] = [
    {
      key: "ticket_number",
      header: "Ticket #",
      sortable: true,
      render: (t) => (
        <span style={{ fontWeight: 600, color: "var(--primary, #2563eb)" }}>
          {t.ticket_number}
        </span>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      sortable: true,
      render: (t) => (
        <span
          style={{
            maxWidth: 220,
            display: "inline-block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            verticalAlign: "middle",
          }}
          title={t.subject}
        >
          {t.subject}
        </span>
      ),
    },
    {
      key: "category_name",
      header: "Category",
      sortable: true,
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      render: (t) => <StatusBadge status={t.priority} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: "created_at",
      header: "Raised",
      sortable: true,
      render: (t) => (
        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          {formatDate(t.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", paddingBottom: "2rem" }}>
      <PageHeader
        title="Facility Manager Dashboard"
        subtitle="Operational facilities oversight, service tickets & SLA warnings"
        breadcrumbs={[
          { label: "GateSphere" },
          { label: "Facility Manager" },
          { label: "Dashboard" },
        ]}
        actions={
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
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

      {loadError && (
        <div
          className="card"
          style={{
            marginBottom: "1.5rem",
            padding: "1rem 1.25rem",
            background: "var(--danger-light, #fef2f2)",
            border: "1px solid var(--danger-border, #fecaca)",
            color: "var(--danger-text, #991b1b)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>⚠️</span>
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
            onClick={() => loadData(true)}
          >
            Retry
          </button>
        </div>
      )}

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
          value={String(amenitiesCount)}
          subtext="Managed amenities & common areas"
          icon="🏢"
          accent="primary"
          isLoading={isLoading}
          onClick={() => router.push("/facility-manager/facilities")}
        />
        <KpiCard
          title="Open Service Tickets"
          value={String(openTickets.length)}
          subtext={`${highPriorityOpen.length} high/critical priority`}
          icon="📋"
          accent="warning"
          trend={highPriorityOpen.length > 0 ? "warning" : undefined}
          trendValue={
            highPriorityOpen.length > 0 ? `${highPriorityOpen.length} needs triage` : undefined
          }
          isLoading={isLoading}
          onClick={() => router.push("/facility-manager/service-requests")}
        />
        <KpiCard
          title="SLA At Risk / Breached"
          value={String(slaWarnings.length)}
          subtext="Tickets needing attention"
          icon="⚠️"
          accent="danger"
          trend={slaWarnings.length > 0 ? "danger" : undefined}
          trendValue={slaWarnings.length > 0 ? "Review now" : undefined}
          isLoading={isLoading}
          onClick={() => router.push("/facility-manager/maintenance")}
        />
        <KpiCard
          title="Amenity Bookings Today"
          value={String(bookingsToday)}
          subtext="Slots reserved for today"
          icon="🏊"
          accent="success"
          isLoading={isLoading}
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
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/facilities")}
          >
            🏢 Add / Edit Facility
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/maintenance")}
          >
            🔧 Maintenance Tickets
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/service-requests")}
          >
            📋 Service Requests
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/vendors")}
          >
            🛠️ Manage Vendors
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/amenities")}
          >
            🏊 Manage Amenity Bookings
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/complaints")}
          >
            🎫 View Complaints
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/facility-manager/reports")}
          >
            📈 Operational Reports
          </button>
        </div>
      </div>

      {/* Split Grid Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: "1.75rem",
          alignItems: "start",
        }}
      >
        {/* Left Side: Open Tickets Table with Pagination */}
        <div style={{ minWidth: 0 }}>
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div
              className="card-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                <h3 className="card-title">Open Service Tickets</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                  Active complaints & maintenance requests across the community
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                onClick={() => router.push("/facility-manager/service-requests")}
              >
                View Full Queue ({openTickets.length}) →
              </button>
            </div>

            <div style={{ padding: "0.5rem 0 0 0" }}>
              <DataTable
                columns={ticketColumns}
                data={openTickets as (DashboardTicket & Record<string, unknown>)[]}
                isLoading={isLoading}
                emptyTitle="No open service tickets"
                emptyDescription="All service and maintenance requests have been resolved."
                enableClientPagination={true}
                enableClientSort={true}
                pageSize={5}
              />
            </div>
          </div>
        </div>

        {/* Right Side: SLA Warnings & Action Items */}
        <div style={{ minWidth: 0 }}>
          <div className="card" style={{ height: "100%" }}>
            <div
              className="card-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                <h3 className="card-title">⚠️ SLA Warnings & Escalations</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                  Tickets exceeding or approaching response/resolution limits
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                onClick={() => router.push("/facility-manager/maintenance")}
              >
                Manage SLAs →
              </button>
            </div>

            <div style={{ padding: "0.75rem 0" }}>
              {isLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <Skeleton width="100%" height={68} borderRadius={6} />
                  <Skeleton width="100%" height={68} borderRadius={6} />
                  <Skeleton width="100%" height={68} borderRadius={6} />
                </div>
              ) : slaWarnings.length === 0 ? (
                <EmptyState
                  icon="🛡️"
                  title="SLA performance is optimal"
                  description="All service tickets and maintenance tasks are well within SLA clocks."
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  {slaWarnings.slice(0, 5).map((t) => (
                    <div
                      key={t.id}
                      style={{
                        padding: "0.85rem 1rem",
                        borderRadius: "var(--radius-sm)",
                        background:
                          t.escalation_state === "breached"
                            ? "var(--danger-light, #fef2f2)"
                            : "var(--warning-light, #fffbeb)",
                        border: `1px solid ${
                          t.escalation_state === "breached"
                            ? "var(--danger-border, #fecaca)"
                            : "var(--warning-border, #fde68a)"
                        }`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            color: t.escalation_state === "breached" ? "#991b1b" : "#92400e",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {t.escalation_state === "breached" ? "🚨 SLA Breached" : "⚠️ SLA At Risk"}
                          : {t.subject}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: t.escalation_state === "breached" ? "#b91c1c" : "#b45309",
                            marginTop: "0.2rem",
                          }}
                        >
                          {t.ticket_number} · {t.category_name} · Raised {formatDate(t.created_at)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", flexShrink: 0 }}
                        onClick={() => router.push("/facility-manager/service-requests")}
                      >
                        Triage →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              form="quick-ticket-form"
              disabled={isSubmittingTicket || units.length === 0}
              title={
                units.length === 0
                  ? "No units available — seed units via Super Admin first"
                  : undefined
              }
            >
              {isSubmittingTicket ? "Creating…" : "Create Ticket"}
            </button>
          </>
        }
      >
        <form id="quick-ticket-form" onSubmit={handleQuickCreateRequest}>
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
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--danger, #dc2626)",
                    marginTop: "0.25rem",
                  }}
                >
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

