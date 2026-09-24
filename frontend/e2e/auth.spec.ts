import { test, expect } from "@playwright/test";
import { demoEmail, demoPassword } from "./support";

test.describe("Authentication (FR-01) — real backend", () => {
  test("an unauthenticated visit to a protected route redirects to /login?next=", async ({
    page,
  }) => {
    await page.goto("/owner-tenant/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fowner-tenant%2Fdashboard/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("empty submit shows both field errors", async ({ page }) => {
    await page.goto("/login");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("Please enter a valid work email address")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("wrong password is rejected with the uniform message", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(demoEmail("resident"));
    await page.locator('input[type="password"]').fill("definitely-wrong-password");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("a resident signs in and lands on the resident portal with a session", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(demoEmail("resident"));
    await page.locator('input[type="password"]').fill(demoPassword("resident"));
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/owner-tenant\//);
    const cookies = await context.cookies();
    const session = cookies.find((c) => /^gatesphere_[a-z0-9_]+_session$/.test(c.name));
    expect(session, "role-bucketed session cookie").toBeTruthy();
    expect(session?.httpOnly).toBe(true);
    // The session is real: the backend recognises it.
    const me = await page.request.get("/api/v1/auth/me");
    expect(me.status()).toBe(200);
    expect((await me.json()).data.email).toBe(demoEmail("resident"));
  });
});
