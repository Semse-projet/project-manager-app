import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const middleware = readFileSync(path.join(root, "apps/web/middleware.ts"), "utf8");

test("workspace shell requires an authenticated session like the business routes", () => {
  const protectedList = middleware.match(/const PROTECTED_PREFIXES = \[([^\]]*)\]/);
  assert.ok(protectedList, "protected route prefixes are declared");
  assert.ok(protectedList[1].includes('"/workspace"'), "workspace routes must not be public");
});

test("authenticated worker, client and admin sessions can open the same workspace shell", () => {
  const owned = middleware.match(/const ownedPrefixes[\s\S]*?\};/);
  assert.ok(owned, "per-role route allowlist exists");
  for (const role of ["worker", "client", "admin"]) {
    const roleLine = owned[0].split("\n").find((line) => line.trimStart().startsWith(`${role}:`));
    assert.ok(roleLine?.includes('"/workspace"'), `${role} must have workspace access`);
  }
});

test("workspace API retains separate backend authorization", () => {
  assert.match(middleware, /if \(pathname\.startsWith\("\/api\/"\)\)/);
  assert.match(middleware, /return unauthorizedApiResponse\(req, Boolean\(sessionCookie\)\)/);
});
