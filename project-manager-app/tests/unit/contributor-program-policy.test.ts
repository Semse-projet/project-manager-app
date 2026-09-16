/**
 * Unit tests for the Knowledge Contributor Program ownership policy — pure, no I/O.
 * Run: node --experimental-strip-types --test tests/unit/contributor-program-policy.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOwnsResource,
  assertIsOpsAdmin,
} from "../../apps/api/src/modules/contributor-program/contributor-program.policy.ts";

function actor(overrides: Partial<{ userId: string; roles: string[] }> = {}) {
  return {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: overrides.userId ?? "usr_a",
    roles: overrides.roles ?? ["WORKER"],
  };
}

test("contributor A cannot access contributor B's resource", () => {
  const a = actor({ userId: "usr_a" });
  assert.throws(() => assertOwnsResource(a, "usr_b"), /forbidden/i);
});

test("a contributor can access their own resource", () => {
  const a = actor({ userId: "usr_a" });
  assert.doesNotThrow(() => assertOwnsResource(a, "usr_a"));
});

test("OPS_ADMIN can access any contributor's resource", () => {
  const admin = actor({ userId: "usr_admin", roles: ["OPS_ADMIN"] });
  assert.doesNotThrow(() => assertOwnsResource(admin, "usr_a"));
  assert.doesNotThrow(() => assertOwnsResource(admin, "usr_b"));
});

test("assertIsOpsAdmin rejects a non-admin actor", () => {
  const worker = actor({ roles: ["WORKER"] });
  assert.throws(() => assertIsOpsAdmin(worker), /admin/i);
});

test("assertIsOpsAdmin accepts an OPS_ADMIN actor", () => {
  const admin = actor({ roles: ["OPS_ADMIN"] });
  assert.doesNotThrow(() => assertIsOpsAdmin(admin));
});
