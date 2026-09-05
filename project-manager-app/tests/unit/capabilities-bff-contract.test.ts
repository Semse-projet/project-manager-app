import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPublicSemseApiPath } from "../../apps/web/lib/semse-api-auth.ts";

test("capabilities BFF proxy stays private and proxies to the canonical endpoint", () => {
  assert.equal(
    isPublicSemseApiPath("/api/semse/users/me/capabilities"),
    false,
  );

  const source = readFileSync(
    "apps/web/app/api/semse/users/me/capabilities/route.ts",
    "utf8",
  );
  assert.match(source, /fetchSemseDataForRequest/);
  assert.match(source, /\/v1\/users\/me\/capabilities/);
  assert.match(source, /isCapabilitySelectorEnabled/);
});

test("fetchMyCapabilities is exported from the web client API module", () => {
  const source = readFileSync("apps/web/app/semse-api.ts", "utf8");
  assert.match(source, /export async function fetchMyCapabilities/);
  assert.match(source, /export type UserCapabilityView/);
});
