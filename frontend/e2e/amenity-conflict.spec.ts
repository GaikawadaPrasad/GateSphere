import { test, expect } from "@playwright/test";
import { RoleApi, pageAs, uniq } from "./support";

type Row = { id: string; code?: string };
type Slot = { id: string; day_of_week: number; start_time: string; is_active: boolean };
type Booking = { id: string; amenity_id: string; status: string };

/** Local YYYY-MM-DD, `days` from today (the portal's date input uses local dates). */
function isoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Python `date.weekday()` (Mon=0), which the backend stores in `day_of_week`. */
function pyWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

test.describe("Amenity booking conflict (FR-11, NFR-REL-02) — server wins the race", () => {
  test("another resident takes the last place; the portal shows the conflict and books nothing", async ({
    browser,
    baseURL,
  }) => {
    const admin = await RoleApi.open(baseURL!, "community_admin");
    const superAdmin = await RoleApi.open(baseURL!, "super_admin");
    const resident = await RoleApi.open(baseURL!, "resident");
    let rival: RoleApi | undefined;
    try {
      // A single-place amenity in the resident's community (fresh per run).
      const name = `E2E Court ${uniq()}`;
      const amenity = await admin.send<Row>("POST", "/amenities", {
        code: `E2E${uniq()}`.slice(0, 30).toUpperCase(),
        name,
        capacity: 1,
      });

      // A second resident of the same community (seed: resident1.<code>@…).
      const me = await resident.get<{ community_id: string }>("/residents/me");
      const community = (await superAdmin.get<Row[]>("/communities")).find(
        (c) => c.id === me.community_id,
      );
      expect(community?.code, "resident's community").toBeTruthy();
      rival = await RoleApi.login(
        baseURL!,
        `resident1.${community!.code}@gatesphere.com`,
        "Resident#2026",
      );

      const date = isoDate(1);
      const slots = (await resident.get<Slot[]>(`/amenities/${amenity.id}/slots`))
        .filter((s) => s.is_active && s.day_of_week === pyWeekday(date))
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      expect(slots.length, "auto-provisioned slots for tomorrow").toBeGreaterThan(0);

      // 1. Resident opens the booking modal for tomorrow's first slot…
      const page = await pageAs(browser, "resident");
      await page.goto("/owner-tenant/amenities");
      const card = page.locator("div").filter({ hasText: name }).last();
      await card
        .getByRole("button", { name: /Reserve Slot/i })
        .first()
        .click();
      await page.locator('input[type="date"]').fill(date);

      // 2. …while another resident takes the only place (the portal cannot know: it only
      //    sees the resident's own bookings, so this must be caught by the server).
      await rival.send("POST", "/amenities/bookings", {
        amenity_id: amenity.id,
        slot_id: slots[0].id,
        booking_date: date,
        participant_count: 1,
      });

      // 3. Resident confirms → server rejects with 409, portal shows it.
      await page.getByRole("button", { name: /Confirm Booking/i }).click();
      await expect(page.getByText(/Booking Error/i)).toBeVisible();

      const mine = await resident.get<Booking[]>("/amenities/bookings?page_size=100");
      expect(
        mine.filter((b) => b.amenity_id === amenity.id && b.status !== "cancelled"),
      ).toHaveLength(0);
    } finally {
      await rival?.dispose();
      await admin.dispose();
      await superAdmin.dispose();
      await resident.dispose();
    }
  });
});
