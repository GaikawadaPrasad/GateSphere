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

  describe("Walk-In Visitor Gate Check-In Field Validation (GS-007)", () => {
    it("validates mobile number format rejecting invalid lengths and non-numeric characters", () => {
      const validatePhone = (raw: string) => {
        const cleaned = raw.trim().replace(/[\s\-()]/g, "");
        if (!cleaned) return "Mobile number is required.";
        if (!/^\+?[0-9]+$/.test(cleaned)) return "Mobile number must contain digits only.";
        let digits = cleaned;
        if (digits.startsWith("+91")) digits = digits.slice(3);
        else if (digits.startsWith("+")) digits = digits.slice(1);
        else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);

        if (digits.length === 10) {
          if (!/^[6-9]\d{9}$/.test(digits)) return "Valid 10-digit mobile number must start with 6, 7, 8, or 9.";
        } else if (cleaned.startsWith("+") && cleaned.length >= 11 && cleaned.length <= 15) {
          return undefined;
        } else {
          return "Mobile number must be a valid 10-digit number (e.g. 9876543210 or +91 9876543210).";
        }
        return undefined;
      };

      // Invalid 16-digit number (from bug screenshot)
      expect(validatePhone("9987654327899287")).toBe(
        "Mobile number must be a valid 10-digit number (e.g. 9876543210 or +91 9876543210)."
      );
      // Invalid alphabetic characters
      expect(validatePhone("98765abcde")).toBe("Mobile number must contain digits only.");
      // Short number
      expect(validatePhone("12345")).toBe(
        "Mobile number must be a valid 10-digit number (e.g. 9876543210 or +91 9876543210)."
      );
      // Valid Indian 10-digit mobile
      expect(validatePhone("9876543210")).toBeUndefined();
      expect(validatePhone("+91 9876543210")).toBeUndefined();
    });

    it("validates Govt ID numbers according to selected ID type", () => {
      const validateId = (idType: string, raw: string) => {
        const cleanVal = raw.trim().toUpperCase().replace(/[\s\-]/g, "");
        if (!cleanVal) return undefined;
        if (idType === "aadhaar") {
          if (!/^\d{12}$/.test(cleanVal)) return "Aadhaar number must be exactly 12 numeric digits.";
        } else if (idType === "pan") {
          if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanVal)) {
            return "PAN must be 10 characters in format ABCDE1234F (5 letters, 4 digits, 1 letter).";
          }
        }
        return undefined;
      };

      // Invalid 29-digit Aadhaar (from bug screenshot)
      expect(validateId("aadhaar", "46354676815376877861918637867")).toBe(
        "Aadhaar number must be exactly 12 numeric digits."
      );
      // Invalid Aadhaar with letters
      expect(validateId("aadhaar", "12345678901A")).toBe(
        "Aadhaar number must be exactly 12 numeric digits."
      );
      // Valid Aadhaar
      expect(validateId("aadhaar", "1234 5678 9012")).toBeUndefined();

      // Invalid PAN format
      expect(validateId("pan", "12345ABCDE")).toBe(
        "PAN must be 10 characters in format ABCDE1234F (5 letters, 4 digits, 1 letter)."
      );
      // Valid PAN
      expect(validateId("pan", "ABCDE1234F")).toBeUndefined();
    });

    it("dynamically synchronizes unit filtering and maps the exact selected destination flat (GS-008)", () => {
      const mockUnits = [
        { id: "unit-101", unit_number: "101", unit_type: "villa" },
        { id: "unit-102", unit_number: "102", unit_type: "apartment" },
        { id: "unit-a101", unit_number: "A-101", unit_type: "apartment" },
        { id: "unit-a102", unit_number: "A-102", unit_type: "apartment" },
        { id: "unit-a105", unit_number: "A-105", unit_type: "apartment" },
      ];

      // Simulate filter search logic in WalkInVisitorModal
      const syncUnitSelection = (
        currentUnitId: string,
        filterText: string,
        units: typeof mockUnits
      ) => {
        const trimmed = filterText.trim().toLowerCase();
        if (!trimmed) {
          return {
            filteredUnits: units,
            selectedUnitId: currentUnitId,
          };
        }
        const matches = units.filter((u) =>
          u.unit_number.toLowerCase().includes(trimmed)
        );
        const exactMatch = matches.find(
          (u) => u.unit_number.toLowerCase() === trimmed
        );

        let newSelectedId = currentUnitId;
        if (exactMatch) {
          newSelectedId = exactMatch.id;
        } else if (matches.length === 1) {
          newSelectedId = matches[0].id;
        } else if (currentUnitId && !matches.some((u) => u.id === currentUnitId)) {
          newSelectedId = "";
        }

        return {
          filteredUnits: matches,
          selectedUnitId: newSelectedId,
        };
      };

      // 1. Initial state: No flat pre-selected
      const unitState = { selectedUnitId: "", filterText: "" };

      // 2. Guard filters for "A-105"
      const res1 = syncUnitSelection(unitState.selectedUnitId, "A-105", mockUnits);
      expect(res1.filteredUnits).toHaveLength(1);
      expect(res1.filteredUnits[0].unit_number).toBe("A-105");
      // Must dynamically auto-select A-105's id instead of leaving stale/default id
      expect(res1.selectedUnitId).toBe("unit-a105");

      // 3. Construct visitor approval payload with selected unit
      const payload = {
        unit_id: res1.selectedUnitId,
        visitor: {
          full_name: "Rahul Sharma",
          phone: "+919876543210",
        },
        visitor_type: "guest",
        purpose: "Visiting resident",
      };

      expect(payload.unit_id).toBe("unit-a105");
      expect(payload.unit_id).not.toBe("unit-102");

      // 4. Guard searches for partial match "A-1" (multiple matches: A-101, A-102, A-105)
      const res2 = syncUnitSelection("unit-102", "A-1", mockUnits);
      expect(res2.filteredUnits).toHaveLength(3);
      // Unit-102 is not in matches, so selection is safely reset to empty to avoid hidden mismatch
      expect(res2.selectedUnitId).toBe("");
    });
  });
});

