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

- Phase: 0 — Core reconciliation and stability
- Objective: confirm repo/deploy reality, reconcile D01–D08, map existing primitives, produce overlap matrix (per `04_IMPLEMENTATION_PROGRAM.md`)
- Status: reconciliation complete for Phase-0 scope; **exit gate NOT fully met** (see below)
- Health: DEGRADED — API is HEALTHY and verified in production as of today, but the deploy-provenance gate (D08) and at least two confirmed duplicate-primitive risks (D03, D04, D05) remain open. Nothing found today blocks starting Phase 1 work, but D08 should be treated as a near-term Phase-0/1 boundary item, not deferred indefinitely.

### Phase 0 exit-gate checklist (per `04_IMPLEMENTATION_PROGRAM.md`)

| Gate | Status | Evidence |
|---|---|---|
| No unresolved critical build/boot regression | ✅ MET | PR #612 (lockfile) + PR #613 (DI + route collision) merged; prod healthcheck 200 today |
| Canonical payment release path identified | ✅ MET | See D02 |
| Per-resource authorization pattern identified | ✅ MET | See D01 |
| Privacy contract preserved end-to-end | ✅ MET (for the scope PR #609 covered) | See D07 |
| Migration/deploy path verified | ⚠️ PARTIAL | Migration: yes (schema up to date). Deploy provenance: **no** — see D08 |
| Overlapping primitives mapped | ✅ MET | See Overlap Matrix below |

## Reconciliation Decisions (D01–D08)

| # | Primitive | Existing location | Decision | Canonical owner | Evidence |
|---|---|---|---|---|---|
| D01 | Per-resource authorization | `apps/api/src/common/{permissions.decorator.ts, rbac.guard.ts, auth.guard.ts}` | **REUSE** | `common/rbac.guard.ts` enforcing `REQUIRED_PERMISSIONS_KEY` | Used in 75/87 controllers via `RequirePermissions`/`AuthenticatedAccess`. 12 controllers don't use it — worth a follow-up sweep, not a Phase-0 blocker. |
| D02 | One canonical payment-release command/path | `apps/api/src/modules/payments/escrow-release.service.ts` | **REUSE** | `EscrowReleaseService`, invoked only from `milestones.service.ts` | `waiver-payment-gate.service.ts` and `change-orders.service.ts` are pre-check *gates* that reference the same release math, not competing implementations (change-orders.service.ts:392 explicitly comments it reuses `PaymentsService.release()`'s pre-check). |
| D03 | One economic evaluator | `apps/api/src/modules/pricing/{material-pricing,location-cost}.service.ts` **vs** `apps/api/src/modules/contractor/contractor-estimate.service.ts` | **DUPLICADA — REPLACE_DUPLICATE or ADAPT (needs ADR)** | Not yet consolidated | `ContractorEstimateService` imports `AiModelGatewayService` + `FinanceService` directly and does **not** import anything from `pricing/`. Two independent estimate/cost paths exist today. Matches the historical Sept-11 audit's DUPLICADA finding — confirmed still true. |
| D04 | One evidence registration contract | `apps/api/src/modules/evidence/*` **vs** `apps/api/src/modules/evidence-gateway/*` | **DUPLICADA — needs ADR to decide REUSE-and-extend vs ADAPT-as-distinct-concept** | Likely `evidence/evidence.service.ts` + `evidence.policy.ts` | `evidence-gateway.service.ts` uses its own `EvidenceGatewayRepository`, not `EvidenceRepository`. `agro/agro-evidence.*` is a third, domain-specific stack — not inspected deeply enough this pass to know if it wraps canonical evidence or is fully independent; flagged for Phase-0 follow-up, not resolved here. |
| D05 | One owner for time commands (Labor Engine) | `apps/api/src/modules/labor-engine/*` **vs** `apps/api/src/modules/field-ops/time-tracker.controller.ts` | **DUPLICADA — REPLACE_DUPLICATE (field-ops path) or EXTEND labor-engine to absorb it** | `labor-engine/labor-engine.service.ts` (matches the baseline doc's own stated intent) | `field-ops/time-tracker.controller.ts` uses its own `FieldOpsService`, not `LaborEngineService`. This area has prior production incident history (phantom-migration Time Tracker outage, per project memory from 2026-07-27) — treat with extra care, do not just delete one side without checking live usage. |
| D06 | Consistent identity approval | `apps/api/src/common/request-context.ts` (`resolveRequestContext`) | **REUSE** | `resolveRequestContext` | Used in 78 files across modules — broad, consistent adoption. No competing identity-resolution helper found. |
| D07 | Immutable request privacy | Tenant-scoping fixes in PR #609 (`50b03219`) | **REUSE (recently reconciled, scope-limited)** | Per-endpoint tenant scoping via Prisma relation filters | PR #609 fixed F02a (payment-governance escrow lookup now scoped by `tenantId` via `project` relation — cross-tenant request 404s instead of leaking) and F02b (Agro farm/unit ownership check). This closes the specific P0 findings from the 2026-09-11 audit; it is **not** a repo-wide guarantee that every endpoint is tenant-scoped — no such sweep was done. |
| D08 | Independent service provenance | `docs/reportes/2026-09-11_f01_procedencia_release_api_web_worker.md` | **CREATE (real gap, not yet implemented)** | none yet | Confirmed via git history + the F01 report: as of 2026-08-31, semse-API/Web/Worker were deployed via direct `railway up`/CLI skill with zero Git commit backing — the deployed commit messages don't exist anywhere in `git log --all`. Only semse-vision had real GitHub-triggered provenance. Today's `railway redeploy --from-source` on semse-API should be Git-backed, but the health endpoint still hardcodes a fake build string (`health.controller.ts:20`, `"2026-05-18a"`) instead of exposing `RAILWAY_GIT_COMMIT_SHA`/similar. **This is the single most concrete, actionable Phase-0→1 gap found.** |

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
| Electrical ProTools/calculators | **Deterministic engine does NOT exist** | Only `semse-agents/protools.agent.ts` (LLM-orchestration wrapper, references `tools.calculate` with a "using rules engine" fallback comment) | Repo-wide search for the offset formula (`offset / sin(angle)`, `Math.sin` near "offset"/"spacing"/"bend") found **zero** matches related to conduit bending anywhere in api/web/mobile/packages. All `Math.sin`-adjacent hits are unrelated geo-distance/proximity code. **Phase 4 (Electrical Field V1) starts from CREATE, not REUSE/EXTEND, despite the baseline doc's framing that this vertical "has already produced real field data."** The field data/domain knowledge may exist in specs or a person's head, not in code. |
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

## Current Batch

_No implementation batch performed in Phase 0 — this pass was reconciliation/documentation only, per the "focused reconciliation, not a new broad audit" instruction._

### Goal

N/A this pass.

### Files changed

`SEMSE_EXECUTION_LEDGER.md` (this file, created).

### Migrations

None.

### Feature flags

None.

### Tests added/changed

None.

### Commands executed

`git clone`, `git log`, `grep`/`find` inspection only. No build/test commands re-run (today's PR #613 CI results were used as the current baseline instead of re-running the full monorepo build — see Baseline section).

### Results

Reconciliation complete for D01–D08 and the primitive inventory; overlap matrix produced.

### Known failures

None introduced. D08 (deploy provenance) remains an open gap, not a regression from this pass.

### Security checks

Not applicable — no code changed.

### Offline checks

Not applicable.

### Production verification

`GET https://api.semseproject.com/v1/health` → `200 {"status":"ok"}` (confirmed today, prior to this ledger).

### Rollback

Not applicable — documentation-only PR.

## Golden Regressions Status

- 6" @30° = 12": **CANNOT CONFIRM — engine does not exist in code.** No implementation of `offset / sin(angle)` found anywhere in the repository. This regression has no code to regress; Phase 4 must create it from scratch and add this as its first test.
- Unknown bender blocks exact marking: N/A, same reason — no bender-marking logic exists yet.
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
| D08 — no verifiable deploy provenance for API/Web/Worker | Internal (process + missing health-endpoint field) | Add real commit SHA to health endpoint (e.g. read `RAILWAY_GIT_COMMIT_SHA` at build/deploy time) and confirm future deploys go through Git-triggered Railway builds, not ad-hoc `railway up` | User/whoever owns Railway service config |
| D03/D04/D05 duplication | Internal, needs product/architecture judgment call | ADRs deciding REPLACE_DUPLICATE vs ADAPT for pricing/contractor-estimate, evidence/evidence-gateway, labor-engine/field-ops-time-tracker | User (these are "real product/business decision[s] with multiple materially different correct interpretations" per the master prompt's own escalation criteria) |
| Electrical Field engine does not exist | Internal | Confirm this is genuinely CREATE-from-zero before Phase 4 planning assumes an existing foundation | User (scope/expectation-setting) |

## Next 3 concrete actions

1. **Write ADRs for D03, D04, D05** (using `09_ADR_TEMPLATE.md`) before any Phase-1+ code touches pricing, evidence, or time/labor — these are exactly the "real product decision with multiple correct interpretations" cases the master prompt says to escalate rather than assume.
2. **Close the D08 gap**: add a real commit-SHA field to `health.controller.ts` (trivial, low-risk) and verify the next Railway deploy of each service (API/Web/Worker) is Git-triggered, not a manual CLI push — this directly unblocks the Phase-0 exit gate's "migration/deploy path verified" item, which is currently only PARTIAL.
3. **Begin Phase 1 (Reliability substrate)** — Capability Reality Registry + verification dimensions — using this ledger's maturity findings (REUSE items above are candidates for immediate REAL/VERIFIED status; D03/D04/D05/Electrical items should be seeded into the registry as PARCIAL/DUPLICADA/SOLO DISEÑADA respectively so Phase 1's registry reflects reality from day one instead of re-discovering these gaps).

## Last verified production behavior

2026-09-13, ~02:38 UTC — `GET https://api.semseproject.com/v1/health` returned `200 {"requestId":"...","data":{"status":"ok","service":"semse-api","persistence":"prisma","build":"2026-05-18a","authMode":"jwt-crypto-only","timestamp":"2026-09-13T02:38:14.424Z"}}` on deployment SHA `68f27f8a` (via `railway redeploy --from-source`), following same-day fixes for the P3009 migration failure, the `PaymentGovernanceService` DI crash, and the `LiensController`/`WaiverController` duplicate-route boot crash (PRs #612, #613).
