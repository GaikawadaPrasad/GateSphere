import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { CommunityTable, type CommunityWithMetrics } from "@/components/tables/CommunityTable";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { CreateCommunityModal } from "@/components/super-admin/CreateCommunityModal";
import type { SuperAdminDashboardMetrics } from "@/types/dashboards";

// Mock QueryClient & hooks
vi.mock("@/hooks/use-communities", () => ({
  useCreateCommunity: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "comm-1", name: "New Community" }),
    isPending: false,
  }),
  useCreateTower: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "twr-1", name: "Tower A" }),
    isPending: false,
  }),
  useCreateFloor: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "flr-1", floor_number: 1 }),
    isPending: false,
  }),
  useCreateUnit: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "unt-1", unit_number: "A-101" }),
    isPending: false,
  }),
}));

const mockCommunities: CommunityWithMetrics[] = Array.from({ length: 25 }, (_, i) => ({
  id: `comm-${i + 1}`,
  name: `Palm Meadows Heights ${i + 1}`,
  code: `PMH-${String(i + 1).padStart(2, "0")}`,
  city: "Bengaluru",
  state: "Karnataka",
  is_active: i % 2 === 0,
  created_at: "2026-01-01T00:00:00Z",
  totalTowersCount: 4,
  totalUnitsCount: 120,
  totalResidentsCount: 300,
  occupancyRate: 85,
  financialStatus: "Good",
}));

const mockMetrics: SuperAdminDashboardMetrics = {
  totalCommunities: 25,
  activeCommunities: 20,
  inactiveCommunities: 5,
  totalResidents: 7500,
  totalUnits: 3000,
  occupancyRate: 85,
  activeGateTraffic: 142,
  visitorsInside: 80,
  vehiclesInside: 40,
  staffInside: 22,
  openComplaints: 12,
  criticalComplaints: 2,
  totalCollected: 1500000,
  totalOutstanding: 200000,
  collectionRate: 88,
  emergencyAlertsActive: 0,
  communityBreakdown: {},
};

describe("Super Admin Dashboard Components", () => {
  describe("MetricsGrid", () => {
    it("renders skeleton placeholders when isLoading is true", () => {
      const { container } = render(<MetricsGrid metrics={undefined} isLoading={true} />);
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders all 6 KPI cards with correct metric values when loaded", () => {
      render(<MetricsGrid metrics={mockMetrics} isLoading={false} />);
      expect(screen.getByText("Total Communities")).toBeInTheDocument();
      expect(screen.getByText("Total Residents")).toBeInTheDocument();
      expect(screen.getByText("Occupancy Rate")).toBeInTheDocument();
      expect(screen.getByText("Active Gate Traffic")).toBeInTheDocument();
      expect(screen.getByText("Open Complaints")).toBeInTheDocument();
      expect(screen.getByText("Financial Health")).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();
    });
  });

  describe("CommunityTable Pagination & Sorting", () => {
    it("paginates data to default 10 items per page", () => {
      render(<CommunityTable communities={mockCommunities} isLoading={false} />);
      // First page shows items 1 to 10
      expect(screen.getByText("Palm Meadows Heights 1")).toBeInTheDocument();
      expect(screen.getByText("Palm Meadows Heights 10")).toBeInTheDocument();
      expect(screen.queryByText("Palm Meadows Heights 11")).not.toBeInTheDocument();

      // Pagination indicators
      expect(screen.getByText(/Showing/)).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    });

    it("advances to page 2 when Next is clicked", () => {
      render(<CommunityTable communities={mockCommunities} isLoading={false} />);
      const nextBtn = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextBtn);

      expect(screen.getByText("Palm Meadows Heights 11")).toBeInTheDocument();
      expect(screen.getByText("Palm Meadows Heights 20")).toBeInTheDocument();
      expect(screen.queryByText("Palm Meadows Heights 1")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    });

    it("renders TableSkeleton when isLoading is true", () => {
      const { container } = render(<CommunityTable communities={[]} isLoading={true} />);
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("CreateCommunityModal", () => {
    it("validates required fields before submission", async () => {
      const { container } = render(
        <CreateCommunityModal
          isOpen={true}
          onClose={vi.fn()}
          initialName=""
          initialCode=""
        />
      );

      const form = container.querySelector("form");
      expect(form).toBeInTheDocument();
      if (form) fireEvent.submit(form);

      const errorMessages = await screen.findAllByText(/Community name is required/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it("renders step indicator with Community, Towers, Floors, and Units steps", () => {
      render(
        <CreateCommunityModal
          isOpen={true}
          onClose={vi.fn()}
          initialName="Green Meadows"
          initialCode="GM-01"
        />
      );

      expect(screen.getByText(/1\. Community/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Towers/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. Floors/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. Units/i)).toBeInTheDocument();
    });
  });

  describe("Unit Number Auto-Generation Logic", () => {
    it("correctly auto-generates unit numbers based on floor number and unit index", async () => {
      const { generateUnitNumber } = await import("@/components/super-admin/CreateCommunityModal");
      
      // Floor 1 with 4 units -> 101, 102, 103, 104
      expect(generateUnitNumber(1, 1)).toBe("101");
      expect(generateUnitNumber(1, 2)).toBe("102");
      expect(generateUnitNumber(1, 4)).toBe("104");

      // Floor 2 with 4 units -> 201, 202, 203, 204
      expect(generateUnitNumber(2, 1)).toBe("201");
      expect(generateUnitNumber(2, 4)).toBe("204");

      // Floor 11 with 4 units -> 1101, 1102, 1103, 1104
      expect(generateUnitNumber(11, 1)).toBe("1101");
      expect(generateUnitNumber(11, 4)).toBe("1104");

      // Tower prefix style
      expect(generateUnitNumber(1, 1, "87", "tower_prefix")).toBe("87-101");
      expect(generateUnitNumber(11, 4, "TWR-A", "tower_prefix")).toBe("TWR-A-1104");

      // Alphabetical style
      expect(generateUnitNumber(1, 1, "", "alpha")).toBe("1A");
      expect(generateUnitNumber(1, 2, "", "alpha")).toBe("1B");
      expect(generateUnitNumber(11, 4, "", "alpha")).toBe("11D");
    });
  });
});
