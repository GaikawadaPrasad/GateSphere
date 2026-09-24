"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/common/Modal";
import { rbacApi } from "@/lib/api";
import type { Role, Permission } from "@/types/rbac";
import { toast } from "@/store/toast";

interface EditRolePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: Role | null;
  allPermissions: Permission[];
  onSuccess: () => void;
}

export function EditRolePermissionsModal({
  isOpen,
  onClose,
  role,
  allPermissions = [],
  onSuccess,
}: EditRolePermissionsModalProps) {
  const queryClient = useQueryClient();
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (role) {
      const initialPerms = role.permissions || role.default_permissions || [];
      setSelectedPermissions(new Set(initialPerms));
      setSearchTerm("");
      setSelectedModule("all");
      setErrorMessage(null);
    }
  }, [role]);

  // Extract unique modules
  const modules = useMemo(() => {
    const mods = new Set<string>();
    allPermissions.forEach((p) => {
      const mod = p.module || (p.code.includes(":") ? p.code.split(":")[0] : p.code);
      if (mod) mods.add(mod);
    });
    return ["all", ...Array.from(mods).sort()];
  }, [allPermissions]);

  // Filter permissions by search and module
  const filteredPermissions = useMemo(() => {
    return allPermissions.filter((p) => {
      const mod = p.module || (p.code.includes(":") ? p.code.split(":")[0] : p.code);
      const matchesModule = selectedModule === "all" || mod === selectedModule;
      const matchesSearch =
        !searchTerm.trim() ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesModule && matchesSearch;
    });
  }, [allPermissions, selectedModule, searchTerm]);

  if (!role || !isOpen) return null;

  const isWildcard = role.is_wildcard || role.slug === "super_admin";

  const handleTogglePermission = (code: string) => {
    if (isWildcard) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (isWildcard) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      filteredPermissions.forEach((p) => next.add(p.code));
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    if (isWildcard) return;
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      filteredPermissions.forEach((p) => next.delete(p.code));
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isWildcard) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await rbacApi.setRolePermissions(role.slug, Array.from(selectedPermissions));
      toast.success(
        `Updated permissions for role "${role.name}" (${selectedPermissions.size} assigned).`,
        "Role Permissions Saved",
      );
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["roles"], refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: ["permissions"], refetchType: "all" }),
      ]);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || "Failed to update role permissions.";
      setErrorMessage(msg);
      toast.error(msg, "Update Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Role Permissions — ${role.name}`}
      size="lg"
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSubmitting || isWildcard}
          >
            {isSubmitting ? "Saving..." : "Save Role Permissions"}
          </button>
        </>
      }
    >
      <form
        onSubmit={handleSave}
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        {/* Meta Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            background: "#f8fafc",
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: "var(--brand-heading)" }}>
              Role: <span style={{ fontFamily: "monospace" }}>{role.slug}</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              {role.description || "System configured RBAC role"}
            </div>
          </div>
          <div>
            {isWildcard ? (
              <span className="badge badge-danger">Wildcard (*) All Access</span>
            ) : (
              <span className="badge badge-primary">
                {selectedPermissions.size} of {allPermissions.length} Permissions
              </span>
            )}
          </div>
        </div>

        {/* Wildcard Alert */}
        {isWildcard && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "0.5rem",
              color: "#991b1b",
              fontSize: "0.85rem",
            }}
          >
            <strong>Note:</strong> The Super Admin role has wildcard access (<code>*</code>) and
            automatically possesses all permissions across every module. Its permission set cannot
            be restricted.
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: "0.5rem",
              color: "#991b1b",
              fontSize: "0.85rem",
            }}
          >
            {errorMessage}
          </div>
        )}

        {!isWildcard && (
          <>
            {/* Filters Bar */}
            <div
              style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}
            >
              <div style={{ flex: 1, minWidth: "200px" }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search permission code or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ fontSize: "0.85rem" }}
                />
              </div>

              <div style={{ width: "160px" }}>
                <select
                  className="form-control"
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  style={{ fontSize: "0.85rem" }}
                >
                  {modules.map((m) => (
                    <option key={m} value={m}>
                      {m === "all" ? "All Modules" : m}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "0.35rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem" }}
                  onClick={handleSelectAllFiltered}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.75rem", padding: "0.35rem 0.65rem" }}
                  onClick={handleDeselectAllFiltered}
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* Permissions Checkbox Grid */}
            <div
              style={{
                maxHeight: "340px",
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                padding: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              {filteredPermissions.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "var(--muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  No permissions match the active filter.
                </div>
              ) : (
                filteredPermissions.map((p) => {
                  const isChecked = selectedPermissions.has(p.code);
                  const mod = p.module || (p.code.includes(":") ? p.code.split(":")[0] : p.code);
                  const act = p.action || (p.code.includes(":") ? p.code.split(":")[1] : "");

                  return (
                    <label
                      key={p.code}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.375rem",
                        background: isChecked ? "rgba(37, 99, 235, 0.04)" : "transparent",
                        border: isChecked
                          ? "1px solid rgba(37, 99, 235, 0.2)"
                          : "1px solid transparent",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePermission(p.code)}
                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}
                          >
                            {p.code}
                          </span>
                          <span
                            className="badge badge-primary"
                            style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem" }}
                          >
                            {mod}
                          </span>
                          {act && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                textTransform: "capitalize",
                                color: "var(--muted)",
                                background: "#f1f5f9",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "0.25rem",
                              }}
                            >
                              {act}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--muted)",
                              marginTop: "0.15rem",
                            }}
                          >
                            {p.description}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
