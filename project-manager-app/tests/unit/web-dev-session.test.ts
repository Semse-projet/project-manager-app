/**
 * Audit A3 (2026-11-25): no hard-coded web session secret, and local-only demo
 * sessions require an explicit opt-in (mirrors the API's headerIdentityAllowed).
 *
 * Run: node --experimental-strip-types --test tests/unit/web-dev-session.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEV_SESSION_OPT_IN_ENV,
  MIN_SESSION_SECRET_LENGTH,
  devSessionAllowed,
  resolveWebSessionSecret,
} from "../../apps/web/lib/dev-session.ts";
import { decodeSession, encodeSession, type SessionPayload } from "../../apps/web/lib/auth.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SECRET = "a".repeat(MIN_SESSION_SECRET_LENGTH);
const now = Math.floor(Date.now() / 1000);
const DEMO_ADMIN: SessionPayload = {
  userId: "usr_admin_001",
  tenantId: "tenant_default",
  orgId: "org_admin_001",
  roles: ["OPS_ADMIN"],
  exp: now + 3600,
};
const REAL_USER: SessionPayload = { ...DEMO_ADMIN, userId: "usr_real_123", roles: ["CLIENT"] };

function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  return async () => {
    const saved: Record<string, string | undefined> = {};
    for (const key of ["NODE_ENV", "SEMSE_WEB_SESSION_SECRET", "AUTH_SECRET", DEV_SESSION_OPT_IN_ENV, "DEMO_MODE_ENABLED"]) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(env)) if (value !== undefined) process.env[key] = value;
    try {
      await fn();
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };
}

test("devSessionAllowed: only development/test with SEMSE_ALLOW_DEV_SESSION=true", () => {
  assert.equal(devSessionAllowed({ NODE_ENV: "development", SEMSE_ALLOW_DEV_SESSION: "true" }), true);
  assert.equal(devSessionAllowed({ NODE_ENV: "test", SEMSE_ALLOW_DEV_SESSION: " true " }), true);
  assert.equal(devSessionAllowed({ NODE_ENV: "development" }), false);
  assert.equal(devSessionAllowed({ SEMSE_ALLOW_DEV_SESSION: "true" }), false, "unset NODE_ENV fails closed");
  assert.equal(devSessionAllowed({ NODE_ENV: "staging", SEMSE_ALLOW_DEV_SESSION: "true" }), false);
  assert.equal(devSessionAllowed({ NODE_ENV: "production", SEMSE_ALLOW_DEV_SESSION: "true" }), false);
  assert.equal(devSessionAllowed({ NODE_ENV: "development", SEMSE_ALLOW_DEV_SESSION: "yes" }), false);
});

test("resolveWebSessionSecret: no fallback, and at least 32 characters", () => {
  assert.equal(resolveWebSessionSecret({}), null);
  assert.equal(resolveWebSessionSecret({ NODE_ENV: "development", SEMSE_ALLOW_DEV_SESSION: "true" }), null, "dev opt-in does not invent a secret");
  assert.equal(resolveWebSessionSecret({ SEMSE_WEB_SESSION_SECRET: "x".repeat(MIN_SESSION_SECRET_LENGTH - 1) }), null);
  assert.equal(resolveWebSessionSecret({ AUTH_SECRET: `  ${SECRET}  ` }), SECRET);
  assert.equal(resolveWebSessionSecret({ SEMSE_WEB_SESSION_SECRET: SECRET, AUTH_SECRET: "b".repeat(40) }), SECRET);
});

test("the repository no longer carries a usable session secret", () => {
  const auth = fs.readFileSync(path.join(repoRoot, "apps/web/lib/auth.ts"), "utf8");
  assert.ok(!auth.includes("semse-dev-session-secret"));
  assert.ok(!auth.includes("DEV_SESSION_SECRET"));
});

test("without a configured secret, a cookie signed with the old public secret is rejected even in development",
  withEnv({ NODE_ENV: "development", SEMSE_ALLOW_DEV_SESSION: "true" }, async () => {
    await assert.rejects(() => encodeSession(REAL_USER), /SEMSE_WEB_SESSION_SECRET or AUTH_SECRET/);
    process.env.SEMSE_WEB_SESSION_SECRET = "semse-dev-session-secret".padEnd(MIN_SESSION_SECRET_LENGTH, "!");
    const forged = await encodeSession(DEMO_ADMIN);
    delete process.env.SEMSE_WEB_SESSION_SECRET;
    assert.equal(await decodeSession(forged), null);
  }),
);

test("legacy demo identities need the opt-in; real users do not",
  withEnv({ NODE_ENV: "development", SEMSE_WEB_SESSION_SECRET: SECRET }, async () => {
    const demo = await encodeSession(DEMO_ADMIN);
    const real = await encodeSession(REAL_USER);
    assert.equal(await decodeSession(demo), null, "development without opt-in rejects seeded demo identities");
    assert.equal((await decodeSession(real))?.userId, REAL_USER.userId);
    process.env.SEMSE_ALLOW_DEV_SESSION = "true";
    assert.equal((await decodeSession(demo))?.userId, DEMO_ADMIN.userId);
    process.env.NODE_ENV = "staging";
    assert.equal(await decodeSession(demo), null, "staging never honours demo identities");
  }),
);

test("DEMO_AGRO sessions need DEMO_MODE_ENABLED or the local opt-in",
  withEnv({ NODE_ENV: "staging", SEMSE_WEB_SESSION_SECRET: SECRET }, async () => {
    const agro = await encodeSession({ ...REAL_USER, roles: ["DEMO_AGRO"] });
    assert.equal(await decodeSession(agro), null);
    process.env.DEMO_MODE_ENABLED = "true";
    assert.equal((await decodeSession(agro))?.roles[0], "DEMO_AGRO");
  }),
);
