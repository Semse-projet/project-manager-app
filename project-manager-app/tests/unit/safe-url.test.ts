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

import {
  fetchAllowlistedHttps,
  isHostAllowed,
  isIpv4Safe,
  isIpv6Safe,
  isIpSafe,
  parseHostnameAllowlist,
  resolveAllowlistedSafeUrl,
  resolveSafeUrl,
} from "@semse/shared";

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

test("parseHostnameAllowlist trims, lowercases and drops empties", () => {
  assert.deepEqual(parseHostnameAllowlist(" API.semseproject.com, app.semseproject.com, ,API.semseproject.com "), [
    "api.semseproject.com",
    "app.semseproject.com",
  ]);
});

test("isHostAllowed matches exact hosts and optional wildcard suffixes", () => {
  assert.equal(isHostAllowed("api.semseproject.com", ["api.semseproject.com"]), true);
  assert.equal(isHostAllowed("cdn.semseproject.com", ["api.semseproject.com"]), false);
  assert.equal(isHostAllowed("cdn.semseproject.com", ["*.semseproject.com"]), true);
  assert.equal(isHostAllowed("semseproject.com", ["*.semseproject.com"]), true);
});

test("resolveAllowlistedSafeUrl is fail-closed when the allowlist is empty", async () => {
  const result = await resolveAllowlistedSafeUrl("https://8.8.8.8/file.jpg", { allowedHosts: [] });
  assert.equal(result.safe, false);
  if (!result.safe) assert.equal(result.reason, "allowlist_empty");
});

test("resolveAllowlistedSafeUrl rejects a public host that is not on the allowlist", async () => {
  const result = await resolveAllowlistedSafeUrl("https://1.1.1.1/file.jpg", { allowedHosts: ["8.8.8.8"] });
  assert.equal(result.safe, false);
  if (!result.safe) assert.match(result.reason, /host_not_allowlisted/);
});

test("resolveAllowlistedSafeUrl still rejects loopback and http even when the host is listed", async () => {
  const loopback = await resolveAllowlistedSafeUrl("https://127.0.0.1/file.jpg", { allowedHosts: ["127.0.0.1"] });
  assert.equal(loopback.safe, false);

  const http = await resolveAllowlistedSafeUrl("http://8.8.8.8/file.jpg", { allowedHosts: ["8.8.8.8"] });
  assert.equal(http.safe, false);

  const ok = await resolveAllowlistedSafeUrl("https://8.8.8.8/file.jpg", { allowedHosts: ["8.8.8.8"] });
  assert.equal(ok.safe, true);
});

test("fetchAllowlistedHttps refuses a redirect to a private or off-list host", async () => {
  const fetchImpl = async (url: string) => {
    if (url === "https://8.8.8.8/start") {
      return new Response(null, { status: 302, headers: { Location: "https://127.0.0.1/secret" } });
    }
    if (url === "https://8.8.8.8/other") {
      return new Response(null, { status: 302, headers: { Location: "https://1.1.1.1/x" } });
    }
    return new Response("nope", { status: 200 });
  };

  const toLoopback = await fetchAllowlistedHttps("https://8.8.8.8/start", {
    allowedHosts: ["8.8.8.8"],
    fetchImpl: fetchImpl as typeof fetch,
  });
  assert.equal(toLoopback.ok, false);
  if (!toLoopback.ok) assert.match(toLoopback.reason, /unsafe_resolved_address|loopback/);

  const offList = await fetchAllowlistedHttps("https://8.8.8.8/other", {
    allowedHosts: ["8.8.8.8"],
    fetchImpl: fetchImpl as typeof fetch,
  });
  assert.equal(offList.ok, false);
  if (!offList.ok) assert.match(offList.reason, /host_not_allowlisted/);
});

test("fetchAllowlistedHttps follows an allowlisted https redirect and returns the final body", async () => {
  const fetchImpl = async (url: string) => {
    if (url === "https://8.8.8.8/start") {
      return new Response(null, { status: 302, headers: { Location: "/ok" } });
    }
    if (url === "https://8.8.8.8/ok") {
      return new Response("safe-bytes", { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const result = await fetchAllowlistedHttps("https://8.8.8.8/start", {
    allowedHosts: ["8.8.8.8"],
    fetchImpl: fetchImpl as typeof fetch,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.finalUrl, "https://8.8.8.8/ok");
    assert.equal(await result.response.text(), "safe-bytes");
  }
});
