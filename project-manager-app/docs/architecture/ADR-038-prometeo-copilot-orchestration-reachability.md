# ADR-038 — Prometeo Copilot/Orchestration Surface: Reachability Audit (AG-04)

- **Date:** 2026-09-18
- **Status:** Accepted
- **Owners:** Agents Governance Reconciliation, follow-up investigation after ADR-037
- **Affected domains:** `apps/api/src/modules/orchestration`, `apps/api/src/modules/prometeo-copilot`, `apps/worker/src/agent-run-handlers.mjs` (`handleProjectCopilot`), `docs/architecture/ADR-036`, `docs/architecture/ADR-037`

## Context

ADR-037 classified the `project-copilot` `RuntimeAgentRole`'s `AgentRun`-shaped path as `INTEGRATION_ONLY` and described it as *"a second, currently-dead implementation of the same product surface"* superseded by the real Project Copilot feature. Before deciding whether that path was worth deleting or wiring a real trigger to, this investigation traced the actual code and found two things ADR-037 did not have:

1. **The characterization was imprecise.** `handleProjectCopilot` (`apps/worker/src/agent-run-handlers.mjs:777-822`) does not reimplement anything — it calls `POST /v1/agents/copilot` (`kind: "chat"`), the exact same endpoint the real product UI hits. It is a legitimate delegation adapter with zero real trigger today (verified: no domain event anywhere in `apps/api/src` declares `"project-copilot"` in its `triggers: [...]` array), not dead/duplicate code.
2. **Following that thread surfaced two more real, live, previously-uninvestigated systems** with the same shape: fully built, registered, tested — and reachable only up to the BFF, with no UI consumer. This ADR exists to record that finding precisely, per the reconciliation's own rule: never characterize a code path's status from its name or its existence alone.

Also correcting one entrypoint citation used in ADR-037 and `semse-agents-governance`'s SKILL.md: the real Project Copilot feature's entrypoint is `POST /v1/agents/copilot` → `ProjectCopilotHarness.run()` (`apps/api/src/modules/agents/harnesses/project-copilot.harness.ts`) — a large, self-contained harness with its own tool-calling surface (disputes, milestones, payments, projects, technical-runtime, workspace-memory). `AgentsService.chatWithTools()` (`agents.service.ts:556`) is not itself the entrypoint; the harness calls it internally (`project-copilot.harness.ts:353`) as one low-level LLM-turn primitive. The substantive conclusion (the real feature does not go through `AgentRun`/`executeGovernedAgentRun`) is unchanged — only which function is "the entrypoint" needed fixing.

## Existing implementations found

| System | Real entrypoint | Registered? | BFF proxy? | Tests? | Real UI consumer? |
|---|---|---|---|---|---|
| Project Copilot (product, real) | `POST /v1/agents/copilot` → `ProjectCopilotHarness.run()` | Yes | Yes | Yes | **Yes** — this is the live feature |
| `project-copilot` `AgentRun` delegate | `apps/worker/src/agent-run-handlers.mjs:handleProjectCopilot` → calls the endpoint above | N/A (worker handler, not an HTTP module) | N/A | Yes (reachability-tested per ADR-037) | No — no domain event declares it as a trigger |
| `orchestration.service.ts` (`v1/prometeo/orchestrate`, `/agents/:id/consult`, `/orchestration/:id`) | `OrchestrationController` (`apps/api/src/modules/orchestration/orchestration.controller.ts`) | Yes (`OrchestrationModule` in `app.module.ts:151`) | Yes — 3 real routes under `apps/web/app/api/semse/prometeo/{orchestrate,agents/[agentId]/consult,orchestration/[orchestrationId]}` | Yes (`orchestration.service.test.ts`, `orchestration.fsm.test.ts`) | **No** — zero grep hits for these BFF paths anywhere in `apps/web` outside the BFF routes themselves |
| `prometeo-copilot.service.ts` (`v1/prometeo/copilot/{context,message,mission/create,action/execute}`) | `PrometeoCopilotController` — imports `OrchestrationService` directly | Yes (`PrometeoCopilotModule` in `app.module.ts:152`) | Yes — 4 real routes under `apps/web/app/api/semse/prometeo/copilot/*` | Yes (`prometeo-copilot.service.test.ts`) | **No** — same, zero UI consumer found |

