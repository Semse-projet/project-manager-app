import type { CapabilityMaturity, CapabilityReachability } from "@prisma/client";
import type { RuntimeAgentRole } from "@semse/agents";

/**
 * Canonical, single-source-of-truth mapping from every RuntimeAgentRole
 * (packages/agents/src/governance.ts) to its Capability Reality Registry
 * (ADR-032) row, per the SEMSE Agents Governance Reconciliation (ADR-037,
 * AG-03). The actual seed data shipped to the database lives in
 * packages/db/prisma/migrations/20260918010000_agent_role_capability_seed/migration.sql
 * (Prisma migrations are static SQL, so it cannot import this file directly)
 * — this map exists so that fact is checked from two independent angles:
 *
 * 1. Compile-time: `Record<RuntimeAgentRole, ...>` forces every key of the
 *    RuntimeAgentRole union to be present. Add a 17th role to
 *    `runtimeAgentRoles` without adding it here, and `pnpm build:api` fails
 *    with a missing-property error — not a silently-stale registry.
 * 2. Runtime: `tests/unit/agent-capability-registry-seed.test.mjs` imports
 *    the real `runtimeAgentRoles` array and asserts its members match this
 *    map's keys exactly, and separately cross-checks this map's `key`
 *    values against what the migration SQL actually inserts, so the two
 *    representations of the same facts can't drift apart unnoticed.
 *
 * `maturity` and `reachability` are deliberately different axes (see the
 * `CapabilityReachability` enum's doc comment in schema.prisma) — never
 * conflate a DEPRECATE-the-path decision (e.g. project-copilot) with
 * DEPRECATE-the-capability.
 */
export interface AgentRoleCapabilitySeed {
  key: string;
  domain: string;
  description: string;
  maturity: CapabilityMaturity;
  reachability: CapabilityReachability;
  ownerModule: string;
}

const PRODUCTION_REACHABLE_MATURITY: CapabilityMaturity = "INTEGRATED";
const INTEGRATION_ONLY_MATURITY: CapabilityMaturity = "INTEGRATED";
const DESIGNED_BUT_UNWIRED_MATURITY: CapabilityMaturity = "TESTED";

