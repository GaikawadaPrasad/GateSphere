"use client";

import { useRef, useState } from "react";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { toast } from "@/store/toast";

/** FR-07 delivery categories (backend `deliveries/models.py::DELIVERY_TYPES`). */
export const DELIVERY_TYPES = [
  "food",
  "grocery",
  "ecommerce",
  "courier",
  "medicine",
  "laundry",
  "other",
] as const;

/** The four PRD delivery protocols (backend `CANONICAL_PROTOCOLS`). */
export const DELIVERY_PROTOCOLS = [
  { value: "allow_at_gate", label: "Allow at gate" },
  { value: "resident_approval_required", label: "Ask me first" },
  { value: "leave_at_gate_desk", label: "Leave at gate desk" },
  { value: "direct_rejection", label: "Reject" },
] as const;

/** Server default when no protocol row exists (`deliveries/service.py::_DEFAULT_PROTOCOL`). */
const DEFAULT_PROTOCOL = "resident_approval_required";

export interface ProtocolRow {
  delivery_type: string;
  protocol_type: string;
}

interface Props {
  protocols: ProtocolRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Persists one protocol; must reject on failure so the row can show the error. */
  onSave: (deliveryType: string, protocolType: string) => Promise<unknown>;
}

/**
 * Resident "Standing Gate Delivery Protocols" (FR-07): one protocol per delivery type for
 * the resident's own unit. The backend pins a resident's upsert to their unit and is the
 * authority; this only picks the value.
 */
export function DeliveryProtocolSettings({
  protocols,
  isLoading,
  isError,
  onRetry,
  onSave,
}: Props) {
  const inFlight = useRef<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: "1rem",
        }}
      >
        <span className="sr-only">Loading delivery protocols</span>
        {[1, 2, 3].map((n) => (
          <CardSkeleton key={n} lines={2} />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <ErrorState
        title="Failed to load delivery protocols"
        message="Your gate delivery preferences could not be loaded."
        onRetry={onRetry}
      />
    );
  }

  const current = new Map((protocols || []).map((p) => [p.delivery_type, p.protocol_type]));

  const change = async (deliveryType: string, protocolType: string) => {
    // Ref guard, not isPending: two change events in one tick must not both submit (§5.4).
    if (inFlight.current.has(deliveryType)) return;
    inFlight.current.add(deliveryType);
    setSaving(deliveryType);
    try {
      await onSave(deliveryType, protocolType);
      toast.success(`${deliveryType} deliveries: ${protocolType.replace(/_/g, " ")}`, "Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save protocol", "Not saved");
    } finally {
      inFlight.current.delete(deliveryType);
      setSaving(null);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
        gap: "1rem",
      }}
    >
      {DELIVERY_TYPES.map((type) => {
        const id = `delivery-protocol-${type}`;
        const value = current.get(type) || DEFAULT_PROTOCOL;
        const isCanonical = DELIVERY_PROTOCOLS.some((p) => p.value === value);
        return (
          <div
            key={type}
            style={{
              padding: "0.85rem",
              background: "#F8FAFC",
              borderRadius: "8px",
              border: "1px solid var(--border-light)",
            }}
          >
            <label
              htmlFor={id}
              style={{ fontWeight: 700, fontSize: "13.5px", textTransform: "capitalize" }}
            >
              {type}
            </label>
            <select
              id={id}
              value={value}
              disabled={saving === type}
              aria-busy={saving === type}
              onChange={(e) => change(type, e.target.value)}
              className="select-field"
              style={{ marginTop: "0.4rem", width: "100%" }}
            >
              {!isCanonical && <option value={value}>{value.replace(/_/g, " ")} (legacy)</option>}
              {DELIVERY_PROTOCOLS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
