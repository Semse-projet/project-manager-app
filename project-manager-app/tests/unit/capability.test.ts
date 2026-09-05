import test from "node:test";
import assert from "node:assert/strict";
import { deriveActiveCapability } from "../../apps/web/lib/capability.ts";
import type { UserCapabilityView } from "../../apps/web/app/semse-api.ts";

const CLIENT_IN_A: UserCapabilityView = { role: "CLIENT", orgId: "org_a", verifiedAt: "2026-01-01T00:00:00.000Z" };
const PRO_IN_B: UserCapabilityView = { role: "PRO", orgId: "org_b", verifiedAt: "2026-01-01T00:00:00.000Z" };
const WORKER_IN_C: UserCapabilityView = { role: "WORKER", orgId: "org_c", verifiedAt: "2026-01-01T00:00:00.000Z" };

test("deriveActiveCapability returns the capability matching the open project's org", () => {
  const result = deriveActiveCapability([CLIENT_IN_A, PRO_IN_B], "org_b");
  assert.deepEqual(result, PRO_IN_B);
});

test("deriveActiveCapability returns null when there is no open project (never a saved preference)", () => {
  assert.equal(deriveActiveCapability([CLIENT_IN_A, PRO_IN_B], null), null);
});

test("deriveActiveCapability returns null when the user holds no membership in that org", () => {
  assert.equal(deriveActiveCapability([CLIENT_IN_A, PRO_IN_B], "org_z"), null);
});

test("deriveActiveCapability disambiguates the same role duplicated across two orgs", () => {
  const clientInB: UserCapabilityView = { role: "CLIENT", orgId: "org_b", verifiedAt: null };
  const result = deriveActiveCapability([CLIENT_IN_A, clientInB], "org_b");
  assert.deepEqual(result, clientInB);
});

test("deriveActiveCapability never mixes WORKER (org A) with PRO (org B) permissions", () => {
  const workerInA: UserCapabilityView = { role: "WORKER", orgId: "org_a", verifiedAt: "2026-01-01T00:00:00.000Z" };
  const capabilities = [workerInA, PRO_IN_B, WORKER_IN_C];

  assert.deepEqual(deriveActiveCapability(capabilities, "org_a"), workerInA);
  assert.deepEqual(deriveActiveCapability(capabilities, "org_b"), PRO_IN_B);
  assert.notDeepEqual(deriveActiveCapability(capabilities, "org_a"), PRO_IN_B);
});
