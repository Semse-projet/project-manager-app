// Client IP for the BFF to forward to the API's rate limiter (KIT-F3-04).
//
// Framework-agnostic (no next/server import) so it runs under `node --test`,
// like _access-token-bootstrap.ts.

import { isIP } from "node:net";

type HeaderReader = { get(name: string): string | null };

/**
 * The right-most X-Forwarded-For hop: the one appended by the proxy in front of
 * the web server. Entries to its left come from the client, who could rotate a
 * made-up IP on every attempt to get a fresh rate-limit bucket.
 */
export function clientIpFromHeaders(headers: HeaderReader): string | undefined {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  const candidate = forwardedFor || headers.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) ? candidate : undefined;
}
