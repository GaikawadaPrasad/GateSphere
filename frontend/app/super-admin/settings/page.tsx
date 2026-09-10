"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { rbacApi } from "@/lib/api";
import type { Role, Permission } from "@/types/rbac";

export default function SettingsPage() {
  const { data: roles, isLoading: isRolesLoading } = useQuery({
    queryKey: ["rbac", "roles"],
    queryFn: () => rbacApi.roles(),
  });

  const { data: permissions, isLoading: isPermissionsLoading } = useQuery({
    queryKey: ["rbac", "permissions"],
    queryFn: () => rbacApi.permissions(),
  });

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
        <span className={`badge ${r.is_wildcard ? "badge-danger" : "badge-neutral"}`}>
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
      render: (p) => <span className="badge badge-primary">{p.module}</span>,
    },
    {
      key: "action",
      header: "Action",
      render: (p) => <span style={{ textTransform: "capitalize" }}>{p.action}</span>,
    },
    {
      key: "description",
      header: "Description",
      render: (p) => <span>{p.description || "–"}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="System & RBAC Settings"
        subtitle="Configure platform permissions, role hierarchies, and system definitions"
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin/dashboard" },
          { label: "System Settings" },
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "1.5rem" }}>
        {/* Roles Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Configured System Roles</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {roles?.length || 10} Roles
            </span>
          </div>

          <DataTable
            columns={roleColumns as unknown as Column<Record<string, unknown>>[]}
            data={roles as unknown as Record<string, unknown>[]}
            isLoading={isRolesLoading}
            emptyTitle="No roles"
            emptyDescription="Roles definition could not be loaded."
          />
        </div>

        {/* Permissions Catalogue */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Permissions Catalogue</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {permissions?.length || 0} Permissions
            </span>
          </div>

          <DataTable
            columns={permissionColumns as unknown as Column<Record<string, unknown>>[]}
            data={permissions as unknown as Record<string, unknown>[]}
            isLoading={isPermissionsLoading}
            emptyTitle="No permissions"
            emptyDescription="Permissions catalogue could not be loaded."
          />
        </div>
      </div>
    </div>
  );
}
