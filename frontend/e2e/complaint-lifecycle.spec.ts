import { test, expect } from "@playwright/test";
import { RoleApi, pageAs, uniq } from "./support";

type Ticket = { id: string; subject: string; status: string };

test.describe("Complaint lifecycle (FR-10) — raise → resolve → resident confirms → closed", () => {
  test("a resident-raised ticket can only be closed by the resident's own confirmation", async ({
    browser,
    baseURL,
  }) => {
    const fm = await RoleApi.open(baseURL!, "facility_manager");
    const resident = await RoleApi.open(baseURL!, "resident");
    try {
      const subject = `E2E leaking tap ${uniq()}`;

      // 1. Resident raises the ticket in the portal.
      const page = await pageAs(browser, "resident");
      await page.goto("/owner-tenant/complaints");
      await page.getByRole("button", { name: /Raise Service Ticket/i }).click();
      await page.getByPlaceholder(/Master bathroom faucet leakage/i).fill(subject);
      await page.getByPlaceholder(/Describe the issue/i).fill("Water dripping under the sink.");
      await page.getByRole("button", { name: /Submit Ticket/i }).click();

      let ticket: Ticket | undefined;
      await expect
        .poll(async () => {
          const rows = await resident.get<Ticket[]>("/complaints/tickets?page_size=100");
          ticket = rows.find((t) => t.subject === subject);
          return ticket?.status;
        })
        .toBe("created");

      // 2. Staff work the ticket through the real lifecycle (assign → in progress → resolved).
      await fm.send("POST", `/complaints/tickets/${ticket!.id}/assign`, {
        vendor_name: "E2E Vendor",
      });
      await fm.send("POST", `/complaints/tickets/${ticket!.id}/transition`, {
        status: "in_progress",
      });
      await fm.send("POST", `/complaints/tickets/${ticket!.id}/transition`, { status: "resolved" });

      // Staff cannot close it themselves — closure needs the resident (DB CHECK + service rule).
      const staffClose = await fm.ctx.post(`/api/v1/complaints/tickets/${ticket!.id}/transition`, {
        data: { status: "closed" },
        headers: {
          "X-CSRF-Token":
            (await fm.ctx.storageState()).cookies.find((c) => c.name.endsWith("_csrf"))?.value ??
            "",
        },
      });
      expect(staffClose.status()).toBe(422);

      // 3. Resident confirms the fix in the portal → closed server-side.
      await page.reload();
      const row = page.getByRole("row").filter({ hasText: subject });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: /Confirm Fix/i }).click();
      await expect
        .poll(async () => (await resident.get<Ticket>(`/complaints/tickets/${ticket!.id}`)).status)
        .toBe("closed");
    } finally {
      await fm.dispose();
      await resident.dispose();
    }
  });
});
