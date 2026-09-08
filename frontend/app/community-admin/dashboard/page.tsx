"use client";

import Link from "next/link";
import { useUiStore } from "@/store/ui";
import { useCommunityDetails, useTowers } from "@/hooks/use-communities";
import { useOverviewStats, useFinancialStats } from "@/hooks/use-dashboards";
import { useStaffList, useStaffAttendance } from "@/hooks/use-staff";
import { useIncidents } from "@/hooks/use-incidents";
import { useMoveRecords } from "@/hooks/use-residents";
import { useAnnouncements } from "@/hooks/use-communication";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { FinancialHealthCard } from "@/components/dashboard/FinancialHealthCard";
import { AttendanceWidget } from "@/components/dashboard/AttendanceWidget";
import { IncidentListWidget } from "@/components/dashboard/IncidentListWidget";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function CommunityAdminDashboardPage() {
  const { activeCommunityId } = useUiStore();

  const { data: community, isLoading: communityLoading } = useCommunityDetails(activeCommunityId || undefined);
  const { data: towers } = useTowers(activeCommunityId || undefined);
  const { data: overview, isLoading: overviewLoading } = useOverviewStats(activeCommunityId || undefined);
  const { data: financial, isLoading: financialLoading } = useFinancialStats(activeCommunityId || undefined);
  const { data: staffList } = useStaffList({ community_id: activeCommunityId || undefined });
  const { data: attendance, isLoading: attendanceLoading } = useStaffAttendance({
    community_id: activeCommunityId || undefined,
    open_only: false,
  });
  const { data: incidents, isLoading: incidentsLoading } = useIncidents({ community_id: activeCommunityId || undefined });
  const { data: pendingMoves } = useMoveRecords({ community_id: activeCommunityId || undefined, move_status: "requested" });
  const { data: announcements } = useAnnouncements({ community_id: activeCommunityId || undefined, published_only: true });

  // Calculated metrics
  const totalTowers = towers?.length ?? community?.total_towers ?? 0;
  const totalUnits = overview?.units ?? community?.total_units ?? 0;
  const totalResidents = overview?.residents ?? community?.total_residents ?? 0;
  const occupancyRate = totalUnits > 0 ? Math.min(100, Math.round((totalResidents / totalUnits) * 100)) : 0;

  const totalStaff = staffList?.length ?? 0;
  const activeStaff = attendance?.filter((a) => !a.check_out_at) || [];
  const staffPresentToday = activeStaff.length;
  const staffAttendanceRate = totalStaff > 0 ? Math.min(100, Math.round((staffPresentToday / totalStaff) * 100)) : 0;

  const openIncidentsCount =
    overview?.open_incidents ??
    incidents?.filter((i) => i.status !== "resolved" && i.status !== "closed" && i.status !== "false_alarm").length ??
    0;
  const financialScore = Number(financial?.total_billed || 0) > 0
    ? `${Math.round((Number(financial?.total_collected || 0) / Number(financial?.total_billed || 1)) * 100)}%`
    : "100%";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <PageHeader
        title="Community Overview"
        description={`Live operations, property health, and resident management for ${community?.name || "your community"}.`}
        action={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link href="/community-admin/communication" className="btn btn-primary">
              📢 Broadcast Announcement
            </Link>
          </div>
        }
      />

      {/* KPI Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
          gap: "1rem",
        }}
      >
        <KpiCard
          title="Total Towers"
          value={totalTowers}
          icon="🏢"
          subtitle="Registered residential blocks"
          isLoading={overviewLoading || communityLoading}
        />
        <KpiCard
          title="Total Units"
          value={totalUnits}
          icon="🚪"
          subtitle={`Across ${totalTowers} towers`}
          isLoading={overviewLoading || communityLoading}
        />
        <KpiCard
          title="Total Residents"
          value={totalResidents}
          icon="👥"
          subtitle={`Occupancy: ${occupancyRate}%`}
          badge={{ text: `${occupancyRate}% Occupied`, variant: occupancyRate >= 50 ? "success" : "neutral" }}
          isLoading={overviewLoading}
        />
        <KpiCard
          title="Staff Present Today"
          value={staffPresentToday}
          icon="🛠️"
          subtitle={`${totalStaff} registered staff`}
          badge={{ text: `${staffAttendanceRate}% Active`, variant: staffAttendanceRate >= 75 ? "success" : "warning" }}
          isLoading={attendanceLoading}
        />
        <KpiCard
          title="Open Incidents"
          value={openIncidentsCount}
          icon="🚨"
          subtitle={openIncidentsCount > 0 ? "Requires review" : "All resolved"}
          isLoading={overviewLoading || incidentsLoading}
        />
        <KpiCard
          title="Financial Health"
          value={financialScore}
          icon="💳"
          subtitle={`Bal: ${formatCurrency(Number(financial?.outstanding_balance || 0))}`}
          isLoading={financialLoading}
        />
      </div>

      {/* Middle Grid: Financial Health + Staff Presence */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "1.25rem" }}>
        <FinancialHealthCard data={financial} isLoading={financialLoading} />
        <AttendanceWidget attendance={attendance} totalStaff={totalStaff} isLoading={attendanceLoading} />
      </div>

      {/* Bottom Grid: Incident Alerts & Pending Actions / Feed */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "1.25rem" }}>
        <IncidentListWidget incidents={incidents} isLoading={incidentsLoading} />

        {/* Action Center: Pending Approvals & Live Broadcasts */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">⚡ Action Center &amp; Broadcasts</h3>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                Pending resident moves &amp; published community notices
              </p>
            </div>
            <Link href="/community-admin/residents" className="btn btn-secondary" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
              Approvals ({pendingMoves?.length || 0}) →
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.5rem" }}>
            {/* Pending Move In/Out Alert */}
            {pendingMoves && pendingMoves.length > 0 ? (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  padding: "0.85rem",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>📦</span>
                    <strong style={{ fontSize: "0.85rem", color: "#92400e" }}>
                      {pendingMoves.length} Pending Move Request{pendingMoves.length > 1 ? "s" : ""}
                    </strong>
                  </div>
                  <Link href="/community-admin/residents" className="btn btn-primary" style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}>
                    Review
                  </Link>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#b45309", marginTop: "0.35rem" }}>
                  New resident move-in/out records awaiting administrative approval and gate pass clearance.
                </div>
              </div>
            ) : (
              <div style={{ background: "#f8fafc", border: "1px solid var(--border)", padding: "0.75rem", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", color: "var(--muted)" }}>
                ✅ No pending resident move approvals.
              </div>
            )}

            {/* Latest Announcements */}
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--fg-secondary)", marginBottom: "0.5rem" }}>
                Latest Community Announcements
              </div>
              {announcements && announcements.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {announcements.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: "0.6rem 0.75rem",
                        background: "#ffffff",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.825rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong style={{ color: "var(--fg)" }}>{a.title}</strong>
                        <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                          {formatDateTime(a.published_at || a.created_at)}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--fg-secondary)", marginTop: "0.25rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {a.body}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>
                  No published announcements.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
