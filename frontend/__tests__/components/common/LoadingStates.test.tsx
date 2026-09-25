import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { BrandLoader } from "@/components/common/BrandLoader";
import { TableSkeleton } from "@/components/common/LoadingSkeleton";

describe("loading states", () => {
  it("BrandLoader is an announced status with the logo and message", () => {
    const { container } = render(<BrandLoader message="Securing your session…" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Securing your session…");
    expect(container.querySelector("img")?.getAttribute("src")).toContain("gatesphere-logo");
    expect(status.className).toContain("gs-brand-loader--screen");
  });

  it("TableSkeleton renders both the desktop table and the mobile card layout", () => {
    const { container } = render(<TableSkeleton rows={3} cols={5} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading records…");
    expect(container.querySelector(".gs-skel-table")).not.toBeNull();
    expect(container.querySelectorAll(".gs-skel-cards .data-table-mobile-card")).toHaveLength(3);
  });
});
