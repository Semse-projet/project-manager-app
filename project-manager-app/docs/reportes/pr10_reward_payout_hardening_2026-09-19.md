# PR-10 — Reward Payout Hardening — ZOOM + implementation

**Date:** 2026-09-19
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Follows:** PR-9 (`docs/reportes/pr9_rag_ingestion_2026-09-19.md`), merged as PR #662, commit `ea3f30a` (merge `f6bec00`).

## 1. Why this session escalated before writing code

Unlike PR-6/7/8, "contributor reward hardening beyond the existing mocked Stripe Connect payout" pointed at real code, not a vague label. ZOOM found a genuine double-payout race. Per this repo's own `semse-security-baseline` skill (RC5 — "payment status trusted without provider verification... any change here needs a plan reviewed by a human before implementation"), the finding and a concrete fix were put to the product owner via `AskUserQuestion` before any code was written, alongside a second, smaller gap surfaced during the same trace. The owner approved fixing **both**.

## 2. ZOOM before writing any code

| Layer | Status | Evidence |
|---|---|---|
| `authorizePayout` eligibility check | present but not atomic | reads reward status via a plain `listRewardsForAdmin` query, then (if eligible) calls the real Stripe transfer, then writes `PAID` — no reservation step in between |
| `ContributorProgramRepository.updateRewardStatus` | blind `update`, not conditional | two concurrent `authorizePayout` calls for the same reward could both read the same eligible status before either writes, and both call `StripeConnectService.transferToContractor` — a real double payout |
| The same failure mode (reserve→provider→finalize) | already found and fixed elsewhere | `payments.service.ts`/`payments.repository.ts`, audit findings 0.14/0.15 in `AUDIT_REMEDIATION_PLAN.md` — never ported to this reward-payout path |
| `ContributorRewardStatus.PAYMENT_PENDING` | defined in the schema, never written | the enum already anticipated a reservation state the service never used |
| `ContributorRewardStatus.REVERSED` | defined in the schema, never written | same pattern |
| Reconciliation of `transfer.reversed` for `ContributorReward` | absent | `PaymentsService.webhook()` already maps `transfer.reversed` and reconciles `PaymentTxn` by `providerRef`, but never attempts a `ContributorReward` match — a reversed reward payout stays incorrectly `PAID` forever |

## 3. What was built

