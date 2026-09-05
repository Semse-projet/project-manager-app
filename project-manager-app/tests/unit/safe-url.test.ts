/**
 * Unit tests for @semse/shared's SSRF-hardened URL validation
 * (docs/specs/satellites/SAT-007-outbound-webhooks.spec.md §8).
 * Run: node --experimental-strip-types --test tests/unit/safe-url.test.ts
 *
 * resolveSafeUrl() is tested with IP-literal hostnames (e.g. "8.8.8.8") —
 * Node's dns.lookup() resolves those locally without any real DNS query or
 * network access, so these assertions are fully deterministic offline.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { isIpv4Safe, isIpv6Safe, isIpSafe, resolveSafeUrl } from "@semse/shared";

test("isIpv4Safe accepts public addresses and rejects loopback/private/link-local/CGNAT/multicast", () => {
  assert.equal(isIpv4Safe("8.8.8.8"), true);
  assert.equal(isIpv4Safe("1.1.1.1"), true);
  assert.equal(isIpv4Safe("93.184.216.34"), true);

  assert.equal(isIpv4Safe("127.0.0.1"), false);
  assert.equal(isIpv4Safe("0.0.0.0"), false);
  assert.equal(isIpv4Safe("10.0.0.1"), false);
  assert.equal(isIpv4Safe("172.16.0.1"), false);
  assert.equal(isIpv4Safe("172.31.255.255"), false);
  assert.equal(isIpv4Safe("172.32.0.1"), true); // just outside 172.16.0.0/12
  assert.equal(isIpv4Safe("192.168.1.1"), false);
  assert.equal(isIpv4Safe("169.254.1.1"), false);
  assert.equal(isIpv4Safe("100.64.0.1"), false); // CGNAT
  assert.equal(isIpv4Safe("100.127.255.255"), false);
  assert.equal(isIpv4Safe("100.128.0.1"), true); // just outside 100.64.0.0/10
  assert.equal(isIpv4Safe("224.0.0.1"), false); // multicast
  assert.equal(isIpv4Safe("255.255.255.255"), false);
});

test("isIpv6Safe accepts public addresses and rejects loopback/unspecified/link-local/unique-local, unwrapping IPv4-mapped addresses", () => {
  assert.equal(isIpv6Safe("2606:4700:4700::1111"), true); // Cloudflare DNS
  assert.equal(isIpv6Safe("::1"), false);
  assert.equal(isIpv6Safe("::"), false);
  assert.equal(isIpv6Safe("fe80::1"), false);
  assert.equal(isIpv6Safe("fc00::1"), false);
  assert.equal(isIpv6Safe("fd12:3456:789a::1"), false);
  // IPv4-mapped: must validate the embedded IPv4, not just "looks IPv6".
  assert.equal(isIpv6Safe("::ffff:127.0.0.1"), false);
  assert.equal(isIpv6Safe("::ffff:10.0.0.1"), false);
  assert.equal(isIpv6Safe("::ffff:8.8.8.8"), true);
});

test("isIpSafe dispatches by family", () => {
  assert.equal(isIpSafe("8.8.8.8", 4), true);
  assert.equal(isIpSafe("127.0.0.1", 4), false);
  assert.equal(isIpSafe("2606:4700:4700::1111", 6), true);
  assert.equal(isIpSafe("::1", 6), false);
});

test("resolveSafeUrl rejects non-https schemes", async () => {
  const result = await resolveSafeUrl("http://8.8.8.8/webhook");
  assert.equal(result.safe, false);
  if (!result.safe) assert.equal(result.reason, "scheme_must_be_https");
});

test("resolveSafeUrl rejects an invalid URL string", async () => {
  const result = await resolveSafeUrl("not a url");
  assert.equal(result.safe, false);
  if (!result.safe) assert.equal(result.reason, "invalid_url");
});

test("resolveSafeUrl rejects localhost and loopback hostnames outright, before any DNS lookup", async () => {
  for (const host of ["localhost", "foo.localhost", "loopback"]) {
    const result = await resolveSafeUrl(`https://${host}/webhook`);
    assert.equal(result.safe, false, `expected ${host} to be rejected`);
    if (!result.safe) assert.equal(result.reason, "loopback_hostname");
  }
});

test("resolveSafeUrl rejects an IP-literal hostname resolving to a private/loopback address", async () => {
  for (const host of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.1.1", "0.0.0.0"]) {
    const result = await resolveSafeUrl(`https://${host}/webhook`);
    assert.equal(result.safe, false, `expected ${host} to be rejected`);
  }
});

test("resolveSafeUrl accepts a public IP-literal https URL and returns the pinnable IP/port", async () => {
  const result = await resolveSafeUrl("https://8.8.8.8:8443/webhook");
  assert.equal(result.safe, true);
  if (result.safe) {
    assert.equal(result.ip, "8.8.8.8");
    assert.equal(result.hostname, "8.8.8.8");
    assert.equal(result.family, 4);
    assert.equal(result.port, 8443);
  }
});

test("resolveSafeUrl defaults to port 443 when none is specified", async () => {
  const result = await resolveSafeUrl("https://8.8.8.8/webhook");
  assert.equal(result.safe, true);
  if (result.safe) assert.equal(result.port, 443);
});

test("resolveSafeUrl rejects a public IPv6-literal loopback/unique-local address the same as IPv4", async () => {
  const loopback = await resolveSafeUrl("https://[::1]/webhook");
  assert.equal(loopback.safe, false);

  const publicV6 = await resolveSafeUrl("https://[2606:4700:4700::1111]/webhook");
  assert.equal(publicV6.safe, true);
  if (publicV6.safe) assert.equal(publicV6.family, 6);
});
