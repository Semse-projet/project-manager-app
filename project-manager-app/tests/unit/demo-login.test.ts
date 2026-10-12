import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  LOCAL_DEV_DEMO_PASSWORD,
  MIN_PRODUCTION_DEMO_PASSWORD_LENGTH,
  demoPasswordMatches,
  resolveDemoLoginPassword,
} from "../../apps/web/lib/demo-login.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("outside production the demo password defaults to the public local value", () => {
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "development" }), LOCAL_DEV_DEMO_PASSWORD);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "test" }), LOCAL_DEV_DEMO_PASSWORD);
  assert.equal(resolveDemoLoginPassword({}), LOCAL_DEV_DEMO_PASSWORD);
});

test("outside production an explicit SEMSE_DEMO_PASSWORD wins over the default", () => {
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "development", SEMSE_DEMO_PASSWORD: "  local-secret  " }), "local-secret");
});

test("production never accepts the public default password, even with demo mode on", () => {
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "production" }), null);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "production", SEMSE_DEMO_MODE: "true" }), null);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "production", SEMSE_DEMO_PASSWORD: LOCAL_DEV_DEMO_PASSWORD }), null);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "production", SEMSE_DEMO_PASSWORD: "   " }), null);
});

test("production requires an explicit password of at least the minimum length", () => {
  const tooShort = "x".repeat(MIN_PRODUCTION_DEMO_PASSWORD_LENGTH - 1);
  const longEnough = "y".repeat(MIN_PRODUCTION_DEMO_PASSWORD_LENGTH);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "production", SEMSE_DEMO_PASSWORD: tooShort }), null);
  assert.equal(resolveDemoLoginPassword({ NODE_ENV: "production", SEMSE_DEMO_PASSWORD: longEnough }), longEnough);
});

test("demoPasswordMatches compares exactly and treats a closed demo login as no match", () => {
  assert.equal(demoPasswordMatches("correct-horse-battery", "correct-horse-battery"), true);
  assert.equal(demoPasswordMatches("correct-horse-batterY", "correct-horse-battery"), false);
  assert.equal(demoPasswordMatches("", "correct-horse-battery"), false);
  assert.equal(demoPasswordMatches(LOCAL_DEV_DEMO_PASSWORD, null), false);
  assert.equal(demoPasswordMatches("", null), false);
});

test("the web login route and the login page no longer hard-code or pre-fill the public password in production", () => {
  const route = read("apps/web/app/api/semse/auth/token/route.ts");
  assert.ok(!route.includes('"demo1234"'), "token route must not compare against a literal demo password");
  assert.ok(route.includes("resolveDemoLoginPassword"), "token route must use the resolver");
  assert.ok(route.includes("demoPasswordMatches"), "token route must use the constant-time matcher");

  const page = read("apps/web/app/login/page.tsx");
  assert.ok(page.includes('const SHOW_DEMO_PASSWORD = DEMO_LOGIN_ENABLED && process.env.NODE_ENV !== "production"'));
  assert.ok(page.includes('useState(SHOW_DEMO_PASSWORD ? "demo1234" : "")'), "password pre-fill must be gated");
  assert.ok(page.includes("{SHOW_DEMO_PASSWORD && ("), "the visible password hint must be gated");
});

test("the API login no longer compares against a literal demo password", () => {
  const service = read("apps/api/src/modules/auth/auth.service.ts");
  assert.ok(!service.includes('"demo1234"'), "auth.service must not compare against a literal demo password");
  assert.ok(service.includes("resolveDemoLoginPassword"));
  assert.ok(service.includes("demoPasswordMatches"));
});
