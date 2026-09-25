import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { WalkInVisitorModal } from "@/components/common/WalkInVisitorModal";
import { visitorsApi } from "@/lib/api";

// Mock FileUpload component to simulate photo attachment
vi.mock("@/components/common/FileUpload", () => ({
  FileUpload: ({ onUploadComplete }: { onUploadComplete: (url: string) => void }) => (
    <button
      type="button"
      data-testid="mock-upload"
      onClick={() => onUploadComplete("https://cdn.example.com/photo.jpg")}
    >
      Upload Photo
    </button>
  ),
}));

// Mock external APIs and stores
vi.mock("@/lib/api", () => ({
  visitorsApi: {
    createRequest: vi.fn(),
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
    check: vi.fn().mockResolvedValue({ blacklisted: false }),
  },
}));

vi.mock("@/store/ui", () => ({
  useUiStore: () => ({
    activeCommunityId: "comm-1",
  }),
}));

// Pages resolve the current user from the shared auth cache (`useCachedMe`); route it to the
// `authApi.me` mock above so no QueryClientProvider is needed here.
vi.mock("@/hooks/use-auth", async () => {
  const { authApi } = await import("@/lib/api");
  return { useCachedMe: () => () => authApi.me() };
});

describe("WalkInVisitorModal - Anti-Passback Validation", () => {
  const onClose = vi.fn();
  const onEntryAdmitted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays an anti-passback alert when visitor is already inside premises", async () => {
    (visitorsApi.createRequest as any).mockRejectedValueOnce({
      code: "VISITOR_ALREADY_INSIDE",
      message: "Visitor Active Visitor is currently inside the premises and has not checked out.",
      fields: { phone: "Visitor Active Visitor is already checked in at the premises." },
    });

    render(
      <WalkInVisitorModal isOpen={true} onClose={onClose} onEntryAdmitted={onEntryAdmitted} />,
    );

    // Wait for units to load
    await waitFor(() => {
      expect(screen.getByText(/A-101/i)).toBeInTheDocument();
    });

    // Fill form fields
    fireEvent.change(screen.getByPlaceholderText(/e.g. Ramesh Kumar/i), {
      target: { value: "Active Visitor" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e.g. 98765 43210/i), {
      target: { value: "9876543210" },
    });

    // Select unit from dropdown
    const unitSelect = screen.getByDisplayValue(/-- Select Destination Unit \/ Flat --/i);
    fireEvent.change(unitSelect, { target: { value: "unit-1" } });

    // Attach mock photo
    fireEvent.click(screen.getByTestId("mock-upload"));

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /SEND APPROVAL PROMPT/i });
    fireEvent.click(submitBtn);

    // Assert anti-passback banner appears
    await waitFor(() => {
      expect(
        screen.getByText(
          /VISITOR ALREADY INSIDE: This visitor is currently checked in at the community/i,
        ),
      ).toBeInTheDocument();
    });
  });
});
