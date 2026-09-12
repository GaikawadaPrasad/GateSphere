import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { EmptyState } from "@/components/common/EmptyState";

interface MockGateEvent {
  id: string;
  event_type: string;
  gate_id: string;
  occurred_at: string;
}

const mockGateEvents: MockGateEvent[] = Array.from({ length: 12 }, (_, i) => ({
  id: `ev-${i + 1}`,
  event_type: i % 2 === 0 ? "visitor_entry" : "vehicle_exit",
  gate_id: `gate-uuid-${i + 1}`,
  occurred_at: `2026-09-12T10:${String(i).padStart(2, "0")}:00Z`,
}));

const eventColumns: Column<MockGateEvent>[] = [
  { key: "occurred_at", header: "Timestamp" },
  { key: "event_type", header: "Event Type" },
  { key: "gate_id", header: "Gate Checkpoint" },
];

describe("Security Supervisor Dashboard Components", () => {
  describe("KPI Cards & Skeleton Loading", () => {
    it("renders KpiCardSkeleton when isLoading is true", () => {
      const { container } = render(
        <KpiCard
          title="Guards On Active Shift"
          value="4"
          icon="👮"
          isLoading={true}
        />
      );
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders metric value, title, and subtext when loaded", () => {
      render(
        <KpiCard
          title="Guards On Active Shift"
          value="4"
          subtext="Currently on duty"
          icon="👮"
          isLoading={false}
        />
      );
      expect(screen.getByText("Guards On Active Shift")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByText("Currently on duty")).toBeInTheDocument();
    });
  });

  describe("Gate Traffic Feed DataTable Pagination", () => {
    it("paginates gate events table to 5 items per page", () => {
      render(
        <DataTable
          columns={eventColumns}
          data={mockGateEvents as (MockGateEvent & Record<string, unknown>)[]}
          isLoading={false}
          enableClientPagination={true}
          pageSize={5}
        />
      );

      // Page 1 should display 5 items
      expect(screen.getByText("gate-uuid-1")).toBeInTheDocument();
      expect(screen.getByText("gate-uuid-5")).toBeInTheDocument();
      expect(screen.queryByText("gate-uuid-6")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();

      // Navigate to Page 2
      const nextBtn = screen.getByRole("button", { name: /Next/i });
      fireEvent.click(nextBtn);

      expect(screen.getByText("gate-uuid-6")).toBeInTheDocument();
      expect(screen.getByText("gate-uuid-10")).toBeInTheDocument();
      expect(screen.queryByText("gate-uuid-1")).not.toBeInTheDocument();
      expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    });

    it("renders EmptyState when there are no gate events", () => {
      render(
        <DataTable
          columns={eventColumns}
          data={[]}
          isLoading={false}
          emptyTitle="No Recent Gate Events"
          emptyDescription="Gate entry and exit events will appear here in real-time."
          emptyIcon="🛡️"
        />
      );

      expect(screen.getByText("No Recent Gate Events")).toBeInTheDocument();
      expect(
        screen.getByText("Gate entry and exit events will appear here in real-time.")
      ).toBeInTheDocument();
    });
  });
});