export const AGENT_ROLE_CAPABILITY_SEED: Record<RuntimeAgentRole, AgentRoleCapabilitySeed> = {
  pricing: {
    key: "agent-role:pricing",
    domain: "Agents",
    description:
      "Real production triggers dispatch to a DB-backed handler in apps/worker/src/agent-run-handlers.mjs — runtime.ts's own builder is never reached in production.",
    maturity: PRODUCTION_REACHABLE_MATURITY,
    reachability: "PRODUCTION_REACHABLE",
    ownerModule: "packages/agents",
  },
  "trust-match": {
    key: "agent-role:trust-match",
    domain: "Agents",
    description: "Real production triggers dispatch to a DB-backed handler in apps/worker/src/agent-run-handlers.mjs.",
    maturity: PRODUCTION_REACHABLE_MATURITY,
    reachability: "PRODUCTION_REACHABLE",
    ownerModule: "packages/agents",
  },
  "evidence-coach": {
    key: "agent-role:evidence-coach",
    domain: "Agents",
    description: "Real production triggers dispatch to a DB-backed handler in apps/worker/src/agent-run-handlers.mjs.",
    maturity: PRODUCTION_REACHABLE_MATURITY,
    reachability: "PRODUCTION_REACHABLE",
    ownerModule: "packages/agents",
  },
  risk: {
    key: "agent-role:risk",
    domain: "Agents",
    description: "Real production triggers dispatch to a DB-backed handler in apps/worker/src/agent-run-handlers.mjs.",
    maturity: PRODUCTION_REACHABLE_MATURITY,
    reachability: "PRODUCTION_REACHABLE",
    ownerModule: "packages/agents",
  },
  dispute: {
    key: "agent-role:dispute",
    domain: "Agents",
    description:
      "Not in apps/worker's SPECIALIZED_HANDLERS table — falls through to executeGovernedAgentRun and actually executes runtime.ts's own buildDispute (one of only two roles, with forge, where runtime.ts's builder itself runs in production).",
    maturity: PRODUCTION_REACHABLE_MATURITY,
    reachability: "PRODUCTION_REACHABLE",
    ownerModule: "packages/agents",
  },
  "browser-agent": {
    key: "agent-role:browser-agent",
    domain: "Agents",
    description:
      "Real BFF (admin/browser-agent/missions) creates the run; actual browser automation is wired via @semse/autonomy directly, not through this manifest.",
    maturity: PRODUCTION_REACHABLE_MATURITY,
    reachability: "PRODUCTION_REACHABLE",
    ownerModule: "packages/agents",
  },
  forge: {
    key: "agent-role:forge",
    domain: "Agents",
    description:
      "Two real, independent paths reach runtime.ts's own buildForge (the worker handler and ForgeAgentAdapterService.execute in-process from the API). Excluded from the public agentCatalog schema like the DESIGNED_BUT_UNWIRED roles, but reachable via this separate, dedicated path.",
    maturity: PRODUCTION_REACHABLE_MATURITY,
    reachability: "PRODUCTION_REACHABLE",
    ownerModule: "packages/agents",
  },
  "job-planner": {
    key: "agent-role:job-planner",
    domain: "Agents",
    description: "Real SPECIALIZED_HANDLERS entry and test coverage exist; no current production trigger creates a run of this type.",
    maturity: INTEGRATION_ONLY_MATURITY,
    reachability: "INTEGRATION_ONLY",
    ownerModule: "packages/agents",
  },
  orchestrator: {
    key: "agent-role:orchestrator",
    domain: "Agents",
    description:
      "Real, executable runtime.ts branch (buildOrchestrator); nothing currently creates a run of this type. Per ADR-036 (AG-02): shares its name with, but has zero code coupling to, the real Prometeo Orchestrator (ai-models/, infrastructure/llm) — do not conflate wiring this role with a Prometeo integration.",
    maturity: INTEGRATION_ONLY_MATURITY,
    reachability: "INTEGRATION_ONLY",
    ownerModule: "packages/agents",
  },
  ecv: {
    key: "agent-role:ecv",
    domain: "Agents",
    description:
      "Real, executable runtime.ts branch (buildEcv), which also serves as executeSpecializedHandler's own default fallback for any unmatched role — load-bearing even though no run is ever explicitly typed 'ecv' today.",
    maturity: INTEGRATION_ONLY_MATURITY,
    reachability: "INTEGRATION_ONLY",
    ownerModule: "packages/agents",
  },
  "project-copilot": {
    key: "agent-role:project-copilot",
    domain: "Agents",
    description:
      "This row tracks the AgentRun-shaped path ONLY. The real, shipped Project Copilot feature bypasses AgentRun entirely via agents.service.ts:556's chatWithTools — a separate, live code path not tracked here. Per ADR-037, this AgentRun path is superseded and should not receive further investment, but the capability itself is NOT deprecated. Never read this row's reachability as 'Project Copilot is dead' — see tests/unit/agent-capability-registry-seed.test.mjs's regression test for this exact confusion.",
    maturity: INTEGRATION_ONLY_MATURITY,
    reachability: "INTEGRATION_ONLY",
    ownerModule: "packages/agents",
  },
  "field-ops": {
    key: "agent-role:field-ops",
    domain: "Agents",
    description:
      "Real SPECIALIZED_HANDLERS entry and test coverage exist, but field-ops as a whole is being replaced by the Labor Engine (CLAUDE.md, semse-labor-engine-boundary). Per ADR-037, this role's AgentRun path is DEPRECATE. Maturity stays INTEGRATED (the code path is real and tested) — reachability, a separate axis, records the lifecycle decision.",
    maturity: INTEGRATION_ONLY_MATURITY,
    reachability: "DEPRECATED",
    ownerModule: "packages/agents",
  },
  "technical-agent": {
    key: "agent-role:technical-agent",
    domain: "Agents",
    description:
      "Real, risk-scored manifest and SPECIALIZED_HANDLERS entry exist, but the role is excluded from the public agentCatalog schema and the domain-event trigger router's allow-set — no entrypoint can create a run of this type. Reads as intentional soft-launch gating (ADR-037), not abandoned work.",
    maturity: DESIGNED_BUT_UNWIRED_MATURITY,
    reachability: "DESIGNED_BUT_UNWIRED",
    ownerModule: "packages/agents",
  },
  "legal-agent": {
    key: "agent-role:legal-agent",
    domain: "Agents",
    description: "Same shape as technical-agent: real manifest and handler, excluded from every public entrypoint.",
    maturity: DESIGNED_BUT_UNWIRED_MATURITY,
    reachability: "DESIGNED_BUT_UNWIRED",
    ownerModule: "packages/agents",
  },
  "financial-agent": {
    key: "agent-role:financial-agent",
    domain: "Agents",
    description: "Same shape as technical-agent: real manifest and handler, excluded from every public entrypoint.",
    maturity: DESIGNED_BUT_UNWIRED_MATURITY,
    reachability: "DESIGNED_BUT_UNWIRED",
    ownerModule: "packages/agents",
  },
  "qa-agent": {
    key: "agent-role:qa-agent",
    domain: "Agents",
    description: "Same shape as technical-agent: real manifest and handler, excluded from every public entrypoint.",
    maturity: DESIGNED_BUT_UNWIRED_MATURITY,
    reachability: "DESIGNED_BUT_UNWIRED",
    ownerModule: "packages/agents",
  },
};
