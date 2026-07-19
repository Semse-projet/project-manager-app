import test from "node:test";
import assert from "node:assert/strict";

import {
  ForgeHarness,
  creatorBlueprintToSpec,
  createCreatorTaskPackets,
  evaluateForgePolicy,
  getForgeAgentManifest,
  validateCreatorBlueprint
} from "../../packages/forge/dist/index.js";

const approvedSpec = {
  id: "forge-test-spec",
  path: "docs/specs/forge/test.spec.md",
  digest: "abc123",
  status: "APPROVED"
};

function task(overrides = {}) {
  return {
    id: "task-1",
    title: "Implement Forge docs",
    spec: approvedSpec,
    requestedRole: "documentation-curator",
    riskLevel: "low",
    objective: "Update documentation",
    allowedFiles: ["docs/**"],
    forbiddenFiles: ["packages/db/**"],
    allowedCommands: [],
    acceptanceCriteria: [],
    dependencies: [],
    targetBranch: "agent/forge-docs",
    environment: "sandbox",
    metadata: {},
    ...overrides
  };
}

test("policy denies direct writes to main", () => {
  const result = evaluateForgePolicy({
    manifest: getForgeAgentManifest("documentation-curator"),
    task: task({ targetBranch: "main" }),
    action: "docs.update",
    changedFiles: ["docs/specs/forge/example.spec.md"]
  });

  assert.equal(result.decision, "deny");
  assert.ok(result.violatedPolicies.includes("policy.no_direct_default_branch"));
});

test("policy allows bounded low-risk documentation work", () => {
  const result = evaluateForgePolicy({
    manifest: getForgeAgentManifest("documentation-curator"),
    task: task(),
    action: "docs.update",
    changedFiles: ["docs/specs/forge/example.spec.md"]
  });

  assert.equal(result.decision, "allow");
});

test("critical data task requires dual control", () => {
  const result = evaluateForgePolicy({
    manifest: getForgeAgentManifest("data-engineer"),
    task: task({
      requestedRole: "data-engineer",
      riskLevel: "critical",
      allowedFiles: ["packages/db/**"],
      forbiddenFiles: []
    }),
    action: "migration.propose",
    changedFiles: ["packages/db/prisma/schema.prisma"]
  });

  assert.equal(result.decision, "require_approval");
  assert.ok(result.requiredApprovals.includes("dual_control"));
});

test("harness enforces lifecycle transitions", () => {
  const harness = new ForgeHarness();
  const run = harness.createRun({ title: "Test run", spec: approvedSpec });

  assert.throws(() => harness.transition(run.id, "building"));
  harness.transition(run.id, "intake");
  harness.transition(run.id, "spec_draft");
  harness.transition(run.id, "spec_review");
  harness.transition(run.id, "approved");
  harness.transition(run.id, "planned");
  const current = harness.transition(run.id, "building");

  assert.equal(current.state, "building");
});

test("harness can ensure pending approvals", () => {
  const harness = new ForgeHarness();
  const run = harness.createRun({ title: "Approval test", spec: approvedSpec });

  harness.ensurePendingApproval(run.id, "ops_admin");
  const first = harness.getRun(run.id);
  assert.equal(first.approvals.length, 1);
  assert.equal(first.approvals[0].mode, "ops_admin");
  assert.equal(first.approvals[0].status, "pending");

  harness.ensurePendingApproval(run.id, "ops_admin");
  const second = harness.getRun(run.id);
  assert.equal(second.approvals.length, 1);

  harness.approve(run.id, "ops_admin", "user-001");
  const approved = harness.getRun(run.id);
  assert.equal(approved.approvals[0].status, "approved");
  assert.equal(approved.approvals[0].actor, "user-001");
});

test("harness can reject a pending approval and the rejection persists", () => {
  const harness = new ForgeHarness();
  const run = harness.createRun({ title: "Rejection test", spec: approvedSpec });

  harness.ensurePendingApproval(run.id, "security");
  harness.reject(run.id, "security", "user-002");

  const rejected = harness.getRun(run.id);
  assert.equal(rejected.approvals[0].status, "rejected");
  assert.equal(rejected.approvals[0].actor, "user-002");

  // getRun() always returns a structuredClone; reading it a second time must
  // still show the rejection, proving it was written to the harness's live
  // state and not just a detached copy of it.
  const rejectedAgain = harness.getRun(run.id);
  assert.equal(rejectedAgain.approvals[0].status, "rejected");
});

test("harness rejecting a mode with no pending approval throws", () => {
  const harness = new ForgeHarness();
  const run = harness.createRun({ title: "Rejection error test", spec: approvedSpec });

  assert.throws(() => harness.reject(run.id, "security", "user-003"), /Pending approval not found/);
});

test("policy allows deployment.propose to target main branch", () => {
  const result = evaluateForgePolicy({
    manifest: getForgeAgentManifest("devops-release"),
    task: task({
      requestedRole: "devops-release",
      environment: "production",
      targetBranch: "main",
      riskLevel: "high"
    }),
    action: "deployment.propose"
  });

  assert.notEqual(result.decision, "deny");
  assert.ok(!result.violatedPolicies.includes("policy.no_direct_default_branch"));
});

test("creator blueprint requires rights and builds task graph", async () => {
  const blueprint = {
    id: "solar-academy",
    creatorId: "teacher-001",
    creatorRole: "professor",
    title: "Solar Installation Academy",
    summary: "Bilingual training and field tools for solar installation.",
    domain: "solar-energy",
    audience: ["apprentices", "technicians"],
    appType: "hybrid",
    learningObjectives: ["Design and validate a residential solar installation."],
    knowledgeSources: [
      { type: "manual", reference: "professor-owned-manual", rightsConfirmed: true }
    ],
    modules: [
      {
        id: "m1",
        title: "System sizing",
        purpose: "Calculate system requirements.",
        capabilities: ["calculator", "simulation"]
      }
    ],
    assessments: [
      { id: "a1", type: "practical", passRule: "score >= 80" }
    ],
    monetization: {
      model: "subscription",
      priceCents: 2900,
      currency: "USD"
    },
    visibility: "marketplace",
    dataClassification: "internal",
    languages: ["es", "en"]
  };

  assert.equal(validateCreatorBlueprint(blueprint).valid, true);
  const draftSpec = await creatorBlueprintToSpec(blueprint);
  const packets = createCreatorTaskPackets(blueprint, {
    ...draftSpec,
    status: "APPROVED"
  });

  assert.equal(packets.length, 4);
  assert.equal(packets.at(-1).requestedRole, "qa-verifier");
});