Also checked and ruled out: `apps/mobile`, `apps/assistant-portal`, `apps/angular` (CLAUDE.md's own "secondary/transitional surfaces" list) as possible alternate consumers of `orchestration`/`prometeo-copilot` — no hits. The only `v1/prometeo/*` match in mobile is `live-sessions` (video inspection via LiveKit), an unrelated feature sharing only the URL prefix.

Both `orchestration.service.ts` and `prometeo-copilot.service.ts` are **not** `RuntimeAgentRole`s — they are not governed by `packages/agents`' `evaluateAgentPolicy`/`executeGovernedAgentRun` at all, and are outside the scope of the 16-role Capability Registry seed (ADR-037, #650). They route to the legacy `NAMED_AGENTS`/`PrometeoAgentId` conversational-persona catalog (Marta, Felix, etc.) that `semse-agents-governance`'s SKILL.md already flags as a separate, unrelated surface inside `packages/agents/src/index.ts`.

## Options considered

### Option A — Build the missing UI now (finish wiring `orchestration`/`prometeo-copilot` into a real screen)
Rejected. No product spec exists for either surface's UI. Building one now would be speculative feature work invented by this investigation, not something requested — exactly what the reconciliation's own discipline (`docs/specs/prometeo/tool-registry-governance.spec.md`'s own caution against unrelated refactors) warns against.

### Option B — Delete the three orphaned paths as dead code
Rejected. All three are fully built, tested, registered, and reachable end-to-end through the BFF — this is materially different evidence than a `DESIGNED_BUT_UNWIRED` `RuntimeAgentRole` rejected by a public schema. There is no signal here of abandonment (no deprecation comment, no superseding PR, no "TODO: remove") versus a paused-in-progress feature. Deleting live, passing-tests, registered API surface without an owner's confirmation would repeat the exact "delete without evidence" mistake ADR-037's own hard rule exists to prevent.

### Option C — Document the reachability honestly, correct the record, and hand the build-vs-deprecate call to a product decision (chosen)

## Decision

`KEEP_FOR_PLANNED_CAPABILITY`-equivalent for all three (no code deleted, no code added, no trigger wired):

- **`project-copilot` `AgentRun` delegate**: reachability classification (`INTEGRATION_ONLY`) in the Capability Registry (#650/#651) does not change — it was already correct. Only the *description* is corrected: `ADR-037` and `semse-agents-governance`'s SKILL.md are updated to say "legitimate delegation adapter to `/v1/agents/copilot`, no real trigger exists" instead of "a second, currently-dead implementation."
- **`orchestration.service.ts`** and **`prometeo-copilot.service.ts`**: newly documented here as real, tested, registered, BFF-complete, UI-orphaned systems. Not registered as `Capability` rows in this ADR — that is proposed as a deferred, separate small PR (see Deferred below), since they are not `RuntimeAgentRole`s and adding them needs its own key/domain naming decision, not a mechanical extension of the 16-role seed.
- **No rename, no deletion, no new trigger** for any of the three in this ADR.

## Why

- The same anti-inflation discipline this whole reconciliation applies to `RuntimeAgentRole`s applies here: "fully coded" and "tested" are not "used." Two more real systems match that exact gap shape, so the honest move is to record them with the same rigor, not extend scope into fixing them without a product owner's input.
- Assuming either "these should be finished" or "these should be deleted" would both be guessing at intent this investigation has no authority to resolve — a product decision is genuinely required here, unlike the `RuntimeAgentRole` lifecycle calls in ADR-037 which had enough evidence (CLAUDE.md's own field-ops note, the real chatWithTools-adjacent path for project-copilot) to decide without a person.
- Correcting the `chatWithTools` citation now, while the evidence is fresh, prevents a future contributor from citing ADR-037 or the skill and being misled about which function is the real entrypoint.

## Invariants

- No future doc, ADR, or skill note may cite `orchestration.service.ts` or `prometeo-copilot.service.ts` as "used by the product" without a real UI consumer citation (a component or page that actually calls their BFF routes) — the same evidentiary bar ADR-037 set for `RuntimeAgentRole` reachability now applies to this surface too.
- A future contributor asked to build a UI for either "Prometeo orchestration/consult" or "Prometeo copilot suggestions" must first check these two services — they are the real, already-built backend for that concept; building a second, parallel implementation would repeat exactly the mistake this reconciliation exists to prevent.
- The `project-copilot` `AgentRun` delegate's corrected description (delegation adapter, not dead reimplementation) must be carried into any future edit of ADR-037 or the skill — never restore the "second implementation" phrasing.

## Migration plan

None — this ADR changes no code. The `chatWithTools` citation fix in ADR-037 and the SKILL.md is a documentation-only correction, applied in this same PR.

## Compatibility

- **API:** none — no endpoint added, removed, or changed.
- **Mobile:** not applicable (confirmed no consumer there).
- **Events:** none.
- **Database:** none — no `Capability` rows added in this ADR (see Deferred).
- **Workflows:** none.

## Risks

- Leaving these two systems undecided has a real cost: they consume CI/test-maintenance attention for a feature nobody currently uses, and every future contributor who greps for "orchestrator" or "copilot" now has to read this ADR to know they're not the enabled path. That cost is smaller than the risk of guessing wrong on a delete or a speculative build.
- `orchestration.service.ts` is now confirmed as a **third** real system carrying "orchestrator/orchestration" naming near the `orchestrator` `RuntimeAgentRole` (ADR-036) and the real Prometeo Orchestrator (`ai-models/`) — ADR-036 did not know about this one. This ADR does not rewrite ADR-036; it flags the gap as a deferred addendum.

## Verification

- Module registration: `grep -n "OrchestrationModule\|PrometeoCopilotModule" apps/api/src/app.module.ts` — both present.
- BFF routes: `apps/web/app/api/semse/prometeo/{orchestrate,agents/[agentId]/consult,orchestration/[orchestrationId]}/route.ts` and `apps/web/app/api/semse/prometeo/copilot/{context,message,mission/create,action/execute}/route.ts` all exist.
- Zero UI consumer: `grep -rln "prometeo/orchestrate\|prometeo/copilot\|prometeo/agents.*consult\|prometeo/orchestration" apps/web/app --include="*.ts" --include="*.tsx"` returns only the BFF route files themselves.
- Zero real trigger for the `project-copilot` delegate: every `triggers: [...]` array emitted in `apps/api/src` was inspected; none names `"project-copilot"`.
- `chatWithTools` citation: `grep -rn "chatWithTools" apps/api/src --include="*.ts"` shows exactly one real caller (`project-copilot.harness.ts:353`) besides its own definition.

## Rollback

Not applicable — this ADR and its accompanying documentation fixes change no code and no runtime behavior.

## Deferred (explicitly out of scope for this ADR)

- **Product decision**: whether to build the missing UI for `orchestration.service.ts`/`prometeo-copilot.service.ts`, or formally deprecate and remove them. This ADR does not make that call.
- Registering `orchestration.service.ts` and `prometeo-copilot.service.ts` as `Capability` rows in the ADR-032 registry, with their own key/domain naming (not `agent-role:*`, since they are not `RuntimeAgentRole`s) — a separate, small PR, mirroring the pattern PR A (#650) used for the 16 agent roles.
- Wiring a real trigger for the `project-copilot` `AgentRun` delegate — deferred until (if ever) a real product need for an autonomous, event-triggered Project Copilot iteration is identified; this ADR found no such need today.
- Updating ADR-036 (AG-02, Prometeo ↔ `packages/agents` boundary) with an addendum noting `orchestration.service.ts` as a third "orchestrator"-named system — flagged here, not rewritten in this ADR.
- The `orchestrator` `RuntimeAgentRole` naming-collision follow-up itself (still separate, per the reconciliation's own sequencing).
