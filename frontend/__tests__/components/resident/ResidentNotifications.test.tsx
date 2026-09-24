import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OwnerTenantDashboardView } from "@/features/dashboards/owner-tenant/OwnerTenantDashboardView";
import { api, notificationsApi } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/owner-tenant/notifications",
  useSearchParams: () => new URLSearchParams(),
}));

let mockNotifications: any[] = [];
let mockVisitors: any[] = [];
let mockDeliveries: any[] = [];

// Mock API
vi.mock("@/lib/api", () => {
  return {
    api: {
      get: vi.fn((url: string) => {
        if (url.startsWith("/notifications")) {
          return Promise.resolve(mockNotifications);
        }
        if (url.startsWith("/visitors")) {
          return Promise.resolve(mockVisitors);
        }
        if (url.startsWith("/deliveries")) {
          return Promise.resolve(mockDeliveries);
        }
        if (url.startsWith("/dashboards/resident")) {
          return Promise.resolve({
            pending_dues_amount: 0,
            pending_visitor_count: 1,
            open_tickets_count: 0,
            staff_on_duty_count: 1,
            upcoming_amenity_bookings: 0,
            active_deliveries_count: 1,
          });
        }
        if (url.startsWith("/residents/me")) {
          return Promise.resolve({
            id: "res-user-01",
            full_name: "Rahul Sharma",
            email: "rahul@example.com",
            phone: "+91 9876543210",
            emergency_contact_name: "Anita Sharma",
            emergency_contact_phone: "+91 9876543211",
            occupancies: [
              {
                id: "occ-1",
                unit_id: "unit-101",
                community_id: "comm-1",
                unit_number: "101",
                tower_name: "Tower A",
              },
            ],
          });
        }
        return Promise.resolve([]);
      }),
      post: vi.fn((url: string) => {
        if (url.includes("/decide") || url.includes("/decision")) {
          return Promise.resolve({ success: true });
        }
        if (url.startsWith("/notifications") && url.includes("/read-all")) {
          mockNotifications = mockNotifications.map((n) => ({ ...n, is_read: true }));
          return Promise.resolve({ marked: 2 });
        }
        if (url.startsWith("/notifications") && url.includes("/read")) {
          const parts = url.split("/");
          const notifId = parts[2];
          mockNotifications = mockNotifications.map((n) =>
            n.id === notifId ? { ...n, is_read: true } : n,
          );
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true });
      }),
      put: vi.fn(() => Promise.resolve({ success: true })),
      patch: vi.fn(() => Promise.resolve({ success: true })),
      delete: vi.fn(() => Promise.resolve({ success: true })),
    },
    notificationsApi: {
      list: vi.fn(() => Promise.resolve(mockNotifications)),
      markRead: vi.fn((id: string) => {
        mockNotifications = mockNotifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n,
        );
        return Promise.resolve();
      }),
      markAllRead: vi.fn(() => {
        mockNotifications = mockNotifications.map((n) => ({ ...n, is_read: true }));
        return Promise.resolve();
      }),
      preferences: vi.fn(() => Promise.resolve([])),
      setPreference: vi.fn(() => Promise.resolve({})),
      dispatch: vi.fn(() => Promise.resolve({})),
    },
    // Signed-in resident: a session cookie is present, so useMe asks authApi.me.
    hasSessionCookie: vi.fn(() => true),
    authApi: {
      me: vi.fn(() =>
        Promise.resolve({
          id: "res-user-01",
          email: "rahul@example.com",
          full_name: "Rahul Sharma",
          active_role: "resident",
          community_ids: ["comm-1"],
        }),
      ),
    },
    gateApi: {
      alerts: vi.fn(() => Promise.resolve([])),
    },
  };
});

function renderDashboard(initialTab: any = "notifications") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OwnerTenantDashboardView initialTab={initialTab} />
    </QueryClientProvider>,
  );
}

