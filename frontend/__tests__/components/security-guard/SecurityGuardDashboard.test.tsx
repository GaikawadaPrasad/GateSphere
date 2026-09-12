import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";

interface MockVisitorRequest {
  id: string;
  visitor_name: string;
  purpose: string;
  status: string;
}

const mockVisitors: MockVisitorRequest[] = Array.from({ length: 12 }, (_, i) => ({
  id: `vis-${i + 1}`,
  visitor_name: `Visitor Guest ${i + 1}`,
  purpose: i % 2 === 0 ? "Family Visit" : "Delivery",
  status: "pending",
}));

const visitorColumns: Column<MockVisitorRequest>[] = [
  {
    key: "visitor_name",
    header: "Visitor",
    sortable: true,
    render: (v) => <span>{v.visitor_name}</span>,
  },
  {
    key: "purpose",
    header: "Purpose",
    sortable: true,
    render: (v) => <span>{v.purpose}</span>,
  },
  {
    key: "status",
    header: "Status",
    sortable: true,
    render: (v) => <StatusBadge status={v.status} />,
  },
];

interface MockDelivery {
  id: string;
  provider_name: string;
  tracking_reference: string;
  status: string;
}

const mockDeliveries: MockDelivery[] = Array.from({ length: 15 }, (_, i) => ({
  id: `del-${i + 1}`,
  provider_name: `Courier Carrier ${i + 1}`,
  tracking_reference: `TRK-${1000 + i}`,
  status: i % 2 === 0 ? "expected" : "at_gate",
}));

const deliveryColumns: Column<MockDelivery>[] = [
  { key: "provider_name", header: "Provider", sortable: true },
  { key: "tracking_reference", header: "Tracking Ref", sortable: true },
  { key: "status", header: "Status", sortable: true, render: (d) => <StatusBadge status={d.status} /> },
];

describe("Security Guard Dashboard Components", () => {
  describe("KPI Cards & Skeleton Loading", () => {
    it("renders KpiCardSkeleton when isLoading is true", () => {
      const { container } = render(
        <KpiCard
          title="Active Visitors Inside"
          value="15"
          icon="👥"
          isLoading={true}
        />
      );
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders metric value, title, and subtext when loaded", () => {
      render(
        <KpiCard
          title="Active Visitors Inside"
          value="15"
          subtext="24 Expected Today"
          icon="👥"
          isLoading={false}
        />
      );
      expect(screen.getByText("Active Visitors Inside")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("24 Expected Today")).toBeInTheDocument();
    });

    it("renders emergency status card in alert state", () => {
      render(
        <KpiCard
          title="Emergency Status"
          value="ACTIVE SOS"
          subtext="Medical Reported"
          icon="🛡️"
          trend="danger"
          trendValue="ALERT"
          isLoading={false}
        />
      );
      expect(screen.getByText("Emergency Status")).toBeInTheDocument();
      expect(screen.getByText("ACTIVE SOS")).toBeInTheDocument();
      expect(screen.getByText("Medical Reported")).toBeInTheDocument();
    });
  });

  describe("Pending Gate Verification Queue DataTable Pagination", () => {
    it("paginates pending visitors queue to 5 items per page", () => {
      render(
        <DataTable
          columns={visitorColumns}
          data={mockVisitors as (MockVisitorRequest & Record<string, unknown>)[]}
          isLoading={false}
          enableClientPagination={true}
          pageSize={5}
        />
      );

      // Page 1: Check first 5 items
      expect(screen.getByText("Visitor Guest 1")).toBeInTheDocument();
      expect(screen.getByText("Visitor Guest 5")).toBeInTheDocument();
      expect(screen.queryByText("Visitor Guest 6")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();

      // Navigate to Page 2
      const nextBtn = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextBtn);

      expect(screen.getByText("Visitor Guest 6")).toBeInTheDocument();
      expect(screen.getByText("Visitor Guest 10")).toBeInTheDocument();
      expect(screen.queryByText("Visitor Guest 1")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    });

    it("renders EmptyState when pending verification queue is empty", () => {
      render(
        <DataTable
          columns={visitorColumns}
          data={[]}
          isLoading={false}
          emptyTitle="No Pending Approvals"
          emptyDescription="All visitors have been cleared or there are no pending gate entry requests."
          emptyIcon="🚪"
        />
      );

      expect(screen.getByText("No Pending Approvals")).toBeInTheDocument();
      expect(
        screen.getByText("All visitors have been cleared or there are no pending gate entry requests.")
      ).toBeInTheDocument();
    });
  });

  describe("Delivery Queue DataTable Pagination", () => {
    it("paginates delivery list to 10 items per page", () => {
      render(
        <DataTable
          columns={deliveryColumns}
          data={mockDeliveries as (MockDelivery & Record<string, unknown>)[]}
          isLoading={false}
          enableClientPagination={true}
          pageSize={10}
        />
      );

      expect(screen.getByText("Courier Carrier 1")).toBeInTheDocument();
      expect(screen.getByText("Courier Carrier 10")).toBeInTheDocument();
      expect(screen.queryByText("Courier Carrier 11")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();

      const nextBtn = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextBtn);

      expect(screen.getByText("Courier Carrier 11")).toBeInTheDocument();
      expect(screen.getByText("Courier Carrier 15")).toBeInTheDocument();
      expect(screen.queryByText("Courier Carrier 1")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
    });
  });
});
