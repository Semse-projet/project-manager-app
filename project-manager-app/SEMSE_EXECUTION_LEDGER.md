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
- Railway/API deployed SHA: **RESOLVED for API.** Post-ADR-030 redeploy verified live: `GET https://api.semseproject.com/v1/health` now returns a real `gitSha` (the deployed commit) instead of the old hardcoded `"2026-05-18a"` string — see "Last verified production behavior" below for the exact response.
- Railway/Web deployed SHA: **CODE READY, NOT YET DEPLOYED.** ADR-033 extends the same pattern to `/api/semse/healthz` (Web's actual Railway healthcheck target). Builds clean, not yet verified against a live redeploy — see Blockers.
- Railway/Worker deployed SHA: **CODE READY, NOT YET DEPLOYED.** ADR-033 adds `gitSha`/`buildTime` to the worker's startup log line (no HTTP surface exists to add a health endpoint to). Not yet verified against a live redeploy — see Blockers.
- Production verification performed today: `GET https://api.semseproject.com/v1/health` → `200 {"status":"ok"}` after the `--from-source` redeploy of `68f27f8a`.

## Current Program Phase

- Phase: **1 — IN PROGRESS (batch 2 of N: golden-regression wiring)**
- Objective: make "implemented/tested/deployed/verified" machine-visible (`04_IMPLEMENTATION_PROGRAM.md` Phase 1 goal).
- Status: batch 1 (Capability Reality Registry + Golden Regression Registry) implemented, merged, and deployed to production. Batch 2 wired 2 of the 8 `NOT_WIRED` golden regressions to real automated tests: `migration-startup-safety` (now `PASSING`) and `payment-release-canonical-path` (now `FAILING` — a real gap, honestly reported, and since mitigated as a fail-safe pending the real fix; see ADR-034 and Blockers). Synthetic/canary strategy and any Mission Control UI surface are still deferred (see Next 3 concrete actions). Phase 0 is CLOSED; D03/D04/D05's physical code duplication still exists — separate Phase-1+ implementation batches.
- Health: `capability-reality-registry` itself now **DEPLOYED + reachable in production** — `GET https://api.semseproject.com/v1/health` reports `gitSha: 087d2e2c...` (the PR #618 merge commit) and `GET /v1/capabilities` returns `401` unauthenticated (route mounted, guard active) rather than `404`. Full authenticated read-through (actual seeded rows returned) not yet captured in this ledger — see Blockers. D03/D04/D05 duplication is still live in the codebase, unchanged by this batch. D08 is closed in code for API+Web+Worker (ADR-033, `@semse/shared` now the single owner) and production-verified for API only; Web/Worker deploy-verification is pending the next redeploy (see Blockers).

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
| `docs/architecture/ADR-033-web-worker-deploy-provenance.md` | EXTEND to Web/Worker + moved canonical owner to `@semse/shared` | D08 (closes the ADR-030 deferral) |

### Phase 0 exit-gate checklist (per `04_IMPLEMENTATION_PROGRAM.md`)

| Gate | Status | Evidence |
|---|---|---|
| No unresolved critical build/boot regression | ✅ MET | PR #612 (lockfile) + PR #613 (DI + route collision) merged; prod healthcheck 200 today |
| Canonical payment release path identified | ✅ MET | See D02 |
| Per-resource authorization pattern identified | ✅ MET | See D01 |
| Privacy contract preserved end-to-end | ✅ MET (for the scope PR #609 covered) | See D07 |
| Migration/deploy path verified | ⚠️ PARTIAL (improved this batch) | Migration: yes (schema up to date). Deploy provenance: API real + production-verified via ADR-030; Web/Worker closed in code via ADR-033, pending a redeploy to production-verify. |
| Overlapping primitives mapped | ✅ MET, decisions recorded | See Overlap Matrix below + ADR-027/028/029 |

## Reconciliation Decisions (D01–D08)

| # | Primitive | Existing location | Decision | Canonical owner | Evidence |
|---|---|---|---|---|---|
| D01 | Per-resource authorization | `apps/api/src/common/{permissions.decorator.ts, rbac.guard.ts, auth.guard.ts}` | **REUSE** | `common/rbac.guard.ts` enforcing `REQUIRED_PERMISSIONS_KEY` | Used in 75/87 controllers via `RequirePermissions`/`AuthenticatedAccess`. 12 controllers don't use it — worth a follow-up sweep, not a Phase-0 blocker. |
| D02 | One canonical payment-release command/path | `apps/api/src/modules/payments/escrow-release.service.ts` | **REUSE — CORRECTED, see below** | `EscrowReleaseService`, invoked only from `milestones.service.ts` | `waiver-payment-gate.service.ts` and `change-orders.service.ts` are pre-check *gates* that reference the same release math, not competing implementations (change-orders.service.ts:392 explicitly comments it reuses `PaymentsService.release()`'s pre-check). **⚠️ CORRECTION (Phase 1, batch 2, 2026-09-14):** the original Phase-0 REUSE verdict above was incomplete. `PaymentGovernanceService.releasePayment()` (`apps/api/src/modules/payment-governance/payment-governance.service.ts`) is a second, independently reachable release path — live at `POST /v1/payments/release` via `payment-governance.controller.ts` — that creates a payment-transaction row and returns `success: true` **without ever calling Stripe/`EscrowReleaseService`**. Two release paths exist in production today; only one moves real money. See the `payment-release-canonical-path` golden regression (now wired and correctly marked `FAILING`, not `PASSING`) and the new Blocker below. Not fixed in this batch — requires an explicit D02 consolidation decision, out of scope for a reconciliation/test-wiring batch. |
| D03 | One economic evaluator | `apps/api/src/modules/pricing/{material-pricing,location-cost}.service.ts` **vs** `apps/api/src/modules/contractor/contractor-estimate.service.ts` | **DUPLICADA — EXTEND pricing/* + ADAPT contractor-estimate** — see `docs/architecture/ADR-027-economic-evaluator-consolidation.md` | `pricing/*` (canonical); migration not yet performed | `ContractorEstimateService` imports `AiModelGatewayService` + `FinanceService` directly and does **not** import anything from `pricing/`. Two independent estimate/cost paths exist today. Decision recorded; code still duplicated pending Phase-1+ migration per the ADR's plan. |
| D04 | One evidence registration contract | `apps/api/src/modules/evidence/*` **vs** `apps/api/src/modules/evidence-gateway/*` | **DUPLICADA — REUSE evidence/* + ADAPT evidence-gateway/* into an integration adapter only** — see `docs/architecture/ADR-028-evidence-gateway-adapter-role.md` | `evidence/evidence.service.ts` + `evidence.policy.ts` (canonical) | `evidence-gateway.service.ts` uses its own `EvidenceGatewayRepository`, not `EvidenceRepository`. `agro/agro-evidence.*` explicitly left undecided by the ADR — needs its own focused look before Phase 1 touches Evidence. |
| D05 | One owner for time commands (Labor Engine) | `apps/api/src/modules/labor-engine/*` **vs** `apps/api/src/modules/field-ops/time-tracker.controller.ts` | **DUPLICADA — REUSE/EXTEND Labor Engine + ADAPT field-ops/time-tracker into a capture surface** — see `docs/architecture/ADR-029-labor-engine-canonical-time-owner.md` | `labor-engine/labor-engine.service.ts` | `field-ops/time-tracker.controller.ts` uses its own `FieldOpsService`, not `LaborEngineService`. Highest-caution ADR of the batch given the 2026-07-27 phantom-migration Time Tracker outage — ADR mandates a regression suite for that failure mode *before* any migration code is written. |
| D06 | Consistent identity approval | `apps/api/src/common/request-context.ts` (`resolveRequestContext`) | **REUSE** | `resolveRequestContext` | Used in 78 files across modules — broad, consistent adoption. No competing identity-resolution helper found. No ADR needed — no duplication to resolve. |
| D07 | Immutable request privacy | Tenant-scoping fixes in PR #609 (`50b03219`) | **REUSE (recently reconciled, scope-limited)** | Per-endpoint tenant scoping via Prisma relation filters | PR #609 fixed F02a (payment-governance escrow lookup now scoped by `tenantId` via `project` relation — cross-tenant request 404s instead of leaking) and F02b (Agro farm/unit ownership check). Not a repo-wide guarantee that every endpoint is tenant-scoped — no such sweep was done. No ADR needed — no duplication, just scope-limited coverage to track. |
| D08 | Independent service provenance | `docs/reportes/2026-09-11_f01_procedencia_release_api_web_worker.md` | **CREATE, then EXTEND to Web/Worker** — see `docs/architecture/ADR-030-service-deploy-provenance.md` and `docs/architecture/ADR-033-web-worker-deploy-provenance.md` | `packages/shared/src/deploy-provenance.ts` (moved from `apps/api`, now the one owner for all three apps) | API (`health.controller.ts`), Web (`/api/semse/healthz` route) and Worker (startup log line) all now read `RAILWAY_GIT_COMMIT_SHA`/`RAILWAY_DEPLOYMENT_CREATED_AT` via the same `getDeployProvenance()`, falling back to `"unknown"` (never fabricated). Production-verified for API only; Web/Worker verified in build/typecheck/unit tests, pending their next redeploy. |

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

## Previous Batch — Phase 1, batch 1: Capability Reality Registry (CLOSED, merged as PR #618, ledger update PR #620)

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

## Previous Batch — Phase 1, batch 2: wire 2 golden regressions to real tests (CLOSED, merged as PR #621)

### Goal

Wire `payment-release-canonical-path` and `migration-startup-safety` (2 of the 8 `NOT_WIRED` golden regressions from batch 1) to real automated tests, per the Execution Pack's own governing rule: "No fake production claims... Unknown is not safe."

### Files changed

- `tests/unit/pre-migrate-startup-safety.test.mjs` (new) — reproduces the P3009 shape live against Postgres, asserts `scripts/pre-migrate.mjs` fails loudly.
- `tests/unit/payment-release-canonical-path.test.mjs` (new) — `test.todo` proving the D02 gap described in the Blocker above; deliberately not a passing assertion.
- `packages/db/prisma/migrations/20260914150000_wire_payment_and_migration_golden_regressions/migration.sql` (new) — additive `UPDATE` of 2 `golden_regression` rows' `testReference`/`status`/`lastCheckedAt`. Zero schema changes.
- `SEMSE_EXECUTION_LEDGER.md` (this file) — corrected the Phase-0 D02 verdict and Golden Regressions Status now that the real behavior is proven, not assumed.

### Migrations

`20260914150000_wire_payment_and_migration_golden_regressions` — 2 `UPDATE` statements against existing rows by primary key (`gr_migration_startup` → `PASSING`, `gr_payment_release_canonical` → `FAILING`). No DDL, no new tables/columns, fully reversible by re-running the batch-1 seed values.

### Tests added/changed

See Files changed. Both run under `pnpm test:unit` (`node --test tests/unit/*.test.mjs`).

### Commands executed

- Local Postgres 16 in Docker (isolated scratch instance, not the shared `semse-postgres` dev container) with the exact `postgres:16` image/env CI uses.
- `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:migrate` — all 89 migrations applied cleanly including this batch's.
- `pnpm build:packages && pnpm --filter @semse/api build` — clean, exit 0.
- `node --experimental-strip-types --test tests/unit/pre-migrate-startup-safety.test.mjs tests/unit/payment-release-canonical-path.test.mjs` — 1 pass, 1 todo (expected), 0 fail.
- Full `pnpm test:unit` — 914 pass / 11 fail / 10 todo. The 11 failures (`agro-*`, `autonomy.service`, `browser-agent.service`, `contracts.service`, `ecosystem-5d.service`, `vision.service.expanded`) are **pre-existing and unrelated** — confirmed by building `apps/api` dist and re-running those exact files individually: all 43 sub-tests then pass. `pnpm test:unit`'s own `build:packages` step doesn't build `apps/api` dist, which some of those tests import from; not touched or caused by this batch.
- Verified the migration's `UPDATE` rows read back correctly via `psql` against the scratch DB.

### Results

2 of 8 `NOT_WIRED` golden regressions now have real evidence behind their status instead of "decided ground truth, not yet automated." One is genuinely healthy (`migration-startup-safety`); one exposed a real, previously-undetected production bug (`payment-release-canonical-path`) that Phase 0's D02 reconciliation had missed.

### Known failures

`payment-release-canonical-path` test fails by design (documents reality, marked `test.todo` so it doesn't block CI). See top Blocker.

### Security checks

No new endpoints or write paths introduced. The new tests are read-only against source files (`payment-release-canonical-path`) or scoped to a synthetic row cleaned up in a `finally` block (`pre-migrate-startup-safety`) — no risk to real migration history.

### Offline checks

Not applicable — API/DB-only.

### Production verification

Not applicable — this batch changes test coverage and registry metadata only, no runtime behavior change. `golden_regression` row values will reflect in production once this migration is deployed the same way batch 1's was (`railway redeploy --from-source`).

### Rollback

Re-run 2 `UPDATE`s restoring `status = 'NOT_WIRED'`, `testReference = 'not yet wired to an automated regression'`, `lastCheckedAt = NULL` for both rows (batch-1 seed values). Deleting the 2 new test files is independently safe and reversible.

## Previous Batch — Phase 1: D02 emergency mitigation (fail-safe, not the real fix; CLOSED, merged as PR #623)

### Goal

Stop `PaymentGovernanceService.releasePayment()` from fabricating a `success: true` response for an admin action whose own UI copy claims it moves real, irreversible money. See `docs/architecture/ADR-034-payment-release-fail-safe-mitigation.md` for the full decision record, including the deeper finding (two identically-named `PaymentGovernanceService` classes, three parallel release paths, an unresolved escrow→milestone ambiguity in the admin UI's request shape) that makes the *real* D02 fix its own future batch, not this one.

### Files changed

- `apps/api/src/modules/payment-governance/payment-governance.service.ts` — `releasePayment()` now throws `ServiceUnavailableException` immediately after the existing tenant-ownership check, instead of creating a transaction/logging a decision/emitting SSE/reporting success.
- `apps/api/test/payment-governance-release-disabled.test.ts` (new) — asserts the owning-tenant case now fails safe and never calls `createPaymentTransaction`/`logPaymentDecision`.
- `apps/web/app/(app)/admin/finance/page.tsx` — the "Liberar" button is `disabled` with an explanatory tooltip; label changed to "Liberar (deshabilitado)".
- `docs/architecture/ADR-034-payment-release-fail-safe-mitigation.md` (new).
- `SEMSE_EXECUTION_LEDGER.md` (this file) — Blockers/Next-3-actions updated to reflect mitigated-but-not-fixed status.

### Migrations

None.

### Feature flags

None — the mitigation is unconditional (no flag to bypass it), since there is no safe "old behavior" to fall back to.

### Tests added/changed

`apps/api/test/payment-governance-release-disabled.test.ts` — 1 new test. Existing `apps/api/test/payment-governance-tenant-scope.test.ts` re-run unmodified to confirm the tenant-ownership security check (F02a, PR #609) still runs and rejects before the new disabled-path error is reached.

### Commands executed

- `pnpm --filter @semse/api build` — clean.
- `pnpm --filter @semse/web build` — clean.
- `node --experimental-strip-types --test apps/api/test/payment-governance-release-disabled.test.ts apps/api/test/payment-governance-tenant-scope.test.ts` — 7/7 passing.
- `pnpm --filter @semse/api test:unit` — 2225 pass / 0 fail (full suite, includes the new test, discovered automatically by `scripts/run-tests.mjs`).
- `pnpm test:unit` (root) — 1048 pass / 0 fail.

### Results

The admin/finance "Liberar" button can no longer report a false success. `POST /v1/payments/release` now always returns a 503 with an honest message instead of ever fabricating a released-funds outcome. This closes the immediate trust/correctness incident; it does not close D02 — see the Blockers row for what real work remains.

### Known failures

None introduced. `tests/unit/payment-release-canonical-path.test.mjs` (PR #621) remains `test.todo`/documenting the still-open canonical-path gap — this batch does not flip it to `PASSING`, since the real delegation still doesn't exist.

### Security checks

The tenant-ownership check (`getEscrow` scoped by `tenantId`) runs unchanged before the new disabled-path error — verified by the pre-existing cross-tenant test still passing. No new input surface introduced.

### Offline checks

Not applicable.

### Production verification

**Not yet done.** Merged-ready and build/test-verified locally; requires the next Railway redeploy of semse-API and semse-web to confirm `POST /v1/payments/release` returns 503 in production and the admin/finance button renders disabled.

### Rollback

Revert this batch's commit. Note that rolling back *restores* the fake-success bug — see ADR-034's Rollback section for why that's not actually a safe fallback.

## Current Batch — Phase 1: D08 follow-up, Web/Worker deploy provenance

### Goal

Close the ADR-030 deferral: extend deploy-provenance (`gitSha`/`buildTime`) to semse-web and semse-worker, and stop the primitive from being re-implemented per-app by moving it to `@semse/shared`. See `docs/architecture/ADR-033-web-worker-deploy-provenance.md`.

### Files changed

- `packages/shared/src/deploy-provenance.ts` (new) + `deploy-provenance.js` (checked-in re-export shim, matching this package's existing convention) — canonical `getDeployProvenance()`/`DeployProvenance`, moved from `apps/api`.
- `packages/shared/src/index.ts` — re-exports the new module.
- `apps/api/src/modules/health/health.controller.ts` — imports `getDeployProvenance` from `@semse/shared` instead of the local file.
- `apps/api/src/modules/health/deploy-provenance.ts` (deleted) — superseded by the shared package.
- `apps/api/test/deploy-provenance.test.ts` (deleted) — coverage moved to `tests/unit/deploy-provenance.test.ts`.
- `apps/web/app/api/semse/healthz/route.ts` — now returns `gitSha`/`buildTime` (this is Web's actual Railway healthcheck target per `infra/railway/web.railway.json`).
- `apps/worker/src/main.mjs` — startup diagnostic log line now includes `gitSha`/`buildTime` (no HTTP surface exists on the worker to add a health endpoint to).
- `tests/unit/deploy-provenance.test.ts` (new) — the 3 cases from the original API test, now covering the shared package.
- `docs/architecture/ADR-033-web-worker-deploy-provenance.md` (new).
- `SEMSE_EXECUTION_LEDGER.md` (this file).

### Migrations

None — no schema change.

### Feature flags

None — additive diagnostic fields only, no existing caller depends on their absence.

### Tests added/changed

`tests/unit/deploy-provenance.test.ts` — 3 tests (absent → `"unknown"`, present → passthrough, empty-string → `"unknown"`), moved verbatim from the deleted `apps/api/test/deploy-provenance.test.ts`.

### Commands executed

- `pnpm --filter @semse/shared build` — clean.
- `pnpm build:packages` — clean.
- `pnpm --filter @semse/api build` — clean (after `pnpm db:generate`, needed for the unrelated Capability Registry Prisma models from the previous batch).
- `pnpm --filter @semse/web build` — clean.
- `pnpm --filter @semse/worker check` (`node --check src/main.mjs`) — clean.
- `pnpm typecheck` — clean across api/web/worker/mobile.
- `pnpm test:unit` — 1048 pass / 0 fail / 4 skip / 9 todo (full suite, after the fix below).

### Results

Web and Worker now read the exact same deploy-provenance primitive API already uses, from one shared owner. Caught and fixed one real bug in-flight: `packages/shared/src/index.ts`'s `export * from "./deploy-provenance.js"` initially broke `node --experimental-strip-types --test tests/unit/shared.test.ts` with `ERR_MODULE_NOT_FOUND`, because this package's convention requires a checked-in `.js` shim (`export * from "./X.ts"`) alongside every `.ts` source module for Node's direct-`.ts`-execution test path to resolve `.js`-specifier imports — added `packages/shared/src/deploy-provenance.js` to match `safe-url.js`/`ui-helpers.js`/etc., confirmed fixed by rerunning the full suite green.

### Known failures

None.

### Security checks

No new input surface — `getDeployProvenance()` only reads `process.env`, never user input. No secrets exposed (`gitSha`/`buildTime` are not sensitive).

### Offline checks

Not applicable.

### Production verification

**Not yet done.** Code is merged-ready and build/test-verified locally; requires `railway redeploy --from-source` for semse-web and semse-worker to confirm in production. Tracked in Blockers, not fabricated as already-verified.

### Rollback

Revert this batch's commit. Pure read-only diagnostic addition plus an internal import-path move — no schema, no state, no migration to unwind.

## Golden Regressions Status

- 6" @30° = 12": **✅ REAL AND TESTED as of this batch.** `packages/tools/src/trades/electrical/conduit-offset.engine.ts` (`calculateConduitOffset`), golden-case test at `packages/tools/test/conduit-offset.test.ts`. Built per `docs/architecture/ADR-031-conduit-offset-engine-v1.md`. Not yet wired into any UI/endpoint — that's Phase-4 scope.
- Unknown bender blocks exact marking: **✅ REAL AND TESTED.** `assertBenderVerifiedForMarking` throws `UnverifiedBenderError` unless a verified `BenderProfile` is supplied; geometry (`calculateConduitOffset`) remains available regardless. Tested in the same file.
- Payment release canonical path: **❌ FAILING — wired to a real test this batch, and it correctly reports the gap.** `tests/unit/payment-release-canonical-path.test.mjs` (`test.todo`, so it doesn't red-block CI) proves `PaymentGovernanceService.releasePayment()` — live at `POST /v1/payments/release` — never calls Stripe/`EscrowReleaseService`. The earlier "✅ confirmed" line in this ledger (Phase 0) was wrong; corrected here and in the D02 row above. Status in the `golden_regression` table is `FAILING`, not `PASSING` — see top Blocker below.
- Privacy local-only fallback: not evaluated this pass (out of D01–D08 scope as literally stated in the baseline doc; would need its own inspection).
- Migration/startup: **✅ PASSING — wired to a real automated test this batch.** `tests/unit/pre-migrate-startup-safety.test.mjs` reproduces the exact P3009 shape (a `_prisma_migrations` row with `finished_at`/`rolled_back_at` both NULL) against a live Postgres and asserts `scripts/pre-migrate.mjs` exits non-zero with a clear FATAL log instead of proceeding or failing silently. Previously this was "confirmed fixed" only by the manual incident response (Baseline section) with no regression test — now it's pinned.
- Cross-tenant: ✅ confirmed fixed for the specific F02a/F02b scope from PR #609; not verified as a repo-wide guarantee.
- Duplicate command: ⚠️ open — see D03/D04/D05 in the overlap matrix.
- Duplicate event: not evaluated this pass.
- Stale approval: not evaluated this pass.
- Offline conflict: not evaluated this pass (mobile not inspected).

## Blockers

| Blocker | External/Internal | Required resolution | Owner |
|---|---|---|---|
| ~~🔴 Payment release has two live, independent paths; only one moves real money~~ — **MITIGATED 2026-09-14, see `docs/architecture/ADR-034-payment-release-fail-safe-mitigation.md`.** `PaymentGovernanceService.releasePayment()` now throws `ServiceUnavailableException` instead of fabricating success, and the admin/finance "Liberar" button is disabled. This is a fail-safe, **not** the real fix. Investigating the fix surfaced the problem is bigger than one function: two entirely different classes are both named `PaymentGovernanceService` (`apps/api/src/modules/payments/payment-governance.service.ts`, the real evaluator used by `EscrowReleaseService`, vs. `apps/api/src/modules/payment-governance/payment-governance.service.ts`, the disabled one), there are three parallel release-adjacent paths in total (`EscrowReleaseService.tryAutoRelease`, `PaymentsService.release`, and this one), and the admin UI only sends `escrowId`+`amount` (no `milestoneId`) while both real paths are milestone-scoped and a project can have multiple milestones — an unresolved design gap, not a one-line delegate call. | **Internal, money-safety — design work remaining** | Decide the milestone-resolution approach (infer server-side vs. add UI selection) and which real path to delegate to, then reconcile or merge the two identically-named `PaymentGovernanceService` classes, as its own dedicated future batch. | Future Phase-1 batch, not blocking other work |
| ~~Capability Reality Registry migration not applied to production~~ — **RESOLVED 2026-09-14T09:29 UTC** via `railway redeploy --from-source` (deployment `b71b9a41`, SHA `087d2e2c`). `/v1/capabilities` now returns `401` (mounted + guarded) instead of `404`. Not yet re-checked: an authenticated call confirming the seeded rows read back correctly. | — | If it matters for the next batch, do one authenticated `GET /v1/capabilities` and paste the response here | — |
| D08 — Web/Worker provenance closed in code (ADR-033), not yet production-verified | Internal, low risk | Merge + `railway redeploy --from-source` for semse-web and semse-worker, then confirm `GET /api/semse/healthz` shows a real `gitSha` and `railway logs --service semse-worker` shows it in the startup line | Next redeploy cycle |
| D03/D04/D05 physical code duplication (decisions made, migration not yet done) | Internal, migration execution risk (especially D05 given incident history) | Execute the migration plans in ADR-027/028/029 — each is explicitly incremental with its own regression-test gate | Phase-1+ implementation work, not blocked on further user decisions per ADRs already accepted |
| Conduit Offset Engine not yet wired into any UI/endpoint | Internal, intentional | Phase-4 scope: wire `calculateConduitOffset`/`assertBenderVerifiedForMarking` into ProTools/mobile UI | Deferred by design, not a Phase-0/1 blocker |
| No CI/deploy hook keeps the registry in sync automatically | Internal, intentional deferral (ADR-032 "Deferred") | Design a hook once a second batch shows real usage patterns — premature now | Future Phase-1 batch |

## Next 3 concrete actions

1. **Design and execute D02's real fix** (top Blocker above) — the immediate money-safety risk has a fail-safe mitigation live (PR #623, ADR-034: `releasePayment()` now fails loudly instead of fabricating success); the real fix (delegation target, escrow→milestone resolution, reconciling the two identically-named `PaymentGovernanceService` classes) is still a separate future batch.
2. **Redeploy semse-API and semse-web and semse-worker** to production-verify PR #623 (payment-release fail-safe) and ADR-033 (Web/Worker deploy provenance) the same way ADR-030 was verified for API.
3. **Phase 1, batch 3 candidates**: synthetic/canary strategy design, a minimal Mission Control surface reading from `GET /v1/capabilities`, or wiring the remaining 6 `NOT_WIRED` golden regressions (privacy local-only fallback, cross-tenant isolation, duplicate command/event, stale approval, offline conflict). Also still open: execute ADR-027/028/029's migration plans (ADR-029/Labor Engine carries the highest risk given incident history and should not be rushed) and `agro-evidence.*`'s relationship to canonical Evidence (ADR-028).

## Last verified production behavior

2026-09-14T09:33 UTC — following the PR #618 merge and a `railway redeploy --from-source` of semse-API (deployment `b71b9a41`), `GET https://api.semseproject.com/v1/health` returned `gitSha: "087d2e2cb5c8288daa1e0d507d2d531152e7a9cb"` (the #618 merge commit), and `GET https://api.semseproject.com/v1/capabilities` returned `401` unauthenticated — confirming the route is mounted and guarded, not a stale 404. A second, redundant `--from-source` redeploy of the same commit (deployment `81ed0b39`, source unclear — possibly another concurrent session) completed cleanly shortly after with no drift.

2026-09-14 — following the PR #616 merge and a `railway redeploy --from-source` of semse-API, `GET https://api.semseproject.com/v1/health` was confirmed (in the main conversation, outside this fork) to return a real `gitSha` field instead of the previously hardcoded `"2026-05-18a"` string, closing D08 for API in production. This ledger does not have the exact byte-for-byte response captured — the main session confirmed it directly; re-run the curl if you need the literal payload for a report.

Prior verification, 2026-09-13 ~02:38 UTC: `GET https://api.semseproject.com/v1/health` returned `200 {"status":"ok", ...}` on deployment SHA `68f27f8a`, following same-day fixes for the P3009 migration failure, the `PaymentGovernanceService` DI crash, and the `LiensController`/`WaiverController` duplicate-route boot crash (PRs #612, #613).
