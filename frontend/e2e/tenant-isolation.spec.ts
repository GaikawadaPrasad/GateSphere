import { test, expect } from "@playwright/test";
import { RoleApi, pageAs } from "./support";

type Row = { id: string };

/** First unit of a community, walked through the real hierarchy endpoints. */
async function firstUnitOf(api: RoleApi, communityId: string): Promise<string> {
  const towers = await api.get<Row[]>(`/communities/${communityId}/towers`);
  for (const t of towers) {
    for (const f of await api.get<Row[]>(`/communities/towers/${t.id}/floors`)) {
      const units = await api.get<Row[]>(`/communities/floors/${f.id}/units`);
      if (units.length) return units[0].id;
    }
  }
  throw new Error(`community ${communityId} has no units in the seed`);
}

test.describe("Tenant isolation (NFR-SEC-08) — cross-community access from a real session", () => {
  test("a community admin gets 404 (never 403) for another community's unit, via URL manipulation", async ({
    browser,
    baseURL,
  }) => {
    const sa = await RoleApi.open(baseURL!, "super_admin");
    const ca = await RoleApi.open(baseURL!, "community_admin");
    try {
      const all = await sa.get<Row[]>("/communities");
      const mine = new Set((await ca.get<Row[]>("/communities")).map((c) => c.id));
      const foreign = all.find((c) => !mine.has(c.id));
      const own = all.find((c) => mine.has(c.id));
      expect(foreign && own, "seed must contain two communities").toBeTruthy();

      const foreignUnit = await firstUnitOf(sa, foreign!.id);
      const ownUnit = await firstUnitOf(sa, own!.id);

      // Through the browser's own session (same-origin proxy), exactly as a tampered URL.
      const page = await pageAs(browser, "community_admin");
      expect((await page.request.get(`/api/v1/communities/units/${ownUnit}`)).status()).toBe(200);
      const res = await page.request.get(`/api/v1/communities/units/${foreignUnit}`);
      expect(res.status()).toBe(404);
      expect((await res.json()).data).toBeNull();
      expect((await page.request.get(`/api/v1/communities/${foreign!.id}`)).status()).toBe(404);
    } finally {
      await sa.dispose();
      await ca.dispose();
    }
  });
});
