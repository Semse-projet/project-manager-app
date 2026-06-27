// Run in Node.js runtime so Railway Service Variables (AUTH_SECRET,
// SEMSE_WEB_SESSION_SECRET) are accessible via process.env at runtime.
// Edge runtime does not guarantee access to non-NEXT_PUBLIC_ secrets.
export const runtime = "nodejs";

/**
 * Next.js Middleware — route protection
 *
 * Protected routes: all paths under the (app) route group
 *   /worker/*, /client/*, /admin/*, /agents
 *
 * Public routes (no session required):
 *   /, /login, /logout, /api/*, /_next/*, /favicon*
 */

import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, decodeSession, roleFromRoles, defaultDashboardForRole } from "@/lib/auth";
import { resolveSafeRedirectPath } from "@/lib/safe-redirect";

// Paths that are always public
const PUBLIC_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/logout", "/api/", "/_next/", "/favicon"];

// Auth pages that logged-in users should be redirected away from
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some(p => pathname.startsWith(p));
}

// Protected prefixes — routes that require a valid session
const PROTECTED_PREFIXES = ["/worker", "/client", "/admin", "/agents"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function withSessionHeaders(req: NextRequest, session: Awaited<ReturnType<typeof decodeSession>>) {
  if (!session) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-semse-user-id", session.userId);
  requestHeaders.set("x-semse-tenant-id", session.tenantId);
  requestHeaders.set("x-semse-org-id", session.orgId);
  requestHeaders.set("x-semse-roles", session.roles.join(","));

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (pathname === "/como-funciona") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("semse_usage_guide", "1");
    return NextResponse.rewrite(url);
  }

  // ── 1. Skip static + public routes ─────────────────────────────────────────
  if (isPublic(pathname)) {
    const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
    const session = sessionCookie ? await decodeSession(sessionCookie) : null;

    // If already logged in and visiting an auth page, redirect to their dashboard
    if (isAuthPage(pathname) && session) {
      const role = roleFromRoles(session.roles);
      const redirectTarget = resolveSafeRedirectPath(req.nextUrl.searchParams.get("from"), defaultDashboardForRole(role));
      return NextResponse.redirect(new URL(redirectTarget, req.url));
    }

    if (pathname.startsWith("/api/")) {
      return withSessionHeaders(req, session);
    }

    return NextResponse.next();
  }

  // ── 2. Non-protected routes: pass through ──────────────────────────────────
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  // ── 3. Check session cookie ─────────────────────────────────────────────────
  const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;

  if (!sessionCookie) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  const session = await decodeSession(sessionCookie);

  if (!session) {
    // Invalid or expired session — clear cookie and redirect to login
    const url = new URL("/login", req.url);
    url.searchParams.set("expired", "1");
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // ── 4. Role-based route enforcement ────────────────────────────────────────
  // Prevent a worker from accessing /admin/*, a client from /worker/*, etc.
  const role = roleFromRoles(session.roles);
  const ownedPrefixes: Record<typeof role, string[]> = {
    worker: ["/worker", "/agents"],
    client: ["/client", "/agents"],
    admin:  ["/worker", "/client", "/admin", "/agents"], // admin sees all
  };

  const allowed = ownedPrefixes[role].some(p => pathname.startsWith(p));

  if (!allowed) {
    // Redirect to their correct dashboard instead of 403
    const url = req.nextUrl.clone();
    url.pathname = defaultDashboardForRole(role);
    return NextResponse.redirect(url);
  }

  // ── 5. Forward session identity as REQUEST headers ─────────────────────────
  // Use NextResponse.next({ request }) so that API route handlers and RSC
  // can read x-semse-* headers from the incoming request object.
  return withSessionHeaders(req, session);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image  (image optimization)
     * - favicon.ico
     * - public files (e.g. images, robots.txt)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf|css|js)).*)",
  ],
};
