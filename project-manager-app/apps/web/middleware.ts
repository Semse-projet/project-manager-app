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
 *   /, /login, /logout, public SEMSE API allowlist, /_next/*, /favicon*
 *
 * Orphan legacy routes: always redirected, never rendered
 *   /dashboard, /field-ops (pre-date the (app)/(public) split — see audit 1.6/1.7)
 */

import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, decodeSession, roleFromRoles, defaultDashboardForRole } from "@/lib/auth";
import { resolveSafeRedirectPath } from "@/lib/safe-redirect";
import { buildSemseApiUnauthorizedBody, isPublicSemseApiPath, isSemseApiPath } from "@/lib/semse-api-auth";

// Paths that are always public
const PUBLIC_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/logout", "/_next/", "/favicon"];

// Auth pages that logged-in users should be redirected away from
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

// Orphan legacy routes (pre-date the (app)/(public) route groups): they render
// outside the real role-scoped app shell — no nav, stale zero-state data, and
// (in the case of /dashboard) an internal "Mission Control" migration banner
// that has no business being shown to a client or worker. Always bounce them
// to the correct destination instead of letting the legacy page render
// (audit 1.6 / 1.7).
const ORPHAN_PREFIXES = ["/dashboard", "/field-ops"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some(p => pathname.startsWith(p));
}

function isOrphan(pathname: string): boolean {
  return ORPHAN_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

// Protected prefixes — routes that require a valid session
const PROTECTED_PREFIXES = ["/worker", "/client", "/admin", "/agents"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

const SEMSE_IDENTITY_HEADERS = ["x-semse-user-id", "x-semse-tenant-id", "x-semse-org-id", "x-semse-roles"];

function withSessionHeaders(req: NextRequest, session: Awaited<ReturnType<typeof decodeSession>>) {
  const requestHeaders = new Headers(req.headers);

  // Always strip caller-supplied identity headers first — regardless of
  // whether there's a valid session. Previously these were only overwritten
  // in the `session` branch, so a request with no/invalid session forwarded
  // whatever x-semse-* headers the caller sent, unexamined.
  for (const name of SEMSE_IDENTITY_HEADERS) requestHeaders.delete(name);

  if (session) {
    requestHeaders.set("x-semse-user-id", session.userId);
    requestHeaders.set("x-semse-tenant-id", session.tenantId);
    requestHeaders.set("x-semse-org-id", session.orgId);
    requestHeaders.set("x-semse-roles", session.roles.join(","));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

function unauthorizedApiResponse(req: NextRequest, clearSessionCookie: boolean): NextResponse {
  const res = NextResponse.json(buildSemseApiUnauthorizedBody(), {
    status: 401,
    headers: { "cache-control": "no-store" },
  });

  if (clearSessionCookie) {
    res.cookies.delete(SESSION_COOKIE);
  }

  return res;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (pathname === "/como-funciona") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("semse_usage_guide", "1");
    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith("/api/")) {
    const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
    const session = sessionCookie ? await decodeSession(sessionCookie) : null;

    if (!isSemseApiPath(pathname) || isPublicSemseApiPath(pathname)) {
      return withSessionHeaders(req, session);
    }

    if (!session) {
      return unauthorizedApiResponse(req, Boolean(sessionCookie));
    }

    return withSessionHeaders(req, session);
  }

  // ── 1. Orphan legacy routes: never render, always redirect ─────────────────
  if (isOrphan(pathname)) {
    const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
    const session = sessionCookie ? await decodeSession(sessionCookie) : null;

    if (!session) {
      const url = new URL("/login", req.url);
      url.searchParams.set("from", `${pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(url);
    }

    const role = roleFromRoles(session.roles);
    const url = req.nextUrl.clone();
    url.pathname = defaultDashboardForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  // ── 2. Skip static + public routes ─────────────────────────────────────────
  if (isPublic(pathname)) {
    const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
    const session = sessionCookie ? await decodeSession(sessionCookie) : null;

    // If already logged in and visiting an auth page, redirect to their dashboard
    if (isAuthPage(pathname) && session) {
      const role = roleFromRoles(session.roles);
      const redirectTarget = resolveSafeRedirectPath(req.nextUrl.searchParams.get("from"), defaultDashboardForRole(role));
      return NextResponse.redirect(new URL(redirectTarget, req.url));
    }

    return NextResponse.next();
  }

  // ── 3. Non-protected routes: pass through ──────────────────────────────────
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  // ── 4. Check session cookie ─────────────────────────────────────────────────
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
    url.searchParams.set("from", `${pathname}${req.nextUrl.search}`);
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // ── 5. Role-based route enforcement ────────────────────────────────────────
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

  // ── 6. Forward session identity as REQUEST headers ─────────────────────────
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
