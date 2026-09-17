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

## The real gap: 4 policy engines that look alike but scope on different axes

`docs/specs/prometeo/tool-registry-governance.spec.md:158-170` (SPEC-GTW-F2, unrelated to this skill's own gateway spec cited by `semse-prometeo-orchestrator` — this is the *tool-registry* one) says outright:

> *"ya existen 3 motores `allow|deny|require_approval` (Forge, `@semse/agents`, y el nuevo de F2) con formas convergentes pero vocabularios divergentes y sin interfaz común. Vale un ADR futuro..."*

That count of 3 misses `packages/agents/src/action-policy.ts`'s own second, internal engine — there are really **4**. A follow-up investigation traced all four precisely; they are **not interchangeable**, and don't assume "the policy engine" means one thing:

| # | Function | Real call sites | Decision axis | Approval vocabulary | Verdict |
|---|---|---|---|---|---|
| 1 | `evaluateAgentPolicy` (`governance.ts:873-959`) | `runtime.ts:770,875`, `agents.service.ts:189,253` | agent capability-manifest + computed risk score | free-text rule IDs | ADAPT |
| 2 | `getActionPolicy`/`resolveApprovalMode` (`action-policy.ts:25-37`) | `project-copilot.harness.ts`, `agent-work-plan.service.ts:154` | static table keyed only by `AgentActionType`, no agent/risk concept, **never denies** | `none\|recommended\|required` | REPLACE_DUPLICATE (overlaps #1's risk→approval escalation, but not a drop-in — no `deny` state) |
| 3 | `evaluateForgePolicy` (`packages/forge/src/policy.ts:86-155`) | `forge/orchestrator.ts:158`, `runtime.ts:467`, `forge.service.ts` | agent-role + file/branch scope + spec-approval-status (richest — can require multiple approval modes at once) | 5-value `ForgeApprovalMode` | ADAPT |
| 4 | `evaluatePrometeoToolPolicy` (`apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts:11-28`) | `prometeo-tool-execution.service.ts:145,234` (**not** `prometeo-tool-registry.ts` — that file is only the static tool catalog; correct this if you see it stated elsewhere) | RBAC permission-match + a static per-tool approval tier | collapses the schema's 4-tier `approvalPolicy` down to a single `require_approval` (confirmed data loss, see its own test `T-012b`) | ADAPT |

Only the outer `decision` field (`allow|deny|require_approval`) is genuinely shared syntax across all four. The approval-mode *payloads* are mutually incompatible (a labeling hint in #2 vs. a hard gate with named approver roles in #1/#3/#4) — unifying them requires the ADR the spec already calls for, not a code merge.

**The `decision`-only unification is now done.** `packages/schemas/src/policy-decision.types.ts` exports `PolicyDecisionBase`/`PolicyDecisionOutcome` (just `{ decision: "allow"|"deny"|"require_approval" }`), and two compile-time-only contract files prove engines #1/#3/#4 structurally satisfy it without importing or touching each other's approval-mode payloads: `packages/agents/src/policy-decision-contract.ts` (covers #1 `AgentPolicyResult` and #3 `ForgePolicyResult`, since `@semse/agents` already depends on both `@semse/schemas` and `@semse/forge`) and `apps/api/src/modules/prometeo/tool-governance/policy-decision-contract.ts` (covers #4). Engine #2 (`action-policy.ts`) is deliberately excluded — it has no `decision` field to check. These files have zero runtime effect (erased by `tsc`); they exist so a future change that breaks the shared `decision` shape on any of the three real gating engines fails the build in one place instead of drifting silently. `packages/forge` itself was left untouched (no new dependency added to it) — the compatibility check lives at the consumer side (`@semse/agents`, which already imports both), keeping forge's zero-dependency package.json intact.

Touching the approval-mode vocabularies themselves (the ADR) is still an architecture decision above this skill's scope — flag it to the user/`semseproject` rather than picking one vocabulary unilaterally.

## Reachability of the 16 `RuntimeAgentRole`s — verified role-by-role, not "most are dead"

`apps/worker/src/main.mjs:449` gates on `shouldUseSpecializedWorkerHandler(run.agentType)` (`agent-run-handlers.mjs:1221-1223`, a membership check against `SPECIALIZED_HANDLERS`, 13 keys): true → `executeSpecializedWorkerRun` (DB-backed handler); false → `executeGovernedAgentRun` (`runtime.ts`'s real builder logic). A second, narrower gate also matters: the legacy `agentCatalog` (11 roles, `packages/agents/src/index.ts:395-407`) — not the full 16-role `runtimeAgentRoles` enum — is what the public creation schema (`createAgentRunSchema`, `agents.controller.ts:31`) and the domain-event trigger router (`agent-trigger-router.service.ts:22`) actually accept. A role missing from `agentCatalog` is rejected by Zod before it ever reaches a policy check.

Verified classification (production entrypoint → router → handler/builder, traced per role, not assumed from the handler table alone):

| Role | Classification | Why |
|---|---|---|
| `pricing`, `trust-match`, `evidence-coach`, `risk` | **PRODUCTION_REACHABLE** | real triggers (e.g. `jobs.service.ts`, `milestones.service.ts`, `disputes.events.ts`) → `SPECIALIZED_HANDLERS` DB-backed handler. `runtime.ts`'s own builder for these is unreached — the handler, not the builder, is what runs. |
| `dispute` | **PRODUCTION_REACHABLE** (real `runtime.ts`) | not in `SPECIALIZED_HANDLERS` → falls to `executeGovernedAgentRun` → `runtime.ts`'s `buildDispute` actually executes. |
| `forge` | **PRODUCTION_REACHABLE** (real `runtime.ts`) | two independent paths both reach `buildForge`: the worker's `handleForge` (in `SPECIALIZED_HANDLERS`) internally calls `executeGovernedAgentRun` anyway; `ForgeAgentAdapterService.execute` also calls it synchronously in-process from the API, bypassing the worker entirely. |
| `browser-agent` | **PRODUCTION_REACHABLE** | real BFF (`admin/browser-agent/missions`) → `browser-agent.service.ts` → `agentsService.create` → handler. |
| `job-planner`, `orchestrator`, `ecv`, `field-ops`, `project-copilot` | **INTEGRATION_ONLY** | wired (in `agentCatalog`, has a handler or a real `runtime.ts` branch) but **nothing ever creates a run of this type**. Notably `orchestrator`/`ecv` have real, executable `runtime.ts` branches — they just never run, so don't confuse "has code" with "reachable." The real "Project Copilot" product feature (`agents.controller.ts:665`) doesn't use `project-copilot` runs at all — it calls `agentsService.chatWithTools` directly, an unrelated LLM code path. |
| `technical-agent`, `legal-agent`, `financial-agent`, `qa-agent` | **DESIGNED_BUT_UNWIRED** | excluded from `agentCatalog`, so the public schema and trigger router reject them outright; would fall to `runtime.ts:701`'s `default: buildEcv(input) // minimal passthrough` stub if ever reached, which nothing does. |

Net: **7 of 16 roles are truly production-reachable**, and of those, only `dispute` and `forge` execute `runtime.ts`'s own builder code — the other 5 reachable roles run through entirely separate DB-backed handlers in `agent-run-handlers.mjs`. **The tested code path (`apps/api/test/agent-governance.test.ts` exercises `runtime.ts` builders directly) and the production code path have diverged for most roles** — if you're asked to "fix" a builder, confirm first whether the fix belongs in `runtime.ts` (what the tests cover) or in `agent-run-handlers.mjs`'s DB-backed handler (what production actually runs) — they are not the same code, and for pricing/trust-match/evidence-coach/risk, only the handler matters in prod.

## The SPEC-AGT-001 verification loop never actually triggers

`runtime.ts:928-995` (plus all of `verification.ts`/`verifiers.ts`) implements an act→verify→fix loop, gated by `isWriteActionType(declaredActionType)`. Every real caller (`agent-run-handlers.mjs:1172`, `main.mjs:457`, `forge-agent-adapter.service.ts:56`) omits `actionType`/`verification` entirely, defaulting to `"runtime.execute"` — and Forge's own actionType (`"forge.evaluate"`) isn't in `WRITE_ACTION_TYPES` (`verification.ts:107-113`) either. So the verification loop is real, tested code that structurally cannot activate from any current call site.

## `packages/autonomy` is cleanly separate — one conceptual seam only

No code coupling either direction (`grep @semse/agents packages/autonomy/src` and the reverse both return zero hits). `autonomy` is a Playwright/browser-automation + spec-drift-loop toolkit; `agents` is governance/manifests. `governance.ts` declares a `"browser-agent"` runtime role, but actual browser automation is wired `@semse/autonomy` → `apps/worker/src/browser-agent/browser-agent.runner.mjs:2` directly — `browser-agent.service.ts`/`browser-agent.controller.ts` never import `@semse/agents` at all. Don't assume the `"browser-agent"` manifest entry is load-bearing for how browser automation actually runs.

## Notas para futuros agentes / hallazgos abiertos

- No se propuso ni implementó el ADR que el propio spec F2 pide (vocabulario común de approval-mode entre los 4 motores) — sigue siendo un hueco real y una decisión de arquitectura, no una tarea de esta skill. Una interfaz que unifique solo el campo `decision` (sin tocar los payloads de approval-mode) sí es segura de agregar sin ese ADR.
- No se investigó si `agent-run-handlers.mjs`'s DB-backed handlers para pricing/trust-match/evidence-coach/risk duplican lógica que también existe en los builders unreached de `runtime.ts`, o implementan algo genuinamente distinto — si te toca modificar uno de esos roles, compará ambos lado a lado antes de asumir cuál es la fuente de verdad real; en prod, el handler es lo que corre, no el builder.
- El inventario de reachability de los 16 roles y el mapa de los 4 motores de aprobación (ambos arriba) ya están verificados línea por línea — no hace falta re-derivarlos desde cero, pero si el código se mueve, re-verificá antes de confiar en la clasificación (`agentCatalog` vs. `runtimeAgentRoles`, `SPECIALIZED_HANDLERS`, y los call sites de cada motor de política son los puntos más frágiles a re-chequear).
- No se abrió `anatomy.ts`/`developer-runtime.ts` en profundidad — se confirmó que existen y se usan, pero no se auditó su contenido con el mismo nivel de detalle que `governance.ts`/`runtime.ts`.
- El hallazgo de los 4 motores de política se cruza directamente con `semse-security-baseline` (RC6, auth weaknesses) y con `semseproject`'s Approval Gate — si el trabajo es de autorización de agentes, leé ambas skills también, no solo esta.
