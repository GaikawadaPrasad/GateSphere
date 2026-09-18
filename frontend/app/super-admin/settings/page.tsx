"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/common/Modal";
import { CreateUserModal } from "@/components/super-admin/CreateUserModal";
import { EditUserModal, type UserRecord } from "@/components/super-admin/EditUserModal";
import { EditRolePermissionsModal } from "@/components/super-admin/EditRolePermissionsModal";
import { rbacApi, usersApi } from "@/lib/api";
import type { Role, Permission } from "@/types/rbac";
import { toast } from "@/store/toast";
import { useUiStore } from "@/store/ui";
import { ScopeBanner } from "@/components/common/ScopeBanner";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { activeCommunityId } = useUiStore();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [descriptionInput, setDescriptionInput] = useState<string>("");

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
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
    queryKey: ["users", activeCommunityId || "global"],
    queryFn: () => usersApi.list({ page_size: 100, community_id: activeCommunityId || undefined }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ code, description }: { code: string; description: string }) =>
      rbacApi.updatePermission(code, { description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbac", "permissions"] });
      toast.success("Permission updated successfully.", "Permission Saved");
      setEditingPermission(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update permission.", "Update Failed");
    },
  });

  const handleEditClick = (p: Permission) => {
    setEditingPermission(p);
    setDescriptionInput(p.description || "");
  };

  const handleSavePermission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermission) return;
    updateMutation.mutate({
      code: editingPermission.code,
      description: descriptionInput,
    });
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await usersApi.delete(deletingUser.id);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success(`User ${deletingUser.full_name} deleted successfully.`, "User Deleted");
      setDeletingUser(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete user", "Delete Failed");
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
      header: "Scope",
      align: "center",
      render: (r) => (
        <span
          className={`badge ${r.is_wildcard ? "badge-danger" : "badge-neutral"}`}
          title={r.is_wildcard ? "Wildcard access granted across all modules" : "Granular module-scoped permissions"}
        >
          {r.is_wildcard ? "Wildcard (*)" : "Scoped"}
        </span>
      ),
    },
    {
      key: "default_permissions",
      header: "Default Permissions Count",
      align: "center",
      render: (r) => <span>{r.default_permissions?.length ?? r.permissions?.length ?? 0}</span>,
    },
    {
      key: "actions",
      header: "Action",
      align: "right",
      render: (r) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
          onClick={() => setEditingRole(r)}
          title={`Configure and update granular permissions assigned to ${r.name}`}
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
    {
      key: "actions",
      header: "Action",
      align: "right",
      render: (p) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
          onClick={() => handleEditClick(p)}
          title={`Edit description for ${p.code}`}
        >
          Update
        </button>
      ),
    },
  ];

  const userColumns: Column<UserRecord>[] = [
    {
      key: "user_details",
      header: "User Details",
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
              <span
                key={r.id}
                className="badge badge-primary"
                style={{ fontSize: "0.75rem" }}
                title={`Role: ${r.role_slug}${r.community_id ? ` (Community: ${r.community_id.slice(0, 8)})` : " (Global)"}`}
              >
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
        <span
          className={`badge ${u.is_active !== false ? "badge-success" : "badge-neutral"}`}
          title={u.is_active !== false ? "Account active and able to authenticate" : "Account disabled"}
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
            title={`Manage RBAC role assignments, community scope, and credentials for ${u.full_name}`}
          >
            Edit Access
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
            onClick={() => setDeletingUser(u)}
            title={`Delete user account for ${u.full_name}`}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const modalMod = editingPermission
    ? editingPermission.module ||
    (editingPermission.code.includes(":") ? editingPermission.code.split(":")[0] : editingPermission.code)
    : "";
  const modalAct = editingPermission
    ? editingPermission.action ||
    (editingPermission.code.includes(":") ? editingPermission.code.split(":")[1] : "")
    : "";

  return (
    <div>
      <PageHeader
        title="System & RBAC Settings"
        subtitle={
          activeCommunityId
            ? "Platform permissions, role hierarchies, and scoped user assignments"
            : "Configure platform permissions, role hierarchies, and system definitions"
        }
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "System Settings" },
        ]}
      />

      {/* Active Scope Banner */}
      <ScopeBanner entityName="user accounts & permissions" />

      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        {/* User Access & RBAC Assignments Matrix */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h3 className="card-title">User Access & RBAC Assignments Matrix</h3>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {isUsersLoading ? "Loading users…" : `${usersData?.length || 0} Registered Users`}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsAddUserOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
            >
              <span>+</span> Add User / Personnel
            </button>
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

        {/* Roles Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Configured System Roles</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {isRolesLoading ? "Loading roles…" : `${roles?.length || 10} Roles`}
            </span>
          </div>

          <DataTable
            columns={roleColumns as unknown as Column<Record<string, unknown>>[]}
            data={roles as unknown as Record<string, unknown>[]}
            isLoading={isRolesLoading}
            emptyTitle="No roles"
            emptyDescription="Roles definition could not be loaded."
            enableClientPagination
            pageSize={10}
          />
        </div>

        {/* Permissions Catalogue */}
        {/* <div className="card">
          <div className="card-header">
            <h3 className="card-title">Permissions Catalogue</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {isPermissionsLoading ? "Loading permissions…" : `${permissions?.length || 0} Permissions`}
            </span>
          </div>

          <DataTable
            columns={permissionColumns as unknown as Column<Record<string, unknown>>[]}
            data={permissions as unknown as Record<string, unknown>[]}
            isLoading={isPermissionsLoading}
            emptyTitle="No permissions"
            emptyDescription="Permissions catalogue could not be loaded."
            enableClientPagination
            pageSize={10}
          />
        </div> */}
      </div>

      {/* Edit Permission Modal */}
      {editingPermission && (
        <Modal
          isOpen={!!editingPermission}
          onClose={() => setEditingPermission(null)}
          title={`Update Permission — ${editingPermission.code}`}
          size="md"
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingPermission(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSavePermission}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </>
          }
        >
          <form onSubmit={handleSavePermission} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--brand-heading)", display: "block", marginBottom: "0.35rem" }}>
                  Permission Code
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editingPermission.code}
                  disabled
                  style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                />
              </div>

              <div style={{ width: "120px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--brand-heading)", display: "block", marginBottom: "0.35rem" }}>
                  Module
                </label>
                <div style={{ paddingTop: "0.4rem" }}>
                  <span className="badge badge-primary">{modalMod}</span>
                </div>
              </div>

              <div style={{ width: "120px" }}>
                <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--brand-heading)", display: "block", marginBottom: "0.35rem" }}>
                  Action
                </label>
                <div style={{ paddingTop: "0.4rem", textTransform: "capitalize", fontWeight: 600 }}>
                  {modalAct || "–"}
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--brand-heading)", display: "block", marginBottom: "0.35rem" }}>
                Description
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="Enter permission description..."
                style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "var(--radius-input)", border: "1px solid var(--border-standard)" }}
              />
            </div>
          </form>
        </Modal>
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
            Are you sure you want to delete <strong>{deletingUser.full_name}</strong> ({deletingUser.email})? This action will immediately revoke their access and delete their user profile.
          </p>
        </Modal>
      )}

      {/* Create User Modal */}
      {isAddUserOpen && (
        <CreateUserModal
          isOpen={isAddUserOpen}
          onClose={() => setIsAddUserOpen(false)}
          preselectedCommunityId={activeCommunityId || ""}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
          }}
        />
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


