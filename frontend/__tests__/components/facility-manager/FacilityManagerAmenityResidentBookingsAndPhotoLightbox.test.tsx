import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock auth & API
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  authApi: {
    me: vi.fn().mockResolvedValue({
      id: "u-fm-1",
      full_name: "Facility Manager John",
      email: "fm@gatesphere.com",
      roles: [{ role_code: "facility_manager", community_id: "c-1" }],
    }),
  },
  amenitiesApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: "amenity-1",
        name: "Clubhouse Badminton Court",
        category: "Sports",
        capacity: 4,
        price_per_hour: 150,
      },
      {
        id: "amenity-2",
        name: "Swimming Pool",
        category: "Recreation",
        capacity: 20,
        price_per_hour: 0,
      },
    ]),
    bookings: vi.fn().mockResolvedValue([
      {
        id: "booking-101",
        amenity_id: "amenity-1",
        amenity_name: "Clubhouse Badminton Court",
        resident_name: "Vikram Sharma",
        resident_phone: "+91 9876543210",
        unit_number: "A-107",
        tower_name: "Tower A",
        unit_label: "Unit A-107, Tower A",
        date: "2026-09-20",
        start_time: "06:00",
        end_time: "07:00",
        status: "confirmed",
        guests_count: 2,
        total_amount: 150,
      },
      {
        id: "booking-102",
        amenity_id: "amenity-2",
        amenity_name: "Swimming Pool",
        resident_name: "Pooja Reddy",
        resident_phone: "+91 9123456780",
        unit_number: "B-402",
        tower_name: "Tower B",
        unit_label: "Unit B-402, Tower B",
        date: "2026-09-20",
        start_time: "08:00",
        end_time: "09:00",
        status: "confirmed",
        guests_count: 1,
        total_amount: 0,
      },
    ]),
    cancelBooking: vi.fn().mockResolvedValue({ status: "cancelled" }),
  },
  visitorsApi: {
    requests: vi.fn().mockResolvedValue([
      {
        id: "req-1",
        visitor_name: "Rajesh Verma",
        phone: "+91 9876543211",
        visitor_type: "guest",
        status: "pending",
        unit_id: "unit-1",
        photo_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400",
        purpose: "Weekend family lunch",
      },
    ]),
    directory: vi.fn().mockResolvedValue([]),
    entries: vi.fn().mockResolvedValue([]),
  },
  communitiesApi: {
    communityUnits: vi.fn().mockResolvedValue([
      { id: "unit-1", unit_number: "A-107" },
    ]),
  },
  useUiStore: vi.fn().mockReturnValue({ activeCommunityId: "c-1" }),
}));

import FacilityManagerAmenitiesPage from "@/app/(protected)/facility-manager/amenities/page";
import SecurityGuardVisitorsPage from "@/app/(protected)/security-guard/visitors/page";

describe("Bug 027: Facility Manager Upcoming Resident Bookings Table & Clickable Visitor Photo Lightbox", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("displays resident name, unit number, tower name, and contact phone in Upcoming Resident Bookings table", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <FacilityManagerAmenitiesPage />
      </QueryClientProvider>
    );

    // Expect table headers for Resident / Booked By and Unit / Tower
    await waitFor(() => {
      expect(screen.getByText("Upcoming Resident Bookings")).toBeInTheDocument();
    });

    expect(screen.getByText("Resident / Booked By")).toBeInTheDocument();
    expect(screen.getByText("Unit / Tower")).toBeInTheDocument();
    expect(screen.getByText("Amenity")).toBeInTheDocument();

    // Verify resident 1 details
    expect(screen.getByText(/Vikram Sharma/)).toBeInTheDocument();
    expect(screen.getByText("+91 9876543210")).toBeInTheDocument();
    expect(screen.getByText(/Unit A-107, Tower A/)).toBeInTheDocument();
    expect(screen.getAllByText("Clubhouse Badminton Court").length).toBeGreaterThanOrEqual(1);

    // Verify resident 2 details
    expect(screen.getByText(/Pooja Reddy/)).toBeInTheDocument();
    expect(screen.getByText("+91 9123456780")).toBeInTheDocument();
    expect(screen.getByText(/Unit B-402, Tower B/)).toBeInTheDocument();
    expect(screen.getAllByText("Swimming Pool").length).toBeGreaterThanOrEqual(1);
  });

  it("opens visitor photo lightbox modal when clicking visitor photo in security guard visitor table", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SecurityGuardVisitorsPage />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Rajesh Verma")).toBeInTheDocument();
    });

    // Check thumbnail image exists
    const photoThumbnail = screen.getByTitle("Click to view full photograph");
    expect(photoThumbnail).toBeInTheDocument();

    // Click photo thumbnail to open in-app lightbox modal
    fireEvent.click(photoThumbnail);

    await waitFor(() => {
      expect(screen.getByText("📷 Rajesh Verma")).toBeInTheDocument();
      expect(screen.getByText("Close Preview")).toBeInTheDocument();
    });

    // Click Close Preview
    fireEvent.click(screen.getByText("Close Preview"));
    await waitFor(() => {
      expect(screen.queryByText("Close Preview")).not.toBeInTheDocument();
    });
  });
});
