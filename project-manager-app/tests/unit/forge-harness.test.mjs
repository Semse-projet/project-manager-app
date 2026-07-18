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
