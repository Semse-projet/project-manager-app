# ADR-037 — Specialized Agent Builder Lifecycle & Reachability Policy (AG-03)

- **Date:** 2026-09-18
- **Status:** Accepted
- **Owners:** Agents Governance Reconciliation (post `semse-agents-governance`, PR #648/#649)
- **Affected domains:** `packages/agents`, `apps/worker`, `apps/api/src/modules/agents`, `apps/api/src/modules/capability-registry`, `apps/web/app/(app)/agents`

## Context

The reconciliation charter's hard rule: **"unit-tested does not mean production-reachable."** A `RuntimeAgentRole` is only `INTEGRATED` if a real chain — production entrypoint → router/orchestrator → capability → specialized builder/runtime → tool/domain — is demonstrable, not assumed from a manifest existing or a unit test passing. This ADR records that chain's verified state for all 16 roles, decides what happens to the roles that don't reach it (the charter forbids deleting any of them without evidence first), and proposes how the ADR-032 Capability Reality Registry should represent this without inflating maturity.

## Existing implementations found

Reachability traced end-to-end and locked in as an executable test (`tests/unit/agent-role-reachability-map.test.mjs`), not narrative:

- `apps/worker/src/main.mjs`'s `processQueuedRun` (~line 429) is the one real worker entrypoint: `shouldUseSpecializedWorkerHandler(run.agentType) ? executeSpecializedWorkerRun(...) : executeGovernedAgentRun(...)`.
- `apps/worker/src/agent-run-handlers.mjs`'s `SPECIALIZED_HANDLERS` (13 keys, lines ~1203-1217) routes: `field-ops, trust-match, pricing, job-planner, evidence-coach, risk, project-copilot, technical-agent, legal-agent, financial-agent, qa-agent, browser-agent, forge`.
- The remaining 3 roles (`dispute, orchestrator, ecv`) fall through to `executeGovernedAgentRun`, which dispatches to `runtime.ts`'s own `executeSpecializedHandler` switch (line ~640), whose `default` branch (line 700-701) is `return buildEcv(input); // minimal passthrough` — meaning `buildEcv` is not just "one role's builder," it is the switch's load-bearing fallback for any unmatched role too.
- The public creation surface gates on a narrower, 11-role `agentCatalog` (`packages/agents/src/index.ts:395-407`), consumed by both `apps/api/src/modules/agents/agents.controller.ts:30-31` (`createAgentRunSchema = z.enum(agentCatalog)`) and `apps/api/src/modules/domain-events/agent-trigger-router.service.ts:22` (`new Set(agentCatalog)`). **5 roles are excluded from both**: `technical-agent, legal-agent, financial-agent, qa-agent` (no manifest reason found — simply absent from the smaller catalog) and, distinctly, `forge` (excluded from the *public* schema but reachable via its own dedicated path, `ForgeAgentAdapterService.execute`, which creates/executes forge runs directly rather than through the public Zod-gated endpoint).
- `project-copilot`'s real, shipped user-facing feature does not go through `AgentRun`/the worker at all — its entrypoint is `POST /v1/agents/copilot` → `ProjectCopilotHarness.run()` (`agents.controller.ts:669-679`, `harnesses/project-copilot.harness.ts`), a large, self-contained harness that internally calls `agents.service.ts:556`'s `chatWithTools` (`project-copilot.harness.ts:353`) as one low-level LLM-turn primitive, not as its own entrypoint. `agent-run-handlers.mjs:handleProjectCopilot` (the `SPECIALIZED_HANDLERS.["project-copilot"]` entry) is a legitimate delegation adapter that calls that same `/v1/agents/copilot` endpoint — not a second, duplicate implementation — it simply has no real trigger today (see ADR-038, AG-04, which corrects this citation and traces two more systems in the same reachability shape).

### Verified classification (16 roles)

| Role | Class | Evidence |
|---|---|---|
| `pricing`, `trust-match`, `evidence-coach`, `risk`, `browser-agent` | `PRODUCTION_REACHABLE` | Reachable via `SPECIALIZED_HANDLERS` from the real worker entrypoint; DB-backed handler in `agent-run-handlers.mjs`, covered by `tests/unit/worker-specialized-handlers.test.mjs` |
| `dispute` | `PRODUCTION_REACHABLE` | Falls through to `executeGovernedAgentRun` → `runtime.ts`'s own `buildDispute`; end-to-end path covered by `apps/api/test/agent-governance.test.ts` |
| `forge` | `PRODUCTION_REACHABLE` | Two real paths: `SPECIALIZED_HANDLERS.forge` (worker) AND `runtime.ts`'s own `buildForge` (via `executeGovernedAgentRun`, when invoked from `ForgeAgentAdapterService`); fully covered end-to-end by `tests/unit/forge-runtime-integration.test.mjs` (manifest→policy→sandbox→...→rollback) |
| `job-planner`, `field-ops`, `project-copilot` | `INTEGRATION_ONLY` | Real `SPECIALIZED_HANDLERS` entry and/or real `runtime.ts` branch exists and is reachability-tested, but no real production trigger currently invokes it for this role (field-ops/project-copilot: superseded by a different real feature — see below) |
| `orchestrator`, `ecv` | `INTEGRATION_ONLY` | Real, executable `runtime.ts` branches (`buildOrchestrator`, `buildEcv`) reachable via `executeGovernedAgentRun`'s fallthrough, but nothing in the current codebase creates an `AgentRun` with these `agentType`s |
| `technical-agent`, `legal-agent`, `financial-agent`, `qa-agent` | `DESIGNED_BUT_UNWIRED` | Real manifests (`governance.ts:606-693`, with real risk/tool/owner metadata) and real `SPECIALIZED_HANDLERS` entries, but rejected by both public gates (`createAgentRunSchema`, `AgentTriggerRouter`'s allow-set) — no entrypoint in this codebase can create a run of this type at all |
| — | `DEAD` (0 roles) | None — every role has at least a manifest + a reachable handler/branch |

## Options considered

### Option A — Delete every non-`PRODUCTION_REACHABLE` builder now
Rejected outright by the charter itself ("Do NOT delete dead builders in the first pass... requiring evidence before any delete"). Several of the 9 non-production-reachable roles (`ecv` as the switch's default fallback; `technical-agent`/`legal-agent`/`financial-agent`/`qa-agent` with real risk-scored manifests) show clear signs of intentional, not-yet-activated design, not abandonment.

### Option B — Leave all 9 exactly as they are, undocumented
Rejected. This is the status quo the charter's Mission Control finding (`apps/web/app/(app)/agents/page.tsx`) shows is actively harmful: without a recorded lifecycle decision per role, a UI surface has no way to distinguish "reachable" from "unwired" and defaults to presenting all of them identically as `"Backend activo"`.

### Option C — Per-role lifecycle decision now (`CONNECT / KEEP_FOR_PLANNED_CAPABILITY / DEPRECATE / DELETE`), evidence-gated, no code deleted in this pass (chosen)

## Decision

| Role | Lifecycle decision | Rationale |
|---|---|---|
| `job-planner` | `KEEP_FOR_PLANNED_CAPABILITY` | Real handler + real test coverage (`worker-specialized-handlers.test.mjs`); only missing a production trigger, not a design or implementation gap |
| `orchestrator` | `KEEP_FOR_PLANNED_CAPABILITY` | Real `runtime.ts` branch; flagged risk (see ADR-036): this role's name collides with the unrelated Prometeo Orchestrator (`ai-models/`) — any future work connecting a trigger to this role must not be confused with, or implicitly become, a Prometeo integration |
| `ecv` | `KEEP_FOR_PLANNED_CAPABILITY` | Cannot be deleted without breaking `executeSpecializedHandler`'s exhaustiveness — `buildEcv` is the switch's own `default` fallback (`runtime.ts:700-701`), so it is load-bearing infrastructure even though no run is ever explicitly typed `ecv` today |
| `field-ops` | `DEPRECATE` | `CLAUDE.md`'s own module notes and `.claude/skills/semse-labor-engine-boundary/SKILL.md` already establish `field-ops` is being replaced by the Labor Engine; this role's `AgentRun` path should not receive further investment |
| `project-copilot` | `DEPRECATE` (the `AgentRun`-shaped path specifically) | The real, shipped Project Copilot feature bypasses `AgentRun` entirely via `POST /v1/agents/copilot` → `ProjectCopilotHarness.run()`; the `SPECIALIZED_HANDLERS`/`runtime.ts` path for this role name is a legitimate delegation adapter to that same endpoint (not a duplicate implementation — see ADR-038, AG-04), simply with no real trigger today — future Project Copilot work should extend the real harness path, not this one |
| `technical-agent`, `legal-agent`, `financial-agent`, `qa-agent` | `KEEP_FOR_PLANNED_CAPABILITY` | Real, risk-scored manifests with tool/owner metadata (`governance.ts:606-693`) read as intentional soft-launch gating (deliberately excluded from the public schema), not incomplete or abandoned work; no evidence found of a plan to remove them |

No role in this pass is classified `CONNECT` (wire up now) or `DELETE` — `CONNECT` requires a named, approved product trigger to build (none exists yet for any of the 6 `INTEGRATION_ONLY`/soft-gated roles), and `DELETE` requires positive evidence a capability is abandoned, which was found for none of them (the closest, `field-ops`/`project-copilot`, is `DEPRECATE`-the-path, not delete-the-role, because the role names and manifests remain valid domain concepts even as this specific implementation path is superseded).

## Why

- Every `KEEP_FOR_PLANNED_CAPABILITY` decision above is backed by a concrete, cited reason a role is unwired-but-intentional (test coverage, structural necessity, or documented soft-launch gating) — never a default "keep because deleting is scary."
- `DEPRECATE` is reserved for the two roles where a *different, real, already-shipped* path for the same product concern was found — not a general judgment that the role is low-value.
- This keeps task #48 (final report) and any future Mission Control fix honest: a UI or report consuming this table can now say "5 wired-but-unused, pending a trigger" instead of presenting them as equivalent to the 7 truly production-reachable roles.

## Invariants

- No `KEEP_FOR_PLANNED_CAPABILITY` role's builder/handler may be deleted without a new ADR citing a `CONNECT` (successfully wired and later retired) or fresh `DEPRECATE`/`DELETE` evidence — this ADR is not a one-time snapshot, it is the standing bar for the next reconciliation pass.
- Any UI or report presenting agent-role capability status (see Deferred below, and the Mission Control finding in `.claude/skills/semse-agents-governance/SKILL.md`) must distinguish at least these three states, not collapse them: `PRODUCTION_REACHABLE`, `INTEGRATION_ONLY`/`DESIGNED_BUT_UNWIRED`, and any future `DEPRECATE`d role.
- `ecv`'s status as the switch's default fallback must be preserved or explicitly re-decided in code (not silently dropped) if `executeSpecializedHandler` is ever refactored.

## Capability Reality Registry maturity — proposed corrections (ADR-032 integration)

`packages/db`'s `Capability` table (ADR-032) currently has no rows for any `RuntimeAgentRole` and no import relationship to `@semse/agents` at all. If/when these 16 roles are registered as `Capability` rows, this reconciliation's evidence caps their maturity as follows — deliberately conservative, per the charter's "never inflate" rule:

| Roles | Max maturity today | Why capped there, not higher |
|---|---|---|
| The 7 `PRODUCTION_REACHABLE` + 5 `INTEGRATION_ONLY` roles (12 total) | `INTEGRATED` | A real, reachability-tested production-entrypoint→router→builder/handler chain exists for all 12 (this ADR's own evidence). No `DEPLOYED` evidence was gathered in this reconciliation (no Railway deploy provenance checked — ADR-030 already found deploys are not git-triggered, so integration ≠ deployment) and no `VERIFIED`/`PRODUCTION` evidence (no live runtime observation collected) — asserting either would inflate maturity beyond what was actually checked |
| The 4 `DESIGNED_BUT_UNWIRED` roles | `TESTED` | Real manifest + real handler code exists and is unit-tested at the handler level (`worker-specialized-handlers.test.mjs` pattern), but no entrypoint in the codebase can reach them at all — `INTEGRATED` requires a demonstrable production path, which does not exist for these 4 |

This table is a proposal, not an executed migration — creating the `Capability` rows themselves is left to a separate, small PR per the charter's sequencing rule (ADRs first, implementation after), tracked under task #48.

## Migration plan

None in this ADR itself (no code changes). A follow-up PR, once this ADR is accepted, may: (a) add a short lifecycle-state doc-comment to each `KEEP_FOR_PLANNED_CAPABILITY`/`DEPRECATE`d role's manifest entry in `governance.ts` citing this ADR; (b) seed `Capability` rows per the table above; (c) fix the `apps/web/app/(app)/agents/page.tsx` "Backend activo" mislabeling (tracked separately — see Deferred).

## Compatibility

- **API:** none — no schema or endpoint changes.
- **Mobile:** not applicable.
- **Events:** none.
- **Database:** none in this ADR; the proposed `Capability` seeding (above) is purely additive per ADR-032's existing migration pattern.
- **Workflows:** none.

## Risks

- `project-copilot`'s dual-path state (real feature via `ProjectCopilotHarness`, unwired-but-legitimate delegation adapter via `AgentRun`) is a latent confusion risk for any future contributor who greps for "project copilot" and finds the `AgentRun`-shaped path first — the `DEPRECATE` decision here should be surfaced wherever that path is next touched. See ADR-038 (AG-04) for the corrected characterization and two more systems in the same reachability shape (`orchestration.service.ts`, `prometeo-copilot.service.ts`).
- If a future PR wires a real trigger for any `KEEP_FOR_PLANNED_CAPABILITY` role, it must re-run (or extend) `tests/unit/agent-role-reachability-map.test.mjs` rather than assume the classification still holds — reachability is a property of the current routing tables, not a permanent label.

## Verification

- `tests/unit/agent-role-reachability-map.test.mjs` (2 tests) passes and enforces that every one of the 16 `runtimeAgentRoles` is classified into exactly one of the two routing tables it checks against the real `shouldUseSpecializedWorkerHandler` function — a role added to the enum without an updated classification fails this test, not silently drifts.
- `apps/api/test/agents.controller.test.ts`'s new assertion (this reconciliation) proves the exact 5-role exclusion (`technical-agent, legal-agent, financial-agent, qa-agent, forge`) from the public `agentCatalog` schema against the real `z.enum(agentCatalog)`.

## Rollback

Delete the two new test files and revert the `agents.controller.test.ts` addition — no production code changed, so this is a clean, zero-risk rollback of the reconciliation's verification artifacts. The lifecycle decisions themselves (the table above) would need a superseding ADR, not a code rollback, if reversed.

## Deferred (explicitly out of scope for this ADR)

- Actually registering the 16 roles as `Capability` rows in the ADR-032 registry — separate, small PR (task #48).
- Fixing `apps/web/app/(app)/agents/page.tsx`'s `SPECIALIZED_AGENTS` hardcoded 8-of-16 mirror and its uniform `"Backend activo"` label regardless of real reachability — identified by this reconciliation, not yet implemented; a separate, small PR once this ADR is accepted (task #48).
- Building a real trigger for any `INTEGRATION_ONLY`/`DESIGNED_BUT_UNWIRED` role (a product decision, not an architecture one).
- Reconciling `project-copilot`'s two parallel paths beyond recording the `DEPRECATE` decision here (i.e., actually removing the dead `AgentRun`-shaped path) — left for whoever next touches that code, citing this ADR.
