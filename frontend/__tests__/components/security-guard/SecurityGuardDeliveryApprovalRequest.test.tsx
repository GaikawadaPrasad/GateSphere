import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import SecurityGuardDeliveriesPage from "@/app/(protected)/security-guard/deliveries/page";
import { deliveriesApi } from "@/lib/api";

// Mock external APIs and stores
vi.mock("@/lib/api", () => ({
  deliveriesApi: {
    list: vi.fn(),
    protocols: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    recordArrival: vi.fn(),
    markDelivered: vi.fn(),
    cancel: vi.fn(),
    sendApprovalRequest: vi.fn(),
  },
  communitiesApi: {
    list: vi.fn().mockResolvedValue([{ id: "comm-1", name: "GateSphere Grand" }]),
    communityUnits: vi
      .fn()
      .mockResolvedValue([{ id: "unit-1", unit_number: "A-101", floor: "1st Floor" }]),
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

describe("SecurityGuardDeliveriesPage - Send Delivery Approval Request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Send Approval Request' action button for active deliveries and sends notification to resident", async () => {
    const mockDeliveries = [
      {
        id: "del-101",
        unit_number: "Unit A-101",
        provider_name: "Amazon Prime",
        delivery_type: "courier",
        executive_name: "Karan Singh",
        executive_phone: "9876543210",
        tracking_reference: "AMZ-12345",
        status: "expected",
        approval_status: "pending",
        protocol_type: "collect_at_gate",
      },
    ];

    (deliveriesApi.list as any).mockResolvedValue(mockDeliveries);
    (deliveriesApi.sendApprovalRequest as any).mockResolvedValue({
      id: "del-101",
      approval_status: "pending",
    });

    render(<SecurityGuardDeliveriesPage />);

    // Wait for delivery table to render
    await waitFor(() => {
      expect(screen.getByText(/Amazon Prime/i)).toBeInTheDocument();
      expect(screen.getByText(/Unit A-101/i)).toBeInTheDocument();
    });

    // Check that 'Send Approval Request' button is rendered in the Gate Action column
    const sendBtn = screen.getByRole("button", { name: /Send Approval Request/i });
    expect(sendBtn).toBeInTheDocument();

    // Click the button
    fireEvent.click(sendBtn);

    // Verify deliveriesApi.sendApprovalRequest is called with the delivery ID
    await waitFor(() => {
      expect(deliveriesApi.sendApprovalRequest).toHaveBeenCalledWith("del-101");
    });

    // Verify success banner appears
    await waitFor(() => {
      expect(
        screen.getByText(/Delivery approval request notification sent to resident/i),
      ).toBeInTheDocument();
    });
  });
});
