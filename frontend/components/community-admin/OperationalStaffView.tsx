"use client";

import { useState, useMemo } from "react";
import { useUiStore } from "@/store/ui";
import {
  useOperationalStaff,
  useUpdateOperationalStaff,
  getRoleMeta,
  type OperationalStaffUser,
  type OperationalRoleSlug,
} from "@/hooks/use-operational-staff";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { FilterPanel } from "@/components/common/FilterPanel";
import { AddOperationalStaffModal } from "@/components/community-admin/AddOperationalStaffModal";
import { OperationalStaffDetailsModal } from "@/components/community-admin/OperationalStaffDetailsModal";
import { UpdateUserCredentialsModal, type CredentialUser } from "@/components/common/UpdateUserCredentialsModal";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/store/toast";

interface OperationalStaffViewProps {
  embeddedInTab?: boolean;
  allowedRoleSlugs?: OperationalRoleSlug[];
  initialRoleFilter?: string;
  title?: string;
  description?: string;
  addButtonText?: string;
  defaultAddRole?: OperationalRoleSlug;
}

export function OperationalStaffView({
  embeddedInTab = false,
  allowedRoleSlugs,
  initialRoleFilter = "",
  title,
  description,
  addButtonText,
  defaultAddRole,
}: OperationalStaffViewProps) {
  const { activeCommunityId } = useUiStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState(initialRoleFilter);
  const [statusFilter, setStatusFilter] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<OperationalStaffUser | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [credentialStaff, setCredentialStaff] = useState<CredentialUser | null>(null);

  const { data: rawStaffList = [], isLoading, refetch } = useOperationalStaff(
    activeCommunityId || undefined
  );
  const updateMutation = useUpdateOperationalStaff();

  // Scope staff list by allowedRoleSlugs if provided
  const staffList = useMemo(() => {
    if (!allowedRoleSlugs || allowedRoleSlugs.length === 0) return rawStaffList;
    const allowedSet = new Set(allowedRoleSlugs);
    return rawStaffList.filter((u) => u.roles.some((r) => allowedSet.has(r.role_slug as OperationalRoleSlug)));
  }, [rawStaffList, allowedRoleSlugs]);

  // Metrics
  const metrics = useMemo(() => {
    const total = staffList.length;
    const activeCount = staffList.filter((u) => u.is_active).length;
    const inactiveCount = staffList.filter((u) => !u.is_active).length;
    const committeeMembers = staffList.filter((u) =>
      u.roles.some((r) => r.role_slug === "association_committee")
    ).length;
    const facilityManagers = staffList.filter((u) =>
      u.roles.some((r) => r.role_slug === "facility_manager")
    ).length;
    const supervisors = staffList.filter((u) =>
      u.roles.some((r) => r.role_slug === "security_supervisor")
    ).length;
    const guards = staffList.filter((u) =>
      u.roles.some((r) => r.role_slug === "security_guard")
    ).length;

    return { total, activeCount, inactiveCount, committeeMembers, facilityManagers, supervisors, guards };
  }, [staffList]);

  // Filtered staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((u) => {
      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = u.full_name.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchPhone = u.phone?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone) return false;
      }

      // Role filter
      if (roleFilter) {
        const hasRole = u.roles.some((r) => r.role_slug === roleFilter);
        if (!hasRole) return false;
      }

      // Status filter
      if (statusFilter) {
        const isActive = statusFilter === "active";
        if (u.is_active !== isActive) return false;
      }

      return true;
    });
  }, [staffList, searchTerm, roleFilter, statusFilter]);

  const handleToggleActive = async (user: OperationalStaffUser) => {
    try {
      const nextActive = !user.is_active;
      await updateMutation.mutateAsync({
        userId: user.id,
        communityId: activeCommunityId || undefined,
        data: { is_active: nextActive },
      });
      toast.success(
        `${user.full_name} is now ${nextActive ? "Active" : "Deactivated"}.`,
        "Status Changed"
      );
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status", "Error");
    }
  };

  const columns: Column<OperationalStaffUser>[] = [
    {
      key: "full_name",
      header: "Staff Member",
      sortable: true,
      render: (u) => {
        const primaryRole = u.roles[0]?.role_slug || "security_guard";
        const meta = getRoleMeta(primaryRole);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background:
                  primaryRole === "association_committee"
                    ? "#e0e7ff"
                    : primaryRole === "facility_manager"
                    ? "#ede9fe"
                    : primaryRole === "security_supervisor"
                    ? "#fef3c7"
                    : "#e0f2fe",
                color:
                  primaryRole === "association_committee"
                    ? "#4338ca"
                    : primaryRole === "facility_manager"
                    ? "#6d28d9"
                    : primaryRole === "security_supervisor"
                    ? "#b45309"
                    : "#0369a1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
                flexShrink: 0,
              }}
            >
              {meta.icon}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--fg)", fontSize: "0.9rem" }}>
                {u.full_name}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{u.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: "roles",
      header: "Assigned Role",
      sortable: true,
      render: (u) => {
        const roleSlug = u.roles[0]?.role_slug || "security_guard";
        const meta = getRoleMeta(roleSlug);
        const badgeStyle =
          roleSlug === "association_committee"
            ? { background: "#e0e7ff", color: "#4338ca", border: "1px solid #c7d2fe" }
            : roleSlug === "facility_manager"
            ? { background: "#f3e8ff", color: "#6b21a8", border: "1px solid #d8b4fe" }
            : roleSlug === "security_supervisor"
            ? { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }
            : { background: "#e0f2fe", color: "#075985", border: "1px solid #bae6fd" };

        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              fontSize: "0.78rem",
              fontWeight: 600,
              ...badgeStyle,
            }}
          >
            <span>{meta.icon}</span> {meta.name}
          </span>
        );
      },
    },
    {
      key: "phone",
      header: "Phone",
      render: (u) => (
        <span style={{ fontSize: "0.85rem", color: u.phone ? "var(--fg)" : "var(--muted)" }}>
          {u.phone || "—"}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      align: "center",
      render: (u) => (
        <span
          className={`badge ${u.is_active ? "badge-success" : "badge-danger"}`}
          style={{ fontSize: "0.75rem" }}
        >
          {u.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Joined",
      sortable: true,
      render: (u) => (
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          {u.created_at ? formatDateTime(u.created_at).split(",")[0] : "Pre-seeded"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (u) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
            onClick={() => {
              setSelectedStaff(u);
              setIsDetailsModalOpen(true);
            }}
          >
            👁️ View
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem", background: "#f8fafc" }}
            onClick={() =>
              setCredentialStaff({
                id: u.id,
                full_name: u.full_name,
                email: u.email,
                phone: u.phone || "",
                roleName: u.roles[0]?.role_slug || "Staff",
              })
            }
            title="Update Credentials"
          >
            🔑 Credentials
          </button>
          <button
            type="button"
            className={u.is_active ? "btn btn-secondary" : "btn btn-secondary"}
            style={{
              fontSize: "0.75rem",
              padding: "0.3rem 0.6rem",
              color: u.is_active ? "var(--danger)" : "var(--success)",
              borderColor: u.is_active ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)",
            }}
            onClick={() => handleToggleActive(u)}
          >
            {u.is_active ? "Deactivate" : "Activate"}
          </button>
        </div>
      ),
    },
  ];

  const isCommitteeOnly =
    allowedRoleSlugs?.length === 1 && allowedRoleSlugs[0] === "association_committee";

  const allFilterOptions = [
    { label: "🏛️ Association Committee", value: "association_committee" },
    { label: "🏢 Facility Manager", value: "facility_manager" },
    { label: "🛡️ Security Supervisor", value: "security_supervisor" },
    { label: "👮 Security Guard", value: "security_guard" },
  ];

  const roleFilterOptions = allowedRoleSlugs && allowedRoleSlugs.length > 0
    ? allFilterOptions.filter((opt) => allowedRoleSlugs.includes(opt.value as OperationalRoleSlug))
    : allFilterOptions;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Top Header Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
            {title || "🛡️ Facility, Committee & Security Personnel"}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0.2rem 0 0" }}>
            {description ||
              "View and provision Association Committee Members, Facility Managers, Security Supervisors, and Security Guards."}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsAddModalOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
        >
          <span>+</span> {addButtonText || (isCommitteeOnly ? "Add Committee Member" : "Add New Personnel")}
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        {isCommitteeOnly ? (
          <>
            <div className="card" style={{ padding: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                🏛️ Total Committee Members
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#4f46e5" }}>
                  {metrics.total}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>members</span>
              </div>
            </div>

            <div className="card" style={{ padding: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                Active Members
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--success)" }}>
                  {metrics.activeCount}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>in office</span>
              </div>
            </div>

            <div className="card" style={{ padding: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                Inactive Members
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--muted)" }}>
                  {metrics.inactiveCount}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>deactivated</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="card" style={{ padding: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                Total Personnel
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--fg)" }}>
                  {metrics.total}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>active team</span>
              </div>
            </div>

            {(!allowedRoleSlugs || allowedRoleSlugs.includes("association_committee")) && (
              <div className="card" style={{ padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                  🏛️ Association Committee
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#4f46e5" }}>
                    {metrics.committeeMembers}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>members</span>
                </div>
              </div>
            )}

            {(!allowedRoleSlugs || allowedRoleSlugs.includes("facility_manager")) && (
              <div className="card" style={{ padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                  🏢 Facility Managers
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#7c3aed" }}>
                    {metrics.facilityManagers}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>operations</span>
                </div>
              </div>
            )}

            {(!allowedRoleSlugs || allowedRoleSlugs.includes("security_supervisor")) && (
              <div className="card" style={{ padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                  🛡️ Security Supervisors
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#d97706" }}>
                    {metrics.supervisors}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>leads</span>
                </div>
              </div>
            )}

            {(!allowedRoleSlugs || allowedRoleSlugs.includes("security_guard")) && (
              <div className="card" style={{ padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                  👮 Security Guards
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#2563eb" }}>
                    {metrics.guards}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>gate ops</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter and Search Panel */}
      <FilterPanel
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={
          isCommitteeOnly
            ? "Search committee members by name, email, or phone..."
            : "Search personnel by name, email, or phone..."
        }
        filterValue={roleFilterOptions.length > 1 ? roleFilter : undefined}
        onFilterChange={roleFilterOptions.length > 1 ? setRoleFilter : undefined}
        filterLabel={roleFilterOptions.length > 1 ? "Filter Role" : undefined}
        filterOptions={roleFilterOptions.length > 1 ? roleFilterOptions : undefined}
        secondaryFilterValue={statusFilter}
        onSecondaryFilterChange={setStatusFilter}
        secondaryFilterLabel="Status"
        secondaryFilterOptions={[
          { label: "Active Only", value: "active" },
          { label: "Inactive Only", value: "inactive" },
        ]}
      />

      {/* Main Data Table */}
      <DataTable
        data={filteredStaff}
        columns={columns}
        isLoading={isLoading}
        emptyTitle={
          isCommitteeOnly
            ? "No Association Committee Members Found"
            : "No Facility or Security Personnel Found"
        }
        emptyDescription={
          searchTerm || roleFilter || statusFilter
            ? "No personnel match your search and filter criteria."
            : isCommitteeOnly
            ? "No committee members registered yet. Click '+ Add Committee Member' to provision an association leader."
            : "No facility managers or security guards registered yet. Click '+ Add New Personnel' to get started."
        }
      />

      {/* Modals */}
      <AddOperationalStaffModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        communityId={activeCommunityId || ""}
        onSuccess={() => refetch()}
        defaultRole={defaultAddRole || (isCommitteeOnly ? "association_committee" : undefined)}
        allowedRoles={allowedRoleSlugs}
      />

      <OperationalStaffDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedStaff(null);
        }}
        staff={selectedStaff}
        communityId={activeCommunityId || undefined}
        onUpdated={() => refetch()}
      />

      <UpdateUserCredentialsModal
        isOpen={Boolean(credentialStaff)}
        onClose={() => setCredentialStaff(null)}
        user={credentialStaff}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
