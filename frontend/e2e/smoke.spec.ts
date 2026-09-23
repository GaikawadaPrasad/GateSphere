import { test, expect } from "@playwright/test";

const MOCK_COMMUNITY_ID = "22222222-2222-2222-2222-222222222222";
const MOCK_UNIT_ID = "33333333-3333-3333-3333-333333333333";
const MOCK_RESIDENT_ID = "44444444-4444-4444-4444-444444444444";

const mockResidentUser = {
  id: MOCK_RESIDENT_ID,
  email: "resident@gatesphere.local",
  full_name: "Aditi Rao",
  role_slug: "resident",
  roles: ["resident"],
  primary_community_id: MOCK_COMMUNITY_ID,
};

const mockAdminUser = {
  id: "55555555-5555-5555-5555-555555555555",
  email: "admin@gatesphere.local",
  full_name: "Vikram Admin",
  role_slug: "community_admin",
  roles: ["community_admin"],
  primary_community_id: MOCK_COMMUNITY_ID,
};

const mockResidentProfile = {
  id: "66666666-6666-6666-6666-666666666666",
  user_id: MOCK_RESIDENT_ID,
  community_id: MOCK_COMMUNITY_ID,
  phone: "+919876543210",
  occupancies: [
    {
      id: "77777777-7777-7777-7777-777777777777",
      unit_id: MOCK_UNIT_ID,
      unit_number: "A-101",
      occupancy_type: "owner",
      is_active: true,
      is_primary: true,
    },
  ],
};

test.describe("GateSphere Critical E2E Workflows", () => {
  test("User Login Workflow — Page load, form validation, and credential submission", async ({
    page,
  }) => {
    // Intercept login API
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }),
      });
    });

    await page.route("**/api/v1/auth/login", async (route) => {
      const postData = route.request().postDataJSON() || {};
      if (postData.email === "resident@gatesphere.local" && postData.password === "ValidPass123!") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { user: mockResidentUser } }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }),
        });
      }
    });

    await page.goto("/login");
    await expect(page).toHaveTitle(/GateSphere/i);

    // Verify presence of login elements
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Trigger validation on empty submit
    await submitBtn.click();
    await expect(page.locator("text=Password is required").or(page.locator("text=valid work email"))).toBeVisible();

    // Fill valid credentials and submit
    await emailInput.fill("resident@gatesphere.local");
    await passwordInput.fill("ValidPass123!");
    await submitBtn.click();
  });

  test("Amenity Booking Journey — View amenities list and open reservation modal", async ({
    page,
  }) => {
    // Mock user & resident profile
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockResidentUser }),
      });
    });

    await page.route("**/api/v1/residents/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockResidentProfile }),
      });
    });

    await page.route("**/api/v1/amenities?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "amenity-badminton-1",
              community_id: MOCK_COMMUNITY_ID,
              name: "Clubhouse Badminton Court",
              category: "sports",
              description: "Indoor wooden badminton court with synthetic mat",
              capacity: 4,
              price_per_hour: 0,
              is_active: true,
            },
          ],
        }),
      });
    });

    await page.route("**/api/v1/amenities/bookings*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], meta: { page: 1, page_size: 20, total: 0 } }),
      });
    });

    await page.goto("/owner-tenant/amenities");

    // Verify sections and amenities grid load
    await expect(page.locator("text=Browse Community Amenities")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Clubhouse Badminton Court")).toBeVisible();

    // Click Reserve Slot to open booking modal
    const reserveBtn = page.getByRole("button", { name: /Reserve Slot/i });
    await expect(reserveBtn).toBeVisible();
    await reserveBtn.click();

    // Verify booking modal opens
    await expect(page.locator("text=Select Date").or(page.locator("text=Confirm Booking"))).toBeVisible();
  });

  test("Visitor Approval Journey — View incoming visitors and access guest pass generation", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockResidentUser }),
      });
    });

    await page.route("**/api/v1/residents/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockResidentProfile }),
      });
    });

    await page.route("**/api/v1/visitors/requests*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "req-vis-001",
              community_id: MOCK_COMMUNITY_ID,
              unit_id: MOCK_UNIT_ID,
              visitor_name: "Rahul Sharma",
              phone: "+919876543211",
              category: "guest",
              status: "pending",
              created_at: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto("/owner-tenant/visitors");

    // Verify visitor request is visible
    await expect(page.locator("text=Rahul Sharma")).toBeVisible({ timeout: 10000 });

    // Verify Generate Guest Pass button is accessible
    const passBtn = page.getByRole("button", { name: /Generate Guest Pass/i });
    await expect(passBtn).toBeVisible();
    await passBtn.click();

    // Verify guest pass modal opens
    await expect(page.locator("text=Create Visitor Pass").or(page.locator("text=Visitor Name"))).toBeVisible();
  });

  test("Delivery Entry Journey — View active delivery rules and parcel list", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockResidentUser }),
      });
    });

    await page.route("**/api/v1/residents/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockResidentProfile }),
      });
    });

    await page.route("**/api/v1/deliveries/protocols*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "proto-1",
              community_id: MOCK_COMMUNITY_ID,
              delivery_type: "ecommerce",
              protocol_type: "leave_at_gate_desk",
              requires_otp: false,
              is_active: true,
            },
            {
              id: "proto-2",
              community_id: MOCK_COMMUNITY_ID,
              delivery_type: "food",
              protocol_type: "allow_at_gate",
              requires_otp: false,
              is_active: true,
            },
          ],
        }),
      });
    });

    await page.route("**/api/v1/deliveries?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "deliv-101",
              community_id: MOCK_COMMUNITY_ID,
              unit_id: MOCK_UNIT_ID,
              delivery_type: "ecommerce",
              provider_name: "Amazon Prime",
              tracking_reference: "AMZ-889900",
              approval_status: "auto_approved",
              status: "at_gate",
              parcel_count: 1,
            },
          ],
        }),
      });
    });

    await page.goto("/owner-tenant/deliveries");

    // Verify Active Delivery Rules header and canonical protocols
    await expect(page.locator("text=Active Delivery Rules")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=leave at gate desk").or(page.locator("text=allow at gate"))).toBeVisible();

    // Verify parcel row in deliveries table
    await expect(page.locator("text=Amazon Prime")).toBeVisible();
    await expect(page.locator("text=AMZ-889900")).toBeVisible();
  });

  test("Incident Reporting Journey — View incident log and open report form", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: mockAdminUser }),
      });
    });

    await page.route("**/api/v1/incidents?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "inc-001",
              incident_number: "INC-2026-0001",
              incident_type: "security",
              severity: "high",
              status: "reported",
              description: "Unauthorized vehicle parked near Main Gate emergency exit",
              location_text: "Main Gate Entry Road",
              reported_at: new Date().toISOString(),
            },
          ],
          meta: { page: 1, page_size: 20, total: 1 },
        }),
      });
    });

    await page.goto("/community-admin/incidents");

    // Verify page header and Log Incident Report button
    const logBtn = page.getByRole("button", { name: /Log Incident Report/i });
    await expect(logBtn).toBeVisible({ timeout: 10000 });

    // Verify incident row is listed
    await expect(page.locator("text=INC-2026-0001")).toBeVisible();

    // Click Log Incident Report button to open form modal
    await logBtn.click();
    await expect(page.locator("text=Report New Incident").or(page.locator("text=Incident Description"))).toBeVisible();
  });
});
