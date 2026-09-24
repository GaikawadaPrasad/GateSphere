import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React, { useState } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ErrorState } from "@/components/common/ErrorState";
import { KpiCardSkeleton, CardSkeleton, TableSkeleton } from "@/components/common/LoadingSkeleton";
import { formatCurrency } from "@/lib/utils";
import type { VisitorRequest, InvoiceItem } from "@/hooks/use-owner-tenant-data";

describe("Resident Dashboard Components & Architecture", () => {
  describe("Skeleton Loading States", () => {
    it("renders KpiCardSkeleton when KPI data is loading", () => {
      const { container } = render(
        <KpiCard title="Pending Gate Approvals" value="2" icon="🔔" isLoading={true} />,
      );
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders CardSkeleton with specified lines/height", () => {
      const { container } = render(<CardSkeleton height={180} lines={3} />);
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders TableSkeleton with specified rows and cols", () => {
      const { container } = render(<TableSkeleton rows={4} cols={5} />);
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe("Error States & Retry Handlers", () => {
    it("renders ErrorState with title, message, and retry button", () => {
      const onRetry = vi.fn();
      render(
        <ErrorState
          title="Failed to Load Invoices"
          message="Network timeout connecting to billing ledger."
          onRetry={onRetry}
        />,
      );

      expect(screen.getByText("Failed to Load Invoices")).toBeInTheDocument();
      expect(screen.getByText("Network timeout connecting to billing ledger.")).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("Table Pagination & Controls", () => {
    const mockVisitors: VisitorRequest[] = Array.from({ length: 25 }, (_, i) => ({
      id: `vis-${i + 1}`,
      visitor_name: `Guest Visitor ${i + 1}`,
      phone: `+91 98765432${i.toString().padStart(2, "0")}`,
      purpose: i % 2 === 0 ? "Family Visit" : "Delivery",
      status: i % 3 === 0 ? "approved" : "pending",
      created_at: new Date(2026, 8, 12, 10, i).toISOString(),
    }));

    const visitorColumns: Column<VisitorRequest>[] = [
      { key: "visitor_name", header: "Visitor Name", sortable: true },
      { key: "phone", header: "Phone" },
      { key: "purpose", header: "Purpose" },
      {
        key: "status",
        header: "Status",
        render: (v) => <StatusBadge status={v.status} />,
      },
    ];

    function PaginatedVisitorTable() {
      const [page, setPage] = useState(1);
      const [pageSize, setPageSize] = useState(10);
      const start = (page - 1) * pageSize;
      const paginatedData = mockVisitors.slice(start, start + pageSize);

      return (
        <DataTable<VisitorRequest>
          columns={visitorColumns}
          data={paginatedData}
          page={page}
          pageSize={pageSize}
          total={mockVisitors.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          emptyTitle="No visitors"
          emptyDescription="No visitors recorded."
        />
      );
    }

    it("paginates visitor requests to 10 items on initial render", () => {
      render(<PaginatedVisitorTable />);
      expect(screen.getByText("Guest Visitor 1")).toBeInTheDocument();
      expect(screen.getByText("Guest Visitor 10")).toBeInTheDocument();
      expect(screen.queryByText("Guest Visitor 11")).not.toBeInTheDocument();
    });

    it("advances to page 2 and displays next batch of visitors", () => {
      render(<PaginatedVisitorTable />);
      const nextBtn = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextBtn);

      expect(screen.getByText("Guest Visitor 11")).toBeInTheDocument();
      expect(screen.getByText("Guest Visitor 20")).toBeInTheDocument();
      expect(screen.queryByText("Guest Visitor 1")).not.toBeInTheDocument();
    });

    it("updates page size when selector is changed", () => {
      render(<PaginatedVisitorTable />);
      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "20" } });

      expect(screen.getByText("Guest Visitor 1")).toBeInTheDocument();
      expect(screen.getByText("Guest Visitor 20")).toBeInTheDocument();
    });
  });

  describe("Invoices & Billing Summary", () => {
    const mockInvoices: InvoiceItem[] = [
      {
        id: "inv-1",
        invoice_number: "INV-2026-001",
        title: "September 2026 Society Maintenance",
        total_amount: 350.0,
        amount_paid: 0,
        balance_due: 350.0,
        status: "posted",
        issue_date: "2026-09-01T00:00:00Z",
        due_date: "2026-09-15T00:00:00Z",
      },
      {
        id: "inv-2",
        invoice_number: "INV-2026-002",
        title: "Clubhouse Booking Fee",
        total_amount: 50.0,
        amount_paid: 50.0,
        balance_due: 0,
        status: "paid",
        issue_date: "2026-09-05T00:00:00Z",
        due_date: "2026-09-05T00:00:00Z",
      },
    ];

    it("renders invoice list with status badges and balances", () => {
      render(
        <DataTable<InvoiceItem>
          columns={[
            { key: "invoice_number", header: "Invoice #" },
            { key: "title", header: "Billing Item" },
            {
              key: "balance_due",
              header: "Balance Due",
              render: (i) => formatCurrency(i.balance_due),
            },
            { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
          ]}
          data={mockInvoices}
        />,
      );

      expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
      expect(screen.getByText("September 2026 Society Maintenance")).toBeInTheDocument();
      expect(screen.getByText("₹350.00")).toBeInTheDocument();
      expect(screen.getByText("INV-2026-002")).toBeInTheDocument();
    });
  });

  describe("Visitor Requests & Approval Actions (GS-004)", () => {
    const mockVisitorRequests: VisitorRequest[] = [
      {
        id: "vis-pending-1",
        visitor_name: "ASHOK",
        phone: "+918765432109",
        purpose: "Visitor at gate requesting entry",
        status: "pending",
        created_at: "2026-09-15T10:00:00Z",
      },
      {
        id: "vis-approved-2",
        visitor_name: "Dharma Raj",
        phone: "+919182275672",
        purpose: "dinner",
        status: "approved",
        created_at: "2026-09-13T18:00:00Z",
      },
    ];

    it("renders Accept and Reject buttons for pending visitor requests", () => {
      const handleDecision = vi.fn();

      const columns: Column<VisitorRequest>[] = [
        { key: "visitor_name", header: "Visitor Name" },
        { key: "phone", header: "Phone" },
        { key: "purpose", header: "Purpose" },
        { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
        {
          key: "actions",
          header: "Actions",
          render: (i) => {
            if (i.status === "pending") {
              return (
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button type="button" onClick={() => handleDecision(i.id, true)}>
                    ✓ Accept
                  </button>
                  <button type="button" onClick={() => handleDecision(i.id, false)}>
                    ✕ Reject
                  </button>
                </div>
              );
            }
            return <span>{i.status === "approved" ? "✓ Approved" : "—"}</span>;
          },
        },
      ];

      render(<DataTable<VisitorRequest> columns={columns} data={mockVisitorRequests} />);

      expect(screen.getByText("ASHOK")).toBeInTheDocument();
      const acceptBtn = screen.getByRole("button", { name: /accept/i });
      const rejectBtn = screen.getByRole("button", { name: /reject/i });
      expect(acceptBtn).toBeInTheDocument();
      expect(rejectBtn).toBeInTheDocument();

      fireEvent.click(acceptBtn);
      expect(handleDecision).toHaveBeenCalledWith("vis-pending-1", true);

      fireEvent.click(rejectBtn);
      expect(handleDecision).toHaveBeenCalledWith("vis-pending-1", false);

      expect(screen.getByText("✓ Approved")).toBeInTheDocument();
    });
  });
});
