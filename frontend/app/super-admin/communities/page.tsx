"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CommunityTable, type CommunityWithMetrics } from "@/components/tables/CommunityTable";
import { SearchInput } from "@/components/forms/SearchInput";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/utils";
import { communitiesApi } from "@/lib/api";
import { useCommunities, useCreateCommunity, useUpdateCommunity, useDeleteCommunity } from "@/hooks/use-communities";
import { INDIAN_STATES_AND_UTS, POPULAR_CITIES_BY_STATE, isValidCommunityName, isValidCityName } from "@/constants/locations";
import type { Tower, Gate } from "@/types/communities";

export default function CommunitiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Create modal state & validations
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [formError, setFormError] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Edit & Delete modal state & validations
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<CommunityWithMetrics | null>(null);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState("");
  const [editTouched, setEditTouched] = useState<Record<string, boolean>>({});
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // View Details Modal state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingCommunity, setViewingCommunity] = useState<CommunityWithMetrics | null>(null);
  const [communityTowers, setCommunityTowers] = useState<Tower[]>([]);
  const [communityGates, setCommunityGates] = useState<Gate[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const { data: communities, isLoading, refetch } = useCommunities();
  const createMutation = useCreateCommunity();
  const updateMutation = useUpdateCommunity();
  const deleteMutation = useDeleteCommunity();

  // Field validation rules for Create Community
  const createErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      errs.name = "Community name is required";
    } else if (trimmedName.length < 2) {
      errs.name = "Community name must be at least 2 characters";
    } else if (trimmedName.length > 255) {
      errs.name = "Community name cannot exceed 255 characters";
    } else if (!isValidCommunityName(trimmedName)) {
      errs.name = "Community name contains invalid characters";
    }

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      errs.code = "Community code is required";
    } else if (trimmedCode.length < 2 || trimmedCode.length > 32) {
      errs.code = "Code must be between 2 and 32 characters";
    } else if (!/^[A-Z0-9][A-Z0-9_\-\/]*$/.test(trimmedCode)) {
      errs.code = "Code must start with alphanumeric and only contain letters, numbers, hyphens or underscores (e.g. PGW-01)";
    }

    const trimmedCity = city.trim();
    if (trimmedCity) {
      if (trimmedCity.length > 120) {
        errs.city = "City cannot exceed 120 characters";
      } else if (!isValidCityName(trimmedCity)) {
        errs.city = "City must contain only alphabetical letters and spaces";
      }
    }

    const trimmedState = state.trim();
    if (trimmedState && trimmedState.length > 120) {
      errs.state = "State cannot exceed 120 characters";
    }

    return errs;
  }, [name, code, city, state]);

  // Field validation rules for Edit Community
  const editErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const trimmedName = editName.trim();

    if (!trimmedName) {
      errs.name = "Community name is required";
    } else if (trimmedName.length < 2) {
      errs.name = "Community name must be at least 2 characters";
    } else if (trimmedName.length > 255) {
      errs.name = "Community name cannot exceed 255 characters";
    } else if (!isValidCommunityName(trimmedName)) {
      errs.name = "Community name contains invalid characters";
    }

    const trimmedCity = editCity.trim();
    if (trimmedCity) {
      if (trimmedCity.length > 120) {
        errs.city = "City cannot exceed 120 characters";
      } else if (!isValidCityName(trimmedCity)) {
        errs.city = "City must contain only alphabetical letters and spaces";
      }
    }

    const trimmedState = editState.trim();
    if (trimmedState && trimmedState.length > 120) {
      errs.state = "State cannot exceed 120 characters";
    }

    return errs;
  }, [editName, editCity, editState]);

  const isCreateFormValid = Object.keys(createErrors).length === 0;
  const isEditFormValid = Object.keys(editErrors).length === 0;

  const filteredCommunities = useMemo(() => {
    if (!communities) return [];
    return communities.filter((comm) => {
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
    });
  }, [communities, searchQuery, statusFilter]);

  const handleOpenCreate = () => {
    setName("");
    setCode("");
    setCity("");
    setState("");
    setFormError("");
    setTouched({});
    setIsCreateModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setTouched({ name: true, code: true, city: true, state: true });

    if (!isCreateFormValid) {
      const firstError = Object.values(createErrors)[0];
      setFormError(firstError || "Please fix validation errors before submitting.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
      });
      setIsCreateModalOpen(false);
      setName("");
      setCode("");
      setCity("");
      setState("");
      setTouched({});
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to create community. Ensure code is unique.");
      }
    }
  };

  const handleOpenEdit = (comm: CommunityWithMetrics) => {
    setEditingCommunity(comm);
    setEditName(comm.name);
    setEditCity(comm.city || "");
    setEditState(comm.state || "");
    setEditIsActive(comm.is_active);
    setEditError("");
    setEditTouched({});
    setIsConfirmingDelete(false);
    setIsEditModalOpen(true);
  };

  const handleOpenView = async (comm: CommunityWithMetrics) => {
    setViewingCommunity(comm);
    setIsViewModalOpen(true);
    setIsLoadingDetails(true);
    setCommunityTowers([]);
    setCommunityGates([]);

    try {
      const [towersRes, gatesRes] = await Promise.allSettled([
        communitiesApi.towers(comm.id),
        communitiesApi.gates(comm.id),
      ]);
      if (towersRes.status === "fulfilled") setCommunityTowers(towersRes.value || []);
      if (gatesRes.status === "fulfilled") setCommunityGates(gatesRes.value || []);
    } catch (err) {
      console.error("Failed to load details", err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommunity) return;
    setEditError("");
    setEditTouched({ name: true, city: true, state: true });

    if (!isEditFormValid) {
      const firstError = Object.values(editErrors)[0];
      setEditError(firstError || "Please fix validation errors before saving.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editingCommunity.id,
        data: {
          name: editName.trim(),
          city: editCity.trim() || undefined,
          state: editState.trim() || undefined,
          is_active: editIsActive,
        },
      });
      setIsEditModalOpen(false);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setEditError(err.message);
      } else {
        setEditError("Failed to update community.");
      }
    }
  };

  const handleDelete = async () => {
    if (!editingCommunity) return;
    setEditError("");

    try {
      await deleteMutation.mutateAsync(editingCommunity.id);
      setIsEditModalOpen(false);
      setIsConfirmingDelete(false);
      refetch();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setEditError(err.message);
      } else {
        setEditError("Failed to delete community.");
      }
    }
  };

  const stateCitySuggestions = state ? POPULAR_CITIES_BY_STATE[state] || [] : [];
  const editStateCitySuggestions = editState ? POPULAR_CITIES_BY_STATE[editState] || [] : [];

  return (
    <div>
      <PageHeader
        title="Community Management"
        subtitle="Configure and manage all registered residential properties in the platform"
        breadcrumbs={[{ label: "Super Admin", href: "/super-admin/dashboard" }, { label: "Communities" }]}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreate}
          >
            ➕ Add Community
          </button>
        }
      />

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h3 className="card-title">All Communities</h3>
            <p style={{ fontSize: "0.775rem", color: "var(--muted)" }}>
              Total {communities?.length || 0} registered communities
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ width: 260 }}>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by name, code or city…"
              />
            </div>
            <select
              className="select-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              style={{ width: "auto", height: 36, padding: "0.25rem 0.6rem", fontSize: "0.85rem" }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        <CommunityTable
          communities={filteredCommunities}
          isLoading={isLoading}
          onEdit={handleOpenEdit}
          onView={handleOpenView}
        />
      </div>

      {/* Create Modal with Validation */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Community"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-comm-page-form"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Save Community"}
            </button>
          </>
        }
      >
        <form id="create-comm-page-form" onSubmit={handleCreate} noValidate>
          {formError && (
            <div className="badge badge-danger" style={{ display: "block", marginBottom: "1.25rem", padding: "0.6rem 0.75rem", textAlign: "left" }}>
              ⚠️ {formError}
            </div>
          )}

          {/* Community Name Field */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
              <label htmlFor="modal-name" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}>
                Community Name <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <span style={{ fontSize: "0.75rem", color: name.length > 255 ? "var(--danger)" : "var(--muted)" }}>
                {name.length}/255
              </span>
            </div>
            <input
              id="modal-name"
              type="text"
              className="input-field"
              placeholder="e.g. Prestige Greenwoods"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!touched.name) setTouched((t) => ({ ...t, name: true }));
              }}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              style={{
                borderColor: touched.name && createErrors.name ? "var(--danger)" : undefined,
              }}
              required
            />
            {touched.name && createErrors.name && (
              <p style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.3rem", fontWeight: 500 }}>
                ✕ {createErrors.name}
              </p>
            )}
          </div>

          {/* Community Code */}
          <div style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
              <label htmlFor="modal-code" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}>
                Community Code <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <span style={{ fontSize: "0.75rem", color: code.length > 32 ? "var(--danger)" : "var(--muted)" }}>
                {code.length}/32
              </span>
            </div>
            <input
              id="modal-code"
              type="text"
              className="input-field"
              placeholder="e.g. PGW-01"
              value={code}
              onChange={(e) => {
                const upper = e.target.value.toUpperCase();
                setCode(upper);
                if (!touched.code) setTouched((t) => ({ ...t, code: true }));
              }}
              onBlur={() => setTouched((t) => ({ ...t, code: true }))}
              style={{
                borderColor: touched.code && createErrors.code ? "var(--danger)" : undefined,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
              required
            />
            {touched.code && createErrors.code ? (
              <p style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.3rem", fontWeight: 500 }}>
                ✕ {createErrors.code}
              </p>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                Use 2–32 uppercase characters, numbers, and hyphens (e.g. <code>PGW-01</code>).
              </p>
            )}
          </div>

          {/* State & City Section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {/* State Selection */}
            <div>
              <label htmlFor="modal-state" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)", display: "block", marginBottom: "0.35rem" }}>
                State / UT
              </label>
              <select
                id="modal-state"
                className="select-field"
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  if (!touched.state) setTouched((t) => ({ ...t, state: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, state: true }))}
                style={{
                  borderColor: touched.state && createErrors.state ? "var(--danger)" : undefined,
                }}
              >
                <option value="">Select State / UT…</option>
                {INDIAN_STATES_AND_UTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {touched.state && createErrors.state && (
                <p style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                  ✕ {createErrors.state}
                </p>
              )}
            </div>

            {/* City Selection */}
            <div>
              <label htmlFor="modal-city" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)", display: "block", marginBottom: "0.35rem" }}>
                City
              </label>
              <input
                id="modal-city"
                type="text"
                list="modal-city-suggestions"
                className="input-field"
                placeholder={state ? `e.g. ${stateCitySuggestions[0] || "City Name"}` : "e.g. Mumbai"}
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (!touched.city) setTouched((t) => ({ ...t, city: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, city: true }))}
                style={{
                  borderColor: touched.city && createErrors.city ? "var(--danger)" : undefined,
                }}
              />
              <datalist id="modal-city-suggestions">
                {stateCitySuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {touched.city && createErrors.city && (
                <p style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                  ✕ {createErrors.city}
                </p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit & Delete Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={isConfirmingDelete ? "Confirm Community Deletion" : `Edit Community: ${editingCommunity?.name}`}
        footer={
          isConfirmingDelete ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsConfirmingDelete(false)}
              >
                Back to Edit
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting…" : "Permanently Delete"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setIsConfirmingDelete(true)}
                style={{ marginRight: "auto" }}
              >
                🗑️ Delete
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-comm-page-form"
                className="btn btn-primary"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
            </>
          )
        }
      >
        {isConfirmingDelete ? (
          <div style={{ padding: "0.5rem 0" }}>
            <div
              style={{
                background: "var(--danger-light)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--radius-sm)",
                padding: "1rem",
                marginBottom: "1rem",
                color: "#991b1b",
              }}
            >
              <h4 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>⚠️ Are you sure you want to delete this community?</h4>
              <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>
                Deleting <strong>{editingCommunity?.name}</strong> ({editingCommunity?.code}) will permanently remove all associated units, residents, and gate records. This action <strong>cannot be undone</strong>.
              </p>
            </div>
            {editError && (
              <div className="badge badge-danger" style={{ display: "block", padding: "0.5rem" }}>
                {editError}
              </div>
            )}
          </div>
        ) : (
          <form id="edit-comm-page-form" onSubmit={handleSaveEdit} noValidate>
            {editError && (
              <div className="badge badge-danger" style={{ display: "block", marginBottom: "1.25rem", padding: "0.6rem 0.75rem" }}>
                ⚠️ {editError}
              </div>
            )}

            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <label htmlFor="edit-cp-name" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}>
                  Community Name <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <span style={{ fontSize: "0.75rem", color: editName.length > 255 ? "var(--danger)" : "var(--muted)" }}>
                  {editName.length}/255
                </span>
              </div>
              <input
                id="edit-cp-name"
                type="text"
                className="input-field"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  if (!editTouched.name) setEditTouched((t) => ({ ...t, name: true }));
                }}
                onBlur={() => setEditTouched((t) => ({ ...t, name: true }))}
                style={{
                  borderColor: editTouched.name && editErrors.name ? "var(--danger)" : undefined,
                }}
                required
              />
              {editTouched.name && editErrors.name && (
                <p style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                  ✕ {editErrors.name}
                </p>
              )}
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="edit-cp-code" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--muted)", display: "block", marginBottom: "0.35rem" }}>
                Community Code (Read-Only)
              </label>
              <input
                id="edit-cp-code"
                type="text"
                className="input-field"
                value={editingCommunity?.code || ""}
                disabled
                style={{ background: "#f1f5f9", cursor: "not-allowed", fontWeight: 600, letterSpacing: "0.05em" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
              <div>
                <label htmlFor="edit-cp-state" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)", display: "block", marginBottom: "0.35rem" }}>
                  State / UT
                </label>
                <select
                  id="edit-cp-state"
                  className="select-field"
                  value={editState}
                  onChange={(e) => {
                    setEditState(e.target.value);
                    if (!editTouched.state) setEditTouched((t) => ({ ...t, state: true }));
                  }}
                  onBlur={() => setEditTouched((t) => ({ ...t, state: true }))}
                  style={{
                    borderColor: editTouched.state && editErrors.state ? "var(--danger)" : undefined,
                  }}
                >
                  <option value="">Select State / UT…</option>
                  {INDIAN_STATES_AND_UTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {editTouched.state && editErrors.state && (
                  <p style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                    ✕ {editErrors.state}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="edit-cp-city" style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)", display: "block", marginBottom: "0.35rem" }}>
                  City
                </label>
                <input
                  id="edit-cp-city"
                  type="text"
                  list="edit-modal-city-suggestions"
                  className="input-field"
                  value={editCity}
                  onChange={(e) => {
                    setEditCity(e.target.value);
                    if (!editTouched.city) setEditTouched((t) => ({ ...t, city: true }));
                  }}
                  onBlur={() => setEditTouched((t) => ({ ...t, city: true }))}
                  style={{
                    borderColor: editTouched.city && editErrors.city ? "var(--danger)" : undefined,
                  }}
                />
                <datalist id="edit-modal-city-suggestions">
                  {editStateCitySuggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {editTouched.city && editErrors.city && (
                  <p style={{ color: "var(--danger)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
                    ✕ {editErrors.city}
                  </p>
                )}
              </div>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  style={{ width: "auto", margin: 0 }}
                />
                <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Active Community Status</span>
              </label>
            </div>
          </form>
        )}
      </Modal>

      {/* View Community Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Community Details: ${viewingCommunity?.name || ""}`}
        maxWidth={620}
        footer={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsViewModalOpen(false)}
          >
            Close
          </button>
        }
      >
        {viewingCommunity && (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "1rem",
                padding: "1rem",
                background: "#f8fafc",
                borderRadius: "var(--radius)",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Code</span>
                <div style={{ fontWeight: 600 }}>{viewingCommunity.code}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Location</span>
                <div style={{ fontWeight: 600 }}>{[viewingCommunity.city, viewingCommunity.state].filter(Boolean).join(", ") || "–"}</div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Status</span>
                <div>
                  <StatusBadge status={viewingCommunity.is_active} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Created</span>
                <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>{formatDate(viewingCommunity.created_at)}</div>
              </div>
            </div>

            {isLoadingDetails ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div className="skeleton" style={{ height: 28 }} />
                <div className="skeleton" style={{ height: 28 }} />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.75rem" }}>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--fg)" }}>
                    🏢 Towers ({communityTowers.length})
                  </h4>
                  {communityTowers.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {communityTowers.map((t) => (
                        <div
                          key={t.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.8rem",
                            padding: "0.3rem 0.5rem",
                            background: "#f1f5f9",
                            borderRadius: 4,
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{t.name}</span>
                          <span style={{ color: "var(--muted)" }}>{t.total_floors} Floors</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>No towers added yet</span>
                  )}
                </div>

                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "0.75rem" }}>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--fg)" }}>
                    🛡️ Gates ({communityGates.length})
                  </h4>
                  {communityGates.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {communityGates.map((g) => (
                        <div
                          key={g.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.8rem",
                            padding: "0.3rem 0.5rem",
                            background: "#f1f5f9",
                            borderRadius: 4,
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{g.name}</span>
                          <span style={{ color: "var(--muted)", textTransform: "capitalize" }}>{g.gate_type}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>No gates configured</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
