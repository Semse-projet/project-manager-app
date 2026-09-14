# SEMSE Execution Ledger

## Repository / Deployment Baseline

- Date: 2026-09-13 (reconciliation pass run 2026-09-14T03:46 UTC against a fresh clone)
- Branch: main
- HEAD SHA: `68f27f8aac2a8c7f73e4a38e12da7e3e3db506a9` — "fix(milestones): resolve PaymentGovernanceService DI crash on boot (#613)" (squash-merge; diff verified to also include the LiensController/WaiverController duplicate-route removal from the same PR)
- Worktree: fresh clone, no local changes
- Dirty state: clean
- API baseline: green as of PR #613 (quality-gates, unit-coverage, e2e, integration, autonomy-staged-smoke, verify-operacion-asistida-api all passed on `68f27f8a`)
- Web baseline: not independently re-verified this pass; last known-good build was part of the same CI run for `#613` (web is built as part of `build:packages`/`build:apps` in quality-gates)
- Worker baseline: not independently re-verified this pass; no worker-specific CI failures observed today
- Mobile baseline: not inspected this pass (out of scope for today's incident/Phase 0 focus)
- Prisma migration status: `20260908050000_add_live_sessions` was stuck FAILED (P3009) in production as of 2026-09-12; manually completed the missing DDL (4th enum + both tables + indexes/FKs — 3 of 4 enums had survived a prior partial attempt) and resolved via `prisma migrate resolve --applied`. Verified via `prisma migrate status` → **"Database schema is up to date!"** on 2026-09-13T02:x UTC. No further migrations pending as of that check.
- Railway/API deployed SHA: **NOT machine-verifiable today.** `apps/api/src/modules/health/health.controller.ts:20` hardcodes `build: "2026-05-18a"` — a static string, not the real deploy SHA. Confirmed via `docs/reportes/2026-09-11_f01_procedencia_release_api_web_worker.md` that as of 2026-08-31 the *active* API/Web/Worker deployments were pushed via `railway up`/CLI skill with **no Git commit backing them at all** (commit messages referenced in Railway's `meta.commitMessage` don't exist anywhere in `git log --all`). Today's incident response used `railway redeploy --service semse-API --from-source`, which per the CLI's own description does pull from the configured Git source — this deploy *should* trace to `68f27f8a`, but there is still no way to confirm this from the running service itself (health endpoint doesn't expose it). **This is the D08 gap — still open.**
- Railway/Web deployed SHA: unknown, same D08 gap; not touched today.
- Railway/Worker deployed SHA: unknown, same D08 gap; not touched today.
- Production verification performed today: `GET https://api.semseproject.com/v1/health` → `200 {"status":"ok"}` after the `--from-source` redeploy of `68f27f8a`.

## Current Program Phase

- Phase: **0 — CLOSED**
- Objective: confirm repo/deploy reality, reconcile D01–D08, map existing primitives, produce overlap matrix (per `04_IMPLEMENTATION_PROGRAM.md`)
- Status: reconciliation complete; all D01–D08 decisions recorded with ADRs; D08 implemented; Conduit Offset Engine V1 created as a Phase-0→Phase-4 foundation. **The underlying code duplication for D03/D04/D05 still physically exists** — these ADRs record the *decision*, not yet the *migration*. That migration work is Phase-1+ implementation, tracked via the ADRs' own migration plans, not part of this closeout.
- Health: DEGRADED, honestly — API is HEALTHY and verified in production, and D08's specific gap (health endpoint provenance) is now closed. But D03/D04/D05 duplication is still live in the codebase (decided, not yet migrated), and Web/Worker provenance is still open (deferred, see ADR-030). Do not read "Phase 0 CLOSED" as "everything is healthy" — it means the reconciliation and decision-making is done and Phase 1 has a real, current-state-honest foundation to build the Capability Reality Registry from.

### Phase 0 ADRs

| ADR | Decision | Covers |
|---|---|---|
| `docs/architecture/ADR-027-economic-evaluator-consolidation.md` | EXTEND pricing/* + ADAPT contractor-estimate | D03 |
| `docs/architecture/ADR-028-evidence-gateway-adapter-role.md` | REUSE evidence/* + ADAPT evidence-gateway/* | D04 |
| `docs/architecture/ADR-029-labor-engine-canonical-time-owner.md` | REUSE/EXTEND Labor Engine + ADAPT field-ops/time-tracker | D05 |
| `docs/architecture/ADR-030-service-deploy-provenance.md` | CREATE (implemented for API this batch; Web/Worker deferred) | D08 |
| `docs/architecture/ADR-031-conduit-offset-engine-v1.md` | CREATE | Electrical Field foundation (Phase 4 prerequisite, built ahead per explicit approval) |

### Phase 0 exit-gate checklist (per `04_IMPLEMENTATION_PROGRAM.md`)

| Gate | Status | Evidence |
|---|---|---|
| No unresolved critical build/boot regression | ✅ MET | PR #612 (lockfile) + PR #613 (DI + route collision) merged; prod healthcheck 200 today |
| Canonical payment release path identified | ✅ MET | See D02 |
| Per-resource authorization pattern identified | ✅ MET | See D01 |
| Privacy contract preserved end-to-end | ✅ MET (for the scope PR #609 covered) | See D07 |
| Migration/deploy path verified | ⚠️ PARTIAL (improved this batch) | Migration: yes (schema up to date). Deploy provenance: API now real via ADR-030; Web/Worker still open. |
| Overlapping primitives mapped | ✅ MET, decisions recorded | See Overlap Matrix below + ADR-027/028/029 |

## Reconciliation Decisions (D01–D08)

| # | Primitive | Existing location | Decision | Canonical owner | Evidence |
|---|---|---|---|---|---|
| D01 | Per-resource authorization | `apps/api/src/common/{permissions.decorator.ts, rbac.guard.ts, auth.guard.ts}` | **REUSE** | `common/rbac.guard.ts` enforcing `REQUIRED_PERMISSIONS_KEY` | Used in 75/87 controllers via `RequirePermissions`/`AuthenticatedAccess`. 12 controllers don't use it — worth a follow-up sweep, not a Phase-0 blocker. |
| D02 | One canonical payment-release command/path | `apps/api/src/modules/payments/escrow-release.service.ts` | **REUSE** | `EscrowReleaseService`, invoked only from `milestones.service.ts` | `waiver-payment-gate.service.ts` and `change-orders.service.ts` are pre-check *gates* that reference the same release math, not competing implementations (change-orders.service.ts:392 explicitly comments it reuses `PaymentsService.release()`'s pre-check). |
| D03 | One economic evaluator | `apps/api/src/modules/pricing/{material-pricing,location-cost}.service.ts` **vs** `apps/api/src/modules/contractor/contractor-estimate.service.ts` | **DUPLICADA — EXTEND pricing/* + ADAPT contractor-estimate** — see `docs/architecture/ADR-027-economic-evaluator-consolidation.md` | `pricing/*` (canonical); migration not yet performed | `ContractorEstimateService` imports `AiModelGatewayService` + `FinanceService` directly and does **not** import anything from `pricing/`. Two independent estimate/cost paths exist today. Decision recorded; code still duplicated pending Phase-1+ migration per the ADR's plan. |
| D04 | One evidence registration contract | `apps/api/src/modules/evidence/*` **vs** `apps/api/src/modules/evidence-gateway/*` | **DUPLICADA — REUSE evidence/* + ADAPT evidence-gateway/* into an integration adapter only** — see `docs/architecture/ADR-028-evidence-gateway-adapter-role.md` | `evidence/evidence.service.ts` + `evidence.policy.ts` (canonical) | `evidence-gateway.service.ts` uses its own `EvidenceGatewayRepository`, not `EvidenceRepository`. `agro/agro-evidence.*` explicitly left undecided by the ADR — needs its own focused look before Phase 1 touches Evidence. |
| D05 | One owner for time commands (Labor Engine) | `apps/api/src/modules/labor-engine/*` **vs** `apps/api/src/modules/field-ops/time-tracker.controller.ts` | **DUPLICADA — REUSE/EXTEND Labor Engine + ADAPT field-ops/time-tracker into a capture surface** — see `docs/architecture/ADR-029-labor-engine-canonical-time-owner.md` | `labor-engine/labor-engine.service.ts` | `field-ops/time-tracker.controller.ts` uses its own `FieldOpsService`, not `LaborEngineService`. Highest-caution ADR of the batch given the 2026-07-27 phantom-migration Time Tracker outage — ADR mandates a regression suite for that failure mode *before* any migration code is written. |
| D06 | Consistent identity approval | `apps/api/src/common/request-context.ts` (`resolveRequestContext`) | **REUSE** | `resolveRequestContext` | Used in 78 files across modules — broad, consistent adoption. No competing identity-resolution helper found. No ADR needed — no duplication to resolve. |
| D07 | Immutable request privacy | Tenant-scoping fixes in PR #609 (`50b03219`) | **REUSE (recently reconciled, scope-limited)** | Per-endpoint tenant scoping via Prisma relation filters | PR #609 fixed F02a (payment-governance escrow lookup now scoped by `tenantId` via `project` relation — cross-tenant request 404s instead of leaking) and F02b (Agro farm/unit ownership check). Not a repo-wide guarantee that every endpoint is tenant-scoped — no such sweep was done. No ADR needed — no duplication, just scope-limited coverage to track. |
| D08 | Independent service provenance | `docs/reportes/2026-09-11_f01_procedencia_release_api_web_worker.md` | **CREATE — implemented for semse-API this batch** — see `docs/architecture/ADR-030-service-deploy-provenance.md` | `apps/api/src/modules/health/deploy-provenance.ts` | `health.controller.ts` now reads `RAILWAY_GIT_COMMIT_SHA`/`RAILWAY_DEPLOYMENT_CREATED_AT` at runtime, falling back to `"unknown"` (never fabricated) instead of the old hardcoded `"2026-05-18a"` string. Web/Worker equivalents explicitly deferred — not confirmed trivial, needs its own pass. |

## Existing Primitives Inventory (focused, not exhaustive)

| Primitive | Present? | Location | Note |
|---|---|---|---|
| agents (package) | Yes | `packages/agents/src/` | `agent-registry.ts`, `action-policy.ts` — looks like the real tool/registry substrate for Phase 2. |
| semse-agents (api module) | Yes | `apps/api/src/modules/semse-agents/` | Includes `protools.agent.ts` (Electrical/tools agent) — LLM-orchestration layer, not the deterministic engine itself. |
| autonomy (package + api module) | Yes | `packages/autonomy/`, `apps/api/src/modules/autonomy/` | Not deep-inspected this pass. |
| orchestration | Yes | `apps/api/src/modules/orchestration/` | Not deep-inspected this pass; relevant to Phase 11. |
| domain-events / outbox | Yes, appears mature | `apps/api/src/modules/domain-events/` | Has `outbox-dispatcher.service.ts`, `outbox.repository.ts`, `domain-event-bus.service.ts`, `agent-trigger-router.service.ts` — strong REUSE candidate as the canonical event backbone for Phase 3. |
| workflows | **Not found as a distinct primitive** | — | No `*workflow*` files under `apps/api/src`. Likely intentionally folded into `orchestration`/`autonomy`, or genuinely absent — needs a decision before Phase 11, not before Phase 0. |
| policy/governance | Yes | `apps/api/src/modules/{payment-governance, evidence/evidence.policy.ts, domain-events/domain-events.policy.ts}` | Fragmented across modules by design (per-domain policy), not obviously duplicated. |
| BuildOps | Yes | `apps/api/src/modules/buildops/` | Not deep-inspected. |
| Evidence | Yes, **fragmented** | See D04 above | Real duplication risk. |
| Payments/Finance | Yes | `apps/api/src/modules/{payments, finance}/` | Two separate modules (`payments` = escrow/release/governance, `finance` = invoicing per `ContractorEstimateService`'s import) — not obviously duplicated, likely a legitimate boundary, but not verified this pass. |
| Materials | Yes | `apps/api/src/modules/materials/` | Not deep-inspected. |
| Time/Labor | Yes, **fragmented** | See D05 above | Real duplication risk. |
| Electrical ProTools/calculators | Load/wire-sizing engine exists; conduit-offset/bend engine created this batch | `packages/tools/src/trades/electrical/electrical.engine.ts` (amperage/wire/breaker/voltage-drop/materials — REUSE, unrelated to bending); `packages/tools/src/trades/electrical/conduit-offset.engine.ts` (**new**, per ADR-031) | A second, follow-up search covering `apps/mobile`, `packages/tools`, `packages/shared` (missed in the first Phase-0 pass, which only checked `apps/api`) still found zero pre-existing bend-geometry code — confirms CREATE was correct. `semse-agents/protools.agent.ts` remains the LLM-orchestration wrapper; it does not yet call the new engine (Phase-4 wiring). |
| Mobile field/tracker | Not found under this name | — | No `field`/`tracker` files under `apps/mobile/src`; time-tracking on mobile (if any) not located this pass — needs a proper mobile-app pass before Phase 5/6. |
| Mission Control | Yes, **UI-fragmented** | `apps/web/app/(app)/admin/{ai-mission-control, mission-control}/`, `apps/web/app/(app)/admin/browser-agent/missions/` | Three separate admin surfaces with "mission(s)" in the name — likely UI sprawl rather than backend duplication, not confirmed. |
| Prisma models/migrations | Yes | `packages/db/prisma/` | 87 migrations found per today's `prisma migrate status` output; schema is currently up to date on production. |

## Overlap Matrix (primitives with real duplication risk)

| Concept | Candidate A | Candidate B | Risk | Suggested next step |
|---|---|---|---|---|
| Economic evaluation / estimating | `modules/pricing/*` | `modules/contractor/contractor-estimate.service.ts` | **High** — two independent cost paths, one LLM-driven with no ties to the deterministic pricing module | ADR: decide whether contractor estimates must call into `pricing/` for base costs, with AI only interpreting/adjusting |
| Evidence registration | `modules/evidence/*` | `modules/evidence-gateway/*` (+ `modules/agro/agro-evidence.*` as a possible third) | **High** — separate repositories/services, not a thin wrapper | ADR: clarify if evidence-gateway is a legitimate distinct concept (e.g. external/vision-sourced ingestion vs internal evidence) or should collapse into canonical evidence |
| Time/labor commands | `modules/labor-engine/*` | `modules/field-ops/time-tracker.controller.ts` | **High**, and historically incident-prone (2026-07-27 phantom-migration outage) | ADR before touching: confirm live usage of both paths before consolidating |
| Payments vs Finance module boundary | `modules/payments/*` | `modules/finance/*` | Low–unclear | Not confirmed as duplication this pass — needs a look before assuming it's fine |
| Mission Control UI surfaces | `admin/mission-control` | `admin/ai-mission-control`, `admin/browser-agent/missions` | Low (UI only, not confirmed as backend duplication) | Defer; not a Phase-0 concern |

## Current Batch (Phase-0 closeout batch — user-approved, split across PR #616 and a separate small PR)

### Goal

Close Phase 0: write the D03/D04/D05/D08 ADRs, implement the user-approved D08 fix (real deploy provenance for semse-API), and — per explicit scope addition — build Conduit Offset Engine V1 as its own small PR, since the reconciliation search confirmed it doesn't exist anywhere.

### Files changed

**In PR #616 (this ledger's own branch):**
- `SEMSE_EXECUTION_LEDGER.md` (this file)
- `docs/architecture/ADR-027-economic-evaluator-consolidation.md`
- `docs/architecture/ADR-028-evidence-gateway-adapter-role.md`
- `docs/architecture/ADR-029-labor-engine-canonical-time-owner.md`
- `docs/architecture/ADR-030-service-deploy-provenance.md`
- `docs/architecture/ADR-031-conduit-offset-engine-v1.md` (ADR text only)
- `apps/api/src/modules/health/deploy-provenance.ts` (new)
- `apps/api/src/modules/health/health.controller.ts` (removed hardcoded `build` string, added `gitSha`/`buildTime`)
- `apps/api/test/deploy-provenance.test.ts` (new)

**In a separate PR (per explicit instruction to keep this one small and reviewable, not a mega-PR):**
- `packages/tools/src/trades/electrical/conduit-offset.engine.ts` (new)
- `packages/tools/src/index.ts` (export the new engine)
- `packages/tools/test/conduit-offset.test.ts` (new)

### Migrations

None.

### Feature flags

None — D08's change is a pure additive health-endpoint field; the Conduit Offset Engine has zero callers yet, so no flag is needed to gate its (non-existent) integration.

### Tests added/changed

- `packages/tools/test/conduit-offset.test.ts` — 7 tests (golden case, formula-match, shrink-distinctness, invalid-input rejection, unverified/verified bender guard, geometry-available-when-blocked).
- `apps/api/test/deploy-provenance.test.ts` — 3 tests (fallback to `"unknown"`, reads real env vars, empty-string is treated as absent).

### Commands executed

- `pnpm install --frozen-lockfile` (fresh clone needed a full install)
- `pnpm --filter @semse/tools build` && `pnpm --filter @semse/tools test` — **19/19 passing** (12 pre-existing + 7 new)
- `pnpm run build:packages` && `pnpm --filter @semse/api build` — see Results below

### Results

All D01–D08 decisions now have file-path evidence and, for D03/D04/D05, an accepted ADR with an explicit migration plan. D08 implemented and tested for semse-API. Conduit Offset Engine V1 built and tested, confirming the golden regression `6"@30°=12"` and the bender-verification hard guard are now real, passing code — not just a documented target.

### Known failures

None introduced by this batch. D03/D04/D05 duplication remains physically present in the code (by design — ADRs record the decision, migration is separate future work). Web/Worker deploy-provenance remains open (ADR-030 explicitly defers it).

### Security checks

Not applicable to the ADRs (documentation). For the code changes: `deploy-provenance.ts` reads only environment variables, no user input; `conduit-offset.engine.ts` validates all numeric inputs and throws rather than returning corrupted geometry for invalid input — no injection/traversal surface in either.

### Offline checks

Not applicable — neither change touches mobile/offline sync paths.

### Production verification

Pre-batch: `GET https://api.semseproject.com/v1/health` → `200 {"status":"ok"}` (confirmed same day, prior to this batch). Post-batch production verification (i.e. confirming the live health endpoint now returns a real `gitSha` instead of `"unknown"` after the next deploy) is **not yet done** — requires an actual Railway redeploy of semse-API after this PR merges, which is outside this ledger-authoring pass. Tracked as a follow-up, not fabricated as already-verified.

### Rollback

- D08 change: revert `health.controller.ts`/`deploy-provenance.ts` — pure read-only diagnostic, no state to unwind.
- Conduit Offset Engine: revert the new files — zero existing callers, nothing else depends on it yet.
- ADRs: mark `Status: Superseded` in the relevant ADR file if a later decision reverses one; do not silently delete an accepted ADR.

## Golden Regressions Status

- 6" @30° = 12": **✅ REAL AND TESTED as of this batch.** `packages/tools/src/trades/electrical/conduit-offset.engine.ts` (`calculateConduitOffset`), golden-case test at `packages/tools/test/conduit-offset.test.ts`. Built per `docs/architecture/ADR-031-conduit-offset-engine-v1.md`. Not yet wired into any UI/endpoint — that's Phase-4 scope.
- Unknown bender blocks exact marking: **✅ REAL AND TESTED.** `assertBenderVerifiedForMarking` throws `UnverifiedBenderError` unless a verified `BenderProfile` is supplied; geometry (`calculateConduitOffset`) remains available regardless. Tested in the same file.
- Payment release canonical path: ✅ confirmed — single path via `EscrowReleaseService` (see D02).
- Privacy local-only fallback: not evaluated this pass (out of D01–D08 scope as literally stated in the baseline doc; would need its own inspection).
- Migration/startup: ✅ confirmed fixed today — see Baseline section (P3009 resolved, DI crash fixed, route collision fixed, prod healthcheck green).
- Cross-tenant: ✅ confirmed fixed for the specific F02a/F02b scope from PR #609; not verified as a repo-wide guarantee.
- Duplicate command: ⚠️ open — see D03/D04/D05 in the overlap matrix.
- Duplicate event: not evaluated this pass.
- Stale approval: not evaluated this pass.
- Offline conflict: not evaluated this pass (mobile not inspected).

## Blockers

| Blocker | External/Internal | Required resolution | Owner |
|---|---|---|---|
| D08 — Web/Worker still have no verifiable deploy provenance (API resolved this batch) | Internal (process + missing status-endpoint field, if one even exists for Web/Worker) | Confirm whether Web/Worker expose any status endpoint at all; if so, apply the same `RAILWAY_GIT_COMMIT_SHA` pattern from ADR-030; if the change isn't trivial, scope it as its own small PR | User/whoever owns Railway service config |
| D03/D04/D05 physical code duplication (decisions made, migration not yet done) | Internal, migration execution risk (especially D05 given incident history) | Execute the migration plans in ADR-027/028/029 — each is explicitly incremental with its own regression-test gate | Phase-1+ implementation work, not blocked on further user decisions per ADRs already accepted |
| Conduit Offset Engine not yet wired into any UI/endpoint | Internal, intentional | Phase-4 scope: wire `calculateConduitOffset`/`assertBenderVerifiedForMarking` into ProTools/mobile UI | Deferred by design, not a Phase-0/1 blocker |

## Next 3 concrete actions

1. **Begin Phase 1 (Reliability substrate)** — Capability Reality Registry + verification dimensions + deployment provenance. Seed the registry directly from this ledger's findings: D01/D02/D06/D07 as REAL/VERIFIED-candidates, D03/D04/D05 as DUPLICADA-with-accepted-ADR (not yet migrated), the new Conduit Offset Engine as IMPLEMENTED/TESTED but not yet INTEGRATED (per the maturity ladder — it has no caller yet).
2. **Execute ADR-027/028/029's migration plans** as their own Phase-1+ implementation batches (one PR per ADR, per the same "small, focused, one concern per PR" discipline used today) — start with whichever the user prioritizes; ADR-029 (Labor Engine) carries the highest risk given incident history and should not be rushed.
3. **Decide Web/Worker deploy-provenance scope** (ADR-030's deferred half) and `agro-evidence.*`'s relationship to canonical Evidence (ADR-028's explicitly-undecided third stack) — both were intentionally left open rather than guessed at.

## Last verified production behavior

2026-09-13, ~02:38 UTC — `GET https://api.semseproject.com/v1/health` returned `200 {"requestId":"...","data":{"status":"ok","service":"semse-api","persistence":"prisma","build":"2026-05-18a","authMode":"jwt-crypto-only","timestamp":"2026-09-13T02:38:14.424Z"}}` on deployment SHA `68f27f8a` (via `railway redeploy --from-source`), following same-day fixes for the P3009 migration failure, the `PaymentGovernanceService` DI crash, and the `LiensController`/`WaiverController` duplicate-route boot crash (PRs #612, #613).
