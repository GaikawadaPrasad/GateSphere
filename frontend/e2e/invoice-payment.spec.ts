import { test, expect } from "@playwright/test";
import { RoleApi, pageAs, residentUnitId } from "./support";

type Invoice = { id: string; invoice_number: string; status: string; balance_due: string | number };

test.describe("Maintenance billing (FR-09) — resident pays a posted invoice", () => {
  test("staff raises + posts an invoice; the resident pays it in the portal; it is paid server-side", async ({
    browser,
    baseURL,
  }) => {
    const admin = await RoleApi.open(baseURL!, "community_admin");
    const resident = await RoleApi.open(baseURL!, "resident");
    try {
      const unitId = await residentUnitId(resident);
      const draft = await admin.send<Invoice>("POST", "/billing/invoices", {
        unit_id: unitId,
        items: [{ description: "E2E maintenance charge", unit_rate: "1250.00" }],
      });
      const posted = await admin.send<Invoice>("POST", `/billing/invoices/${draft.id}/post`);
      expect(Number(posted.balance_due)).toBeGreaterThan(0);

      const page = await pageAs(browser, "resident");
      await page.goto("/owner-tenant/payments");
      const row = page.getByRole("row").filter({ hasText: posted.invoice_number });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: /Pay Now/i }).click();
      await page.getByRole("button", { name: /Simulate Instant Payment/i }).click();

      await expect
        .poll(async () => (await resident.get<Invoice>(`/billing/invoices/${posted.id}`)).status)
        .toBe("paid");
      const paid = await resident.get<Invoice>(`/billing/invoices/${posted.id}`);
      expect(Number(paid.balance_due)).toBe(0);
      await expect(row.getByRole("button", { name: /View Receipt/i })).toBeVisible();
    } finally {
      await admin.dispose();
      await resident.dispose();
    }
  });
});
