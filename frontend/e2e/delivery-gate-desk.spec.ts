import { test, expect } from "@playwright/test";
import { RoleApi, pageAs, residentUnitId, uniq } from "./support";

type Protocol = { delivery_type: string; protocol_type: string; unit_id: string | null };
type Delivery = { id: string; status: string; approval_status: string };

test.describe("Delivery protocols (FR-07) — resident configures, guard hands over at desk", () => {
  test("resident sets 'Leave at gate desk'; the parcel is auto-approved and collected at the desk", async ({
    browser,
    baseURL,
  }) => {
    const guard = await RoleApi.open(baseURL!, "security_guard");
    const resident = await RoleApi.open(baseURL!, "resident");
    try {
      const unitId = await residentUnitId(resident);

      // 1. Resident chooses the protocol in the portal.
      const residentPage = await pageAs(browser, "resident");
      await residentPage.goto("/owner-tenant/deliveries");
      const select = residentPage.getByLabel("ecommerce", { exact: true });
      await expect(select).toBeEnabled();
      await select.selectOption("leave_at_gate_desk");
      await expect(
        residentPage.getByText("ecommerce deliveries: leave at gate desk"),
      ).toBeVisible();
      await expect
        .poll(
          async () =>
            (await resident.get<Protocol[]>("/deliveries/protocols")).find(
              (p) => p.delivery_type === "ecommerce",
            )?.protocol_type,
        )
        .toBe("leave_at_gate_desk");

      // 2. Guard logs the parcel — the protocol routes it without asking the resident.
      const ref = `E2E-${uniq()}`;
      const d = await guard.send<Delivery>("POST", "/deliveries", {
        unit_id: unitId,
        delivery_type: "ecommerce",
        provider_name: "E2E Courier",
        tracking_reference: ref,
      });
      expect(d.approval_status).toBe("auto_approved");
      await guard.send("POST", `/deliveries/${d.id}/arrival`, {});

      // 3. Guard records the gate-desk hand-over in the guard console.
      const guardPage = await pageAs(browser, "security_guard");
      await guardPage.goto("/security-guard/deliveries");
      const row = guardPage.getByRole("row").filter({ hasText: ref });
      await expect(row).toBeVisible();
      await expect(row.getByRole("button", { name: "Delivered" })).toHaveCount(0);
      await row.getByRole("button", { name: "Collected at desk" }).click();
      await expect(
        guardPage.getByText("Parcel handed over at the gate desk").first(),
      ).toBeVisible();

      await expect
        .poll(async () => (await guard.get<Delivery>(`/deliveries/${d.id}`)).status)
        .toBe("collected");
    } finally {
      // Restore the seed default for this unit so later journeys start from a known state.
      await resident
        .send("PUT", "/deliveries/protocols", {
          delivery_type: "ecommerce",
          protocol_type: "resident_approval_required",
        })
        .catch(() => undefined);
      await guard.dispose();
      await resident.dispose();
    }
  });
});
