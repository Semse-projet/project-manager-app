/**
 * GET /logout — Clears session cookie and redirects to /login
 */
import { type NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export function GET(_req: NextRequest): NextResponse {
  const res = NextResponse.redirect(new URL("/login", _req.url));
  res.headers.set("Set-Cookie", clearSessionCookie());
  return res;
}
