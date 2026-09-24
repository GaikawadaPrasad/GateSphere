import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import CommunitiesPage from "@/app/super-admin/communities/page";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CommunityWithMetrics } from "@/components/tables/CommunityTable";

const mockMutateUnitAsync = vi.fn();

vi.mock("@/hooks/use-communities", () => ({
  useCommunities: () => ({
    data: [
      {
        id: "comm-1",
        name: "Palm Meadows",
        code: "PM-01",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        totalTowersCount: 1,
        totalUnitsCount: 5,
        totalResidentsCount: 10,
        occupancyRate: 80,
        financialStatus: "Good",
      } as CommunityWithMetrics,
    ],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useCreateCommunity: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCommunity: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCommunity: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTower: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateFloor: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateUnit: () => ({
    mutateAsync: mockMutateUnitAsync,
    isPending: false,
  }),
  useCreateGate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCommunityUnits: () => ({
    data: [],
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-dashboards", () => ({
  useSuperAdminDashboardMetrics: () => ({
    data: null,
  }),
}));

vi.mock("@/hooks/use-residents", () => ({
  useAddResident: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/lib/api", () => ({
  communitiesApi: {
    towers: vi
      .fn()
      .mockResolvedValue([
        { id: "twr-1", name: "Tower A", code: "TWR-A", total_floors: 5, total_units: 10 },
      ]),
    floors: vi
      .fn()
      .mockResolvedValue([{ id: "flr-1", tower_id: "twr-1", floor_number: 1, label: "Floor 1" }]),
    communityUnits: vi.fn().mockResolvedValue([]),
    gates: vi.fn().mockResolvedValue([]),
    provisionAdmin: vi.fn().mockResolvedValue({ id: "adm-1" }),
    createUnit: vi.fn(),
  },
  residentsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
  usersApi: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommunitiesPage />
    </QueryClientProvider>,
  );
}

describe("Super Admin Communities - Add Unit Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateUnitAsync.mockResolvedValue({
      id: "unt-1",
      unit_number: "A-101",
      unit_type: "apartment",
    });
  });

  it("renders valid Unit Type enum options and defaults to apartment", async () => {
    renderPage();

    // Click "View" button to open community details
    const viewBtn = await screen.findByRole("button", { name: /view/i });
    fireEvent.click(viewBtn);

    // Switch to Units tab
    const unitsTab = await screen.findByRole("button", { name: /units/i });
    fireEvent.click(unitsTab);

    // Click "Add Unit" button
    const addUnitBtn = await screen.findByRole("button", { name: /➕ add unit/i });
    await waitFor(() => expect(addUnitBtn).not.toBeDisabled());
    fireEvent.click(addUnitBtn);

    // Modal should be open
    expect(await screen.findByText("Add Unit / Apartment")).toBeInTheDocument();

    // Verify Unit Type label is present
    const unitTypeLabels = screen.getAllByText(/unit type/i);
    expect(unitTypeLabels.length).toBeGreaterThan(0);

    // Verify Unit Type select options
    const selectElements = screen.getAllByRole("combobox");
    // selectElements should include Tower, Floor, Unit Type
    const typeSelect = selectElements.find((sel) =>
      Array.from(sel.querySelectorAll("option")).some((opt) => opt.value === "apartment"),
    ) as HTMLSelectElement;

    expect(typeSelect).toBeDefined();
    expect(typeSelect.value).toBe("apartment");

    const optionValues = Array.from(typeSelect.querySelectorAll("option")).map((o) => o.value);
    expect(optionValues).toEqual(["apartment", "office", "penthouse", "shop", "studio", "villa"]);

    const optionTexts = Array.from(typeSelect.querySelectorAll("option")).map((o) => o.textContent);
    expect(optionTexts).toEqual(["Apartment", "Office", "Penthouse", "Shop", "Studio", "Villa"]);
  });

  it("successfully creates a unit with default unit_type 'apartment' and numeric values", async () => {
    renderPage();

    const viewBtn = await screen.findByRole("button", { name: /view/i });
    fireEvent.click(viewBtn);

    const unitsTab = await screen.findByRole("button", { name: /units/i });
    fireEvent.click(unitsTab);

    const addUnitBtn = await screen.findByRole("button", { name: /➕ add unit/i });
    await waitFor(() => expect(addUnitBtn).not.toBeDisabled());
    fireEvent.click(addUnitBtn);

    expect(await screen.findByText("Add Unit / Apartment")).toBeInTheDocument();

    // Fill in unit number
    const unitNumberInput = screen.getByPlaceholderText(/e\.g\. A-101/i);
    fireEvent.change(unitNumberInput, { target: { value: "A-741" } });

    // Submit form
    const createUnitBtn = screen.getByRole("button", { name: "Create Unit" });
    fireEvent.click(createUnitBtn);

    await waitFor(() => {
      expect(mockMutateUnitAsync).toHaveBeenCalledWith({
        floor_id: "flr-1",
        unit_number: "A-741",
        unit_type: "apartment",
        bedrooms: 2,
        area_sqft: 1200,
      });
    });
  });

  it("sends selected valid enum value when unit type is changed to villa", async () => {
    renderPage();

    const viewBtn = await screen.findByRole("button", { name: /view/i });
    fireEvent.click(viewBtn);

    const unitsTab = await screen.findByRole("button", { name: /units/i });
    fireEvent.click(unitsTab);

    const addUnitBtn = await screen.findByRole("button", { name: /➕ add unit/i });
    await waitFor(() => expect(addUnitBtn).not.toBeDisabled());
    fireEvent.click(addUnitBtn);

    expect(await screen.findByText("Add Unit / Apartment")).toBeInTheDocument();

    const selectElements = screen.getAllByRole("combobox");
    const typeSelect = selectElements.find((sel) =>
      Array.from(sel.querySelectorAll("option")).some((opt) => opt.value === "villa"),
    ) as HTMLSelectElement;

    fireEvent.change(typeSelect, { target: { value: "villa" } });
    expect(typeSelect.value).toBe("villa");

    const unitNumberInput = screen.getByPlaceholderText(/e\.g\. A-101/i);
    fireEvent.change(unitNumberInput, { target: { value: "Villa-9" } });

    const createUnitBtn = screen.getByRole("button", { name: "Create Unit" });
    fireEvent.click(createUnitBtn);

    await waitFor(() => {
      expect(mockMutateUnitAsync).toHaveBeenCalledWith({
        floor_id: "flr-1",
        unit_number: "Villa-9",
        unit_type: "villa",
        bedrooms: 2,
        area_sqft: 1200,
      });
    });
  });

  it("displays error inside modal if mutation fails", async () => {
    mockMutateUnitAsync.mockRejectedValueOnce(
      new Error("Unit number already exists in this tower"),
    );

    renderPage();

    const viewBtn = await screen.findByRole("button", { name: /view/i });
    fireEvent.click(viewBtn);

    const unitsTab = await screen.findByRole("button", { name: /units/i });
    fireEvent.click(unitsTab);

    const addUnitBtn = await screen.findByRole("button", { name: /➕ add unit/i });
    await waitFor(() => expect(addUnitBtn).not.toBeDisabled());
    fireEvent.click(addUnitBtn);

    expect(await screen.findByText("Add Unit / Apartment")).toBeInTheDocument();

    const unitNumberInput = await screen.findByPlaceholderText(/e\.g\. A-101/i);
    fireEvent.change(unitNumberInput, { target: { value: "A-101" } });

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Create Unit" });
      expect(btn).not.toBeDisabled();
    });

    const createUnitBtn = screen.getByRole("button", { name: "Create Unit" });
    fireEvent.click(createUnitBtn);

    await waitFor(() => {
      expect(mockMutateUnitAsync).toHaveBeenCalled();
    });

    await waitFor(() => {
      const form = document.getElementById("add-unit-form");
      expect(form?.textContent).toContain("Unit number already exists in this tower");
    });
  });
});
