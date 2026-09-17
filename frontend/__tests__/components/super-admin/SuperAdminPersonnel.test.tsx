import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { CreateUserModal } from "@/components/super-admin/CreateUserModal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usersApi, communitiesApi } from "@/lib/api";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

function renderWithClient(ui: React.ReactElement) {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>
  );
}

// Mock APIs
vi.mock("@/lib/api", () => ({
  usersApi: {
    create: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  },
  communitiesApi: {
    list: vi.fn(),
  },
}));

vi.mock("@/store/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Super Admin Personnel Management: CreateUserModal", () => {
  const mockCommunities = [
    { id: "comm-1", name: "Palm Meadows Heights", code: "PMH-01" },
    { id: "comm-2", name: "Green Valley Enclave", code: "GVE-02" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(communitiesApi.list).mockResolvedValue(mockCommunities as any);
    vi.mocked(usersApi.create).mockResolvedValue({ id: "user-new-1" } as any);
  });

  it("renders all key community personnel roles in dropdown", async () => {
    renderWithClient(
      <CreateUserModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const roleSelect = screen.getByLabelText(/Assign Role/i) as HTMLSelectElement;
    expect(roleSelect).toBeInTheDocument();

    const options = Array.from(roleSelect.options).map((opt) => opt.value);
    expect(options).toContain("community_admin");
    expect(options).toContain("association_committee");
    expect(options).toContain("facility_manager");
    expect(options).toContain("vendor_technician");
    expect(options).toContain("auditor");
    expect(options).toContain("domestic_staff");
    expect(options).toContain("security_supervisor");
    expect(options).toContain("security_guard");
    expect(options).toContain("super_admin");
  });

  it("enforces community selection for community-assigned roles", async () => {
    renderWithClient(
      <CreateUserModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        defaultRoleSlug="auditor"
      />
    );

    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Anita Sharma" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "anita.auditor@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: "GateSphere2026!" },
    });

    const submitBtn = screen.getByRole("button", { name: /Create & Assign/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/A community must be selected for community-assigned roles/i)).toBeInTheDocument();
    });
    expect(usersApi.create).not.toHaveBeenCalled();
  });

  it("successfully creates a community personnel user when form is valid", async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    renderWithClient(
      <CreateUserModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
        preselectedCommunityId="comm-1"
        lockCommunity={true}
        defaultRoleSlug="association_committee"
      />
    );

    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Ramesh Verma" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "ramesh.committee@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Phone Number/i), {
      target: { value: "+91 9876543210" },
    });
    fireEvent.change(screen.getByLabelText(/Initial Password/i), {
      target: { value: "GateSphere2026!" },
    });

    const submitBtn = screen.getByRole("button", { name: /Create & Assign/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(usersApi.create).toHaveBeenCalledWith({
        full_name: "Ramesh Verma",
        email: "ramesh.committee@example.com",
        password: "GateSphere2026!",
        phone: "+91 9876543210",
        role_slug: "association_committee",
        community_id: "comm-1",
      });
    });

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("locks community selection when lockCommunity prop is true", async () => {
    renderWithClient(
      <CreateUserModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        preselectedCommunityId="comm-2"
        lockCommunity={true}
        defaultRoleSlug="vendor_technician"
      />
    );

    const communitySelect = screen.getByLabelText(/Assigned Community/i) as HTMLSelectElement;
    expect(communitySelect).toBeDisabled();
    expect(screen.getByText(/Locked to active community/i)).toBeInTheDocument();
  });
});

describe("Super Admin Users Page: Sorting & Search", () => {
  const mockCommunities = [
    { id: "comm-1", name: "Palm Meadows Heights", code: "PMH-01" },
  ];

  const mockUsers = [
    {
      id: "u-old",
      full_name: "Aaron Oldman",
      email: "aaron.oldman@example.com",
      created_at: "2026-01-01T10:00:00Z",
      roles: [{ id: "r-1", role_slug: "community_admin", community_id: "comm-1" }],
      is_active: true,
    },
    {
      id: "u-new",
      full_name: "Zoe Newbie",
      email: "zoe.newbie@example.com",
      created_at: "2026-09-17T11:00:00Z",
      roles: [{ id: "r-2", role_slug: "facility_manager", community_id: "comm-1" }],
      is_active: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(communitiesApi.list).mockResolvedValue(mockCommunities as any);
    vi.mocked(usersApi.list).mockResolvedValue(mockUsers as any);
  });

  it("shows newly added user at top by default and displays sort button and styled search input", async () => {
    const { default: SuperAdminUsersPage } = await import("@/app/super-admin/users/page");

    renderWithClient(<SuperAdminUsersPage />);

    // Check search input exists with styled placeholder
    const searchInput = screen.getByPlaceholderText(/Search name, email, phone…/i);
    expect(searchInput).toBeInTheDocument();

    // Check sort button exists with default Newest First
    const sortBtn = screen.getByRole("button", { name: /Newest First/i });
    expect(sortBtn).toBeInTheDocument();

    // Zoe Newbie was created more recently (Sep 2026) than Aaron Oldman (Jan 2026),
    // so Zoe Newbie must be rendered first in table
    await waitFor(() => {
      const userCells = screen.getAllByText(/Zoe Newbie|Aaron Oldman/i);
      expect(userCells[0]).toHaveTextContent("Zoe Newbie");
      expect(userCells[1]).toHaveTextContent("Aaron Oldman");
    });

    // Clicking sort button toggles to Oldest First
    fireEvent.click(sortBtn);
    expect(screen.getByRole("button", { name: /Oldest First/i })).toBeInTheDocument();

    await waitFor(() => {
      const reorderedCells = screen.getAllByText(/Zoe Newbie|Aaron Oldman/i);
      expect(reorderedCells[0]).toHaveTextContent("Aaron Oldman");
      expect(reorderedCells[1]).toHaveTextContent("Zoe Newbie");
    });
  });

  it("filters personnel when typing in the search input and clears via clear button", async () => {
    const { default: SuperAdminUsersPage } = await import("@/app/super-admin/users/page");

    renderWithClient(<SuperAdminUsersPage />);

    const searchInput = screen.getByPlaceholderText(/Search name, email, phone…/i);

    // Search for Zoe
    fireEvent.change(searchInput, { target: { value: "zoe" } });

    await waitFor(() => {
      expect(screen.getByText("Zoe Newbie")).toBeInTheDocument();
      expect(screen.queryByText("Aaron Oldman")).not.toBeInTheDocument();
    });

    // Clear search using the clear button
    const clearBtn = screen.getByRole("button", { name: /Clear search/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText("Zoe Newbie")).toBeInTheDocument();
      expect(screen.getByText("Aaron Oldman")).toBeInTheDocument();
    });
  });
});
