"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { SearchInput } from "@/components/forms/SearchInput";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { CommunityTable, type CommunityWithMetrics } from "@/components/tables/CommunityTable";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DemoRequestsCard } from "@/components/dashboard/DemoRequestsCard";
import { useSuperAdminDashboardMetrics } from "@/hooks/use-dashboards";
import { useCommunities } from "@/hooks/use-communities";
import { useGateEvents, usePanicAlerts } from "@/hooks/use-gate";
import type { DemoRequestLead } from "@/lib/demo-requests";
import type { Community } from "@/types/communities";

// Lazy-loaded modal dialogs for code splitting and instant initial page render
const CreateCommunityModal = dynamic(
  () =>
    import("@/components/super-admin/CreateCommunityModal").then((mod) => mod.CreateCommunityModal),
  { ssr: false }
);

const EditCommunityModal = dynamic(
  () =>
    import("@/components/super-admin/EditCommunityModal").then((mod) => mod.EditCommunityModal),
  { ssr: false }
);

const ViewCommunityModal = dynamic(
  () =>
    import("@/components/super-admin/ViewCommunityModal").then((mod) => mod.ViewCommunityModal),
  { ssr: false }
);

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal dialog states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [leadInitialValues, setLeadInitialValues] = useState<{ name?: string; code?: string }>({});

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<CommunityWithMetrics | null>(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingCommunity, setViewingCommunity] = useState<CommunityWithMetrics | null>(null);

  // Backend queries with automatic caching and background invalidation
  const {
    data: metrics,
    isLoading: isMetricsLoading,
    refetch: refetchMetrics,
  } = useSuperAdminDashboardMetrics();

  const {
    data: communities,
    isLoading: isCommunitiesLoading,
    refetch: refetchCommunities,
  } = useCommunities();

  const { data: gateEvents, isLoading: isEventsLoading } = useGateEvents({ page_size: 6 });
  const { data: panicAlerts } = usePanicAlerts({ page_size: 5 });

  // Filter communities by search query & status, enriched with live breakdown metrics
  const filteredCommunities: CommunityWithMetrics[] = useMemo(() => {
    if (!communities) return [];
    return communities
      .filter((comm: Community) => {
        const matchesSearch =
          searchQuery === "" ||
          comm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          comm.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (comm.city && comm.city.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && comm.is_active) ||
          (statusFilter === "inactive" && !comm.is_active);

        return matchesSearch && matchesStatus;
      })
      .map((comm: Community) => {
        const bd = metrics?.communityBreakdown?.[comm.id];
        return {
          ...comm,
          totalTowersCount: bd?.totalTowers,
          totalUnitsCount: bd?.totalUnits,
          totalResidentsCount: bd?.totalResidents,
          occupancyRate: bd?.occupancyRate ?? 0,
          financialStatus: bd?.financialStatus ?? "Good",
        };
      });
  }, [communities, searchQuery, statusFilter, metrics]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["dashboards"] }),
        queryClient.invalidateQueries({ queryKey: ["communities"] }),
        queryClient.invalidateQueries({ queryKey: ["gate"] }),
        refetchMetrics(),
        refetchCommunities(),
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const handleOpenCreate = () => {
    setLeadInitialValues({});
    setIsCreateModalOpen(true);
  };

  const handleOnboardFromLead = (lead: DemoRequestLead) => {
    const generatedCode = (lead.community || "COM")
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 4)
      .toUpperCase() + "-01";

    setLeadInitialValues({
      name: lead.community || "",
      code: generatedCode,
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (comm: CommunityWithMetrics) => {
    setEditingCommunity(comm);
    setIsEditModalOpen(true);
  };

  const handleOpenView = (comm: CommunityWithMetrics) => {
    setViewingCommunity(comm);
    setIsViewModalOpen(true);
  };

  const handleMutationSuccess = () => {
    refetchCommunities();
    refetchMetrics();
  };

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto" }}>
      <PageHeader
        title="Super Admin Dashboard"
        subtitle="Global operations and analytics across all residential communities"
        breadcrumbs={[{ label: "GateSphere" }, { label: "Super Admin" }, { label: "Dashboard" }]}
        actions={
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Dashboard Data"
              style={{ minWidth: 110 }}
            >
              <span className={isRefreshing ? "spin-animation" : ""}>🔄</span>{" "}
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
              ➕ New Community
            </button>
          </div>
        }
      />

      {/* 6-KPI Metrics Grid with Responsive Auto-fit & Shimmer Skeletons */}
      <MetricsGrid
        metrics={metrics}
        isLoading={isMetricsLoading}
        onCardClick={(key) => {
          if (key === "communities") router.push("/super-admin/communities");
          if (key === "residents") router.push("/super-admin/residents");
          if (key === "gate") router.push("/super-admin/gate-traffic");
          if (key === "complaints") router.push("/super-admin/complaints");
          if (key === "billing") router.push("/super-admin/billing");
        }}
      />

      {/* Quick Actions Bar */}
      <QuickActions onNewCommunity={handleOpenCreate} />

      {/* Main Grid: Communities Table (Left / Full) + Live Activity Feed (Right / Collapsible) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
          gap: "1.75rem",
          alignItems: "start",
          marginBottom: "1.75rem",
        }}
      >
        {/* Left Side: Communities Table with Built-in Search & Pagination */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div
              className="card-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <div>
                <h3 className="card-title">Managed Communities</h3>
                <p style={{ fontSize: "0.775rem", color: "var(--muted)", margin: "0.15rem 0 0 0" }}>
                  {filteredCommunities.length} of {communities?.length || 0} communities
                </p>
              </div>

              {/* Filters */}
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                  maxWidth: "100%",
                }}
              >
                <div style={{ width: "100%", maxWidth: 220, minWidth: 160 }}>
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search name, code, city…"
                  />
                </div>

                <select
                  className="select-field"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                  style={{
                    width: "auto",
                    height: 36,
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            <CommunityTable
              communities={filteredCommunities}
              isLoading={isCommunitiesLoading}
              onEdit={handleOpenEdit}
              onView={handleOpenView}
              enableClientPagination={true}
            />
          </div>
        </div>

        {/* Right Side: Live Security Activity Feed */}
        <div style={{ width: "100%", minWidth: 0 }}>
          <ActivityFeed events={gateEvents} alerts={panicAlerts} isLoading={isEventsLoading} />
        </div>
      </div>

      {/* Inbound Demo Requests & Township Leads Card with Pagination */}
      <DemoRequestsCard onOnboardCommunity={handleOnboardFromLead} />

      {/* Lazy-Loaded Dialogs */}
      {isCreateModalOpen && (
        <CreateCommunityModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleMutationSuccess}
          initialName={leadInitialValues.name}
          initialCode={leadInitialValues.code}
        />
      )}

      {isEditModalOpen && (
        <EditCommunityModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleMutationSuccess}
          community={editingCommunity}
        />
      )}

      {isViewModalOpen && (
        <ViewCommunityModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          community={viewingCommunity}
        />
      )}
    </div>
  );
}
