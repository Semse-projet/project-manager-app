---
name: semse-agents-governance
description: packages/agents is a real, substantive governance/runtime library ("Sistema de agentes") — but it is unrelated to apps/api/src/modules/ai-models/ (semse-prometeo-orchestrator), contains 3-4 separate allow/deny/require_approval policy engines with no common interface (a risk the repo's own SPEC-AGT/F2 spec already flags as unresolved), and most of its "specialized agent" runtime logic is dead in production — only exercised by unit tests. Use before touching packages/agents/src/, wiring a new agent policy check, or reasoning about which code path an agentType actually runs through in apps/worker.
---

# SEMSE `packages/agents` — governance library, not the Prometeo orchestrator

## It is a separate system from `ai-models/`

Despite the name overlap with `apps/api/src/modules/agents/agent-delegation.service.ts` (a different module, same word "agents"), `packages/agents` shares **no code or imports** with `apps/api/src/modules/ai-models/` (the Prometeo orchestrator documented in `semse-prometeo-orchestrator`). It's a standalone governance/manifest/runtime library consumed by `apps/api/src/modules/{agents,anatomy,developer-runtime,domain-events,forge}/`, `apps/worker/src/{main,agent-run-handlers}.mjs`, and the web agents chat panel — plain DI/module imports, not a plugin system. Don't assume work on one touches the other.

## Real substance, ~3,780 LOC across 14 files in `packages/agents/src/`

- `governance.ts` (998 lines) — `agentToolRegistry` (17 tools), `runtimeAgentManifests` for 16 `RuntimeAgentRole`s, `evaluateAgentPolicy` (allow/deny/require_approval), `classifyAgentRisk`.
- `runtime.ts` (1,080 lines) — `executeSpecializedAgent`/`executeGovernedAgentRun`, plus a SPEC-AGT-001 act→verify→fix loop.
- `delegate.ts`/`registry.ts`/`registrations.ts` — a Hermes-style subagent delegation system (`delegateTo`/`delegateAll`, blocked roles).
- `verification.ts`/`verifiers.ts` — `spawnSync`-based CI verifier runner, **deliberately excluded from `index.ts`'s export surface**: `index.ts:490-493` has a comment explaining `apps/web` imports `@semse/agents` from client components, and `node:child_process` would break the webpack bundle. Server-side entrypoints import `"@semse/agents/verifiers"` directly instead.
- `action-policy.ts` (37 lines) — a **second, unrelated** approval matrix keyed by `AgentActionType` from `@semse/schemas`. Shares no types or logic with `governance.ts`'s policy engine.
- `agent-registry.ts`/`semse-agents.types.ts` — a **third, unrelated** thing: the "6-agent architecture" catalog (marketplace/buildops/protools/evidence/crowd/prometeo), pure data with no runtime wiring to the other two.
- `index.ts` also re-exports the legacy `NAMED_AGENTS`/`SPECIALIZED_AGENTS` conversational-persona catalog (Marta, Felix, Justus, etc.), migrated from `labsemse/src/lib/ai.ts` per its own comment at `index.ts:5`.
- `master-domains.ts` is dead code — not re-exported from `index.ts`, not imported anywhere under `apps/`.

## The real gap: 3-4 policy engines, no common interface — and the repo's own spec already flags it

`docs/specs/prometeo/tool-registry-governance.spec.md:158-170` (SPEC-GTW-F2, unrelated to this skill's own gateway spec cited by `semse-prometeo-orchestrator` — this is the *tool-registry* one) says outright, in its own words:

> *"ya existen 3 motores `allow|deny|require_approval` (Forge, `@semse/agents`, y el nuevo de F2) con formas convergentes pero vocabularios divergentes y sin interfaz común. Vale un ADR futuro..."*

That count of 3 doesn't even include `packages/agents/src/action-policy.ts`'s own second, internal `getActionPolicy`/`resolveApprovalMode` engine — meaning there are really **4** independently-evolved approval-decision engines in this codebase today, and no spec has fully inventoried them. **Before adding a 5th, or before assuming "the policy engine" means one thing, check which of these four you're actually looking at**: `evaluateAgentPolicy` (`governance.ts`), `getActionPolicy`/`resolveApprovalMode` (`action-policy.ts`), Forge's `evaluateForgePolicy`, and the F2 tool-registry one (`apps/api/src/modules/prometeo/prometeo-tool-registry.ts`). This is exactly the kind of ambiguity `semseproject`'s Approval Gate needs a definitive answer on when a task touches agent authorization — don't guess which engine gates a given call site.

## Most of the "specialized agent" runtime is dead in production

`apps/worker/src/main.mjs:449` routes any `agentType` present in `SPECIALIZED_HANDLERS` (`agent-run-handlers.mjs:1205-1219` — 13 of the 16 `RuntimeAgentRole`s, including `pricing`/`job-planner`/`trust-match`/`evidence-coach`/`risk`) to bespoke DB-backed handlers **instead of** `runtime.ts`'s `executeGovernedAgentRun`. Only `dispute`, `orchestrator`, `ecv`, and `forge` ever reach that real logic in production (confirmed: `grep executeGovernedAgentRun|executeSpecializedAgent apps/api/src/modules/agents/` returns zero hits). The unreachable functions (`buildPricing`, `buildJobPlan`, `buildTrustMatch`, `buildEvidenceCoach`, `buildRisk` — `runtime.ts:110-346`, ~250 lines) are only exercised by `apps/api/test/agent-governance.test.ts`/`agents.controller.test.ts` — **the tested code path and the production code path have diverged**. If you're asked to "fix" or "improve" one of these five builders, confirm first whether the fix needs to land in `runtime.ts` (tests) or in the actual `agent-run-handlers.mjs` DB-backed handler (production) — they are not the same code.

Related: `runtime.ts:701`'s `default:` case for `field-ops`/`project-copilot`/`technical-agent`/`legal-agent`/`financial-agent`/`qa-agent` falls through to `buildEcv(input)` with an explicit `// minimal passthrough` comment — a self-acknowledged stub, and also unreachable in prod for the same reason.

## The SPEC-AGT-001 verification loop never actually triggers

`runtime.ts:928-995` (plus all of `verification.ts`/`verifiers.ts`) implements an act→verify→fix loop, gated by `isWriteActionType(declaredActionType)`. Every real caller (`agent-run-handlers.mjs:1172`, `main.mjs:457`, `forge-agent-adapter.service.ts:56`) omits `actionType`/`verification` entirely, defaulting to `"runtime.execute"` — and Forge's own actionType (`"forge.evaluate"`) isn't in `WRITE_ACTION_TYPES` (`verification.ts:107-113`) either. So the verification loop is real, tested code that structurally cannot activate from any current call site.

## `packages/autonomy` is cleanly separate — one conceptual seam only

No code coupling either direction (`grep @semse/agents packages/autonomy/src` and the reverse both return zero hits). `autonomy` is a Playwright/browser-automation + spec-drift-loop toolkit; `agents` is governance/manifests. `governance.ts` declares a `"browser-agent"` runtime role, but actual browser automation is wired `@semse/autonomy` → `apps/worker/src/browser-agent/browser-agent.runner.mjs:2` directly — `browser-agent.service.ts`/`browser-agent.controller.ts` never import `@semse/agents` at all. Don't assume the `"browser-agent"` manifest entry is load-bearing for how browser automation actually runs.

## Notas para futuros agentes / hallazgos abiertos

- No se propuso ni implementó el ADR que el propio spec F2 pide (`PolicyDecision` común entre los 3-4 motores) — sigue siendo un hueco real, no una tarea de esta skill.
- No se investigó si `agent-run-handlers.mjs`'s DB-backed handlers for pricing/job-planner/trust-match/evidence-coach/risk duplicate logic that also exists in `runtime.ts`'s dead builders, or implement something genuinely different — si te toca modificar uno de esos 5 roles, comparalos línea por línea antes de asumir cuál es la fuente de verdad real.
- No se abrió `anatomy.ts`/`developer-runtime.ts` en profundidad — se confirmó que existen y se usan, pero no se auditó su contenido con el mismo nivel de detalle que `governance.ts`/`runtime.ts`.
- El hallazgo de los 4 motores de política se cruza directamente con `semse-security-baseline` (RC6, auth weaknesses) y con `semseproject`'s Approval Gate — si el trabajo es de autorización de agentes, leé ambas skills también, no solo esta.
