import test from "node:test";
import assert from "node:assert/strict";
import {
  isDisabledDemoIdentity,
  isLegacyDemoLoginEnabled,
  LEGACY_DEMO_ACCOUNTS,
} from "../src/modules/auth/auth-demo-mode.ts";

test("production identifies persisted legacy demo accounts as disabled", (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDemoMode = process.env.SEMSE_DEMO_MODE;
  t.after(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.SEMSE_DEMO_MODE = originalDemoMode;
  });

  process.env.NODE_ENV = "production";
  process.env.SEMSE_DEMO_MODE = "true";

  assert.equal(isLegacyDemoLoginEnabled(), false);
  assert.ok("admin@demo.semse" in LEGACY_DEMO_ACCOUNTS);
  assert.equal(
    isDisabledDemoIdentity("usr_admin_001", ["OPS_ADMIN"]),
    true,
  );
});

import {
  LOCAL_DEV_DEMO_PASSWORD,
  MIN_PRODUCTION_DEMO_PASSWORD_LENGTH,
  demoPasswordMatches,
  resolveDemoLoginPassword,
} from "../src/modules/auth/auth-demo-mode.ts";

test("API demo password: public default only outside production", () => {
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "development" }), LOCAL_DEV_DEMO_PASSWORD);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "production" }), null);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "production", SEMSE_DEMO_MODE: "true" }), null);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "production", SEMSE_DEMO_PASSWORD: LOCAL_DEV_DEMO_PASSWORD }), null);
  assert.equal(
    resolveDemoLoginPassword({ NODE_ENV: "production", SEMSE_DEMO_PASSWORD: "x".repeat(MIN_PRODUCTION_DEMO_PASSWORD_LENGTH - 1) }),
    null,
  );
  const strong = "z".repeat(MIN_PRODUCTION_DEMO_PASSWORD_LENGTH);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "production", SEMSE_DEMO_PASSWORD: strong }), null);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "development", SEMSE_DEMO_PASSWORD: strong }), strong);
});

test("API demo password match is exact and closed when no password is allowed", () => {
  assert.equal(demoPasswordMatches("a-long-demo-secret", "a-long-demo-secret"), true);
  assert.equal(demoPasswordMatches("a-long-demo-secreT", "a-long-demo-secret"), false);
  assert.equal(demoPasswordMatches(LOCAL_DEV_DEMO_PASSWORD, null), false);
});
