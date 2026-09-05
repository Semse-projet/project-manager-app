// ─────────────────────────────────────────────────────────────────────────────
// SSRF-hardened URL validation, shared between apps/api (satellite webhooks)
// and packages/autonomy (browser agent). See docs/specs/satellites/
// SAT-007-outbound-webhooks.spec.md §8 — this is a stricter superset of
// packages/autonomy/src/browser/secure-network-gateway.ts, which only
// resolves one address via `dns.lookup(host)` (no `{ all: true }`, so it
// can miss a coexisting unsafe AAAA/A record). This module resolves and
// validates every address a hostname returns, for both families.
// ─────────────────────────────────────────────────────────────────────────────

import { lookup } from "node:dns/promises";

export type SafeUrlResult =
  | { safe: true; hostname: string; ip: string; family: 4 | 6; port: number }
  | { safe: false; reason: string };

const IPV4_MAPPED_PREFIX = "::ffff:";

/**
 * True only for a public, routable IPv4 address — rejects loopback,
 * unspecified, private (RFC1918), link-local, shared address space
 * (RFC6598, common in carrier-grade NAT and easy to overlook), and
 * multicast/reserved ranges.
 */
export function isIpv4Safe(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;

  if (a === 0) return false; // 0.0.0.0/8
  if (a === 127) return false; // 127.0.0.0/8 loopback
  if (a === 10) return false; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
  if (a === 192 && b === 168) return false; // 192.168.0.0/16
  if (a === 169 && b === 254) return false; // 169.254.0.0/16 link-local
  if (a === 100 && b >= 64 && b <= 127) return false; // 100.64.0.0/10 CGNAT
  if (a >= 224) return false; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved

  return true;
}

/**
 * True only for a public, routable IPv6 address — rejects loopback (::1),
 * unspecified (::), link-local (fe80::/10), unique local (fc00::/7), and
 * unwraps IPv4-mapped addresses (::ffff:a.b.c.d) to validate the embedded
 * IPv4 address instead of trusting the wrapper.
 */
export function isIpv6Safe(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower.startsWith(IPV4_MAPPED_PREFIX)) {
    return isIpv4Safe(lower.slice(IPV4_MAPPED_PREFIX.length));
  }
  if (lower === "::1" || lower === "::" || lower === "0:0:0:0:0:0:0:1" || lower === "0:0:0:0:0:0:0:0") {
    return false;
  }
  // fe80::/10 link-local
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return false;
  // fc00::/7 unique local (fc00:: through fdff::)
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return false;

  return true;
}

export function isIpSafe(ip: string, family: 4 | 6): boolean {
  return family === 4 ? isIpv4Safe(ip) : isIpv6Safe(ip);
}

/**
 * Validates a URL against SSRF, resolving DNS and checking **every**
 * returned address (A and AAAA) — a hostname that resolves to a mix of
 * safe and unsafe addresses is rejected outright, since that mix is itself
 * a rebinding setup, not a coincidence. Only `https:` is accepted (per
 * SAT-007 spec §8 — registered satellite webhook URLs must be HTTPS).
 *
 * Returns the resolved IP so callers can pin their HTTP connection to it
 * (never re-resolve DNS between this check and the actual connect — see
 * SAT-007 spec §8 point 2 on DNS rebinding).
 */
export async function resolveSafeUrl(rawUrl: string): Promise<SafeUrlResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "invalid_url" };
  }

  if (url.protocol !== "https:") {
    return { safe: false, reason: "scheme_must_be_https" };
  }

  // URL.hostname keeps the enclosing brackets for an IPv6 literal
  // ("[::1]") — strip them before treating it as a hostname/address to
  // resolve, or dns.lookup() rejects it outright as an invalid address.
  const rawHostname = url.hostname.toLowerCase();
  const hostname =
    rawHostname.startsWith("[") && rawHostname.endsWith("]")
      ? rawHostname.slice(1, -1)
      : rawHostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "loopback") {
    return { safe: false, reason: "loopback_hostname" };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return { safe: false, reason: "dns_resolution_failed" };
  }
  if (addresses.length === 0) {
    return { safe: false, reason: "dns_resolution_failed" };
  }

  for (const candidate of addresses) {
    const family = candidate.family === 6 ? 6 : 4;
    if (!isIpSafe(candidate.address, family)) {
      return { safe: false, reason: `unsafe_resolved_address:${candidate.address}` };
    }
  }

  const chosen = addresses[0]!;
  const port = url.port ? Number(url.port) : 443;
  return {
    safe: true,
    hostname,
    ip: chosen.address,
    family: chosen.family === 6 ? 6 : 4,
    port,
  };
}
