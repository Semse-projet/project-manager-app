# ADR-036 — Prometeo Orchestrator ↔ `packages/agents` Boundary (AG-02)

- **Date:** 2026-09-18
- **Status:** Accepted
- **Owners:** Agents Governance Reconciliation (post `semse-agents-governance`, PR #648/#649)
- **Affected domains:** `apps/api/src/modules/ai-models`, `apps/api/src/modules/prometeo`, `apps/api/src/infrastructure/llm`, `packages/agents`

## Context

`.claude/skills/semse-prometeo-orchestrator/SKILL.md` documents that "the local Ollama model" already means three different things depending on the code path, and that `ai-models/` is "the Prometeo orchestrator, not a generic model wrapper" (`CLAUDE.md`). `.claude/skills/semse-agents-governance/SKILL.md` separately documents `packages/agents` ("Sistema de agentes") as unrelated to that orchestrator. The reconciliation charter required this relationship be made explicit rather than left implicit, because two subsystems that both use the word "agent" and both route decisions through an `allow|deny|require_approval`-shaped result (see ADR-035) are exactly the kind of pair a future contributor will assume are more connected than they are — or worse, will connect informally by having one call into the other's internals.

## Existing implementations found

Traced with real imports, not assumed from naming:

| Subsystem | What it actually owns | Key files |
|---|---|---|
| **Prometeo Orchestrator** | Resolving an operator's intent/context into a model call: task-type routing, provider selection (DeepSeek/Kimi/GLM/Ollama), privacy-critical routing to local Ollama, fallback-on-failure, tool invocation + tool-governance (`evaluatePrometeoToolPolicy`, ADR-035 engine #4), RAG/context ingestion | `apps/api/src/modules/ai-models/gateway/ai-model-gateway.service.ts`, `.../router/ai-model-router.service.ts`, `apps/api/src/infrastructure/llm/orchestrator.ts` (`LLMOrchestrator`) and `.../router/adaptive-router.ts` (`AdaptiveRouter`), `apps/api/src/modules/prometeo/prometeo.controller.ts` (`v1/prometeo/*`, incl. `tools/invoke`, `tools/invocations/:id/approve`) |
| **`packages/agents`** | Governing whether a named, capability-bearing `RuntimeAgentRole` run is allowed to execute at all, and dispatching it to its builder/handler once allowed | `packages/agents/src/governance.ts` (`evaluateAgentPolicy`), `runtime.ts` (`executeGovernedAgentRun`), `apps/worker/src/agent-run-handlers.mjs` |

**Verified finding: as of this reconciliation, these two subsystems have zero direct code coupling.** `packages/agents/src/runtime.ts` contains no reference to `AiModelGatewayService`, `LLMOrchestrator`, `AdaptiveRouter`, or any model/provider selection logic — it governs and dispatches capability *runs*, it does not itself call an LLM. `apps/api/src/modules/prometeo/prometeo.controller.ts` imports `LLMOrchestrator`, `PrometeoService`, `PrometeoToolExecutionService`, `TradeGuideService` — it does not import `@semse/agents` and never calls `createAgentRun`/`executeGovernedAgentRun`.

The only place the string `"prometeo"` appears inside `packages/agents/src` is a different, unrelated concept: `agent-registry.ts`'s and `semse-agents.types.ts`'s static 6-agent marketplace catalog (`agentCatalog`'s cousin data structure, not `runtimeAgentRoles`) lists `prometeo` as one of six catalog entries and tags other entries' `integratesWith: [...]` arrays with the string `'prometeo'`, and a domain-event routing table (`EVENT_ROUTING`) lists `'prometeo'` as a subscriber name for events like `ESCROW_FUNDED`. None of this is a function call — it is descriptive metadata in a marketplace-catalog data file that predates (and is unrelated to) both `RuntimeAgentRole` governance and the real `ai-models` orchestrator. This is exactly the kind of "apparent vs. real" gap the reconciliation charter exists to prevent: a contributor grepping for `prometeo` inside `packages/agents` would find these entries and could easily conclude an integration exists that does not.

## Options considered

### Option A — Merge them (make `packages/agents` a submodule of the Prometeo orchestrator, or vice versa)
Rejected. They govern genuinely different axes: Prometeo decides *which model/provider answers a request*; `packages/agents` decides *whether a named governed capability run is allowed to execute and which builder/handler serves it*. A single request can need both, in sequence, without either being a special case of the other — collapsing them would force model-routing concerns (privacy-critical Ollama routing, provider fallback) into the agent-governance layer, or force capability-governance concerns (manifest risk scoring, approval requests) into the model gateway. Same anti-pattern ADR-035 rejected for the four policy engines.

### Option B — Leave the relationship fully undocumented
Rejected. Two subsystems that share vocabulary (both "orchestrate agents"), share a decision shape (`allow|deny|require_approval`, ADR-035), and have a stale cross-reference already sitting in `packages/agents/src` (the marketplace-catalog `'prometeo'` tags) will keep attracting confident-but-wrong assumptions from future contributors and agents alike. Leaving it undocumented is how the reconciliation charter's own starting complaint ("apparent vs. real capability gap") reproduces itself in a new place.

### Option C — Document the boundary and the one legitimate contract direction, without building any new integration code (chosen)
```text
Operator intent
      │
      ▼
Prometeo Orchestrator (ai-models/, infrastructure/llm/)
  — resolves intent + context
  — selects/routes to a model or provider
  — MAY decide the intent requires a governed agent capability
      │  (the only legitimate crossing point — not yet built)
      ▼
packages/agents (governance.ts + runtime.ts)
  — evaluates policy for the named RuntimeAgentRole
  — dispatches to its builder / apps/worker's specialized handler
      │
      ▼
Capability / tool execution → Unified Action/Query → domain module
```
No code changes. The ADR fixes the *direction* a future integration must take if/when one is built: Prometeo may delegate into `packages/agents`' governed-run entrypoint (`createAgentRun`/`executeGovernedAgentRun`) as a caller; `packages/agents` must never reach back into `ai-models`/`LLMOrchestrator` to make its own separate model-selection decisions, and neither module may reimplement the other's core responsibility as a shortcut.

## Decision

`KEEP_DOMAIN_SPECIFIC` for both subsystems — no merge, no extraction of a shared "orchestrator" abstraction. Documented contract direction (Option C) is now the constraint on any future work that connects them.

The stale `'prometeo'` references inside `packages/agents/src/agent-registry.ts` and `semse-agents.types.ts` are `KEEP_FOR_PLANNED_CAPABILITY`, not `DELETE`, in this pass: they describe the unrelated 6-agent marketplace catalog (already flagged as a distinct surface in `semse-agents-governance`'s SKILL.md), which is out of this ADR's scope to retire. This ADR only requires that no future document or code comment describe them as evidence of a real Prometeo↔`packages/agents` integration.

## Why

- **The zero-coupling finding is the important part.** Documenting a clean boundary that already holds in practice is cheap insurance against future accidental coupling — the alternative (waiting until someone actually wires one into the other under deadline pressure, informally) is how the two policy-engine proliferation problem (ADR-035) started in the first place.
- **Naming collision risk is real and specific**: the `orchestrator` `RuntimeAgentRole` (one of the 16, classified `INTEGRATION_ONLY` — see ADR-037) is a `packages/agents` capability role, not the Prometeo orchestrator itself, despite the name. Any future work must not conflate "wire up the `orchestrator` role" with "integrate Prometeo."
- **One contract direction, not two**, keeps the dependency graph acyclic and keeps policy evaluation ownership unambiguous: whichever module a request enters through, it is `packages/agents`' `evaluateAgentPolicy` that gates a governed capability run, never a shadow check inside the Prometeo orchestrator.

## Invariants

- `packages/agents` must never import from `apps/api/src/modules/ai-models` or `apps/api/src/infrastructure/llm`. A dependency in that direction would mean the governance layer is silently making model-routing decisions it has no business making.
- If Prometeo ever needs to invoke a governed agent capability, it must go through `packages/agents`' public entrypoint (`createAgentRun` / `executeGovernedAgentRun`), never call a role's builder function or `agent-run-handlers.mjs` handler directly — that would bypass `evaluateAgentPolicy` entirely.
- The marketplace-catalog `'prometeo'` tags in `agent-registry.ts`/`semse-agents.types.ts` must not be cited as evidence of integration in any future spec, ADR, or skill without a real call site backing the claim.

## Migration plan

None — no code changes are required or made by this ADR.

## Compatibility

- **API:** none.
- **Mobile:** not applicable.
- **Events:** none — the existing `EVENT_ROUTING` table entries referencing `'prometeo'` are unchanged; they describe the marketplace catalog, not this boundary.
- **Database:** none.
- **Workflows:** none.

## Risks

- A future feature ("Prometeo should be able to trigger a governed dispute agent run") is a legitimate, foreseeable need — this ADR does not block it, it only fixes the direction (Prometeo calls in) and the entrypoint (the public governed-run API) it must use when built.
- Without this ADR, the natural failure mode is a developer under time pressure adding a direct import from `prometeo.controller.ts` into `packages/agents/src/runtime.ts`'s internals, or copying a builder's logic inline into a Prometeo handler — both would silently violate the invariants above.

## Verification

- Confirmed via direct source inspection (not inferred): `packages/agents/src/runtime.ts` has no import of any `ai-models`/`infrastructure/llm` symbol; `apps/api/src/modules/prometeo/prometeo.controller.ts` has no import of `@semse/agents`.
- `grep` for `AiModelGatewayService|LLMOrchestrator|AdaptiveRouter` across `packages/agents/src` returns zero matches.

## Rollback

Not applicable — this ADR changes no code, only records a boundary decision. A future ADR would supersede it if a real integration is later designed.

## Deferred (explicitly out of scope for this ADR)

- Designing the actual integration (a Prometeo-triggered governed agent run) — not requested by this reconciliation and not needed until a real feature calls for it.
- Retiring the unrelated 6-agent marketplace catalog (`agent-registry.ts`, `semse-agents.types.ts`) — tracked as a known-dead-surface note in `semse-agents-governance`'s SKILL.md, not this ADR's concern.
- The `orchestrator`/`ecv`/`job-planner`/`field-ops`/`project-copilot` reachability classifications and lifecycle decisions — see ADR-037.
- **Addendum (found by ADR-038, AG-04):** `apps/api/src/modules/orchestration/orchestration.service.ts` is a **third** real system carrying "orchestrator/orchestration" naming, distinct from both the `orchestrator` `RuntimeAgentRole` this ADR discusses and the real Prometeo Orchestrator (`ai-models/`) — it routes user messages to the legacy `NAMED_AGENTS`/`PrometeoAgentId` conversational-persona catalog by keyword/intent. Registered, tested, BFF-complete, and — per ADR-038 — has zero real UI consumer today. This ADR's boundary/naming analysis did not know about it at authoring time; ADR-038 documents it, this note only cross-references that fact rather than re-deriving the boundary analysis here.
