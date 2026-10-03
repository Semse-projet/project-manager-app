import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  isLegacyOrphanRoute,
  resolveLegacyRouteRedirect,
} from "../../apps/web/lib/legacy-route-redirect.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("legacy dashboard redirects every authenticated role to its canonical dashboard", () => {
  assert.equal(resolveLegacyRouteRedirect("/dashboard", "client"), "/client/dashboard");
  assert.equal(resolveLegacyRouteRedirect("/dashboard", "worker"), "/worker/dashboard");
  assert.equal(resolveLegacyRouteRedirect("/dashboard", "admin"), "/admin/dashboard");
});

test("legacy field ops redirects only operational roles to canonical field ops", () => {
  assert.equal(resolveLegacyRouteRedirect("/field-ops", "client"), "/client/dashboard");
  assert.equal(resolveLegacyRouteRedirect("/field-ops", "worker"), "/worker/field-ops");
  assert.equal(resolveLegacyRouteRedirect("/field-ops", "admin"), "/admin/field-ops");
});

test("legacy route matching is exact and does not capture similar paths", () => {
  assert.equal(isLegacyOrphanRoute("/dashboard"), true);
  assert.equal(isLegacyOrphanRoute("/field-ops"), true);

  for (const pathname of [
    "/dashboard/stats",
    "/field-ops-old",
    "/client/dashboard",
    "/worker/field-ops",
  ]) {
    assert.equal(isLegacyOrphanRoute(pathname), false);
    assert.equal(resolveLegacyRouteRedirect(pathname, "admin"), null);
  }
});

test("middleware protects and redirects legacy routes after resolving the session role", () => {
  const source = read("apps/web/middleware.ts");

  assert.match(source, /isLegacyOrphanRoute\(pathname\)/);
  assert.match(source, /resolveLegacyRouteRedirect\(pathname, role\)/);
  assert.match(source, /url\.pathname = legacyRedirectTarget/);
});

test("legacy pages fail closed without loading orphan implementations", () => {
  const dashboardSource = read("apps/web/app/dashboard/page.tsx");
  const fieldOpsSource = read("apps/web/app/field-ops/page.tsx");

  assert.match(dashboardSource, /redirect\("\/login"\)/);
  assert.doesNotMatch(dashboardSource, /SEMSE_API_BASE_URL|fetch\(|DashboardClient/);

  assert.match(fieldOpsSource, /redirect\("\/login"\)/);
  assert.doesNotMatch(fieldOpsSource, /"use client"|fetch\(|FieldOpsService/);

  assert.equal(
    existsSync(path.join(repoRoot, "apps/web/app/dashboard/dashboard-client.tsx")),
    false,
  );
});
