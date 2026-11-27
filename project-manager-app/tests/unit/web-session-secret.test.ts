import assert from "node:assert/strict";
import test from "node:test";
import { decodeSession, devSessionOptIn, encodeSession, MIN_SESSION_SECRET_LENGTH } from "../../apps/web/lib/auth.ts";

const SECRET = "x".repeat(MIN_SESSION_SECRET_LENGTH);

function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  return fn().finally(() => {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
}

test("dev session opt-in requires development or test plus the explicit flag", () => {
  assert.equal(devSessionOptIn({}), false);
  assert.equal(devSessionOptIn({ NODE_ENV: "development" }), false);
  assert.equal(devSessionOptIn({ NODE_ENV: "production", SEMSE_ALLOW_DEV_SESSION: "true" }), false);
  assert.equal(devSessionOptIn({ SEMSE_ALLOW_DEV_SESSION: "true" }), false);
  assert.equal(devSessionOptIn({ NODE_ENV: "development", SEMSE_ALLOW_DEV_SESSION: "true" }), true);
  assert.equal(devSessionOptIn({ NODE_ENV: "test", SEMSE_ALLOW_DEV_SESSION: "true" }), true);
});

test("session cookies require an explicit secret of at least 32 characters", async () => {
  const payload = {
    userId: "usr_1",
    tenantId: "tenant_1",
    orgId: "org_1",
    roles: ["CLIENT"],
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  await withEnv({ SEMSE_WEB_SESSION_SECRET: undefined, AUTH_SECRET: undefined, NODE_ENV: "development" }, async () => {
    await assert.rejects(() => encodeSession(payload), /SEMSE_WEB_SESSION_SECRET or AUTH_SECRET/);
  });

  await withEnv({ SEMSE_WEB_SESSION_SECRET: "short-secret", AUTH_SECRET: SECRET, NODE_ENV: "development" }, async () => {
    await assert.rejects(() => encodeSession(payload), /SEMSE_WEB_SESSION_SECRET or AUTH_SECRET/);
  });

  await withEnv({ SEMSE_WEB_SESSION_SECRET: undefined, AUTH_SECRET: SECRET, NODE_ENV: undefined }, async () => {
    const cookie = await encodeSession(payload);
    const decoded = await decodeSession(cookie);
    assert.equal(decoded?.userId, "usr_1");
    assert.equal(await decodeSession("forged.cookie"), null);
  });
});

test("legacy demo identities are rejected unless the dev opt-in is set", async () => {
  const payload = {
    userId: "usr_admin_001",
    tenantId: "tenant_default",
    orgId: "org_admin_001",
    roles: ["OPS_ADMIN"],
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  await withEnv({
    AUTH_SECRET: SECRET,
    SEMSE_WEB_SESSION_SECRET: undefined,
    SEMSE_ALLOW_DEV_SESSION: undefined,
    NODE_ENV: "development",
  }, async () => {
    const cookie = await encodeSession(payload);
    assert.equal(await decodeSession(cookie), null);
  });

  await withEnv({
    AUTH_SECRET: SECRET,
    SEMSE_WEB_SESSION_SECRET: undefined,
    SEMSE_ALLOW_DEV_SESSION: "true",
    NODE_ENV: "development",
  }, async () => {
    const cookie = await encodeSession(payload);
    assert.equal((await decodeSession(cookie))?.userId, "usr_admin_001");
  });
});
