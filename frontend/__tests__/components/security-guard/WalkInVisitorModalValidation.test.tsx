import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { WalkInVisitorModal } from "@/components/common/WalkInVisitorModal";

// Mock external APIs and stores
vi.mock("@/lib/api", () => ({
  visitorsApi: {
    createRequest: vi.fn().mockResolvedValue({ id: "req-123", status: "pending" }),
    getRequest: vi.fn().mockResolvedValue({ id: "req-123", status: "pending" }),
    admitEntry: vi.fn().mockResolvedValue({ id: "log-123" }),
  },
  communitiesApi: {
    list: vi.fn().mockResolvedValue([{ id: "comm-1", name: "GateSphere Grand" }]),
    communityUnits: vi.fn().mockResolvedValue([
      { id: "unit-1", unit_number: "A-101", floor: "1st Floor" },
      { id: "unit-2", unit_number: "B-202", floor: "2nd Floor" },
    ]),
  },
  authApi: {
    me: vi.fn().mockResolvedValue({ community_ids: ["comm-1"] }),
  },
  blacklistApi: {
    screen: vi.fn().mockResolvedValue({ blacklisted: false }),
  },
}));

vi.mock("@/store/ui", () => ({
  useUiStore: () => ({
    activeCommunityId: "comm-1",
  }),
}));

describe("WalkInVisitorModal - Visitor Name Length Validation", () => {
  const onClose = vi.fn();
  const onEntryAdmitted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders visitor name input with 0/35 character counter", async () => {
    render(
      <WalkInVisitorModal isOpen={true} onClose={onClose} onEntryAdmitted={onEntryAdmitted} />,
    );

    expect(screen.getByPlaceholderText(/e.g. Ramesh Kumar/i)).toBeInTheDocument();
    expect(screen.getByText("0/35")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/A-101/i)).toBeInTheDocument();
    });
  });

  it("shows validation error when visitor name is too short (1 character)", async () => {
    render(
      <WalkInVisitorModal isOpen={true} onClose={onClose} onEntryAdmitted={onEntryAdmitted} />,
    );

    const input = screen.getByPlaceholderText(/e.g. Ramesh Kumar/i);
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.blur(input);

    expect(
      await screen.findByText("Visitor name is too short (must be at least 2 characters)."),
    ).toBeInTheDocument();
    expect(screen.getByText("1/35")).toBeInTheDocument();
  });

  it("shows validation error when visitor name exceeds 35 characters", async () => {
    render(
      <WalkInVisitorModal isOpen={true} onClose={onClose} onEntryAdmitted={onEntryAdmitted} />,
    );

    const input = screen.getByPlaceholderText(/e.g. Ramesh Kumar/i);
    const longName = "A".repeat(36);
    fireEvent.change(input, { target: { value: longName } });
    fireEvent.blur(input);

    expect(
      await screen.findByText("Visitor name exceeds maximum length (cannot exceed 35 characters)."),
    ).toBeInTheDocument();
    expect(screen.getByText("36/35")).toBeInTheDocument();
  });

  it("accepts a valid visitor name within the character limit (e.g. 2 to 35 chars)", async () => {
    render(
      <WalkInVisitorModal isOpen={true} onClose={onClose} onEntryAdmitted={onEntryAdmitted} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/A-101/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/e.g. Ramesh Kumar/i);
    fireEvent.change(input, { target: { value: "Ramesh Kumar" } });
    fireEvent.blur(input);

    expect(
      screen.queryByText("Visitor name is too short (must be at least 2 characters)."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Visitor name exceeds maximum length (cannot exceed 35 characters)."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("12/35")).toBeInTheDocument();
  });

  it("displays validation error when submitting an empty visitor name", async () => {
    render(
      <WalkInVisitorModal isOpen={true} onClose={onClose} onEntryAdmitted={onEntryAdmitted} />,
    );

    const submitBtn = screen.getByRole("button", { name: /Send Approval Prompt/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Visitor full name is required.")).toBeInTheDocument();
  });
});
