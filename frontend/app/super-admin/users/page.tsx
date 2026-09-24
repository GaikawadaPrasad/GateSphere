"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { CreateUserModal } from "@/components/super-admin/CreateUserModal";
import { EditUserModal, type UserRecord } from "@/components/super-admin/EditUserModal";
import { usersApi, communitiesApi } from "@/lib/api";
import { toast } from "@/store/toast";
import { useUiStore } from "@/store/ui";
import { ScopeBanner } from "@/components/common/ScopeBanner";
import type { Community } from "@/types/communities";

export default function SuperAdminUsersPage() {
  const queryClient = useQueryClient();
  const { activeCommunityId, setActiveCommunity } = useUiStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>(activeCommunityId || "");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"created_at" | "name" | "email">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load communities list for dropdown
  const { data: communities } = useQuery({
    queryKey: ["communities"],
    queryFn: () => communitiesApi.list(),
  });

  // Load all users
  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["users", selectedCommunityId || activeCommunityId || "global"],
    queryFn: () =>
      usersApi.list({
        page_size: 100,
        community_id: selectedCommunityId || activeCommunityId || undefined,
      }),
  });

  const communityMap = useMemo(() => {
    const map = new Map<string, Community>();
    (communities || []).forEach((c: Community) => map.set(c.id, c));
    return map;
  }, [communities]);

  const filteredUsers = useMemo(() => {
    const rawList = (usersData || []) as unknown as UserRecord[];
    const filtered = rawList.filter((u) => {
      // Community filter (if user has any role matching community)
      if (selectedCommunityId) {
        const matchesComm = u.roles?.some((r) => r.community_id === selectedCommunityId);
        if (!matchesComm) return false;
      }

      // Role filter
      if (selectedRole) {
        const matchesRole = u.roles?.some((r) => r.role_slug === selectedRole);
        if (!matchesRole) return false;
      }

      // Status filter
      if (statusFilter === "active" && u.is_active === false) return false;
      if (statusFilter === "disabled" && u.is_active !== false) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });

    // Sort: Newly added at top by default (created_at desc)
    return [...filtered].sort((a, b) => {
      if (sortBy === "created_at") {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (timeA !== timeB) {
          return sortDirection === "desc" ? timeB - timeA : timeA - timeB;
        }
        return 0;
      }
      if (sortBy === "name") {
        const nameA = (a.full_name || "").toLowerCase();
        const nameB = (b.full_name || "").toLowerCase();
        return sortDirection === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortBy === "email") {
        const emailA = (a.email || "").toLowerCase();
        const emailB = (b.email || "").toLowerCase();
        return sortDirection === "asc"
          ? emailA.localeCompare(emailB)
          : emailB.localeCompare(emailA);
      }
      return 0;
    });
  }, [
    usersData,
    selectedCommunityId,
    selectedRole,
    statusFilter,
    searchQuery,
    sortBy,
    sortDirection,
  ]);

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await usersApi.delete(deletingUser.id);
      toast.success(`User "${deletingUser.full_name}" deleted successfully.`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeletingUser(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<UserRecord>[] = [
    {
      key: "user_details",
      header: "User Details",
      render: (u) => {
        const isRecent =
          u.created_at && Date.now() - new Date(u.created_at).getTime() < 86400000 * 2;
        return (
          <div>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}
            >
              <span style={{ fontWeight: 600, color: "var(--fg)" }}>{u.full_name}</span>
              {isRecent && (
                <span
                  className="badge badge-success"
                  style={{
                    fontSize: "0.65rem",
                    padding: "0.1rem 0.45rem",
                    fontWeight: 700,
                    letterSpacing: "0.025em",
                    borderRadius: "4px",
                  }}
                >
                  NEW
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {u.email} {u.phone ? `• ${u.phone}` : ""}
            </div>
            {u.created_at && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--muted-foreground, #94a3b8)",
                  marginTop: "0.15rem",
                }}
              >
                Added:{" "}
                {new Date(u.created_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "roles",
      header: "Assigned Role(s)",
      render: (u) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {u.roles && u.roles.length > 0 ? (
            u.roles.map((r) => (
              <span
                key={r.id}
                className="badge badge-primary"
                style={{ fontSize: "0.75rem", textTransform: "capitalize" }}
              >
                {r.role_name || r.role_slug.replace(/_/g, " ")}
              </span>
            ))
          ) : (
            <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>No roles assigned</span>
          )}
        </div>
      ),
    },
    {
      key: "community",
      header: "Assigned Community",
      render: (u) => {
        const commIds = Array.from(
          new Set(u.roles?.map((r) => r.community_id).filter(Boolean) as string[]),
        );

        if (commIds.length === 0) {
          return (
            <span
              className="badge"
              style={{
                background: "rgba(100, 116, 139, 0.12)",
                color: "var(--muted)",
                fontSize: "0.725rem",
                fontWeight: 600,
              }}
            >
              🌐 Global / Platform
            </span>
          );
        }

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            {commIds.map((cid) => {
              const comm = communityMap.get(cid);
              return (
                <div key={cid} style={{ fontSize: "0.825rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                    {comm ? comm.name : `#${cid.slice(0, 8)}`}
                  </span>
                  {comm?.code && (
                    <span
                      style={{ fontSize: "0.725rem", color: "var(--muted)", marginLeft: "0.35rem" }}
                    >
                      ({comm.code})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (u) => (
        <span
          className={`badge ${u.is_active !== false ? "badge-success" : "badge-neutral"}`}
          style={{ fontSize: "0.75rem" }}
        >
          {u.is_active !== false ? "Active" : "Disabled"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (u) => (
        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
            onClick={() => setEditingUser(u)}
          >
            Edit Access
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
            onClick={() => setDeletingUser(u)}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users & Community Personnel"
        subtitle="Comprehensive directory of community administrators, committee members, managers, technicians, and staff across all properties"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "Users & Staff" },
        ]}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsAddUserOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <span>+</span> Add User / Personnel
          </button>
        }
      />

      {/* Scope Banner */}
      <ScopeBanner
        entityName="user accounts & personnel"
        onClear={() => {
          setSelectedCommunityId("");
          setActiveCommunity(null);
        }}
      />

      <div className="card">
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
            <h3 className="card-title">Personnel Directory</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              {filteredUsers.length} personnel matching filters
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            {/* Search Input Box with Icon & CSS */}
            <div style={{ position: "relative", minWidth: 240, maxWidth: 300, flex: "1 1 auto" }}>
              <span
                style={{
                  position: "absolute",
                  left: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted, #64748b)",
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search name, email, phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: 38,
                  paddingLeft: "2.35rem",
                  paddingRight: searchQuery ? "2.2rem" : "0.75rem",
                  fontSize: "0.85rem",
                  borderRadius: "var(--radius-sm, 8px)",
                  border: "1px solid var(--border-standard, #cbd5e1)",
                  background: "#ffffff",
                  color: "var(--fg, #0f172a)",
                  outline: "none",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary, #2563eb)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-standard, #cbd5e1)";
                  e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  title="Clear search"
                  style={{
                    position: "absolute",
                    right: "0.65rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "rgba(100, 116, 139, 0.15)",
                    border: "none",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted, #64748b)",
                    cursor: "pointer",
                    fontSize: "0.7rem",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Community Filter */}
            <select
              className="select-field"
              value={selectedCommunityId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCommunityId(val);
                setActiveCommunity(val || null);
              }}
              style={{
                width: "auto",
                height: 38,
                fontSize: "0.85rem",
                padding: "0 0.75rem",
                borderRadius: "var(--radius-sm, 8px)",
              }}
            >
              <option value="">All Communities</option>
              {(communities || []).map((c: Community) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>

            {/* Role Filter */}
            <select
              className="select-field"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              style={{
                width: "auto",
                height: 38,
                fontSize: "0.85rem",
                padding: "0 0.75rem",
                borderRadius: "var(--radius-sm, 8px)",
              }}
            >
              <option value="">All System Roles</option>
              <option value="community_admin">Community Admin</option>
              <option value="association_committee">Association Committee</option>
              <option value="facility_manager">Facility Manager</option>
              <option value="vendor_technician">Vendor Technician</option>
              <option value="auditor">Auditor</option>
              <option value="domestic_staff">Domestic Staff</option>
              <option value="security_supervisor">Security Supervisor</option>
              <option value="security_guard">Security Guard</option>
              <option value="super_admin">Super Admin</option>
            </select>

            {/* Status Filter */}
            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: "auto",
                height: 38,
                fontSize: "0.85rem",
                padding: "0 0.75rem",
                borderRadius: "var(--radius-sm, 8px)",
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="disabled">Disabled Only</option>
            </select>

            {/* Quick Sort Toggle Button */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (sortBy !== "created_at") {
                  setSortBy("created_at");
                  setSortDirection("desc");
                } else {
                  setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
                }
              }}
              title={
                sortBy === "created_at" && sortDirection === "desc"
                  ? "Currently showing Newest first. Click to show Oldest first."
                  : "Click to toggle sort order"
              }
              style={{
                height: 38,
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0 0.85rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                borderRadius: "var(--radius-sm, 8px)",
                border: "1px solid var(--border-standard, #cbd5e1)",
                background: "#ffffff",
                color: "var(--fg, #0f172a)",
                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{ fontSize: "0.95rem", color: "var(--primary, #2563eb)", fontWeight: 700 }}
              >
                {sortDirection === "desc" ? "↓" : "↑"}
              </span>
              <span>
                {sortBy === "created_at"
                  ? sortDirection === "desc"
                    ? "Newest First"
                    : "Oldest First"
                  : sortDirection === "asc"
                    ? "Name (A-Z)"
                    : "Name (Z-A)"}
              </span>
            </button>

            {/* Sort Criteria Selector */}
            <select
              className="select-field"
              value={`${sortBy}_${sortDirection}`}
              onChange={(e) => {
                const [by, dir] = e.target.value.split("_");
                setSortBy(by as "created_at" | "name" | "email");
                setSortDirection(dir as "asc" | "desc");
              }}
              aria-label="Sort users by"
              style={{
                width: "auto",
                height: 38,
                fontSize: "0.85rem",
                padding: "0 0.75rem",
                borderRadius: "var(--radius-sm, 8px)",
                border: "1px solid var(--border-standard, #cbd5e1)",
              }}
            >
              <option value="created_at_desc">🕒 Sort: Newest First (Default)</option>
              <option value="created_at_asc">⏳ Sort: Oldest First</option>
              <option value="name_asc">🔤 Sort: Name (A → Z)</option>
              <option value="name_desc">🔤 Sort: Name (Z → A)</option>
              <option value="email_asc">✉️ Sort: Email (A → Z)</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={filteredUsers as unknown as Record<string, unknown>[]}
          isLoading={isUsersLoading}
          emptyTitle="No users found"
          emptyDescription="No users or personnel match the selected filters."
          enableClientPagination
          pageSize={15}
        />
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <CreateUserModal
          isOpen={isAddUserOpen}
          onClose={() => setIsAddUserOpen(false)}
          preselectedCommunityId={selectedCommunityId || activeCommunityId || ""}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}

      {/* Edit User Access Modal */}
      {editingUser && (
        <EditUserModal
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          user={editingUser}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}

      {/* Confirm Delete User Modal */}
      {deletingUser && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingUser(null)}
          title="Delete User Account"
          size="sm"
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeletingUser(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteUser}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Confirm Delete"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: "0.9rem" }}>
            Are you sure you want to delete user <strong>{deletingUser.full_name}</strong> (
            {deletingUser.email})? This will revoke all role grants and session tokens.
          </p>
        </Modal>
      )}
    </div>
  );
}
