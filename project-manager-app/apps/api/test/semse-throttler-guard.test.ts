import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";
import { Reflector } from "@nestjs/core";
import { ThrottlerException, ThrottlerStorageService } from "@nestjs/throttler";
import { resolveThrottleTracker, SemseThrottlerGuard } from "../dist/common/semse-throttler.guard.js";
import { signToken } from "../dist/common/auth-token.js";

// KIT-F3-04 (docs/semse-kit/test-matrix.md): the stock tracker is the socket IP,
// and every web user reaches the API from the BFF's IP, so the whole platform
// shared one bucket per handler (5 logins/min, 5 token bootstraps/min, and
// RATE_LIMIT_LIMIT requests/min for everything else).

const SECRET = "test-auth-secret-0123456789abcdef";
const BOOTSTRAP = "test-bootstrap-token";
const BFF_IP = "10.0.0.7";

function withEnv(env: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  return async () => {
    const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
    Object.assign(process.env, env);
    for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key];
    try {
      await fn();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };
}

const ENV = { AUTH_SECRET: SECRET, SEMSE_BOOTSTRAP_TOKEN: BOOTSTRAP };

function accessToken(userId: string, ttlSeconds = 3600) {
  return signToken({ userId, tenantId: "tenant_1", orgId: "org_1", roles: ["CLIENT"], sid: `ses_${userId}`, typ: "access" }, SECRET, ttlSeconds);
}

test("no credentials: the socket IP, as before", withEnv(ENV, () => {
  assert.equal(resolveThrottleTracker({ ip: BFF_IP, headers: {} }), `ip:${BFF_IP}`);
}));

test("a forwarded client IP is ignored without the bootstrap token", withEnv(ENV, () => {
  const spoofed = { ip: "198.51.100.9", headers: { "x-semse-client-ip": "203.0.113.1", "x-forwarded-for": "203.0.113.2" } };
  assert.equal(resolveThrottleTracker(spoofed), "ip:198.51.100.9");
  const wrongToken = { ip: "198.51.100.9", headers: { "x-semse-bootstrap-token": "guess", "x-semse-client-ip": "203.0.113.1" } };
  assert.equal(resolveThrottleTracker(wrongToken), "ip:198.51.100.9");
}));

test("an unset bootstrap token never makes a caller trusted", withEnv({ ...ENV, SEMSE_BOOTSTRAP_TOKEN: undefined }, () => {
  const request = { ip: BFF_IP, headers: { "x-semse-bootstrap-token": "", "x-semse-client-ip": "203.0.113.1" } };
  assert.equal(resolveThrottleTracker(request), `ip:${BFF_IP}`);
}));

test("the BFF: forwarded client IP, or the identity it bootstraps a token for", withEnv(ENV, () => {
  const login = { ip: BFF_IP, headers: { "x-semse-bootstrap-token": BOOTSTRAP, "x-semse-client-ip": "203.0.113.1" }, body: { email: "a@b.c" } };
  assert.equal(resolveThrottleTracker(login), "ip:203.0.113.1");

  const tokenBootstrap = { ip: BFF_IP, headers: { "x-semse-bootstrap-token": BOOTSTRAP }, body: { tenantId: "tenant_1", userId: "usr_9" } };
  assert.equal(resolveThrottleTracker(tokenBootstrap), "identity:tenant_1:usr_9");

  const notAnIp = { ip: BFF_IP, headers: { "x-semse-bootstrap-token": BOOTSTRAP, "x-semse-client-ip": "unknown" } };
  assert.equal(resolveThrottleTracker(notAnIp), `ip:${BFF_IP}`);
}));

test("the BFF's forwarded IP wins over the server's static Bearer identity", withEnv(ENV, () => {
  const mobileLogin = {
    ip: BFF_IP,
    headers: { authorization: `Bearer ${accessToken("usr_static_ops")}`, "x-semse-bootstrap-token": BOOTSTRAP, "x-semse-client-ip": "203.0.113.4" },
  };
  assert.equal(resolveThrottleTracker(mobileLogin), "ip:203.0.113.4");
}));

test("a correctly signed access token: its user", withEnv(ENV, () => {
  assert.equal(resolveThrottleTracker({ ip: BFF_IP, headers: { authorization: `Bearer ${accessToken("usr_1")}` } }), "user:tenant_1:usr_1");
}));

test("forged, foreign-secret or expired tokens fall back to the IP", withEnv(ENV, () => {
  const forged = `${Buffer.from(JSON.stringify({ userId: "usr_x", tenantId: "t", orgId: "o", roles: [], exp: 9e9 })).toString("base64url")}.sig`;
  const foreign = signToken({ userId: "usr_y", tenantId: "t", orgId: "o", roles: [] }, "another-secret-0123456789abcdef");
  const expired = accessToken("usr_z", -10);
  for (const token of [forged, foreign, expired, "garbage"]) {
    assert.equal(resolveThrottleTracker({ ip: "198.51.100.9", headers: { authorization: `Bearer ${token}` } }), "ip:198.51.100.9");
  }
}));

// --- End-to-end through the real ThrottlerGuard machinery -------------------

class FakeAuthController {
  login() {}
}

async function makeGuard() {
  const guard = new SemseThrottlerGuard([{ ttl: 60_000, limit: 5 }], new ThrottlerStorageService(), new Reflector());
  await guard.onModuleInit();
  return guard;
}

function http(request: Record<string, unknown>) {
  const response = { header: () => response };
  return {
    getHandler: () => FakeAuthController.prototype.login,
    getClass: () => FakeAuthController,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    getType: () => "http",
  } as never;
}

test("six visitors logging in through the BFF in the same minute all get through", withEnv(ENV, async () => {
  const guard = await makeGuard();
  for (let i = 1; i <= 6; i++) {
    const request = { ip: BFF_IP, headers: { "x-semse-bootstrap-token": BOOTSTRAP, "x-semse-client-ip": `203.0.113.${i}` } };
    assert.equal(await guard.canActivate(http(request)), true, `visitor ${i}`);
  }
}));

test("one visitor is still limited, and so is an untrusted caller rotating forwarded IPs", withEnv(ENV, async () => {
  const guard = await makeGuard();
  const sameVisitor = { ip: BFF_IP, headers: { "x-semse-bootstrap-token": BOOTSTRAP, "x-semse-client-ip": "203.0.113.50" } };
  for (let i = 0; i < 5; i++) await guard.canActivate(http(sameVisitor));
  await assert.rejects(guard.canActivate(http(sameVisitor)), ThrottlerException);

  for (let i = 0; i < 5; i++) {
    await guard.canActivate(http({ ip: "198.51.100.9", headers: { "x-semse-client-ip": `203.0.113.${100 + i}` } }));
  }
  await assert.rejects(
    guard.canActivate(http({ ip: "198.51.100.9", headers: { "x-semse-client-ip": "203.0.113.200" } })),
    ThrottlerException,
  );
}));
