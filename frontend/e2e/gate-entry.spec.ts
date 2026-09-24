import { test, expect } from "@playwright/test";
import { RoleApi, pageAs, residentUnitId, uniq } from "./support";

type VisitorRequest = { id: string; status: string };

// A minimal valid JPEG (SOI + JFIF APP0 + EOI): the upload pipeline sniffs magic bytes.
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  Buffer.from("JFIF\0", "binary"),
  Buffer.alloc(64, 0x20),
  Buffer.from([0xff, 0xd9]),
]);

test.describe("Gate entry (FR-04/05) — approved visitor admitted with mandatory photo", () => {
  test("the guard cannot admit without a photo, then admits with one and the entry is recorded", async ({
    browser,
    baseURL,
  }) => {
    const guard = await RoleApi.open(baseURL!, "security_guard");
    const resident = await RoleApi.open(baseURL!, "resident");
    try {
      const unitId = await residentUnitId(resident);
      const name = `E2E Visitor ${uniq()}`;
      const req = await guard.send<VisitorRequest>("POST", "/visitors/requests", {
        unit_id: unitId,
        visitor: { full_name: name, phone: `9${Date.now().toString().slice(-9)}` },
        visitor_type: "personal_guest",
      });
      await resident.send("POST", `/visitors/requests/${req.id}/decision`, {
        decision: "approved",
      });

      const page = await pageAs(browser, "security_guard");
      await page.goto("/security-guard/visitors");
      const row = page.getByRole("row").filter({ hasText: name });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Mark Entry" }).click();

      // Photo is mandatory (security policy) — admitting without one is refused client-side…
      await page.getByRole("button", { name: /ALLOW GATE ENTRY/i }).click();
      await expect(page.getByText(/VISITOR PHOTO REQUIRED/i).first()).toBeVisible();

      // …attach a real photo through the upload pipeline, then admit.
      await page.locator('input[type="file"]').first().setInputFiles({
        name: "visitor.jpg",
        mimeType: "image/jpeg",
        buffer: JPEG,
      });
      await expect(page.getByText(/Photograph Attached/i)).toBeVisible();
      await page.getByRole("button", { name: /ALLOW GATE ENTRY/i }).click();
      await expect(page.getByText(`Gate entry recorded for ${name}`).first()).toBeVisible();

      await expect
        .poll(async () => (await guard.get<VisitorRequest>(`/visitors/requests/${req.id}`)).status)
        .toBe("entered");
    } finally {
      await guard.dispose();
      await resident.dispose();
    }
  });
});
