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
- Railway/API deployed SHA: **RESOLVED for API.** Post-ADR-030 redeploy verified live: `GET https://api.semseproject.com/v1/health` now returns a real `gitSha` (the deployed commit) instead of the old hardcoded `"2026-05-18a"` string — see "Last verified production behavior" below for the exact response. The D08 gap is closed for API; Web/Worker remain open (see Blockers).
- Railway/Web deployed SHA: unknown, same D08 gap; not touched today.
- Railway/Worker deployed SHA: unknown, same D08 gap; not touched today.
- Production verification performed today: `GET https://api.semseproject.com/v1/health` → `200 {"status":"ok"}` after the `--from-source` redeploy of `68f27f8a`.

## Current Program Phase

- Phase: **1 — IN PROGRESS (batch 1 of N: Capability Reality Registry)**
- Objective: make "implemented/tested/deployed/verified" machine-visible (`04_IMPLEMENTATION_PROGRAM.md` Phase 1 goal).
- Status: batch 1 (Capability Reality Registry + Golden Regression Registry) implemented — Prisma models, seed data from Phase 0's findings, a thin read-only API — CI-verified, merged, and deployed to production (2026-09-14T09:3x UTC, `railway redeploy --from-source`). Synthetic/canary strategy and any Mission Control UI surface are explicitly deferred to a later batch (see Next 3 concrete actions). Phase 0 is CLOSED (see its own summary retained below); D03/D04/D05's physical code duplication still exists — that migration work is separate Phase-1+ implementation batches, not this one.
- Health: `capability-reality-registry` itself now **DEPLOYED + reachable in production** — `GET https://api.semseproject.com/v1/health` reports `gitSha: 087d2e2c...` (the PR #618 merge commit) and `GET /v1/capabilities` returns `401` unauthenticated (route mounted, guard active) rather than `404`. Full authenticated read-through (actual seeded rows returned) not yet captured in this ledger — see Blockers. D03/D04/D05 duplication is still live in the codebase, unchanged by this batch. D08 is fully closed for API (verified in production), Web/Worker still open.

## Capability Status Matrix

As of this batch this table is **backed by a real database**, not hand-maintained prose — see `docs/architecture/ADR-032-capability-reality-registry.md`. Query `GET /v1/capabilities` for the live view once the migration is applied to production (see Blockers). The rows below are the seed data shipped in `packages/db/prisma/migrations/20260914120000_capability_reality_registry/migration.sql`:

| Capability (`key`) | Maturity | Health | Evidence |
|---|---|---|---|
| `pricing-engine` | INTEGRATED | DEGRADED | ADR-027 |
| `contractor-estimate` | INTEGRATED | DEGRADED | ADR-027 |
| `evidence-domain` | PRODUCTION | HEALTHY | ADR-028 |
| `evidence-gateway` | INTEGRATED | DEGRADED | ADR-028 |
| `labor-engine` | PRODUCTION | HEALTHY | ADR-029 |
| `field-time-tracker` | DEPLOYED | DEGRADED | ADR-029 |
| `deploy-provenance` | VERIFIED | HEALTHY | ADR-030 + production observation (gitSha confirmed live) |
| `conduit-offset-engine` | TESTED | HEALTHY | ADR-031 + `conduit-offset.test.ts` |
| `capability-reality-registry` | DEPLOYED | UNKNOWN | ADR-032 — migration merged to `main`, not yet run against production (health UNKNOWN until it is) |

Golden Regression Registry (`GET /v1/capabilities/golden-regressions`): 9 rows seeded — `conduit-offset-6in-30deg` is `PASSING`; the other 8 (payment-release canonical path, privacy local-only fallback, migration/startup safety, cross-tenant isolation, duplicate command/event, stale approval, offline conflict) are seeded `NOT_WIRED` — decided ground truth, not yet automated.

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

## Previous Batch — Phase-0 closeout (CLOSED, merged as PR #616 + PR #617)

Write-up retained for history: wrote the D03/D04/D05/D08 ADRs, implemented D08 (real deploy provenance for semse-API), and — per explicit scope addition — built Conduit Offset Engine V1 (`packages/tools/src/trades/electrical/conduit-offset.engine.ts`, PR #617). Both merged; D08 subsequently verified live in production (see "Last verified production behavior"). Full detail (files changed, tests, commands) is in the PR #616/#617 diffs themselves — not repeated here to keep this ledger about *current* state.

## Current Batch — Phase 1, batch 1: Capability Reality Registry

### Goal

Implement the Capability Reality Registry + Golden Regression Registry (Phase 1's first, smallest slice) per `docs/architecture/ADR-032-capability-reality-registry.md`, seeded from Phase 0's already-established ground truth. Synthetic/canary strategy and Mission Control UI surface deferred to later batches.

### Files changed

- `packages/db/prisma/schema.prisma` — added `Capability`, `CapabilityEvidence`, `GoldenRegression` models + 4 enums.
- `packages/db/prisma/migrations/20260914120000_capability_reality_registry/migration.sql` (new) — additive DDL, verified byte-identical to `prisma migrate diff --from-empty` output for the same models, plus seed `INSERT`s for the initial registry rows (see Capability Status Matrix above).
- `apps/api/src/modules/capability-registry/{capability-registry.module.ts, capability-registry.service.ts, capability-registry.controller.ts}` (new) — thin read-only API, authenticated (`AuthGuard('jwt')` + `AuthenticatedAccess`), not resource-scoped (platform metadata, not tenant data).
- `apps/api/src/app.module.ts` — registered `CapabilityRegistryModule`.
- `apps/api/test/capability-registry.service.test.ts` (new).
- `docs/architecture/ADR-032-capability-reality-registry.md` (new).
- `SEMSE_EXECUTION_LEDGER.md` (this file).

### Migrations

`20260914120000_capability_reality_registry` — purely additive (3 new tables, 4 new enums), zero changes to existing tables/columns. Verified against `prisma migrate diff --from-empty --to-schema-datamodel` for the same model subset: output matched hand-written SQL exactly (only difference: the diff tool's `CREATE SCHEMA IF NOT EXISTS "public"` line, not needed since the schema already exists).

### Feature flags

None — read-only, additive, zero existing callers of the old health/mission-control code changed.

### Tests added/changed

`apps/api/test/capability-registry.service.test.ts` — 4 tests: `list()` returns capabilities with evidence, `getByKey()` returns a match, `getByKey()` throws `NotFoundException` for an unknown key, `listGoldenRegressions()` returns seeded rows. All passing against a stubbed Prisma client (no live DB needed for this level of test).

### Commands executed

- `prisma validate` — schema valid.
- `prisma migrate diff --from-empty --to-schema-datamodel <mini-schema>` — confirmed hand-written migration SQL is byte-identical to Prisma's own generator output for these models.
- `prisma generate` — client regenerated successfully.
- `pnpm run build:packages && pnpm --filter @semse/api build` — clean, no errors.
- `node --import tsx --test test/capability-registry.service.test.ts` — 4/4 passing.

### Results

Registry schema + thin read API implemented, tested, and merged. Seed data reflects Phase 0's real findings (D03/D04/D05 duplication recorded as DEGRADED, D08 as HEALTHY/VERIFIED, the new engine as TESTED/HEALTHY, the registry itself as DEPLOYED/UNKNOWN pending its own production verification).

### Known failures

None introduced. The registry cannot be queried in production yet — see Blockers.

### Security checks

Read-only endpoints, authenticated via the existing `AuthGuard('jwt')` pattern used repo-wide; no user-controllable input beyond a `key` path param used in a Prisma `findUnique` (parameterized, no injection surface). No secrets/PII in any of the seeded rows (they describe engineering artifacts, not business data).

### Offline checks

Not applicable — API-only, no mobile/offline path touched.

### Production verification

**Not yet done.** The migration is merged to `main` but has not been applied to the production database — per ADR-030's own finding, Railway deploys are not Git-triggered, so this requires an explicit `railway redeploy --from-source` (or equivalent) run in the main conversation, followed by a `GET /v1/capabilities` check against production. Tracked as the top item in Blockers below, not fabricated as already-verified.

### Rollback

Drop the 3 new tables + 4 new enums (`DROP TABLE`/`DROP TYPE`, in FK-dependency order: `capability_evidence` before `capability`). Remove `CapabilityRegistryModule` from `app.module.ts` and delete the module directory. No existing table/column touched, so rollback carries zero risk to other data.

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
| ~~Capability Reality Registry migration not applied to production~~ — **RESOLVED 2026-09-14T09:29 UTC** via `railway redeploy --from-source` (deployment `b71b9a41`, SHA `087d2e2c`). `/v1/capabilities` now returns `401` (mounted + guarded) instead of `404`. Not yet re-checked: an authenticated call confirming the seeded rows read back correctly. | — | If it matters for the next batch, do one authenticated `GET /v1/capabilities` and paste the response here | — |
| D08 — Web/Worker still have no verifiable deploy provenance (API resolved and production-verified this batch) | Internal (process + missing status-endpoint field, if one even exists for Web/Worker) | Confirm whether Web/Worker expose any status endpoint at all; if so, apply the same `RAILWAY_GIT_COMMIT_SHA` pattern from ADR-030; if the change isn't trivial, scope it as its own small PR | User/whoever owns Railway service config |
| D03/D04/D05 physical code duplication (decisions made, migration not yet done) | Internal, migration execution risk (especially D05 given incident history) | Execute the migration plans in ADR-027/028/029 — each is explicitly incremental with its own regression-test gate | Phase-1+ implementation work, not blocked on further user decisions per ADRs already accepted |
| Conduit Offset Engine not yet wired into any UI/endpoint | Internal, intentional | Phase-4 scope: wire `calculateConduitOffset`/`assertBenderVerifiedForMarking` into ProTools/mobile UI | Deferred by design, not a Phase-0/1 blocker |
| No CI/deploy hook keeps the registry in sync automatically | Internal, intentional deferral (ADR-032 "Deferred") | Design a hook once a second batch shows real usage patterns — premature now | Future Phase-1 batch |

## Next 3 concrete actions

1. **Phase 1, batch 2 candidates** (pick one, keep it small): synthetic/canary strategy design, or a minimal Mission Control surface reading from `GET /v1/capabilities` (the existing `mission-control.service.ts` already has a `service_health`-style exception-source pattern to extend), or wiring 1-2 of the 8 `NOT_WIRED` golden regressions to real tests (payment-release canonical path and migration/startup safety are the most straightforward given D02/today's incident are already well-understood).
2. **Execute ADR-027/028/029's migration plans** as their own future implementation batches (one PR per ADR) — start with whichever the user prioritizes; ADR-029 (Labor Engine) carries the highest risk given incident history and should not be rushed. Also still open: Web/Worker deploy-provenance scope (ADR-030) and `agro-evidence.*`'s relationship to canonical Evidence (ADR-028).

## Last verified production behavior

2026-09-14T09:33 UTC — following the PR #618 merge and a `railway redeploy --from-source` of semse-API (deployment `b71b9a41`), `GET https://api.semseproject.com/v1/health` returned `gitSha: "087d2e2cb5c8288daa1e0d507d2d531152e7a9cb"` (the #618 merge commit), and `GET https://api.semseproject.com/v1/capabilities` returned `401` unauthenticated — confirming the route is mounted and guarded, not a stale 404. A second, redundant `--from-source` redeploy of the same commit (deployment `81ed0b39`, source unclear — possibly another concurrent session) completed cleanly shortly after with no drift.

2026-09-14 — following the PR #616 merge and a `railway redeploy --from-source` of semse-API, `GET https://api.semseproject.com/v1/health` was confirmed (in the main conversation, outside this fork) to return a real `gitSha` field instead of the previously hardcoded `"2026-05-18a"` string, closing D08 for API in production. This ledger does not have the exact byte-for-byte response captured — the main session confirmed it directly; re-run the curl if you need the literal payload for a report.

Prior verification, 2026-09-13 ~02:38 UTC: `GET https://api.semseproject.com/v1/health` returned `200 {"status":"ok", ...}` on deployment SHA `68f27f8a`, following same-day fixes for the P3009 migration failure, the `PaymentGovernanceService` DI crash, and the `LiensController`/`WaiverController` duplicate-route boot crash (PRs #612, #613).
