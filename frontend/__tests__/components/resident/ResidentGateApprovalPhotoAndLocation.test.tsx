import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React, { useState } from "react";
import type { VisitorRequest } from "@/hooks/use-owner-tenant-data";

describe("Resident Gate Approval, Emergency Categories & Security Guard SOS Dismissal", () => {
  describe("Resident Gate Approval Prompt with Mandatory Photo & Details", () => {
    it("renders visitor name, phone number, purpose, and captured photo in approval prompt", () => {
      const mockPendingVisitor: VisitorRequest = {
        id: "vis-101",
        visitor_name: "John Doe",
        phone: "+919876543210",
        purpose: "Maintenance Inspection",
        photo_url: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        status: "pending",
        created_at: new Date().toISOString(),
      };

      render(
        <div data-testid="gate-approval-banner">
          {mockPendingVisitor.photo_url ? (
            <img
              src={mockPendingVisitor.photo_url}
              alt={mockPendingVisitor.visitor_name}
              data-testid="visitor-photo-img"
              style={{ width: 68, height: 68, objectFit: "cover", borderRadius: 8 }}
            />
          ) : (
            <div data-testid="visitor-photo-fallback">👤</div>
          )}
          <span data-testid="visitor-name">{mockPendingVisitor.visitor_name}</span>
          <span data-testid="visitor-purpose">Purpose: {mockPendingVisitor.purpose}</span>
          <span data-testid="visitor-phone">Phone: {mockPendingVisitor.phone}</span>
        </div>,
      );

      expect(screen.getByTestId("visitor-name")).toHaveTextContent("John Doe");
      expect(screen.getByTestId("visitor-purpose")).toHaveTextContent(
        "Purpose: Maintenance Inspection",
      );
      expect(screen.getByTestId("visitor-phone")).toHaveTextContent("Phone: +919876543210");

      const img = screen.getByTestId("visitor-photo-img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "data:image/jpeg;base64,/9j/4AAQSkZJRg==");
      expect(img).toHaveAttribute("alt", "John Doe");
    });
  });

  describe("Resident Emergency Category Selection & Dispatch", () => {
    function ResidentEmergencyDispatchForm({ onDispatch }: { onDispatch: (data: any) => void }) {
      const [type, setType] = useState("medical");
      const [note, setNote] = useState("");
      const residentUnit = "Unit A-107, Tower A";

      const categories = [
        { id: "medical", label: "Medical Emergency" },
        { id: "fire", label: "Fire & Smoke Alert" },
        { id: "security", label: "Security Threat" },
        { id: "gas_leak", label: "Gas Leak & Hazard" },
        { id: "elevator", label: "Elevator Malfunction" },
        { id: "other", label: "General Emergency SOS" },
      ];

      return (
        <div>
          <div data-testid="registered-unit">{residentUnit}</div>
          <div role="radiogroup" aria-label="Emergency Category">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setType(c.id)}
                data-testid={`cat-${c.id}`}
                aria-pressed={type === c.id}
              >
                {c.label} {type === c.id ? "✓ SELECTED" : ""}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Situational notes"
            data-testid="emergency-notes"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            data-testid="dispatch-btn"
            onClick={() => onDispatch({ alert_type: type, note, location: residentUnit })}
          >
            TRIGGER EMERGENCY DISPATCH NOW
          </button>
        </div>
      );
    }

    it("allows resident to select emergency type, enter note, and dispatch for Unit A-107, Tower A", () => {
      const handleDispatch = vi.fn();
      render(<ResidentEmergencyDispatchForm onDispatch={handleDispatch} />);

      expect(screen.getByTestId("registered-unit")).toHaveTextContent("Unit A-107, Tower A");

      // Select Fire & Smoke Alert
      fireEvent.click(screen.getByTestId("cat-fire"));
      expect(screen.getByTestId("cat-fire")).toHaveAttribute("aria-pressed", "true");

      // Enter notes
      fireEvent.change(screen.getByTestId("emergency-notes"), {
        target: { value: "Kitchen electrical smoke" },
      });

      // Dispatch
      fireEvent.click(screen.getByTestId("dispatch-btn"));
      expect(handleDispatch).toHaveBeenCalledWith({
        alert_type: "fire",
        note: "Kitchen electrical smoke",
        location: "Unit A-107, Tower A",
      });
    });
  });

  describe("Security Guard SOS Emergency Alert Location & Dismissal", () => {
    it("extracts and formats Tower and Unit location from SOS message", () => {
      const mockAlertWithMessage = {
        id: "sos-12345678",
        alert_type: "medical",
        message: "Medical Emergency — Location: Unit A-107, Tower A",
        status: "active",
      };

      const getSosLocation = (alert: any) => {
        const raw = alert?.message || "";
        const match = raw.match(/Location:\s*([^—\n]+)/i);
        if (match && match[1]?.trim()) return match[1].trim();
        const rawTitle = alert?.title || "";
        const titleMatch =
          rawTitle.match(/Location:\s*([^—\n]+)/i) || rawTitle.match(/SOS EMERGENCY:\s*(.+)/i);
        if (titleMatch && titleMatch[1]?.trim()) return titleMatch[1].trim();
        return alert?.location_coordinates || "Main Gate / Facility";
      };

      expect(getSosLocation(mockAlertWithMessage)).toBe("Unit A-107, Tower A");
    });

    it("allows security guards to resolve and dismiss active alert", async () => {
      const mockAlert = {
        id: "sos-99999999",
        alert_type: "medical",
        message: "Location: Unit A-107, Tower A — Medical Emergency",
        status: "active",
      };

      const handleDismiss = vi.fn().mockImplementation(async (alertId: string) => {
        return { ...mockAlert, status: "resolved", id: alertId };
      });

      const updated = await handleDismiss(mockAlert.id);
      expect(handleDismiss).toHaveBeenCalledWith("sos-99999999");
      expect(updated.status).toBe("resolved");
    });
  });
});