describe("GS-033: Resident Notifications State & Action Updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockNotifications = [
      {
        id: "notif-cab-01",
        title: "Cab Uber KA01AB1234 Arrived at Gate 1",
        body: "Your cab driver Ramesh (KA01AB1234) is requesting gate entry.",
        notification_type: "cab_arrival",
        reference_type: "cab_request",
        reference_id: "cab-req-01",
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: "notif-del-02",
        title: "Amazon Courier at Gate 2",
        body: "Delivery agent Suresh has arrived with 1 parcel.",
        notification_type: "delivery",
        reference_type: "delivery",
        reference_id: "del-req-02",
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ];

    mockVisitors = [
      {
        id: "cab-req-01",
        visitor_name: "Ramesh (Uber)",
        phone: "+91 9988776655",
        purpose: "Cab / Taxi Entry",
        vehicle_number: "KA01AB1234",
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ];

    mockDeliveries = [
      {
        id: "del-req-02",
        courier_company: "Amazon",
        package_type: "Box",
        protocol: "require_approval",
        status: "at_gate",
        approval_status: "pending",
        created_at: new Date().toISOString(),
      },
    ];
  });

  it("renders the notifications tab with unread count and action buttons", async () => {
    renderDashboard("notifications");

    await waitFor(() => {
      expect(screen.getByText("Notifications & Gate Alerts")).toBeInTheDocument();
    });

    // Notifications load only after the session (/auth/me) resolves — wait for the data.
    expect(await screen.findByText("2 Unread")).toBeInTheDocument();
    expect(screen.getByText("Cab Uber KA01AB1234 Arrived at Gate 1")).toBeInTheDocument();
    expect(screen.getByText("Amazon Courier at Gate 2")).toBeInTheDocument();

    // Verify action buttons exist for pending actionable notifications
    expect(screen.getByRole("button", { name: /✓ Approve Cab/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /✕ Turn Away/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /✓ Approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /✕ Reject$/i })).toBeInTheDocument();
  });

  it("marks all notifications as read when clicking 'Mark All as Read'", async () => {
    renderDashboard("notifications");

    await waitFor(() => {
      expect(screen.getByText("Notifications & Gate Alerts")).toBeInTheDocument();
    });

    const markAllBtn = screen.getByRole("button", { name: /✓ Mark All as Read/i });
    // Enabled once the (auth-gated) notifications have loaded with unread items.
    await waitFor(() => expect(markAllBtn).not.toBeDisabled());

    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(notificationsApi.markAllRead).toHaveBeenCalled();
    });
  });

  it("approving cab notification marks notification as read and updates status to Approved", async () => {
    renderDashboard("notifications");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /✓ Approve Cab/i })).toBeInTheDocument();
    });

    const approveCabBtn = screen.getByRole("button", { name: /✓ Approve Cab/i });
    fireEvent.click(approveCabBtn);

    await waitFor(() => {
      expect(notificationsApi.markRead).toHaveBeenCalledWith("notif-cab-01");
      expect(screen.getByText("✓ Cab Approved")).toBeInTheDocument();
    });

    // Action buttons are replaced by the status badge
    expect(screen.queryByRole("button", { name: /✓ Approve Cab/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /✕ Turn Away/i })).not.toBeInTheDocument();
  });

  it("rejecting delivery notification marks notification as read and updates status to Rejected", async () => {
    renderDashboard("notifications");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /✕ Reject$/i })).toBeInTheDocument();
    });

    const rejectBtn = screen.getByRole("button", { name: /✕ Reject$/i });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(notificationsApi.markRead).toHaveBeenCalledWith("notif-del-02");
      expect(screen.getByText("✕ Rejected")).toBeInTheDocument();
    });

    // Action buttons are replaced by the status badge
    expect(screen.queryByRole("button", { name: /✓ Approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /✕ Reject$/i })).not.toBeInTheDocument();
  });

  it("supports filtering by Unread Only and All Notifications", async () => {
    mockNotifications[0].is_read = true; // 1 read, 1 unread

    renderDashboard("notifications");

    await waitFor(() => {
      expect(screen.getByText("All (2)")).toBeInTheDocument();
    });

    expect(screen.getByText("Unread (1)")).toBeInTheDocument();

    // Click Unread tab filter
    const unreadTab = screen.getByRole("button", { name: /Unread \(1\)/i });
    fireEvent.click(unreadTab);

    // Only unread notif should show
    expect(screen.queryByText("Cab Uber KA01AB1234 Arrived at Gate 1")).not.toBeInTheDocument();
    expect(screen.getByText("Amazon Courier at Gate 2")).toBeInTheDocument();
  });
});
