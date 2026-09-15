import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { FinancialHealthCard } from "@/components/dashboard/FinancialHealthCard";
import { AttendanceWidget } from "@/components/dashboard/AttendanceWidget";
import { IncidentListWidget } from "@/components/dashboard/IncidentListWidget";
import { DataTable } from "@/components/tables/DataTable";
import type { StaffAttendance } from "@/types/staff";
import type { Incident } from "@/types/incidents";
import type { FinancialStats } from "@/types/dashboards";

describe("Community Admin Dashboard Components", () => {
  describe("FinancialHealthCard", () => {
    it("renders skeleton placeholders when isLoading is true", () => {
      const { container } = render(
        <FinancialHealthCard
          data={null}
          isLoading={true}
        />
      );
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders formatted currency metrics and calculated collection rate", () => {
      const mockFinancialData: FinancialStats = {
        total_billed: 500000,
        total_collected: 450000,
        outstanding_balance: 50000,
        invoices_by_status: {
          paid: 45,
          issued: 5,
          partially_paid: 2,
          overdue: 1,
        },
      };

      render(
        <FinancialHealthCard
          data={mockFinancialData}
          isLoading={false}
        />
      );
      expect(screen.getByText("💳 Financial Health & Billing")).toBeInTheDocument();
      expect(screen.getByText("Total Billed")).toBeInTheDocument();
      expect(screen.getByText("Collected")).toBeInTheDocument();
      expect(screen.getByText("Outstanding")).toBeInTheDocument();
      expect(screen.getByText("90%")).toBeInTheDocument();
      expect(screen.getByText("paid:")).toBeInTheDocument();
      expect(screen.getByText("overdue:")).toBeInTheDocument();
    });
  });

  describe("AttendanceWidget", () => {
    it("renders skeleton placeholders when isLoading is true", () => {
      const { container } = render(<AttendanceWidget attendance={[]} isLoading={true} />);
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders empty state when no staff are on duty", () => {
      render(<AttendanceWidget attendance={[]} isLoading={false} />);
      expect(screen.getByText("No staff currently checked in.")).toBeInTheDocument();
    });

    it("renders active on-duty staff members with roles and check-in times", () => {
      const mockAttendance: StaffAttendance[] = [
        {
          id: "att-1",
          staff_id: "s-1",
          staff_name: "Ramesh Security",
          staff_type: "security",
          phone: "9876543210",
          check_in_at: "2026-09-12T08:00:00Z",
          check_out_at: null,
          gate_name: "Gate 1 North",
          created_at: "2026-09-12T08:00:00Z",
        },
        {
          id: "att-2",
          staff_id: "s-2",
          staff_name: "Suresh Maintenance",
          staff_type: "technician",
          phone: "9876543211",
          check_in_at: "2026-09-12T09:30:00Z",
          check_out_at: null,
          gate_name: "Gate 2 South",
          created_at: "2026-09-12T09:30:00Z",
        },
      ];

      render(<AttendanceWidget attendance={mockAttendance} totalStaff={4} isLoading={false} />);
      expect(screen.getByText("🛠️ Staff Presence & Attendance")).toBeInTheDocument();
      expect(screen.getByText("Ramesh Security")).toBeInTheDocument();
      expect(screen.getByText("Suresh Maintenance")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });
  });

  describe("IncidentListWidget", () => {
    it("renders skeleton placeholders when isLoading is true", () => {
      const { container } = render(<IncidentListWidget incidents={[]} isLoading={true} />);
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders empty state when no open incidents exist", () => {
      render(<IncidentListWidget incidents={[]} isLoading={false} />);
      expect(screen.getByText("No open incidents or security alerts.")).toBeInTheDocument();
    });

    it("renders incident list with category, priority, and location", () => {
      const mockIncidents: Incident[] = [
        {
          id: "inc-1",
          community_id: "comm-1",
          incident_type: "security",
          severity: "high",
          status: "open",
          description: "Vehicle entered without QR scan",
          reported_at: "2026-09-12T10:00:00Z",
          created_at: "2026-09-12T10:00:00Z",
          location_text: "Gate 2 Visitor Lane",
        },
      ];

      render(<IncidentListWidget incidents={mockIncidents} isLoading={false} />);
      expect(screen.getByText("🚨 Recent Incidents & Alerts")).toBeInTheDocument();
      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.getByText("security Incident")).toBeInTheDocument();
      expect(screen.getByText(/Gate 2 Visitor Lane/)).toBeInTheDocument();
    });
  });

  describe("DataTable Pagination in Community Admin Context", () => {
    interface DummyItem {
      id: string;
      name: string;
      unit: string;
    }

    const dummyData: DummyItem[] = Array.from({ length: 25 }, (_, i) => ({
      id: `item-${i + 1}`,
      name: `Resident ${i + 1}`,
      unit: `Tower A - ${100 + i}`,
    }));

    const columns = [
      { key: "name", header: "Name" },
      { key: "unit", header: "Unit" },
    ];

    it("paginates client data and allows changing pages", () => {
      render(
        <DataTable
          columns={columns}
          data={dummyData as (DummyItem & Record<string, unknown>)[]}
          enableClientPagination={true}
          pageSize={10}
        />
      );

      // Page 1 should display Resident 1 to Resident 10
      expect(screen.getByText("Resident 1")).toBeInTheDocument();
      expect(screen.getByText("Resident 10")).toBeInTheDocument();
      expect(screen.queryByText("Resident 11")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();

      // Click Next
      const nextBtn = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextBtn);

      // Page 2 should display Resident 11 to Resident 20
      expect(screen.getByText("Resident 11")).toBeInTheDocument();
      expect(screen.getByText("Resident 20")).toBeInTheDocument();
      expect(screen.queryByText("Resident 1")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    });
  });
});
