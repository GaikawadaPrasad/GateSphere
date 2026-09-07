import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Coarse route guard (AGENTS.md §5.1): presence-only check on the session
 * cookie. The backend re-validates every request and is the real authority;
 * `app/super-admin/layout.tsx` and role guards enforce role boundaries.
 */
const PROTECTED_PREFIXES = [
  "/super-admin",
  "/community-admin",
  "/dashboard",
  "/communities",
  "/towers",
  "/floors",
  "/units",
  "/residents",
  "/visitors",
  "/gate",
  "/deliveries",
  "/domestic-staff",
  "/vehicles",
  "/parking",
  "/violations",
  "/billing",
  "/payments",
  "/complaints",
  "/amenities",
  "/communications",
  "/notifications",
  "/incidents",
  "/reports",
  "/audit-logs",
  "/profile",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  // Accept the legacy `gs_session` cookie or any role-bucketed `gatesphere_<bucket>_session`.
  const hasSession =
    req.cookies.has("gs_session") ||
    req.cookies.getAll().some((c) => /^gatesphere_[a-z0-9_]+_session$/.test(c.name));

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
