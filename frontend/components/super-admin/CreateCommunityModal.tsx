"use client";

import { useState, useMemo, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { useCreateCommunity } from "@/hooks/use-communities";
import {
  INDIAN_STATES_AND_UTS,
  POPULAR_CITIES_BY_STATE,
  isValidCommunityName,
  isValidCityName,
} from "@/constants/locations";

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialName?: string;
  initialCode?: string;
}

export function CreateCommunityModal({
  isOpen,
  onClose,
  onSuccess,
  initialName = "",
  initialCode = "",
}: CreateCommunityModalProps) {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [formError, setFormError] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const createCommunityMutation = useCreateCommunity();

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setCode(initialCode);
      setCity(initialName ? "Bengaluru" : "");
      setState(initialName ? "Karnataka" : "");
      setFormError("");
      setTouched({});
    }
  }, [isOpen, initialName, initialCode]);

  // Field validation rules
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
      errs.code =
        "Code must start with alphanumeric and only contain letters, numbers, hyphens or underscores (e.g. PMH-01)";
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

  const isCreateFormValid = Object.keys(createErrors).length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setTouched({ name: true, code: true, city: true, state: true });

    if (!isCreateFormValid) {
      const firstError = Object.values(createErrors)[0];
      setFormError(firstError || "Please fix validation errors before submitting.");
      return;
    }

    try {
      await createCommunityMutation.mutateAsync({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
      });

      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to create community. Ensure code is unique.");
      }
    }
  };

  const stateCitySuggestions = state ? POPULAR_CITIES_BY_STATE[state] || [] : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Residential Community"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="create-community-modal-form"
            className="btn btn-primary"
            disabled={createCommunityMutation.isPending}
          >
            {createCommunityMutation.isPending ? "Creating…" : "Create Community"}
          </button>
        </>
      }
    >
      <form id="create-community-modal-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div
            className="badge badge-danger"
            style={{
              display: "block",
              marginBottom: "1.25rem",
              padding: "0.6rem 0.75rem",
              textAlign: "left",
            }}
          >
            ⚠️ {formError}
          </div>
        )}

        {/* Community Name Field */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}
          >
            <label
              htmlFor="modal-comm-name"
              style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}
            >
              Community Name <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <span
              style={{
                fontSize: "0.75rem",
                color: name.length > 255 ? "var(--danger)" : "var(--muted)",
              }}
            >
              {name.length}/255
            </span>
          </div>
          <input
            id="modal-comm-name"
            type="text"
            className="input-field"
            placeholder="e.g. Palm Meadows Heights"
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
            <p
              style={{
                color: "var(--danger)",
                fontSize: "0.75rem",
                marginTop: "0.3rem",
                fontWeight: 500,
              }}
            >
              ✕ {createErrors.name}
            </p>
          )}
        </div>

        {/* Community Code Field */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}
          >
            <label
              htmlFor="modal-comm-code"
              style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--fg)" }}
            >
              Community Code (Unique Slug) <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <span
              style={{
                fontSize: "0.75rem",
                color: code.length > 32 ? "var(--danger)" : "var(--muted)",
              }}
            >
              {code.length}/32
            </span>
          </div>
          <input
            id="modal-comm-code"
            type="text"
            className="input-field"
            placeholder="e.g. PMH-01"
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
            <p
              style={{
                color: "var(--danger)",
                fontSize: "0.75rem",
                marginTop: "0.3rem",
                fontWeight: 500,
              }}
            >
              ✕ {createErrors.code}
            </p>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
              Use 2–32 uppercase characters, numbers, and hyphens (e.g. <code>PMH-01</code>).
            </p>
          )}
        </div>

        {/* State & City Section — Responsive Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          {/* State Selection */}
          <div>
            <label
              htmlFor="modal-comm-state"
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
              id="modal-comm-state"
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

          {/* City Selection with Datalist Autocomplete */}
          <div>
            <label
              htmlFor="modal-comm-city"
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
              id="modal-comm-city"
              type="text"
              list="modal-city-suggestions"
              className="input-field"
              placeholder={
                state ? `e.g. ${stateCitySuggestions[0] || "City Name"}` : "e.g. Bengaluru"
              }
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
  );
}
