import assert from "node:assert/strict";
import test from "node:test";

import { AccessTokenBootstrapper } from "../../apps/web/app/api/semse/_access-token-bootstrap.ts";

function tokenResponse(token: string, accessExpiresAt?: string) {
  return new Response(
    JSON.stringify({ data: { accessToken: token, accessExpiresAt } }),
    { status: 201, headers: { "content-type": "application/json" } },
  );
}

function rateLimitedResponse(retryAfterSeconds?: number) {
  return new Response("Too Many Requests", {
    status: 429,
    headers: retryAfterSeconds !== undefined ? { "retry-after": String(retryAfterSeconds) } : {},
  });
}

function baseParams(overrides: Partial<Parameters<AccessTokenBootstrapper["getToken"]>[1]> = {}) {
  return {
    apiBaseUrl: "http://127.0.0.1:4000",
    tenantId: "tnt_demo",
    orgId: "org_pro_001",
    userId: "usr_worker_001",
    roles: ["PRO"],
    bootstrapHeaders: { "x-semse-bootstrap-token": "test-token" },
    ...overrides,
  };
}

test("concurrent calls for the same identity share one in-flight bootstrap request", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return tokenResponse("token-1");
  }) as typeof fetch;

  const bootstrapper = new AccessTokenBootstrapper(fetchImpl, async () => {});
  const params = baseParams();

  const results = await Promise.all([
    bootstrapper.getToken("key-a", params),
    bootstrapper.getToken("key-a", params),
    bootstrapper.getToken("key-a", params),
    bootstrapper.getToken("key-a", params),
    bootstrapper.getToken("key-a", params),
  ]);

  assert.equal(calls, 1, "only one POST /v1/auth/token should fire for 5 concurrent callers");
  assert.deepEqual(results, ["token-1", "token-1", "token-1", "token-1", "token-1"]);
});

test("different identities (cacheKeys) are not deduplicated against each other", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return tokenResponse(`token-${calls}`);
  }) as typeof fetch;

  const bootstrapper = new AccessTokenBootstrapper(fetchImpl, async () => {});

  const [a, b] = await Promise.all([
    bootstrapper.getToken("key-a", baseParams({ userId: "usr_a" })),
    bootstrapper.getToken("key-b", baseParams({ userId: "usr_b" })),
  ]);

  assert.equal(calls, 2);
  assert.notEqual(a, b);
});

test("a cached, non-expired token is reused without hitting the network", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return tokenResponse("token-1", new Date(Date.now() + 60 * 60 * 1000).toISOString());
  }) as typeof fetch;

  const bootstrapper = new AccessTokenBootstrapper(fetchImpl, async () => {});
  const params = baseParams();

  const first = await bootstrapper.getToken("key-a", params);
  const second = await bootstrapper.getToken("key-a", params);

  assert.equal(first, "token-1");
  assert.equal(second, "token-1");
  assert.equal(calls, 1, "the second call should reuse the cached token instead of re-fetching");
});

test("a 429 is retried once, honoring Retry-After, then succeeds", async () => {
  const responses = [rateLimitedResponse(0.01), tokenResponse("token-after-retry")];
  let calls = 0;
  const fetchImpl = (async () => {
    const response = responses[calls];
    calls++;
    return response;
  }) as typeof fetch;

  const sleeps: number[] = [];
  const bootstrapper = new AccessTokenBootstrapper(fetchImpl, async (ms) => { sleeps.push(ms); });

  const token = await bootstrapper.getToken("key-a", baseParams());

  assert.equal(token, "token-after-retry");
  assert.equal(calls, 2, "should retry exactly once after a 429");
  assert.deepEqual(sleeps, [10], "should sleep for the Retry-After duration (in ms)");
});

test("a 429 with no Retry-After header falls back to a default backoff", async () => {
  const responses = [rateLimitedResponse(), tokenResponse("token-after-retry")];
  let calls = 0;
  const fetchImpl = (async () => responses[calls++]) as typeof fetch;
  const sleeps: number[] = [];
  const bootstrapper = new AccessTokenBootstrapper(fetchImpl, async (ms) => { sleeps.push(ms); });

  await bootstrapper.getToken("key-a", baseParams());

  assert.deepEqual(sleeps, [1_500]);
});

test("two consecutive 429s give up gracefully and return undefined (no crash)", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return rateLimitedResponse(0.001);
  }) as typeof fetch;

  const bootstrapper = new AccessTokenBootstrapper(fetchImpl, async () => {});
  const token = await bootstrapper.getToken("key-a", baseParams());

  assert.equal(token, undefined);
  assert.equal(calls, 2, "should attempt exactly twice before giving up");
});

test("a network error (thrown fetch) returns undefined instead of throwing", async () => {
  const fetchImpl = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  const bootstrapper = new AccessTokenBootstrapper(fetchImpl, async () => {});

  const token = await bootstrapper.getToken("key-a", baseParams());

  assert.equal(token, undefined);
});

test("a malformed 200 response (no accessToken in body) returns undefined", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ data: {} }), { status: 200 })) as typeof fetch;
  const bootstrapper = new AccessTokenBootstrapper(fetchImpl, async () => {});

  const token = await bootstrapper.getToken("key-a", baseParams());

  assert.equal(token, undefined);
});
