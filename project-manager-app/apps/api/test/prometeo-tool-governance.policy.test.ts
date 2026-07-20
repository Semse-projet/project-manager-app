import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePrometeoToolPolicy } from "../dist/modules/prometeo/tool-governance/tool-governance.policy.js";

function descriptor(overrides: Partial<{ permissions: string[]; approvalPolicy: "none" | "confirm" | "human_required" | "dual_approval" }> = {}) {
  return {
    permissions: overrides.permissions ?? ["field-ops:read"],
    approvalPolicy: overrides.approvalPolicy ?? "none",
  };
}

test("T-010: allows when the actor holds every permission the tool declares", () => {
  const result = evaluatePrometeoToolPolicy({
    actorRoles: ["PRO"],
    descriptor: descriptor({ permissions: ["field-ops:read"] }),
  });
  assert.deepEqual(result, { decision: "allow", missingPermissions: [] });
});

test("T-011: denies when the actor is missing a permission the tool declares, even with agents:run:create-equivalent roles", () => {
  // CLIENT has agents:run:create but not field-ops:read/write in rbac.ts
  const result = evaluatePrometeoToolPolicy({
    actorRoles: ["CLIENT"],
    descriptor: descriptor({ permissions: ["field-ops:read"] }),
  });
  assert.equal(result.decision, "deny");
  assert.deepEqual(result.missingPermissions, ["field-ops:read"]);
});

test("T-011b: denies when only some of several declared permissions are missing", () => {
  const result = evaluatePrometeoToolPolicy({
    actorRoles: ["WORKER"],
    descriptor: descriptor({ permissions: ["field-ops:read", "payments:write"] }),
  });
  assert.equal(result.decision, "deny");
  assert.deepEqual(result.missingPermissions, ["payments:write"]);
});

test("T-012: requires approval when permission is present but approvalPolicy is not none", () => {
  const result = evaluatePrometeoToolPolicy({
    actorRoles: ["PRO"],
    descriptor: descriptor({ permissions: ["agro:write"], approvalPolicy: "confirm" }),
  });
  assert.deepEqual(result, { decision: "require_approval", missingPermissions: [] });
});

test("T-012b: critical tools with human_required still require approval, not denial, once permission is present", () => {
  // Note: rbac.ts has no role holding "payments:write" today — the real
  // payments.propose_release descriptor's permission string doesn't match
  // anything grantable, a separate catalog issue to resolve in F2-D
  // (T-040). Using "finance:write" here, which OPS_ADMIN does hold, to test
  // the require_approval branch on its own.
  const result = evaluatePrometeoToolPolicy({
    actorRoles: ["OPS_ADMIN"],
    descriptor: descriptor({ permissions: ["finance:write"], approvalPolicy: "human_required" }),
  });
  assert.deepEqual(result, { decision: "require_approval", missingPermissions: [] });
});

test("a tool with no declared permissions and approvalPolicy none allows any actor", () => {
  const result = evaluatePrometeoToolPolicy({
    actorRoles: [],
    descriptor: descriptor({ permissions: [], approvalPolicy: "none" }),
  });
  assert.deepEqual(result, { decision: "allow", missingPermissions: [] });
});
