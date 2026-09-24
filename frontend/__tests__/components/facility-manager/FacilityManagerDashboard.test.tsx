import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/common/LoadingSkeleton";

interface MockTicket {
  id: string;
  ticket_number: string;
  subject: string;
  category_name: string;
  priority: string;
  status: string;
  escalation_state: string;
  created_at: string;
}

const mockTickets: MockTicket[] = Array.from({ length: 15 }, (_, i) => ({
  id: `t-${i + 1}`,
  ticket_number: `TICK-2026-${String(i + 1).padStart(3, "0")}`,
  subject: `Water Leakage in Block ${i + 1}`,
  category_name: "Plumbing & Water",
  priority: i % 3 === 0 ? "high" : "medium",
  status: "assigned",
  escalation_state: i === 0 ? "breached" : i === 1 ? "at_risk" : "on_track",
  created_at: "2026-09-12T10:00:00Z",
}));

const ticketColumns: Column<MockTicket>[] = [
  { key: "ticket_number", header: "Ticket #" },
  { key: "subject", header: "Subject" },
  { key: "category_name", header: "Category" },
  { key: "priority", header: "Priority" },
  { key: "status", header: "Status" },
];

describe("Facility Manager Dashboard Components", () => {
  describe("KPI Cards & Skeleton Loading", () => {
    it("renders KpiCardSkeleton when isLoading is true", () => {
      const { container } = render(
        <KpiCard title="Total Facilities" value="12" icon="🏢" isLoading={true} />,
      );
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders metric value and title when loaded", () => {
      render(
        <KpiCard
          title="Total Facilities"
          value="12"
          subtext="Managed amenities & common areas"
          icon="🏢"
          accent="primary"
          isLoading={false}
        />,
      );
      expect(screen.getByText("Total Facilities")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
      expect(screen.getByText("Managed amenities & common areas")).toBeInTheDocument();
    });
  });

  describe("Open Service Tickets DataTable Pagination", () => {
    it("paginates tickets table to 5 items per page", () => {
      render(
        <DataTable
          columns={ticketColumns}
          data={mockTickets as (MockTicket & Record<string, unknown>)[]}
          isLoading={false}
          enableClientPagination={true}
          pageSize={5}
        />,
      );

      // Page 1 should display first 5 tickets
      expect(screen.getByText("TICK-2026-001")).toBeInTheDocument();
      expect(screen.getByText("TICK-2026-005")).toBeInTheDocument();
      expect(screen.queryByText("TICK-2026-006")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();

      // Click Next
      const nextBtn = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextBtn);

      // Page 2 should display TICK-2026-006 to TICK-2026-010
      expect(screen.getByText("TICK-2026-006")).toBeInTheDocument();
      expect(screen.getByText("TICK-2026-010")).toBeInTheDocument();
      expect(screen.queryByText("TICK-2026-001")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    });

    it("renders resident identification details (name, unit number, contact phone) in table", () => {
      const ticketsWithResident: MockTicket[] = [
        {
          id: "tkt-res-01",
          ticket_number: "TKT-2026-00101",
          subject: "AC Not Cooling in Master Bedroom",
          category_name: "HVAC",
          priority: "high",
          status: "created",
          escalation_state: "on_track",
          created_at: "2026-09-24T10:00:00Z",
          raised_by_name: "Aarav Patel",
          unit_number: "101",
          raised_by_phone: "+91 9876543210",
          raised_by_email: "aarav@example.com",
        },
      ];

      const columnsWithResident: Column<MockTicket>[] = [
        { key: "ticket_number", header: "Ticket #" },
        { key: "subject", header: "Subject" },
        {
          key: "raised_by_name",
          header: "Resident / Unit",
          render: (t) => (
            <div>
              <span>👤 {t.raised_by_name || "Resident"}</span>
              <span>🏢 Unit {t.unit_number}</span>
            </div>
          ),
        },
        {
          key: "raised_by_phone",
          header: "Contact Info",
          render: (t) => (
            <div>
              <a href={`tel:${t.raised_by_phone}`}>📞 {t.raised_by_phone}</a>
              <a href={`mailto:${t.raised_by_email}`}>✉️ {t.raised_by_email}</a>
            </div>
          ),
        },
        { key: "priority", header: "Priority" },
      ];

      render(
        <DataTable
          columns={columnsWithResident}
          data={ticketsWithResident as (MockTicket & Record<string, unknown>)[]}
          isLoading={false}
        />,
      );

      expect(screen.getByText("TKT-2026-00101")).toBeInTheDocument();
      expect(screen.getByText("AC Not Cooling in Master Bedroom")).toBeInTheDocument();
      expect(screen.getByText(/Aarav Patel/)).toBeInTheDocument();
      expect(screen.getByText(/Unit 101/)).toBeInTheDocument();
      expect(screen.getByText(/\+91 9876543210/)).toBeInTheDocument();
      expect(screen.getByText(/aarav@example\.com/)).toBeInTheDocument();
    });

    it("renders EmptyState when there are no tickets", () => {
      render(
        <EmptyState
          icon="🛡️"
          title="No open service tickets"
          description="All service and maintenance requests have been resolved."
        />,
      );
      expect(screen.getByText("No open service tickets")).toBeInTheDocument();
      expect(
        screen.getByText("All service and maintenance requests have been resolved."),
      ).toBeInTheDocument();
    });
  });
});
