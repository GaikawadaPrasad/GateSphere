import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";

interface MockVisitor {
  id: string;
  visitor_name: string;
  phone: string;
  purpose: string;
  status: "approved" | "pending" | "rejected";
  date: string;
}

const mockVisitors: MockVisitor[] = [
  {
    id: "vis-1",
    visitor_name: "Manohar Sharma",
    phone: "+91 98489 46245",
    purpose: "Lunch Meeting",
    status: "approved",
    date: "Sep 15, 2026",
  },
  {
    id: "vis-2",
    visitor_name: "Priya Patel",
    phone: "+91 98123 45678",
    purpose: "Delivery Drop-off",
    status: "pending",
    date: "Sep 15, 2026",
  },
];

const visitorColumns: Column<MockVisitor>[] = [
  { key: "visitor_name", header: "Visitor Name", sortable: true },
  { key: "phone", header: "Phone" },
  { key: "purpose", header: "Purpose" },
  {
    key: "status",
    header: "Status",
    render: (item) => <StatusBadge status={item.status} />,
  },
  { key: "date", header: "Date" },
  {
    key: "actions",
    header: "Actions",
    render: (item) => (
      <button type="button" className="btn btn-secondary">
        View {item.visitor_name}
      </button>
    ),
  },
];

describe("DataTable Responsive Views (Option 1 Cards & Option 2 Scroller)", () => {
  it("renders standard table layout in desktop viewMode", () => {
    const { container } = render(
      <DataTable<MockVisitor>
        columns={visitorColumns}
        data={mockVisitors}
        viewMode="table"
      />
    );

    const table = container.querySelector("table.data-table");
    expect(table).toBeInTheDocument();
    expect(screen.getByText("Visitor Name")).toBeInTheDocument();
    expect(screen.getByText("Manohar Sharma")).toBeInTheDocument();
    expect(screen.getByText("+91 98489 46245")).toBeInTheDocument();
  });

  it("renders mobile-friendly card layout in cards viewMode (Option 1)", () => {
    const { container } = render(
      <DataTable<MockVisitor>
        columns={visitorColumns}
        data={mockVisitors}
        viewMode="cards"
      />
    );

    // Should NOT render a standard table
    const table = container.querySelector("table.data-table");
    expect(table).not.toBeInTheDocument();

    // Should render mobile cards
    const cards = container.querySelectorAll(".data-table-mobile-card");
    expect(cards.length).toBe(2);

    // Primary column is rendered in header
    expect(screen.getByText("Manohar Sharma")).toBeInTheDocument();
    expect(screen.getByText("Priya Patel")).toBeInTheDocument();

    // Field headers and values are mapped in card body
    expect(screen.getAllByText("Phone").length).toBeGreaterThan(0);
    expect(screen.getByText("+91 98489 46245")).toBeInTheDocument();
    expect(screen.getAllByText("Purpose").length).toBeGreaterThan(0);
    expect(screen.getByText("Lunch Meeting")).toBeInTheDocument();

    // Status badges and action buttons rendered
    expect(screen.getByText(/approved/i)).toBeInTheDocument();
    expect(screen.getByText("View Manohar Sharma")).toBeInTheDocument();
  });

  it("supports interactive view switching when showViewToggle is enabled", () => {
    const { container } = render(
      <DataTable<MockVisitor>
        columns={visitorColumns}
        data={mockVisitors}
        showViewToggle={true}
      />
    );

    expect(container.querySelector("table.data-table")).toBeInTheDocument();

    // Click cards toggle button
    const cardsBtn = screen.getByRole("button", { name: /Cards/i });
    fireEvent.click(cardsBtn);

    // Now cards view is rendered
    expect(container.querySelectorAll(".data-table-mobile-card").length).toBe(2);
    expect(container.querySelector("table.data-table")).not.toBeInTheDocument();

    // Click table toggle button
    const tableBtn = screen.getByRole("button", { name: /Table/i });
    fireEvent.click(tableBtn);

    // Back to table view
    expect(container.querySelector("table.data-table")).toBeInTheDocument();
  });

  it("renders custom card representation when renderCard prop is provided", () => {
    const { container } = render(
      <DataTable<MockVisitor>
        columns={visitorColumns}
        data={mockVisitors}
        viewMode="cards"
        renderCard={(item) => (
          <div className="custom-visitor-card">
            <h4>Guest: {item.visitor_name}</h4>
            <p>Reason: {item.purpose}</p>
          </div>
        )}
      />
    );

    const customCards = container.querySelectorAll(".custom-visitor-card");
    expect(customCards.length).toBe(2);
    expect(screen.getByText("Guest: Manohar Sharma")).toBeInTheDocument();
  });

  it("triggers onRowClick when clicking on a card", () => {
    const handleRowClick = vi.fn();
    const { container } = render(
      <DataTable<MockVisitor>
        columns={visitorColumns}
        data={mockVisitors}
        viewMode="cards"
        onRowClick={handleRowClick}
      />
    );

    const cards = container.querySelectorAll(".data-table-mobile-card");
    fireEvent.click(cards[0]);

    expect(handleRowClick).toHaveBeenCalledWith(mockVisitors[0]);
  });
});