- **Spec**: `docs/specs/core/knowledge-contributor-reward-hardening.spec.md` (APPROVED, `risk: high`).
- **Race fix**: `ContributorProgramRepository.claimRewardForPayout` — a conditional `updateMany` (`WHERE id, tenantId, status IN (PENDING_REVIEW, BLOCKED_NO_PAYOUT_ACCOUNT, FAILED)` → `PAYMENT_PENDING`). `authorizePayout` now claims before calling Stripe; `count === 0` means it lost the race (or the reward simply isn't claimable), and it never reaches the provider in that case. Exact same reserve→provider→finalize shape as the already-audited `releaseFunds`/`finalizeRelease`.
- **Reversal reconciliation**: `ContributorReward.transferId String? @unique` (migration `20260919041500_knowledge_contributor_reward_hardening`), stored when a payout finalizes to `PAID`. New `ContributorProgramRepository.reconcileReversedTransfer`/`ContributorProgramService.reconcileReversedTransfer` — finds a reward by `transferId`, only reconciles if currently `PAID` (mirrors `PaymentsRepository.reconcileTransactionStatus`'s own guard), moves it to `REVERSED`.
- **Cross-module wiring**: `PaymentsService.webhook()` now also tries the reward-reconciliation path when the `PaymentTxn` reconciliation misses and the event is `transfer.reversed` (a `transferId` belongs to either a milestone release or a contributor reward, never both). `PaymentsModule` and `ContributorProgramModule` now depend on each other, wired with `forwardRef` — an already-established pattern in this codebase (10+ existing uses, e.g. `jobs.module.ts`/`projects.module.ts`), not a new technique.
- **A real bug caught by actually booting the app, not just `tsc`**: the first `forwardRef` attempt (wrapping only the new `PaymentsModule`↔`ContributorProgramModule` edge) compiled cleanly but crashed at runtime with `ReferenceError: Cannot access 'PrometeoModule' before initialization` — a genuine ESM temporal-dead-zone issue from the *three-way* cycle (`ContributorProgramModule` → `PrometeoModule` → `PaymentsModule` → `ContributorProgramModule`), since `PrometeoModule` was still imported eagerly. Fixed by wrapping that import in `forwardRef` too. `tsc` cannot catch this class of bug — it only surfaces when the actual Node/Nest module graph loads, which is why this session booted the built API directly against local Postgres to confirm `AppModule` fully initializes (`api_bootstrap_complete` logged, all modules including the three involved here) before trusting the wiring.

## 4. Verification — against real local Postgres and a real app boot

- `prisma migrate dev --create-only` blocked by Prisma's non-interactive-mode refusal (a `@unique` column addition triggers an interactive confirmation prompt even against an empty table) — hand-authored the migration SQL instead, matching this repo's own generated-migration format exactly (confirmed against recent examples), verified the table was empty first (`0` rows) so the unique constraint addition was unconditionally safe. Applied via `prisma migrate deploy`.
- `pnpm build:packages` + `pnpm --filter @semse/api build` — clean.
- **Booted the built API directly** (`node apps/api/dist/main.js` against real local Postgres) to verify the full Nest module graph resolves — caught and fixed the three-way circular-import bug described above; confirmed clean boot afterward (`api_bootstrap_complete`, every module including `ContributorProgramModule`/`PaymentsModule`/`PrometeoModule` initialized).
- Full `apps/api` test suite against the real DB: **2292 pass, 0 fail, 1 skipped** (pre-existing), including 4 new tests in `contributor-program.service.test.ts`:
  - two genuinely concurrent `authorizePayout` calls (`Promise.allSettled`) for the same reward — the fake Stripe provider is called **exactly once**, verified by an actual call counter, not just an assumption.
  - re-authorizing an already-`PAID` reward stays idempotent (no second provider call).
  - `reconcileReversedTransfer` moves a `PAID` reward with a matching `transferId` to `REVERSED`.
  - `reconcileReversedTransfer` is a safe no-op for a `transferId` that belongs to no reward (the normal case for most `transfer.reversed` events).
  - Also ran `payments-payout-method.service.test.ts` directly (constructs `PaymentsService` with positional args) to confirm the new trailing optional constructor parameter didn't disturb it — 4/4 pass.
- `pnpm verify:prisma-contract:db` — no drift.
- `pnpm --filter @semse/api lint` — 1 pre-existing, unrelated error (same one flagged in PR-6 through PR-9: `prometeo/tool-governance/policy-decision-contract.ts`).
- `pnpm typecheck` (workspace-wide) — clean.
- `pnpm spec:validate:strict` — 128 specs, 0 errors.
- `pnpm spec:index` — regenerated.
- `pnpm test:unit` (root) — 1122 pass, 0 fail.

## 5. Status (per capability)

| Capability | CODED | TESTED (real DB) | Boot-verified | CI_GREEN | MERGED |
|---|---|---|---|---|---|
| Atomic claim before payout | yes | yes (genuine concurrency test) | yes | no | no |
| `transfer.reversed` → `REVERSED` reconciliation | yes | yes | yes | no | no |

Unlike PR-6 through PR-9, this capability doesn't depend on the still-open `Observation`-generation gap — `ContributorReward` rows are created from real `KnowledgeSubmission`/`KnowledgeMissionAcceptance` flows already reachable in production (PR-2's mission-accept path), so this fix is live the moment it merges, not blocked on upstream data.

## 6. Recommendation for next session

1. The structural blocker flagged across PR-6 through PR-9 — no production path creates a real `Observation` row yet — remains the standing recommendation for whoever picks up the Knowledge pipeline half of this program next.
2. This was the last labeled PR (PR-2 through PR-10) from the original session report's plan. A next session should ask the product owner what comes next, rather than inventing further scope.
