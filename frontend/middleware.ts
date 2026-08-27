import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route guard. Presence-only check on the session cookie — the backend is the
 * authority and re-validates every request. Deep RBAC gating happens in the pages.
 */
const PROTECTED = ["/dashboard"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  if (!req.cookies.has("gs_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
