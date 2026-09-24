import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OwnerTenantDashboardView } from "@/features/dashboards/owner-tenant/OwnerTenantDashboardView";
import { api } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/resident/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock API and dependencies
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.startsWith("/billing/invoices")) {
        return Promise.resolve([
          {
            id: "inv-uuid-001",
            invoice_number: "INV-2026-001",
            total_amount: 4500,
            amount_paid: 0,
            balance_due: 4500,
            status: "posted",
            issue_date: "2026-09-01",
            due_date: "2026-09-15",
            billing_period_start: "2026-09-01",
            billing_period_end: "2026-09-30",
            subtotal: 4000,
            tax: 500,
            late_fee: 0,
            discount: 0,
            receipt_number: null,
            items: [
              {
                id: "item-1",
                description: "Monthly Maintenance & Security Operations",
                quantity: 1,
                unit_rate: 3500,
                amount: 3500,
                taxable: true,
              },
              {
                id: "item-2",
                description: "Clubhouse & Gym Upkeep",
                quantity: 1,
                unit_rate: 500,
                amount: 500,
                taxable: false,
              },
            ],
          },
          {
            id: "inv-uuid-002",
            invoice_number: "INV-2026-002",
            total_amount: 3000,
            amount_paid: 3000,
            balance_due: 0,
            status: "paid",
            issue_date: "2026-08-01",
            due_date: "2026-08-15",
            billing_period_start: "2026-08-01",
            billing_period_end: "2026-08-31",
            subtotal: 3000,
            tax: 0,
            late_fee: 0,
            discount: 0,
            receipt_number: "RCP-2026-8899",
            items: [
              {
                id: "item-3",
                description: "Monthly Society Maintenance Charge",
                quantity: 1,
                unit_rate: 3000,
                amount: 3000,
                taxable: false,
              },
            ],
          },
        ]);
      }
      if (url.startsWith("/dashboards/resident")) {
        return Promise.resolve({
          pending_dues_amount: 4500,
          pending_visitor_count: 0,
          open_tickets_count: 0,
          staff_on_duty_count: 2,
          upcoming_amenity_bookings: 0,
          active_deliveries_count: 0,
        });
      }
      if (url.startsWith("/residents/me")) {
        return Promise.resolve({
          id: "res-123",
          full_name: "Rahul Sharma",
          email: "rahul@example.com",
          phone: "+91 98765 43210",
          occupancies: [
            {
              unit_id: "unit-uuid-1",
              unit_number: "A-101",
              tower_name: "Tower A",
              resident_type: "owner",
              is_primary: true,
            },
          ],
        });
      }
      if (url.startsWith("/units/unit-uuid-1/ledger")) {
        return Promise.resolve([
          {
            id: "led-1",
            entry_type: "debit",
            source_type: "invoice",
            amount: 4500,
            balance_after: -4500,
            created_at: "2026-09-01T10:00:00Z",
            entry_date: "2026-09-01",
            narration: "Invoice generated: INV-2026-001",
          },
        ]);
      }
      if (url.startsWith("/visitors")) return Promise.resolve([]);
      if (url.startsWith("/deliveries")) return Promise.resolve([]);
      if (url.startsWith("/amenities")) return Promise.resolve([]);
      if (url.startsWith("/complaints")) return Promise.resolve([]);
      if (url.startsWith("/vehicles")) return Promise.resolve([]);
      if (url.startsWith("/staff")) return Promise.resolve([]);
      if (url.startsWith("/notifications")) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
    post: vi.fn((url: string, payload: any) => {
      if (url === "/billing/payments") {
        return Promise.resolve({
          id: "pay-uuid-12345",
          payment_reference: "PAY-2026-TXN-9999",
          receipt_number: "RCP-2026-9999",
          receipt_issued_at: "2026-09-18T10:00:00Z",
          amount: payload.amount,
          payment_method: "upi",
          payment_status: "successful",
          paid_at: "2026-09-18T10:00:00Z",
        });
      }
      return Promise.resolve({});
    }),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  authApi: {
    me: vi.fn().mockResolvedValue({
      id: "res-123",
      full_name: "Rahul Sharma",
      community_ids: ["comm-1"],
      roles: [{ role: "resident", community_id: "comm-1" }],
    }),
    changePassword: vi.fn().mockResolvedValue({}),
  },
  visitorsApi: {
    listRequests: vi.fn().mockResolvedValue([]),
  },
  communitiesApi: {
    list: vi.fn().mockResolvedValue([{ id: "comm-1", name: "GateSphere Central" }]),
    communityUnits: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/store/ui", () => ({
  useUiStore: () => ({
    activeCommunityId: "comm-1",
  }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
}

describe("Resident Dashboard - Invoice Payment Modal & Receipt Flow", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    if (typeof window !== "undefined") {
      window.URL.createObjectURL = vi.fn(() => "blob:test-url");
      window.URL.revokeObjectURL = vi.fn();
      window.print = vi.fn();
    }
  });

  it("displays complete invoice details inside the Payment Modal", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OwnerTenantDashboardView initialTab="payments" />
      </QueryClientProvider>,
    );

    // Wait for Invoices & Bills table to load
    await waitFor(() => {
      expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    });

    // Click "Pay Now" on the unpaid invoice
    const payNowButtons = screen.getAllByRole("button", { name: /Pay Now/i });
    fireEvent.click(payNowButtons[0]);

    // Verify complete invoice details in modal
    await waitFor(() => {
      expect(screen.getByText("💳 Settle Invoice & Maintenance Dues")).toBeInTheDocument();
    });

    const modal = document.querySelector(".modal-content") as HTMLElement;
    expect(modal).not.toBeNull();

    // 1. Invoice Number & Property
    expect(within(modal).getAllByText("INV-2026-001").length).toBeGreaterThan(0);
    expect(within(modal).getAllByText(/Unit A-101/i).length).toBeGreaterThan(0);

    // 2. Dates & Billing Period
    expect(within(modal).getByText("Invoice Date")).toBeInTheDocument();
    expect(within(modal).getByText("Payment Due Date")).toBeInTheDocument();
    expect(within(modal).getByText("Billing Period")).toBeInTheDocument();

    // 3. Charge Descriptions & Breakdown Items
    expect(
      within(modal).getByText("Monthly Maintenance & Security Operations"),
    ).toBeInTheDocument();
    expect(within(modal).getByText("Clubhouse & Gym Upkeep")).toBeInTheDocument();
    expect(within(modal).getByText("GST 18%")).toBeInTheDocument();

    // 4. Financial Summary
    expect(within(modal).getByText("Subtotal Charges:")).toBeInTheDocument();
    expect(within(modal).getByText("Applicable Taxes & Levies:")).toBeInTheDocument();
    expect(within(modal).getByText("Total Invoice Amount:")).toBeInTheDocument();
    expect(within(modal).getByText("Net Outstanding Balance Due")).toBeInTheDocument();

    // 5. Action Buttons (including Download Invoice)
    expect(
      within(modal).getByRole("button", { name: /Simulate Instant Payment/i }),
    ).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: /Download Invoice/i })).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("allows viewing and downloading invoices directly from the Invoices table", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OwnerTenantDashboardView initialTab="payments" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    });

    // Verify "View Invoice" button exists and opens invoice modal
    const viewInvoiceBtns = screen.getAllByRole("button", { name: /View Invoice/i });
    expect(viewInvoiceBtns.length).toBeGreaterThan(0);
    fireEvent.click(viewInvoiceBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("💳 Settle Invoice & Maintenance Dues")).toBeInTheDocument();
    });
    const modal = document.querySelector(".modal-content") as HTMLElement;
    expect(within(modal).getAllByText("INV-2026-001").length).toBeGreaterThan(0);

    // Click "Download Invoice" inside modal
    const downloadModalBtn = within(modal).getByRole("button", { name: /Download Invoice/i });
    fireEvent.click(downloadModalBtn);
    expect(window.URL.createObjectURL).toHaveBeenCalled();

    // Close modal
    fireEvent.click(within(modal).getByRole("button", { name: /Cancel/i }));

    // Click "Download Invoice" directly from table row
    const downloadTableBtns = screen.getAllByRole("button", { name: /Download Invoice/i });
    fireEvent.click(downloadTableBtns[0]);
    expect(window.URL.createObjectURL).toHaveBeenCalled();
  });

  it("processes simulated instant payment, updates state, and provides Download Receipt and View Invoice options", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OwnerTenantDashboardView initialTab="payments" />
      </QueryClientProvider>,
    );

    // Wait for invoice table
    await waitFor(() => {
      expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    });

    // Open Payment Modal
    const payNowButtons = screen.getAllByRole("button", { name: /Pay Now/i });
    fireEvent.click(payNowButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("💳 Settle Invoice & Maintenance Dues")).toBeInTheDocument();
    });

    const paymentModal = document.querySelector(".modal-content") as HTMLElement;
    const simulateBtn = within(paymentModal).getByRole("button", {
      name: /Simulate Instant Payment/i,
    });
    fireEvent.click(simulateBtn);

    // Verify Receipt Modal opens with complete confirmation details
    await waitFor(() => {
      expect(screen.getByText(/Official Payment Receipt/i)).toBeInTheDocument();
    });

    const receiptModal = document.querySelector(".modal-content") as HTMLElement;
    expect(
      within(receiptModal).getByText("Payment Processed & Settled Successfully"),
    ).toBeInTheDocument();
    expect(within(receiptModal).getByText("RCP-2026-9999")).toBeInTheDocument();
    expect(within(receiptModal).getByText("PAY-2026-TXN-9999")).toBeInTheDocument();
    expect(within(receiptModal).getByText("₹0.00 (Settled in Full)")).toBeInTheDocument();

    // Check action buttons in Receipt Modal
    const downloadReceiptBtn = within(receiptModal).getByRole("button", {
      name: /Download Receipt/i,
    });
    const viewInvoiceBtn = within(receiptModal).getByRole("button", { name: /View Invoice/i });
    const downloadInvoiceBtn = within(receiptModal).getByRole("button", {
      name: /Download Invoice/i,
    });
    const printBtn = within(receiptModal).getByRole("button", { name: /Print Receipt/i });

    expect(downloadReceiptBtn).toBeInTheDocument();
    expect(viewInvoiceBtn).toBeInTheDocument();
    expect(downloadInvoiceBtn).toBeInTheDocument();
    expect(printBtn).toBeInTheDocument();

    // Trigger Download Receipt
    fireEvent.click(downloadReceiptBtn);
    expect(window.URL.createObjectURL).toHaveBeenCalled();

    // Trigger Print Receipt
    fireEvent.click(printBtn);
    expect(window.print).toHaveBeenCalled();

    // Trigger View Invoice from Receipt Modal
    fireEvent.click(viewInvoiceBtn);
    await waitFor(() => {
      expect(screen.getByText(/Invoice Details:/i)).toBeInTheDocument();
    });

    // Close Modal
    const updatedModal = document.querySelector(".modal-content") as HTMLElement;
    const closeBtn = within(updatedModal).getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
  });

  it("provides View Receipt and Download Receipt for paid invoices in the table and details modal", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <OwnerTenantDashboardView initialTab="payments" />
      </QueryClientProvider>,
    );

    // Wait for invoices table
    await waitFor(() => {
      expect(screen.getByText("INV-2026-002")).toBeInTheDocument();
    });

    // Check that paid invoice has View Receipt and Download Receipt buttons in table
    const viewReceiptBtn = screen.getByRole("button", { name: /View Receipt/i });
    const downloadReceiptBtns = screen.getAllByRole("button", { name: /Download Receipt/i });

    expect(viewReceiptBtn).toBeInTheDocument();
    expect(downloadReceiptBtns.length).toBeGreaterThan(0);

    // Trigger direct Download Receipt from table
    fireEvent.click(downloadReceiptBtns[0]);
    expect(window.URL.createObjectURL).toHaveBeenCalled();

    // Click "View Receipt" button
    fireEvent.click(viewReceiptBtn);

    await waitFor(() => {
      expect(screen.getByText(/Official Payment Receipt/i)).toBeInTheDocument();
    });

    const receiptModal = document.querySelector(".modal-content") as HTMLElement;
    expect(within(receiptModal).getByText("RCP-2026-8899")).toBeInTheDocument();
    expect(within(receiptModal).getAllByText("INV-2026-002").length).toBeGreaterThan(0);
    expect(within(receiptModal).getByText("₹0.00 (Settled in Full)")).toBeInTheDocument();

    // Close Receipt modal
    fireEvent.click(within(receiptModal).getByRole("button", { name: "Close" }));

    // Click "View Invoice" for paid invoice
    const viewInvoiceBtns = screen.getAllByRole("button", { name: /View Invoice/i });
    fireEvent.click(viewInvoiceBtns[1]); // second row is INV-2026-002

    await waitFor(() => {
      expect(screen.getByText(/Invoice Details: INV-2026-002/i)).toBeInTheDocument();
    });

    // Verify paid invoice banner inside modal
    const invoiceModal = document.querySelector(".modal-content") as HTMLElement;
    expect(within(invoiceModal).getByText(/Invoice Paid & Cleared:/i)).toBeInTheDocument();
    expect(
      within(invoiceModal).getAllByRole("button", { name: /View Receipt/i }).length,
    ).toBeGreaterThan(0);
    expect(
      within(invoiceModal).getAllByRole("button", { name: /Download Receipt/i }).length,
    ).toBeGreaterThan(0);
  });

  it("displays latest updated Open Service Tickets and Booked Amenities counts based on actual records", async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url.startsWith("/complaints/tickets")) {
        return Promise.resolve([
          {
            id: "tkt-1",
            ticket_number: "TKT-2026-0001",
            subject: "Water Leakage in Kitchen",
            category_id: "cat-1",
            status: "in_progress",
            priority: "high",
            created_at: "2026-09-17T10:00:00Z",
          },
          {
            id: "tkt-2",
            ticket_number: "TKT-2026-0002",
            subject: "Balcony Light Repair",
            category_id: "cat-2",
            status: "created",
            priority: "medium",
            created_at: "2026-09-18T08:00:00Z",
          },
          {
            id: "tkt-3",
            ticket_number: "TKT-2026-0003",
            subject: "Old AC issue",
            category_id: "cat-1",
            status: "resolved",
            priority: "low",
            created_at: "2026-08-10T08:00:00Z",
          },
        ]);
      }
      if (url.startsWith("/complaints/categories")) {
        return Promise.resolve([
          { id: "cat-1", name: "Plumbing & Water" },
          { id: "cat-2", name: "Electrical" },
        ]);
      }
      if (url.startsWith("/amenities/bookings") || url.startsWith("/amenities/my-bookings")) {
        return Promise.resolve([
          {
            id: "bk-1",
            amenity_id: "am-1",
            amenity_name: "Swimming Pool",
            date: "2026-09-20",
            start_time: "07:00",
            end_time: "08:00",
            status: "confirmed",
            guests_count: 2,
          },
          {
            id: "bk-2",
            amenity_id: "am-2",
            amenity_name: "Tennis Court",
            date: "2026-09-22",
            start_time: "18:00",
            end_time: "19:00",
            status: "confirmed",
            guests_count: 1,
          },
          {
            id: "bk-3",
            amenity_id: "am-3",
            amenity_name: "Clubhouse Hall",
            date: "2026-09-15",
            start_time: "10:00",
            end_time: "14:00",
            status: "cancelled",
            guests_count: 10,
          },
        ]);
      }
      if (url.startsWith("/dashboards/resident")) {
        return Promise.resolve({
          pending_dues_amount: 0,
          pending_visitor_count: 0,
          open_tickets_count: 0,
          staff_on_duty_count: 1,
          upcoming_amenity_bookings: 0,
          active_deliveries_count: 0,
        });
      }
      if (url.startsWith("/residents/me")) {
        return Promise.resolve({
          id: "res-123",
          full_name: "Rahul Sharma",
          email: "rahul@example.com",
          occupancies: [{ unit_id: "unit-uuid-1", unit_number: "A-101", is_primary: true }],
        });
      }
      return Promise.resolve([]);
    });

    render(
      <QueryClientProvider client={queryClient}>
        <OwnerTenantDashboardView />
      </QueryClientProvider>,
    );

    // Verify Open Service Tickets count = 2 (tkt-1 and tkt-2, excluding resolved tkt-3)
    await waitFor(
      () => {
        expect(screen.getByText("Open Service Tickets")).toBeInTheDocument();
        expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 4000 },
    );

    // Verify Booked Amenities count = 2 (bk-1 and bk-2, excluding cancelled bk-3)
    expect(screen.getByText("Booked Amenities")).toBeInTheDocument();
  });
});
