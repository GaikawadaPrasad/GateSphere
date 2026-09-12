"use client";

import { useState, useMemo, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { useUpdateCommunity, useDeleteCommunity } from "@/hooks/use-communities";
import {
  INDIAN_STATES_AND_UTS,
  POPULAR_CITIES_BY_STATE,
  isValidCommunityName,
  isValidCityName,
} from "@/constants/locations";
import type { CommunityWithMetrics } from "@/components/tables/CommunityTable";

interface EditCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  community: CommunityWithMetrics | null;
}

export function EditCommunityModal({
  isOpen,
  onClose,
  onSuccess,
  community,
}: EditCommunityModalProps) {
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState("");
  const [editTouched, setEditTouched] = useState<Record<string, boolean>>({});
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const updateCommunityMutation = useUpdateCommunity();
  const deleteCommunityMutation = useDeleteCommunity();

  useEffect(() => {
    if (isOpen && community) {
      setEditName(community.name);
      setEditCity(community.city || "");
      setEditState(community.state || "");
      setEditIsActive(community.is_active);
      setEditError("");
      setEditTouched({});
      setIsConfirmingDelete(false);
    }
  }, [isOpen, community]);

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

  const isEditFormValid = Object.keys(editErrors).length === 0;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community) return;
    setEditError("");
    setEditTouched({ name: true, city: true, state: true });

    if (!isEditFormValid) {
      const firstError = Object.values(editErrors)[0];
      setEditError(firstError || "Please fix validation errors before saving.");
      return;
    }

    try {
      await updateCommunityMutation.mutateAsync({
        id: community.id,
        data: {
          name: editName.trim(),
          city: editCity.trim() || undefined,
          state: editState.trim() || undefined,
          is_active: editIsActive,
        },
      });

      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setEditError(err.message);
      } else {
        setEditError("Failed to update community.");
      }
    }
  };

  const handleDelete = async () => {
    if (!community) return;
    setEditError("");

    try {
      await deleteCommunityMutation.mutateAsync(community.id);
      onClose();
      setIsConfirmingDelete(false);
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setEditError(err.message);
      } else {
        setEditError("Failed to delete community.");
      }
    }
  };

  const editStateCitySuggestions = editState ? POPULAR_CITIES_BY_STATE[editState] || [] : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isConfirmingDelete
          ? "Confirm Community Deletion"
          : `Edit Community: ${community?.name || ""}`
      }
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
              disabled={deleteCommunityMutation.isPending}
            >
              {deleteCommunityMutation.isPending ? "Deleting…" : "Permanently Delete"}
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
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-community-modal-form"
              className="btn btn-primary"
              disabled={updateCommunityMutation.isPending}
            >
              {updateCommunityMutation.isPending ? "Saving…" : "Save Changes"}
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
            <h4 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              ⚠️ Are you sure you want to delete this community?
            </h4>
            <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>
              Deleting <strong>{community?.name}</strong> ({community?.code}) will
              permanently remove all associated gates, towers, units, resident profiles, tickets,
              and logs. This action <strong>cannot be undone</strong>.
            </p>
          </div>
          {editError && (
            <div className="badge badge-danger" style={{ display: "block", padding: "0.5rem" }}>
              {editError}
            </div>
          )}
        </div>
      ) : (
        <form id="edit-community-modal-form" onSubmit={handleSaveEdit} noValidate>
          {editError && (
            <div
              className="badge badge-danger"
              style={{ display: "block", marginBottom: "1.25rem", padding: "0.6rem 0.75rem" }}
            >
              ⚠️ {editError}
            </div>
          )}

          <div style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.35rem",
              }}
            >
              <label
                htmlFor="edit-modal-comm-name"
                style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}
              >
                Community Name <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: editName.length > 255 ? "var(--danger)" : "var(--muted)",
                }}
              >
                {editName.length}/255
              </span>
            </div>
            <input
              id="edit-modal-comm-name"
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
            <label
              htmlFor="edit-modal-comm-code"
              style={{
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "var(--muted)",
                display: "block",
                marginBottom: "0.35rem",
              }}
            >
              Community Code (Read-Only)
            </label>
            <input
              id="edit-modal-comm-code"
              type="text"
              className="input-field"
              value={community?.code || ""}
              disabled
              style={{
                background: "#f1f5f9",
                cursor: "not-allowed",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            />
          </div>

          {/* State & City Section — Responsive Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
              gap: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <label
                htmlFor="edit-modal-comm-state"
                style={{
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  color: "var(--fg)",
                  display: "block",
                  marginBottom: "0.35rem",
                }}
              >
                State / UT
              </label>
              <select
                id="edit-modal-comm-state"
                className="select-field"
                value={editState}
                onChange={(e) => {
                  setEditState(e.target.value);
                  if (!editTouched.state) setEditTouched((t) => ({ ...t, state: true }));
                }}
                onBlur={() => setEditTouched((t) => ({ ...t, state: true }))}
                style={{
                  borderColor:
                    editTouched.state && editErrors.state ? "var(--danger)" : undefined,
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
              <label
                htmlFor="edit-modal-comm-city"
                style={{
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  color: "var(--fg)",
                  display: "block",
                  marginBottom: "0.35rem",
                }}
              >
                City
              </label>
              <input
                id="edit-modal-comm-city"
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
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
                style={{ width: "auto", margin: 0 }}
              />
              <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Active Community Status
              </span>
            </label>
          </div>
        </form>
      )}
    </Modal>
  );
}
