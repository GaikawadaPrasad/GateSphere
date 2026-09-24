import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { DeliveryProtocolSettings } from "@/components/deliveries/DeliveryProtocolSettings";

const noop = () => {};

describe("DeliveryProtocolSettings (FR-07 resident protocol configuration)", () => {
  it("shows a distinct loading state", () => {
    render(
      <DeliveryProtocolSettings
        protocols={undefined}
        isLoading
        isError={false}
        onRetry={noop}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("Loading delivery protocols")).toBeInTheDocument();
  });

  it("shows a distinct error state with retry", () => {
    const onRetry = vi.fn();
    render(
      <DeliveryProtocolSettings
        protocols={undefined}
        isLoading={false}
        isError
        onRetry={onRetry}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("Failed to load delivery protocols")).toBeInTheDocument();
  });

  it("renders every delivery type with its current protocol (server default when unset)", () => {
    render(
      <DeliveryProtocolSettings
        protocols={[{ delivery_type: "food", protocol_type: "allow_at_gate" }]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("food")).toHaveValue("allow_at_gate");
    expect(screen.getByLabelText("courier")).toHaveValue("resident_approval_required");
  });

  it("saves the selected protocol once, even on a same-tick double change", async () => {
    let resolve: (v: unknown) => void = noop;
    const onSave = vi.fn(() => new Promise((r) => (resolve = r)));
    render(
      <DeliveryProtocolSettings
        protocols={[]}
        isLoading={false}
        isError={false}
        onRetry={noop}
        onSave={onSave}
      />,
    );
    const select = screen.getByLabelText("ecommerce");
    fireEvent.change(select, { target: { value: "leave_at_gate_desk" } });
    fireEvent.change(select, { target: { value: "direct_rejection" } });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("ecommerce", "leave_at_gate_desk");
    resolve(undefined);
    await waitFor(() => expect(select).not.toBeDisabled());
  });
});
