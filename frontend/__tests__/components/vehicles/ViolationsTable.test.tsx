import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { ViolationsTable } from "@/components/vehicles/ViolationsTable";
import { normalizePlate, PLATE_PATTERN, type ParkingViolation } from "@/types/vehicles";

const row = (over: Partial<ParkingViolation> = {}): ParkingViolation => ({
  id: "v1",
  community_id: "c1",
  vehicle_id: null,
  registration_number: "MH01ZZ0077",
  parking_slot_id: null,
  reported_by_user_id: null,
  violation_type: "unauthorized",
  description: "In slot P-02",
  occurred_at: "2026-09-25T04:00:00Z",
  evidence_url: null,
  fine_amount: null,
  status: "open",
  resolved_at: null,
  created_at: "2026-09-25T04:00:00Z",
  updated_at: "2026-09-25T04:00:00Z",
  ...over,
});

const base = {
  total: 1,
  page: 1,
  pageSize: 20,
  onPageChange: () => {},
  isLoading: false,
  slotCode: new Map<string, string>(),
  emptyTitle: "empty",
  emptyDescription: "empty",
};

describe("ViolationsTable", () => {
  it("renders no lifecycle controls for a read-only viewer (auditor)", () => {
    render(<ViolationsTable {...base} rows={[row()]} />);
    expect(screen.getAllByText("MH01ZZ0077").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /acknowledge|resolve|waive/i })).toBeNull();
  });

  it("offers only the transitions the state machine allows", () => {
    const onTransition = vi.fn();
    render(
      <ViolationsTable
        {...base}
        rows={[row({ status: "acknowledged" })]}
        onTransition={onTransition}
      />,
    );
    expect(screen.queryByRole("button", { name: "Acknowledge" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Resolve" })[0]);
    expect(onTransition).toHaveBeenCalledWith(expect.objectContaining({ id: "v1" }), "resolved");
  });

  it("renders nothing actionable for a terminal violation", () => {
    render(
      <ViolationsTable {...base} rows={[row({ status: "resolved" })]} onTransition={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /acknowledge|resolve|waive/i })).toBeNull();
  });
});

describe("normalizePlate", () => {
  it("matches the backend canonical form", () => {
    expect(normalizePlate("ka 01-ab 1234")).toBe("KA01AB1234");
    expect(PLATE_PATTERN.test(normalizePlate("KA#01"))).toBe(false);
  });
});
