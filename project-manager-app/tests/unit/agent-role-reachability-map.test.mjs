// Agents Governance Reconciliation — reachability proofs.
//
// These tests exercise the REAL, exported routing/decision functions (never
// a reimplementation of their logic) to prove the classification table in
// `.claude/skills/semse-agents-governance/SKILL.md` reflects actual code, not
// a narrative that could silently drift. "Unit-tested does not mean
// production-reachable" — each test below proves one real link in the chain
// production entrypoint -> router -> capability -> builder/handler, using
// the real function at that link.
import test from "node:test";
import assert from "node:assert/strict";
import { runtimeAgentRoles } from "../../packages/agents/dist/index.js";
import { shouldUseSpecializedWorkerHandler } from "../../apps/worker/src/agent-run-handlers.mjs";
import { evaluatePrometeoToolPolicy } from "../../apps/api/dist/modules/prometeo/tool-governance/tool-governance.policy.js";
import { PROMETEO_TOOL_REGISTRY } from "../../apps/api/dist/modules/prometeo/prometeo-tool-registry.js";

// Roles that reach apps/worker/src/main.mjs's `executeSpecializedWorkerRun`
// branch (a DB-backed handler in agent-run-handlers.mjs), NOT runtime.ts's
// own builder for that role.
const EXPECTED_SPECIALIZED_HANDLER_ROLES = [
  "field-ops", "trust-match", "pricing", "job-planner", "evidence-coach",
  "risk", "project-copilot", "technical-agent", "legal-agent",
  "financial-agent", "qa-agent", "browser-agent", "forge",
];

// Roles that fall to main.mjs's `executeGovernedAgentRun` branch, reaching
// runtime.ts's own builder function directly.
const EXPECTED_GOVERNED_RUNTIME_ROLES = ["dispute", "orchestrator", "ecv"];

test("main.mjs's real routing decision matches the reconciliation's classification for all 16 roles", () => {
  assert.equal(runtimeAgentRoles.length, 16, "expected exactly 16 RuntimeAgentRoles; update this test's tables if the enum changed");

  for (const role of EXPECTED_SPECIALIZED_HANDLER_ROLES) {
    assert.equal(
      shouldUseSpecializedWorkerHandler(role),
      true,
      `${role} should route to a specialized (DB-backed) worker handler, not runtime.ts's builder`,
    );
  }
  for (const role of EXPECTED_GOVERNED_RUNTIME_ROLES) {
    assert.equal(
      shouldUseSpecializedWorkerHandler(role),
      false,
      `${role} should fall through to executeGovernedAgentRun and run runtime.ts's own builder`,
    );
  }

  const allClassified = new Set([...EXPECTED_SPECIALIZED_HANDLER_ROLES, ...EXPECTED_GOVERNED_RUNTIME_ROLES]);
  assert.deepEqual(
    [...allClassified].sort(),
    [...runtimeAgentRoles].sort(),
    "every RuntimeAgentRole must be classified into exactly one of the two tables above — a role present in neither is untested reachability, not proven dead or alive",
  );
});

// Prometeo entrypoint: prove a REAL registry entry (not a synthetic
// descriptor) actually flows through the real policy decision function.
// Uses the registry's own most-guarded entry (escrow release,
// approvalPolicy "human_required") so the "require_approval" branch is
// exercised against real data, not a hand-picked easy case.
test("Prometeo tool-execution entrypoint: a real PROMETEO_TOOL_REGISTRY entry reaches evaluatePrometeoToolPolicy with its declared policy intact", () => {
  const humanRequiredTool = PROMETEO_TOOL_REGISTRY.find((tool) => tool.approvalPolicy === "human_required");
  assert.ok(humanRequiredTool, "expected at least one human_required tool in the real registry to anchor this test");
  assert.ok(humanRequiredTool.permissions.length > 0);

  // No roles at all can never satisfy a declared permission requirement —
  // this proves the real permission check actually runs (not a stub that
  // always allows), without needing to hardcode which named role does or
  // doesn't hold this specific tool's permission.
  const deniedForNoRoles = evaluatePrometeoToolPolicy({
    actorRoles: [],
    descriptor: humanRequiredTool,
  });
  assert.equal(deniedForNoRoles.decision, "deny");
  assert.deepEqual(deniedForNoRoles.missingPermissions, humanRequiredTool.permissions);

  // OPS_ADMIN is documented (prometeo-tool-registry.ts's own inline comment
  // on this exact entry) as a holder of the permission it declares.
  const requiresApprovalForHolder = evaluatePrometeoToolPolicy({
    actorRoles: ["OPS_ADMIN"],
    descriptor: humanRequiredTool,
  });
  assert.equal(requiresApprovalForHolder.decision, "require_approval");
  assert.deepEqual(requiresApprovalForHolder.missingPermissions, []);
});
