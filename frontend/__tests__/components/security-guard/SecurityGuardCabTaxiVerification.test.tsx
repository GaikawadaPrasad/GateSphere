import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import SecurityGuardCabTaxiPage from "@/app/(protected)/security-guard/cab-taxi/page";
import { visitorsApi, communitiesApi, authApi } from "@/lib/api";

// Mock external APIs
vi.mock("@/lib/api", () => ({
  visitorsApi: {
    requests: vi.fn(),
    directory: vi.fn().mockResolvedValue([]),
    entries: vi.fn().mockResolvedValue([]),
    createRequest: vi.fn(),
    recordEntry: vi.fn(),
    recordExit: vi.fn(),
    sendApprovalRequest: vi.fn(),
    notifyResident: vi.fn(),
  },
  communitiesApi: {
    list: vi.fn().mockResolvedValue([{ id: "comm-1", name: "Green Park Enclave" }]),
    communityUnits: vi.fn().mockResolvedValue([
      { id: "unit-101", unit_number: "A-101" },
      { id: "unit-102", unit_number: "B-202" },
    ]),
  },
  authApi: {
    me: vi.fn().mockResolvedValue({ community_ids: ["comm-1"] }),
  },
}));

vi.mock("@/store/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Pages resolve the current user from the shared auth cache (`useCachedMe`); route it to the
// `authApi.me` mock above so no QueryClientProvider is needed here.
vi.mock("@/hooks/use-auth", async () => {
  const { authApi } = await import("@/lib/api");
  return { useCachedMe: () => () => authApi.me() };
});

describe("SecurityGuardCabTaxiPage - Verification & Gate Actions (Bug 043)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCabs = [
    {
      id: "cab-req-1",
      visitor_type: "cab_taxi",
      unit_id: "unit-101",
      visitor_name: "Ramesh Driver",
      visitor_phone: "9876543210",
      vehicle_number: "KA-01-MJ-5555",
      purpose: "Uber Premier",
      status: "approved",
      expected_at: "2026-09-18T10:00:00Z",
    },
    {
      id: "cab-req-2",
      visitor_type: "cab_taxi",
      unit_id: "unit-102",
      visitor_name: "Suresh Driver",
      visitor_phone: "9876500000",
      vehicle_number: "DL-04-AB-1234",
      purpose: "Ola Sedan",
      status: "pending",
      created_at: "2026-09-18T10:15:00Z",
    },
    {
      id: "cab-req-3",
      visitor_type: "cab_taxi",
      unit_id: "unit-101",
      visitor_name: "Karan Cab",
      visitor_phone: "9876511111",
      vehicle_number: "MH-02-XY-9999",
      purpose: "Rapido Cab",
      status: "entered",
      created_at: "2026-09-18T09:30:00Z",
    },
  ];

  const mockEntries = [
    {
      id: "entry-cab-3",
      request_id: "cab-req-3",
      entry_at: "2026-09-18T09:35:00Z",
      exit_at: null,
      vehicle_number: "MH-02-XY-9999",
    },
  ];

  it("renders page header, verification action button, status filter tabs, and active movements", async () => {
    (visitorsApi.requests as any).mockResolvedValue(mockCabs);
    (visitorsApi.entries as any).mockResolvedValue(mockEntries);

    render(<SecurityGuardCabTaxiPage />);

    // Check header and verification button
    await waitFor(() => {
      expect(screen.getByText(/Cab & Taxi Verification/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Verify Cab \/ Taxi/i })).toBeInTheDocument();
    });

    // Check movements rendered in table
    expect(screen.getByText(/KA-01-MJ-5555/i)).toBeInTheDocument();
    expect(screen.getByText(/DL-04-AB-1234/i)).toBeInTheDocument();
    expect(screen.getByText(/MH-02-XY-9999/i)).toBeInTheDocument();

    // Check status badges & destination units
    expect(screen.getByText(/Ramesh Driver/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Unit A-101/i).length).toBeGreaterThan(0);
  });

  it("allows sending real-time approval request notification to resident for pending cab arrival", async () => {
    (visitorsApi.requests as any).mockResolvedValue(mockCabs);
    (visitorsApi.entries as any).mockResolvedValue(mockEntries);
    (visitorsApi.sendApprovalRequest as any).mockResolvedValue({
      id: "cab-req-2",
      status: "pending",
    });

    render(<SecurityGuardCabTaxiPage />);

    await waitFor(() => {
      expect(screen.getByText(/DL-04-AB-1234/i)).toBeInTheDocument();
    });

    // Find "Send Approval Request" button for the pending cab
    const sendBtn = screen.getByRole("button", { name: /Send Approval Request/i });
    expect(sendBtn).toBeInTheDocument();

    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(visitorsApi.sendApprovalRequest).toHaveBeenCalledWith("cab-req-2");
      expect(
        screen.getByText(/Approval request notification dispatched to resident/i),
      ).toBeInTheDocument();
    });
  });

  it("opens fast verification modal and searches cab booking by vehicle plate", async () => {
    (visitorsApi.requests as any).mockResolvedValue(mockCabs);
    (visitorsApi.entries as any).mockResolvedValue(mockEntries);

    render(<SecurityGuardCabTaxiPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Verify Cab \/ Taxi/i })).toBeInTheDocument();
    });

    // Click Fast Verification
    fireEvent.click(screen.getByRole("button", { name: /Verify Cab \/ Taxi/i }));

    expect(screen.getByText(/Quick Gate Verification:/i)).toBeInTheDocument();

    // Search for plate number
    const searchInput = screen.getByPlaceholderText(/e\.g\. KA-01-AB-1234/i);
    fireEvent.change(searchInput, { target: { value: "KA-01" } });

    await waitFor(() => {
      expect(screen.getByText(/MATCHED CAB BOOKINGS/i)).toBeInTheDocument();
      // Should show the matched booking card
      expect(screen.getAllByText(/KA-01-MJ-5555/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("allows 1-click direct entry without photo capture for approved cabs", async () => {
    (visitorsApi.requests as any).mockResolvedValue(mockCabs);
    (visitorsApi.entries as any).mockResolvedValue(mockEntries);
    (visitorsApi.recordEntry as any).mockResolvedValue({
      id: "entry-cab-1",
      entry_at: "2026-09-18T10:05:00Z",
    });

    render(<SecurityGuardCabTaxiPage />);

    await waitFor(() => {
      expect(screen.getByText(/KA-01-MJ-5555/i)).toBeInTheDocument();
    });

    const allowEntryBtn = screen.getByRole("button", { name: /✅ Allow Entry/i });
    expect(allowEntryBtn).toBeInTheDocument();

    fireEvent.click(allowEntryBtn);

    await waitFor(() => {
      expect(visitorsApi.recordEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          request_id: "cab-req-1",
        }),
      );
      expect(screen.getByText(/Gate entry recorded for cab/i)).toBeInTheDocument();
    });
  });

  it("allows marking gate exit for entered cabs", async () => {
    (visitorsApi.requests as any).mockResolvedValue(mockCabs);
    (visitorsApi.entries as any).mockResolvedValue(mockEntries);
    (visitorsApi.recordExit as any).mockResolvedValue({
      id: "entry-cab-3",
      exit_at: "2026-09-18T10:30:00Z",
    });

    render(<SecurityGuardCabTaxiPage />);

    await waitFor(() => {
      expect(screen.getByText(/MH-02-XY-9999/i)).toBeInTheDocument();
    });

    const exitBtn = screen.getByRole("button", { name: /Mark Exit/i });
    expect(exitBtn).toBeInTheDocument();

    fireEvent.click(exitBtn);

    await waitFor(() => {
      expect(visitorsApi.recordExit).toHaveBeenCalledWith("entry-cab-3");
      expect(screen.getByText(/Gate exit recorded for cab/i)).toBeInTheDocument();
    });
  });
});
