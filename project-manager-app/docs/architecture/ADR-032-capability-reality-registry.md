# ADR-032 — Capability Reality Registry (Phase 1 substrate)

- **Date:** 2026-09-14
- **Status:** Accepted
- **Owners:** SEMSE Execution Program, Phase 1 batch 1
- **Affected domains:** Reliability substrate, Mission Control (future consumer), Prisma schema

## Context

`04_IMPLEMENTATION_PROGRAM.md` Phase 1's exit gate is: "No subsequent capability may be promoted without verification evidence." Today that evidence lives only as prose — the Sept-11 80-capability audit (REAL/PARCIAL/ROTA/DUPLICADA/SOLO DISEÑADA), `SEMSE_EXECUTION_LEDGER.md`'s hand-maintained tables, and ADR files. None of it is queryable by a dashboard, a CI gate, or an agent. Phase 1 needs a live, machine-readable source of truth for "is capability X actually done, and is it healthy right now."

## Existing implementations found

- `apps/api/src/modules/health/health.service.ts` — live infra component health (API/Redis/worker ok|degraded), refreshed every 15s. **Different concept**: this is runtime infra health, not capability/feature maturity tracking. No overlap; the new registry does not replace it and should eventually be one *evidence source* for capability health, not a duplicate.
- `apps/api/src/modules/ops/mission-control/mission-control.service.ts` (1204 lines) — consumes `HealthService.getHealth()` for `service_health` exceptions. No existing capability-maturity concept found here either. Mission Control is the intended future consumer of this registry (deferred to a follow-up batch — see Deferred below).
- No existing `Capability`/`CapabilityStatus`/similar Prisma model found repo-wide.

## Options considered

### Option A — Keep it as markdown only (status quo)
Rejected: not queryable, does not satisfy Phase 1's exit gate ("machine-visible"), already proven insufficient by the Sept-11 audit going stale.

### Option B — Full Agent Capability Protocol V1 now (03_PROTOCOLS_AND_CONTRACTS.md §3.2)
Rejected for this batch: that contract (risk ceilings, tool bindings, offline modes, input provenance) is Phase 2 scope (Agent Runtime + Capability Protocol) and depends on the AgentRun/Tool Registry primitives that don't exist yet. Building it now would violate the pack's own phase-gate rule.

### Option C — Minimal Capability Reality Registry (chosen)
A small, additive Prisma schema (`Capability`, `CapabilityEvidence`, `GoldenRegression`) plus a thin read-only API. Answers exactly Phase 1's question without anticipating Phase 2's agent-specific fields.

## Decision

`CREATE`.

Three new tables:
- `capability` — key, domain, description, maturity, health, ownerModule.
- `capability_evidence` — kind (TEST | DEPLOYMENT | PRODUCTION_OBSERVATION | ADR), reference, note; one-to-many from `capability`.
- `golden_regression` — key, description, expectedResult, testReference, status (PASSING | FAILING | NOT_WIRED).

Read-only `GET /v1/capabilities`, `GET /v1/capabilities/:key`, `GET /v1/capabilities/golden-regressions` under `apps/api/src/modules/capability-registry/`.

**Maturity ladder reconciliation:** `08_EXECUTION_LEDGER_TEMPLATE.md` and `03_PROTOCOLS_AND_CONTRACTS.md` §3.2 disagree at one rung (`DEPLOYED` vs `BETA`). This registry uses `DESIGNED, IMPLEMENTED, TESTED, INTEGRATED, DEPLOYED, VERIFIED, PRODUCTION` — `DEPLOYED` is a concrete, checkable state (a deployment exists) where `BETA` is a label describing intent, not a fact you can verify against a deployment ID. Phase 2's Agent Capability Protocol may layer `BETA` back in as an agent-facing label without changing this table.

## Why

- **One source of truth per concept** (baseline doc §1.5): capability reality belongs here, not duplicated across the ledger's markdown table and a future dashboard's own state.
- **Unknown is a first-class state**: `health` defaults to `UNKNOWN`, not `HEALTHY` — a capability with no evidence yet must not read as fine.
- **AI is not final authority**: this table is written by engineering process (migrations, and later CI/deploy hooks), not inferred by an LLM.

## Invariants

- Every `Capability.health` transition to `HEALTHY` or `VERIFIED`/`PRODUCTION` maturity should be backed by at least one `CapabilityEvidence` row — not enforced at the DB level in this batch (no CHECK constraint), but is the intended discipline going forward.
- `GoldenRegression.status = PASSING` must reference a real, currently-passing automated test (`testReference`) — never hand-waved.

## Migration plan

Purely additive migration (`20260914120000_capability_reality_registry`): three new tables, four new enums, zero changes to existing tables/columns. Seeded in the same migration with the capability rows Phase 0 already established as ground truth (D01–D08 items, the conduit-offset engine, deploy provenance) and the golden-regression rows from the ledger template's "Golden Regressions Status" section — most seeded as `NOT_WIRED` rather than fabricating `PASSING`.

## Compatibility

- **API:** new endpoints only, additive.
- **Mobile:** not consumed yet.
- **Events:** none emitted yet — a future batch may emit an event when a capability's maturity/health changes, once something needs to react to it.
- **Database:** additive only, see Migration plan.
- **Workflows:** none.

## Risks

- Registry can drift from reality if nothing enforces updating it on every relevant PR — mitigated only by process/discipline in this batch, not tooling. A CI hook that updates `Capability` rows automatically from test/deploy results is explicitly deferred (see below), not built here.

## Verification

- `packages/db` — migration SQL reviewed against the schema by hand (no live DB available to this batch; `prisma validate`/typecheck run instead — see PR for command output).
- `apps/api` — build/typecheck of the new module; `apps/api/test/capability-registry.service.test.ts` covers list/getByKey/listGoldenRegressions and the not-found case, against a stubbed Prisma client.
- Not yet applied to production — the migration merges to `main` but requires an explicit Railway redeploy (deploys are not Git-triggered per ADR-030's own finding) to actually run against the live database. Verification of production behavior is pending that redeploy.

## Rollback

Drop the three new tables/four enums (`DROP TABLE`/`DROP TYPE`) — no existing table is touched, so this is a clean, low-risk rollback. Remove the module registration in `app.module.ts` and the module directory to fully revert the code side.

## Deferred (explicitly out of scope for this batch)

- Synthetic/canary verification strategy.
- Mission Control UI surface consuming this registry.
- Wiring the `NOT_WIRED` golden regressions (payment-release canonical path, privacy local-only fallback, migration/startup safety, cross-tenant isolation, duplicate command/event rejection, stale approval, offline conflict) to real automated tests.
- Any write path from HTTP (currently seed/migration-only).
- A CI/deploy hook that updates registry rows automatically.
