"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { EditUserModal, type UserRecord } from "@/components/super-admin/EditUserModal";
import { EditRolePermissionsModal } from "@/components/super-admin/EditRolePermissionsModal";
import { rbacApi, usersApi } from "@/lib/api";
import type { Role, Permission } from "@/types/rbac";

export default function AdminRbacPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"roles" | "permissions" | "matrix">("roles");
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: roles, isLoading: isRolesLoading } = useQuery({
    queryKey: ["rbac", "roles"],
    queryFn: () => rbacApi.roles(),
  });

  const { data: permissions, isLoading: isPermissionsLoading } = useQuery({
    queryKey: ["rbac", "permissions"],
    queryFn: () => rbacApi.permissions(),
  });

  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list({ page_size: 100 }),
  });

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await usersApi.delete(deletingUser.id);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeletingUser(null);
    } catch (err: any) {
      alert(err?.message || "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const roleColumns: Column<Role>[] = [
    {
      key: "name",
      header: "Role Name",
      render: (r) => (
        <div>
          <span style={{ fontWeight: 600, color: "var(--fg)" }}>{r.name}</span>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Slug: {r.slug}</div>
        </div>
      ),
    },
    {
      key: "is_wildcard",
      header: "Access Scope",
      align: "center",
      render: (r) => (
        <span className={`badge ${r.is_wildcard ? "badge-danger" : "badge-neutral"}`}>
          {r.is_wildcard ? "Super Admin (*)" : "Tenant Scoped"}
        </span>
      ),
    },
    {
      key: "permissions_count",
      header: "Assigned Permissions",
      align: "center",
      render: (r) => <span>{r.default_permissions?.length ?? r.permissions?.length ?? 0}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (r) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
          onClick={() => setEditingRole(r)}
        >
          Update Role Permissions
        </button>
      ),
    },
  ];

  const permissionColumns: Column<Permission>[] = [
    {
      key: "code",
      header: "Permission Code",
      render: (p) => <span style={{ fontWeight: 600, color: "var(--fg)" }}>{p.code}</span>,
    },
    {
      key: "module",
      header: "Module",
      render: (p) => {
        const mod = p.module || (p.code.includes(":") ? p.code.split(":")[0] : p.code);
        return <span className="badge badge-primary">{mod}</span>;
      },
    },
    {
      key: "action",
      header: "Action",
      render: (p) => {
        const act = p.action || (p.code.includes(":") ? p.code.split(":")[1] : "");
        return <span style={{ textTransform: "capitalize" }}>{act || "–"}</span>;
      },
    },
    {
      key: "description",
      header: "Description",
      render: (p) => <span>{p.description || "–"}</span>,
    },
  ];

  const userColumns: Column<UserRecord>[] = [
    {
      key: "user_details",
      header: "User / Person Details",
      render: (u) => (
        <div>
          <span style={{ fontWeight: 600, color: "var(--fg)" }}>{u.full_name}</span>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {u.email} {u.phone ? `• ${u.phone}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Assigned Roles",
      render: (u) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {u.roles && u.roles.length > 0 ? (
            u.roles.map((r) => (
              <span key={r.id} className="badge badge-primary" style={{ fontSize: "0.75rem" }}>
                {r.role_name || r.role_slug}
              </span>
            ))
          ) : (
            <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>No explicit roles</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (u) => (
        <span className={`badge ${u.is_active !== false ? "badge-success" : "badge-neutral"}`}>
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
        title="Role-Based Access Control (RBAC)"
        subtitle="View and manage role permissions, system scopes, and security policy matrix"
        breadcrumbs={[{ label: "Admin", href: "/admin/community" }, { label: "RBAC Management" }]}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <button
          type="button"
          className={`btn ${activeTab === "roles" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("roles")}
        >
          Roles ({roles?.length || 0})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "permissions" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("permissions")}
        >
          Permissions Catalogue ({permissions?.length || 0})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "matrix" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("matrix")}
        >
          User RBAC Access Matrix ({usersData?.length || 0})
        </button>
      </div>

      {activeTab === "roles" && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">System Roles</h3>
          </div>
          <DataTable
            columns={roleColumns as unknown as Column<Record<string, unknown>>[]}
            data={roles as unknown as Record<string, unknown>[]}
            isLoading={isRolesLoading}
            emptyTitle="No roles loaded"
            enableClientPagination
            pageSize={10}
          />
        </div>
      )}

      {activeTab === "permissions" && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Permissions Catalogue</h3>
          </div>
          <DataTable
            columns={permissionColumns as unknown as Column<Record<string, unknown>>[]}
            data={permissions as unknown as Record<string, unknown>[]}
            isLoading={isPermissionsLoading}
            emptyTitle="No permissions loaded"
            enableClientPagination
            pageSize={10}
          />
        </div>
      )}

      {activeTab === "matrix" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">User Access & Role Assignments Matrix</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {usersData?.length || 0} Accounts Managed
              </span>
            </div>

            <DataTable
              columns={userColumns as unknown as Column<Record<string, unknown>>[]}
              data={(usersData || []) as unknown as Record<string, unknown>[]}
              isLoading={isUsersLoading}
              emptyTitle="No users found"
              emptyDescription="User list could not be loaded."
              enableClientPagination
              pageSize={10}
            />
          </div>

          <div className="card" style={{ padding: "1.5rem" }}>
            <h3 className="card-title" style={{ marginBottom: "1rem" }}>
              GateSphere Enterprise RBAC Invariants
            </h3>
            <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.6, color: "var(--fg)" }}>
              <li>
                <strong>Tenant Scope Isolation:</strong> Every query enforces tenant boundary using{" "}
                <code>community_id</code> predicate.
              </li>
              <li>
                <strong>Auditor Role:</strong> Strict <code>GET-only</code> read access. Any
                state-changing mutation returns <code>403 Forbidden</code>.
              </li>
              <li>
                <strong>Resident Own-Unit Control:</strong> Plain residents access only their unit
                records via <code>actor_unit_scope()</code>.
              </li>
              <li>
                <strong>Security Guard Scope:</strong> Scoped to gate operations and visitor logs
                only.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Edit User Access Modal */}
      {editingUser && (
        <EditUserModal
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          user={editingUser}
          availableRoles={roles}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <Modal
          isOpen={!!deletingUser}
          onClose={() => setDeletingUser(null)}
          title={`Delete Person — ${deletingUser.full_name}`}
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
                onClick={handleConfirmDeleteUser}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: "0.9rem", color: "var(--fg)", lineHeight: 1.5 }}>
            Are you sure you want to delete <strong>{deletingUser.full_name}</strong> (
            {deletingUser.email})? This action will immediately revoke their access and delete their
            user profile.
          </p>
        </Modal>
      )}

      {/* Edit Role Permissions Modal */}
      {editingRole && (
        <EditRolePermissionsModal
          isOpen={!!editingRole}
          onClose={() => setEditingRole(null)}
          role={editingRole}
          allPermissions={permissions || []}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["rbac", "roles"] });
            queryClient.invalidateQueries({ queryKey: ["rbac", "permissions"] });
          }}
        />
      )}
    </div>
  );
}
