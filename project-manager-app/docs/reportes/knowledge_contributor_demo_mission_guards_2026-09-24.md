# SEMSE Field Knowledge System — Demo Mission Guards Across the Pipeline — ZOOM + LOOP report

**Date:** 2026-09-24
**Branch:** `claude/contributor-demo-mission-tqxe8u`
**Spec:** `docs/specs/core/knowledge-contributor-demo-mission-guards.spec.md` (APPROVED, risk high)
**Scope:** close every place where a demo (`isDemo`) mission could still produce a submission, a reward, a real Stripe transfer, or a Prometeo RAG document. Findings and the proposed fix were presented to the product owner before any code (RC5 gate, `semse-security-baseline`); the owner chose to fix all four, the RAG one included.

## 1. Repository truth (ZOOM)

- `acceptMission` has refused demo missions since PR-2 (2026-09-17). It is the only caller of `createAcceptance`, and nothing updates `isDemo` after a mission is created — so no *new* demo acceptance can be created today.
- The contributor tables were created on 2026-09-16 (`20260916021251_knowledge_contributor_program`), one day before the guard. The seed publishes the demo mission (500¢, 25 slots), so any environment seeded in that window may have demo acceptances.
- Every step after acceptance trusted the acceptance and never re-read `mission.isDemo`:

| Step | Before | After |
|---|---|---|
| `createSubmission` | created the submission | `400 CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO`, no row |
| `makeRewardEligible` (review APPROVED / appeal OVERTURNED) | created a real `ContributorReward` and moved the submission to `PAYMENT_PENDING` | no reward; submission stays `APPROVED`; the review/appeal decision is kept |
| `authorizePayout` | claimed the reward and called `stripeConnect.transferToContractor` | `409 CONTRIBUTOR_PROGRAM_REWARD_NOT_PAYABLE` **before** the atomic claim; status unchanged; provider never called. An already-`PAID` demo reward is still returned idempotently |
| `setObservationPromotion` → `PROMOTED` | indexed demo content into the tenant's Prometeo RAG | `400 CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO`, no ingestion. `REJECTED` still allowed, so a demo observation promoted earlier can be de-indexed |

No repository, schema, permission, or UI change was needed: `acceptance.mission`, `submission.mission` and `observation.submission.mission` were already loaded by the existing queries.

## 2. LOOP — implemented

1. **Spec** — `knowledge-contributor-demo-mission-guards.spec.md`, scenarios P1–P6, linked by `pnpm spec:index`.
2. **Tests first** (confirmed red before the fix: exactly the 4 new tests failed, 17 existing passed):
   - `contributor-program.service.test.ts`: P1 submission refused; P2 approving never creates a reward and leaves `APPROVED`; P3 payout refused, 0 provider calls, reward stays `PENDING_REVIEW` with no `transferId`.
   - `contributor-program-extraction.test.ts`: P4/P5 promoting is refused with 0 Prometeo ingestions and the observation stays `PENDING`; rejecting still works.
   - Fixtures `createRewardFixture` and the extraction `createFixture` had `isDemo: true` incidentally (same as the PR-2 snapshot fixture). They now take an `isDemo` option that defaults to `false`, so the existing payout/promotion tests keep testing what they were written for (P6).
3. **Code** — four guards in `contributor-program.service.ts`.

No new audit events: `EVENT_CATALOG.md` defines no `contributor_program.*` events and this repo forbids inventing them. The refusals are synchronous and visible to the actor.

## 3. Verification

Local PostgreSQL 16 (no Docker), scratch DB, `prisma migrate deploy` (all migrations applied):

- `node --test apps/api/test/contributor-program*.test.ts` → **26/26 pass** (before the fix: 4 fail, exactly the new ones).
- API unit suite (`apps/api/scripts/run-tests.mjs` against the built `dist`) → **2296 pass, 0 fail, 1 skip**.
- `pnpm test:unit` (root) → **1123 pass, 0 fail**.
- `pnpm spec:validate:strict` → 129 specs, 0 errors, 0 warnings.

**Pre-existing failures on `main`, not caused by this change (reproduced with this diff stashed):**
- `nest build` — 2× TS2322: after the dependency bump in #664, the Stripe SDK expects `apiVersion: "2026-08-26.dahlia"`; `payments/providers/stripe.provider.ts:30` and `payments/stripe-connect.service.ts:49` still pin `"2026-06-24.dahlia"`. `nest build` still writes `dist`, but it exits non-zero, which also fails `pnpm --filter @semse/api test:unit` at its build step. Changing a pinned Stripe API version changes live payment behavior, so it is out of scope here and needs its own decision.
- `pnpm lint` — 1 error in `prometeo/tool-governance/policy-decision-contract.ts:16` (unused type parameter `T`), a file this change doesn't touch.

## 4. Status

- CODED: yes
- TESTED_LOCAL: yes, against real Postgres
- INTEGRATION_TESTED: yes (contributor-program DB suites)
- CI_GREEN: pending — the PR's CI will likely show the pre-existing `main` failures above
- REVIEWED / MERGED / DEPLOYED / ACTIVATED / VERIFIED_PRODUCTION: no

## 5. What remains

- **Legacy data cleanup:** find (and decide what to do with) demo acceptances, submissions, rewards and promoted observations in each real environment. Start with a read-only query, e.g. `ContributorReward` joined to `KnowledgeSubmission` → `KnowledgeMission` where `isDemo = true`. Any write needs explicit confirmation.
- The two pre-existing `main` failures listed in §3.
