/**
 * Shared E2E helpers. The suite runs against a REAL backend with the deterministic seed
 * (`python -m app.scripts.seed --reset`) — nothing in the browser is mocked, because the
 * Next.js middleware checks the session cookie server-side (re-audit #3, F1).
 *
 * Each role logs in once in `global-setup.ts`; its cookies are saved to
 * `e2e/.auth/<role>.json` (gitignored — live session cookies).
 */
import path from "node:path";
import { expect, request, type APIRequestContext, type Browser, type Page } from "@playwright/test";

export const DEMO_DOMAIN = "gatesphere.com";
export const ROLES = [
  "resident",
  "security_guard",
  "community_admin",
  "facility_manager",
  "super_admin",
] as const;
export type Role = (typeof ROLES)[number];

export const demoEmail = (role: Role) => `${role}@${DEMO_DOMAIN}`;
/** Seed convention: `backend/app/scripts/seed.py` / `backend/conftest.py::demo_password`. */
export const demoPassword = (role: Role) => `${role}@Gate2026!`;
export const authFile = (role: Role) => path.join(__dirname, ".auth", `${role}.json`);

/** Unique suffix so a journey never collides with seed rows or an earlier run. */
export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type Envelope<T> = { success: boolean; data: T; error?: { code: string } };

/**
 * An API client that carries one role's session cookies and sends the matching
 * `X-CSRF-Token` on unsafe methods — the same contract `lib/api.ts` follows.
 */
export class RoleApi {
  private constructor(
    readonly ctx: APIRequestContext,
    private readonly csrf: string,
  ) {}

  static async open(baseURL: string, role: Role): Promise<RoleApi> {
    const ctx = await request.newContext({ baseURL, storageState: authFile(role) });
    return RoleApi.fromContext(ctx, role);
  }

  /** Sign in any seeded account (e.g. a second resident) through the real login endpoint. */
  static async login(baseURL: string, email: string, password: string): Promise<RoleApi> {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.post("/api/v1/auth/login", { data: { email, password } });
    expect(res.status(), `login ${email}: ${await res.text()}`).toBe(200);
    return RoleApi.fromContext(ctx, email);
  }

  private static async fromContext(ctx: APIRequestContext, who: string): Promise<RoleApi> {
    const state = await ctx.storageState();
    const csrf = state.cookies.find((c) => /^gatesphere_[a-z0-9_]+_csrf$/.test(c.name));
    if (!csrf) throw new Error(`no csrf cookie for ${who}`);
    return new RoleApi(ctx, csrf.value);
  }

  async get<T>(url: string): Promise<T> {
    const res = await this.ctx.get(`/api/v1${url}`);
    expect(res.status(), `GET ${url}: ${await res.text()}`).toBe(200);
    return ((await res.json()) as Envelope<T>).data;
  }

  async send<T>(method: "POST" | "PUT" | "PATCH", url: string, data?: unknown): Promise<T> {
    const res = await this.ctx.fetch(`/api/v1${url}`, {
      method,
      data: data ?? {},
      headers: { "X-CSRF-Token": this.csrf },
    });
    expect(res.ok(), `${method} ${url} -> ${res.status()}: ${await res.text()}`).toBeTruthy();
    return ((await res.json()) as Envelope<T>).data;
  }

  /** Raw status for negative assertions (403 / 404 / 409 …). */
  async status(url: string): Promise<number> {
    return (await this.ctx.get(`/api/v1${url}`)).status();
  }

  dispose() {
    return this.ctx.dispose();
  }
}

/** A browser page already signed in as `role` (real session cookie). */
export async function pageAs(browser: Browser, role: Role): Promise<Page> {
  const context = await browser.newContext({ storageState: authFile(role) });
  return context.newPage();
}

/** The unit the seeded resident actively occupies (row-level scope, AGENTS.md §3). */
export async function residentUnitId(resident: RoleApi): Promise<string> {
  const me = await resident.get<{
    occupancies: { unit_id: string; is_active: boolean; is_primary: boolean }[];
  }>("/residents/me");
  const occ =
    me.occupancies.find((o) => o.is_active && o.is_primary) ||
    me.occupancies.find((o) => o.is_active);
  if (!occ) throw new Error("seeded resident has no active occupancy");
  return occ.unit_id;
}
