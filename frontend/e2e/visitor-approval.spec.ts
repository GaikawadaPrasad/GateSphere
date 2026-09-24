import { test, expect } from "@playwright/test";
import { RoleApi, pageAs, residentUnitId, uniq } from "./support";

type VisitorRequest = { id: string; status: string };

test.describe("Visitor approval (FR-04) — guard logs, resident approves in the portal", () => {
  test("a guard-logged visitor is approved by the resident and becomes approved server-side", async ({
    browser,
    baseURL,
  }) => {
    const guard = await RoleApi.open(baseURL!, "security_guard");
    const resident = await RoleApi.open(baseURL!, "resident");
    try {
      const unitId = await residentUnitId(resident);

      // The portal surfaces the oldest pending request; clear seed leftovers so the prompt
      // shown is deterministically the one this journey creates.
      const pending = await resident.get<VisitorRequest[]>(
        `/visitors/requests?request_status=pending&page_size=100`,
      );
      for (const r of pending) {
        await resident.send("POST", `/visitors/requests/${r.id}/decision`, {
          decision: "rejected",
          remarks: "E2E setup: clearing stale pending requests",
        });
      }

      const name = `E2E Guest ${uniq()}`;
      const created = await guard.send<VisitorRequest>("POST", "/visitors/requests", {
        unit_id: unitId,
        visitor: { full_name: name, phone: `9${Date.now().toString().slice(-9)}` },
        visitor_type: "personal_guest",
      });
      expect(created.status).toBe("pending");

      const page = await pageAs(browser, "resident");
      await page.goto("/owner-tenant/dashboard");
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await page.getByRole("button", { name: /Approve Entry/i }).click();
      await expect(page.getByText("Visitor entry approved", { exact: false })).toBeVisible();

      // End state is verified against the backend, not the UI.
      await expect
        .poll(
          async () =>
            (await resident.get<VisitorRequest>(`/visitors/requests/${created.id}`)).status,
        )
        .toBe("approved");

      // The guard cannot approve on the resident's behalf (visitors:approve is resident-side).
      const res = await guard.ctx.post(`/api/v1/visitors/requests/${created.id}/decision`, {
        data: { decision: "approved" },
        headers: {
          "X-CSRF-Token":
            (await guard.ctx.storageState()).cookies.find((c) => c.name.endsWith("_csrf"))?.value ??
            "",
        },
      });
      expect(res.status()).toBe(403);
    } finally {
      await guard.dispose();
      await resident.dispose();
    }
  });
});
