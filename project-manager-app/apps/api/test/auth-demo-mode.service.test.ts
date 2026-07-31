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
  process.env.SEMSE_DEMO_MODE = "false";

  assert.equal(isLegacyDemoLoginEnabled(), false);
  assert.ok("admin@demo.semse" in LEGACY_DEMO_ACCOUNTS);
  assert.equal(
    isDisabledDemoIdentity("usr_admin_001", ["OPS_ADMIN"]),
    true,
  );
});
