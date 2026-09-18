-- CreateEnum
CREATE TYPE "CapabilityReachability" AS ENUM ('PRODUCTION_REACHABLE', 'INTEGRATION_ONLY', 'DESIGNED_BUT_UNWIRED', 'DEPRECATED');

-- AlterTable
ALTER TABLE "capability" ADD COLUMN "reachability" "CapabilityReachability";

-- CreateIndex
CREATE INDEX "capability_reachability_idx" ON "capability"("reachability");

-- Seed: the 16 RuntimeAgentRole capabilities from the SEMSE Agents Governance
-- Reconciliation (ADR-035/036/037). Maturity follows ADR-037's evidence-capped
-- table exactly: a reachability-tested production-entrypoint chain (the
-- PRODUCTION_REACHABLE and INTEGRATION_ONLY roles) caps at INTEGRATED, never
-- higher (no deploy-provenance or live-runtime evidence was gathered by that
-- reconciliation); a role with no reachable entrypoint at all
-- (DESIGNED_BUT_UNWIRED) caps at TESTED. `reachability` is a DIFFERENT axis
-- from `maturity` (see the enum's doc comment in schema.prisma): it records
-- ADR-037's lifecycle decision, not how much evidence backs the code.
--
-- This INSERT is idempotent by construction (ON CONFLICT ("key") DO UPDATE):
-- re-running it never creates duplicate rows, and it deliberately does NOT
-- touch `health`, so it can never clobber a legitimately-observed runtime
-- health value written by a future evidence source.
INSERT INTO "capability" ("id", "key", "domain", "description", "maturity", "reachability", "ownerModule", "updatedAt") VALUES
('cap_agent_role_pricing', 'agent-role:pricing', 'Agents', 'RuntimeAgentRole "pricing" (packages/agents/src/governance.ts). Real production triggers create AgentRuns dispatched to a DB-backed handler in apps/worker/src/agent-run-handlers.mjs — runtime.ts''s own builder for this role is never reached in production.', 'INTEGRATED', 'PRODUCTION_REACHABLE', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_trust_match', 'agent-role:trust-match', 'Agents', 'RuntimeAgentRole "trust-match". Real production triggers dispatch to a DB-backed handler in apps/worker/src/agent-run-handlers.mjs.', 'INTEGRATED', 'PRODUCTION_REACHABLE', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_evidence_coach', 'agent-role:evidence-coach', 'Agents', 'RuntimeAgentRole "evidence-coach". Real production triggers dispatch to a DB-backed handler in apps/worker/src/agent-run-handlers.mjs.', 'INTEGRATED', 'PRODUCTION_REACHABLE', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_risk', 'agent-role:risk', 'Agents', 'RuntimeAgentRole "risk". Real production triggers dispatch to a DB-backed handler in apps/worker/src/agent-run-handlers.mjs.', 'INTEGRATED', 'PRODUCTION_REACHABLE', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_dispute', 'agent-role:dispute', 'Agents', 'RuntimeAgentRole "dispute". Not in apps/worker''s SPECIALIZED_HANDLERS table, so it falls through to executeGovernedAgentRun and actually executes runtime.ts''s own buildDispute — one of only two roles (with forge) where runtime.ts''s builder code itself runs in production.', 'INTEGRATED', 'PRODUCTION_REACHABLE', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_browser_agent', 'agent-role:browser-agent', 'Agents', 'RuntimeAgentRole "browser-agent". Real BFF (admin/browser-agent/missions) creates the run; actual browser automation is wired via @semse/autonomy directly, not through this manifest.', 'INTEGRATED', 'PRODUCTION_REACHABLE', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_forge', 'agent-role:forge', 'Agents', 'RuntimeAgentRole "forge". Two real, independent paths reach runtime.ts''s own buildForge: apps/worker''s handler and ForgeAgentAdapterService.execute (in-process from the API, bypassing the worker). Excluded from the public agentCatalog schema like the 4 DESIGNED_BUT_UNWIRED roles, but reachable via this separate, dedicated path.', 'INTEGRATED', 'PRODUCTION_REACHABLE', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_job_planner', 'agent-role:job-planner', 'Agents', 'RuntimeAgentRole "job-planner". Real SPECIALIZED_HANDLERS entry and test coverage exist; no current production trigger creates a run of this type.', 'INTEGRATED', 'INTEGRATION_ONLY', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_orchestrator', 'agent-role:orchestrator', 'Agents', 'RuntimeAgentRole "orchestrator". Real, executable runtime.ts branch (buildOrchestrator) exists and is reachability-tested; nothing currently creates a run of this type. Per ADR-036 (AG-02): this role shares its name with, but has zero code coupling to, the real Prometeo Orchestrator (apps/api/src/modules/ai-models, infrastructure/llm) — do not conflate wiring this role with a Prometeo integration.', 'INTEGRATED', 'INTEGRATION_ONLY', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_ecv', 'agent-role:ecv', 'Agents', 'RuntimeAgentRole "ecv". Real, executable runtime.ts branch (buildEcv) exists and is reachability-tested; it also serves as executeSpecializedHandler''s own default fallback for any unmatched role, making it load-bearing infrastructure even though no run is ever explicitly typed "ecv" today.', 'INTEGRATED', 'INTEGRATION_ONLY', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_project_copilot', 'agent-role:project-copilot', 'Agents', 'RuntimeAgentRole "project-copilot" (the AgentRun-shaped path only). The REAL, shipped Project Copilot feature bypasses AgentRun entirely via agents.service.ts:556''s chatWithTools — a separate, unrelated, live code path not tracked by this row. This row tracks only the SPECIALIZED_HANDLERS/runtime.ts AgentRun path for the same role name, which nothing currently invokes. Per ADR-037: this path is superseded and should not receive further investment, but the capability itself is NOT deprecated — it is live, just through a different mechanism than this RuntimeAgentRole. Do not read this row''s reachability as "Project Copilot is dead."', 'INTEGRATED', 'INTEGRATION_ONLY', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_field_ops', 'agent-role:field-ops', 'Agents', 'RuntimeAgentRole "field-ops". Has a real SPECIALIZED_HANDLERS entry and is reachability-tested, but CLAUDE.md and the semse-labor-engine-boundary skill already establish that field-ops as a whole is being replaced by the Labor Engine. Per ADR-037, this role''s AgentRun path is DEPRECATE: it should not receive further investment. Maturity stays INTEGRATED (the code path itself is real and tested) — reachability, a separate axis, records the lifecycle decision.', 'INTEGRATED', 'DEPRECATED', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_technical_agent', 'agent-role:technical-agent', 'Agents', 'RuntimeAgentRole "technical-agent". Real, risk-scored manifest and SPECIALIZED_HANDLERS entry exist, but the role is excluded from the public agentCatalog schema and the domain-event trigger router''s allow-set — no entrypoint in the codebase can create a run of this type at all. Reads as intentional soft-launch gating (ADR-037), not abandoned work.', 'TESTED', 'DESIGNED_BUT_UNWIRED', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_legal_agent', 'agent-role:legal-agent', 'Agents', 'RuntimeAgentRole "legal-agent". Same shape as technical-agent: real manifest and handler, excluded from every public entrypoint.', 'TESTED', 'DESIGNED_BUT_UNWIRED', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_financial_agent', 'agent-role:financial-agent', 'Agents', 'RuntimeAgentRole "financial-agent". Same shape as technical-agent: real manifest and handler, excluded from every public entrypoint.', 'TESTED', 'DESIGNED_BUT_UNWIRED', 'packages/agents', CURRENT_TIMESTAMP),
('cap_agent_role_qa_agent', 'agent-role:qa-agent', 'Agents', 'RuntimeAgentRole "qa-agent". Same shape as technical-agent: real manifest and handler, excluded from every public entrypoint.', 'TESTED', 'DESIGNED_BUT_UNWIRED', 'packages/agents', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  domain = EXCLUDED.domain,
  description = EXCLUDED.description,
  maturity = EXCLUDED.maturity,
  reachability = EXCLUDED.reachability,
  "ownerModule" = EXCLUDED."ownerModule",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Evidence rows are append-only historical facts, not something a re-run
-- should overwrite — ON CONFLICT DO NOTHING, keyed by a deterministic id.
INSERT INTO "capability_evidence" ("id", "capabilityId", "kind", "reference", "note") VALUES
('ev_agent_role_pricing_reach', 'cap_agent_role_pricing', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', 'Proves shouldUseSpecializedWorkerHandler("pricing") routes to the real DB-backed handler.'),
('ev_agent_role_pricing_adr', 'cap_agent_role_pricing', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', NULL),
('ev_agent_role_trust_match_reach', 'cap_agent_role_trust_match', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', NULL),
('ev_agent_role_trust_match_adr', 'cap_agent_role_trust_match', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', NULL),
('ev_agent_role_evidence_coach_reach', 'cap_agent_role_evidence_coach', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', NULL),
('ev_agent_role_evidence_coach_adr', 'cap_agent_role_evidence_coach', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', NULL),
('ev_agent_role_risk_reach', 'cap_agent_role_risk', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', NULL),
('ev_agent_role_risk_adr', 'cap_agent_role_risk', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', NULL),
('ev_agent_role_dispute_reach', 'cap_agent_role_dispute', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', 'Proves shouldUseSpecializedWorkerHandler("dispute") is false (falls through to executeGovernedAgentRun).'),
('ev_agent_role_dispute_governance_test', 'cap_agent_role_dispute', 'TEST', 'apps/api/test/agent-governance.test.ts', 'Exercises runtime.ts''s buildDispute end-to-end.'),
('ev_agent_role_dispute_adr', 'cap_agent_role_dispute', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', NULL),
('ev_agent_role_browser_agent_reach', 'cap_agent_role_browser_agent', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', NULL),
('ev_agent_role_browser_agent_adr', 'cap_agent_role_browser_agent', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', NULL),
('ev_agent_role_forge_reach', 'cap_agent_role_forge', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', NULL),
('ev_agent_role_forge_integration_test', 'cap_agent_role_forge', 'TEST', 'tests/unit/forge-runtime-integration.test.mjs', 'End-to-end: manifest -> policy -> sandbox -> ... -> rollback, plus the worker handler wrapper.'),
('ev_agent_role_forge_golden_test', 'cap_agent_role_forge', 'TEST', 'tests/unit/agent-approval-consistency-golden.test.mjs', 'Golden Approval Consistency Scenario for forge''s dual policy gate.'),
('ev_agent_role_forge_adr', 'cap_agent_role_forge', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', NULL),
('ev_agent_role_job_planner_reach', 'cap_agent_role_job_planner', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', NULL),
('ev_agent_role_job_planner_adr', 'cap_agent_role_job_planner', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', 'KEEP_FOR_PLANNED_CAPABILITY.'),
('ev_agent_role_orchestrator_reach', 'cap_agent_role_orchestrator', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', NULL),
('ev_agent_role_orchestrator_boundary_adr', 'cap_agent_role_orchestrator', 'ADR', 'docs/architecture/ADR-036-prometeo-agents-boundary.md', 'Naming-collision risk with the real Prometeo Orchestrator; zero code coupling.'),
('ev_agent_role_orchestrator_adr', 'cap_agent_role_orchestrator', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', 'KEEP_FOR_PLANNED_CAPABILITY.'),
('ev_agent_role_ecv_reach', 'cap_agent_role_ecv', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', NULL),
('ev_agent_role_ecv_adr', 'cap_agent_role_ecv', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', 'KEEP_FOR_PLANNED_CAPABILITY — load-bearing default fallback, must not be deleted.'),
('ev_agent_role_project_copilot_reach', 'cap_agent_role_project_copilot', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', NULL),
('ev_agent_role_project_copilot_adr', 'cap_agent_role_project_copilot', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', 'DEPRECATE applies to the AgentRun-shaped path only, not the capability — the real feature lives in agents.service.ts:556''s chatWithTools.'),
('ev_agent_role_field_ops_reach', 'cap_agent_role_field_ops', 'TEST', 'tests/unit/agent-role-reachability-map.test.mjs', NULL),
('ev_agent_role_field_ops_adr', 'cap_agent_role_field_ops', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', 'DEPRECATE.'),
('ev_agent_role_field_ops_boundary_skill', 'cap_agent_role_field_ops', 'ADR', 'docs/architecture/ADR-029-labor-engine-canonical-time-owner.md', 'field-ops is being replaced by the Labor Engine.'),
('ev_agent_role_technical_agent_unwired', 'cap_agent_role_technical_agent', 'TEST', 'apps/api/test/agents.controller.test.ts', 'Proves the real z.enum(agentCatalog) schema rejects this role before the service layer.'),
('ev_agent_role_technical_agent_adr', 'cap_agent_role_technical_agent', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', 'KEEP_FOR_PLANNED_CAPABILITY.'),
('ev_agent_role_legal_agent_unwired', 'cap_agent_role_legal_agent', 'TEST', 'apps/api/test/agents.controller.test.ts', 'Proves the real z.enum(agentCatalog) schema rejects this role before the service layer.'),
('ev_agent_role_legal_agent_adr', 'cap_agent_role_legal_agent', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', 'KEEP_FOR_PLANNED_CAPABILITY.'),
('ev_agent_role_financial_agent_unwired', 'cap_agent_role_financial_agent', 'TEST', 'apps/api/test/agents.controller.test.ts', 'Proves the real z.enum(agentCatalog) schema rejects this role before the service layer.'),
('ev_agent_role_financial_agent_adr', 'cap_agent_role_financial_agent', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', 'KEEP_FOR_PLANNED_CAPABILITY.'),
('ev_agent_role_qa_agent_unwired', 'cap_agent_role_qa_agent', 'TEST', 'apps/api/test/agents.controller.test.ts', 'Proves the real z.enum(agentCatalog) schema rejects this role before the service layer.'),
('ev_agent_role_qa_agent_adr', 'cap_agent_role_qa_agent', 'ADR', 'docs/architecture/ADR-037-specialized-agent-builder-lifecycle.md', 'KEEP_FOR_PLANNED_CAPABILITY.')
ON CONFLICT ("id") DO NOTHING;
