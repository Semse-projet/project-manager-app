// PR B (Agents Catalog Operational Truth) — proves the required regression
// cases against the REAL derivation/presentation functions the page imports
// (apps/web/app/(app)/agents/agent-role-presentation.ts), not a
// reimplementation. This repo has no component-test harness (no jsdom/RTL),
// so this is the honest boundary: everything downstream of these two pure
// functions is plain JSX rendering with no additional branching logic.
import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveSpecializedAgents,
  reachabilityPresentation,
  AGENT_ROLE_KEY_PREFIX,
} from "../../apps/web/app/(app)/agents/agent-role-presentation.ts";

function capability(key, overrides = {}) {
  return {
    id: `cap_${key}`,
    key: `${AGENT_ROLE_KEY_PREFIX}${key}`,
    domain: "Agents",
    description: "",
    maturity: "INTEGRATED",
    health: "UNKNOWN",
    reachability: "PRODUCTION_REACHABLE",
    ownerModule: "packages/agents",
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    evidence: [],
    ...overrides,
  };
}

test("job-planner, orchestrator, and ecv are never presented as production-live", () => {
  const agents = deriveSpecializedAgents([
    capability("job-planner", { reachability: "INTEGRATION_ONLY" }),
    capability("orchestrator", { reachability: "INTEGRATION_ONLY" }),
    capability("ecv", { reachability: "INTEGRATION_ONLY" }),
  ]);
  for (const role of ["job-planner", "orchestrator", "ecv"]) {
    const agent = agents.find((a) => a.id === role);
    assert.ok(agent, `${role} should be rendered (present in the registry response)`);
    assert.equal(agent.reachability, "INTEGRATION_ONLY");
    const status = reachabilityPresentation(agent.reachability);
    assert.notEqual(
      status.label,
      "Disponible en producción",
      `${role} must not read as production-live — nothing currently triggers it`,
    );
  }
});

test("project-copilot's canonical role is not mislabeled by its deprecated secondary path", () => {
  // The real seed (PR A) keeps project-copilot at INTEGRATION_ONLY, not
  // DEPRECATED, precisely because only the unused AgentRun-shaped path is
  // superseded — the real feature (chatWithTools) lives outside this role.
  const agents = deriveSpecializedAgents([capability("project-copilot", { reachability: "INTEGRATION_ONLY" })]);
  const projectCopilot = agents.find((a) => a.id === "project-copilot");
  assert.ok(projectCopilot);
  assert.notEqual(reachabilityPresentation(projectCopilot.reachability).label, "En retiro");

  // Contrast: field-ops IS a whole-role deprecation and correctly reads
  // "En retiro" — proving this isn't a blanket "never show deprecated" rule.
  const fieldOpsAgents = deriveSpecializedAgents([capability("field-ops", { reachability: "DEPRECATED" })]);
  assert.equal(reachabilityPresentation(fieldOpsAgents[0].reachability).label, "En retiro");
});

test("a null reachability (registry hasn't classified this row) renders UNKNOWN, never available", () => {
  const agents = deriveSpecializedAgents([capability("qa-agent", { reachability: null })]);
  const status = reachabilityPresentation(agents[0].reachability);
  assert.equal(status.label, "Estado no verificado");
  assert.notEqual(status.label, "Disponible en producción");
});

test("a role missing from the registry response is never fabricated into the roster", () => {
  // Only 2 of many real roles present in this response — the derived list
  // must contain exactly those 2, never pad in anything else as available.
  const agents = deriveSpecializedAgents([capability("pricing"), capability("forge")]);
  assert.deepEqual(
    agents.map((a) => a.id).sort(),
    ["forge", "pricing"],
    "a role absent from the API response must simply not appear, not render as some default status",
  );
});

test("non-agent-role capabilities (the pre-existing ADR-032 rows) are excluded from the specialized roster", () => {
  const agents = deriveSpecializedAgents([
    { ...capability("pricing"), key: "pricing-engine", domain: "Finance/Payments" },
    capability("dispute"),
  ]);
  assert.deepEqual(agents.map((a) => a.id), ["dispute"]);
});

test("PRODUCTION_REACHABLE and INTEGRATION_ONLY are visually distinguishable even at the same maturity", () => {
  const agents = deriveSpecializedAgents([
    capability("dispute", { maturity: "INTEGRATED", reachability: "PRODUCTION_REACHABLE" }),
    capability("orchestrator", { maturity: "INTEGRATED", reachability: "INTEGRATION_ONLY" }),
  ]);
  const dispute = agents.find((a) => a.id === "dispute");
  const orchestrator = agents.find((a) => a.id === "orchestrator");
  assert.equal(dispute.maturity, orchestrator.maturity, "same maturity by construction, per ADR-037");
  const disputeStatus = reachabilityPresentation(dispute.reachability);
  const orchestratorStatus = reachabilityPresentation(orchestrator.reachability);
  assert.notEqual(
    disputeStatus.label,
    orchestratorStatus.label,
    "identical maturity must not collapse into identical operational status",
  );
});
