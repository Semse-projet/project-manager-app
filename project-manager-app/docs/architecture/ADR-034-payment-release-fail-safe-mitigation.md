# ADR-034 — D02 emergency mitigation: disable the fake payment-release path

- **Date:** 2026-09-14
- **Status:** Accepted (mitigation only — the real D02 consolidation is a separate, future ADR)
- **Owners:** SEMSE Execution Program, Phase 1 (D02 follow-up)
- **Affected domains:** Payment Governance (API), admin/finance (Web)

## Context

Phase 1 batch 2 (PR #621) wired a golden regression for D02 ("one canonical payment-release command/path") and found it **failing in production**, not just undocumented:

- `POST /v1/payments/release` is live, mounted, and guarded by `finance:write` (`apps/api/src/modules/payment-governance/payment-governance.controller.ts`).
- Its handler, `PaymentGovernanceService.releasePayment()` (`apps/api/src/modules/payment-governance/`), creates a `PaymentTransaction` row, logs a decision, emits an SSE `payment released` event, and returns `{ success: true, message: "Payment released successfully" }` — **without ever calling Stripe or `EscrowReleaseService`**, the only path that actually moves money (confirmed by direct code inspection, not just the fork's report).
- This is wired to a real, live admin UI action: `apps/web/app/(app)/admin/finance/page.tsx`'s "Liberar" button, whose own on-screen copy states *"Esta acción mueve dinero real y no se puede deshacer desde este panel"* ("this moves real money and can't be undone") — which was false.
- Deeper investigation while scoping the fix surfaced that the situation is worse than "one function forgot to call Stripe": **two entirely different classes are both named `PaymentGovernanceService`** in different modules — `apps/api/src/modules/payments/payment-governance.service.ts` (the real evaluator, `evaluate()`, injected into `EscrowReleaseService`) and `apps/api/src/modules/payment-governance/payment-governance.service.ts` (the fake one, `releasePayment()`/`blockPayment()`). There are in fact **three** independent release-adjacent code paths: `EscrowReleaseService.tryAutoRelease()` (real, auto-triggered on milestone approval), `PaymentsService.release()` (real, manual, requires an explicit `milestoneId` + signed contract + `APPROVED` milestone), and the fake one above.
- The admin/finance UI's "Liberar" action only sends `escrowId` + `amount` — no `milestoneId` — while both real release paths are milestone-scoped, and a project/escrow can have multiple milestones. Delegating the button to either real path therefore requires a **milestone-resolution design decision** (infer the eligible milestone server-side and define the error case, or add milestone selection to the UI) that is out of scope for an emergency mitigation.

Given a real UI path can currently cause an admin to believe money moved when it did not, this needed an immediate mitigation rather than waiting for the full D02 consolidation design.

## Decision

**Fail safe, don't fix forward yet.** `PaymentGovernanceService.releasePayment()` now throws `ServiceUnavailableException` immediately after its existing tenant-ownership check (preserving the tested cross-tenant `NotFoundException` security behavior), instead of proceeding to create a transaction, log a decision, emit an SSE event, or report success. The admin/finance "Liberar" button is disabled (`disabled` attribute + explanatory `title` tooltip) rather than removed, so escrow state stays visible while the action itself is inert.

This is explicitly **not** the D02 fix. The full fix — deciding whether `releasePayment()` delegates to `PaymentsService.release()` or `EscrowReleaseService.tryAutoRelease()`, resolving the escrow→milestone ambiguity, and reconciling or merging the two identically-named `PaymentGovernanceService` classes — is deferred to its own future ADR and implementation batch, per explicit user instruction: mitigate now, design the real fix later with more time.

## Why

- An admin action that silently fails to do what its own UI claims is a trust/correctness incident, not a backlog item — "unknown is not safe" applies to a fabricated *success* outcome exactly as much as to a fabricated *value* (per `01_CURRENT_BASELINE_AND_NON_NEGOTIABLES.md` §1.5's "unknown is a first-class state").
- The tenant-ownership check (`getEscrow` scoped by `tenantId`, the F02a fix from PR #609) is preserved untouched — this mitigation only changes what happens *after* that check passes, so no security regression.
- Disabling rather than deleting the button/endpoint keeps the change reversible and small: no route removed, no schema touched, no other caller's behavior affected beyond the (already-broken) success path.
- Rushing the real fix under mitigation time-pressure risks releasing funds against the wrong milestone (the escrow→milestone ambiguity) or building on top of the wrong one of two identically-named classes — a worse outcome than a temporarily-disabled button.

## Invariants

- `releasePayment()` must never again report `success: true` or create a `PaymentTransaction` row unless it has genuinely delegated to a real money-moving path. This mitigation enforces that by construction (the code path to do either no longer executes).
- The cross-tenant `NotFoundException` check must continue to run and reject before the disabled-path error is reached — verified by the pre-existing `payment-governance-tenant-scope.test.ts` suite still passing unmodified.

## Migration plan

1. `apps/api/src/modules/payment-governance/payment-governance.service.ts` — `releasePayment()` throws `ServiceUnavailableException` right after the tenant-ownership check; the now-unreachable blockers/score/transaction/SSE logic is removed from this method (the underlying `checkReleaseBlockers`/`calculatePaymentScore` methods themselves are untouched — `calculatePaymentScore` is still used by the separate `getPaymentScore` GET endpoint).
2. `apps/api/test/payment-governance-release-disabled.test.ts` (new) — asserts the owning-tenant case now rejects with `ServiceUnavailableException` instead of fabricating success, and that neither `createPaymentTransaction` nor `logPaymentDecision` is called.
3. `apps/web/app/(app)/admin/finance/page.tsx` — the "Liberar" button is `disabled` with an explanatory `title`; label changed to "Liberar (deshabilitado)" so it's visibly not a live action, not just an unresponsive click.
4. `SEMSE_EXECUTION_LEDGER.md` — Blockers table updated with the corrected, more complete picture (duplicate-class finding, three release paths, milestone-resolution gap) and this ADR referenced.

## Compatibility

- **API:** `POST /v1/payments/release` now always responds with a 503 instead of ever succeeding. Any caller other than the admin/finance UI that depended on the old (fake) success response would break — none found in this codebase (`grep` for `payments/release` across `apps/web` and `apps/mobile` found only the one BFF route feeding this one UI button).
- **Web:** the "Liberar" button becomes visibly inert; escrow list/status display is unaffected.
- **Database/Events:** no schema change. The SSE `payment released` event this path used to emit is no longer emitted from here (it was never backed by a real release, so no consumer should have relied on its accuracy — worth double-checking at the real-fix stage, not assumed clean here).

## Risks

- Any admin relying on this button as their normal workflow now has no manual-release option until the real fix ships. Preferable to the alternative (fake success), but worth flagging to whoever owns finance operations if manual releases are needed before the follow-up batch lands.
- `checkReleaseBlockers`/parts of `calculatePaymentScore`'s call sites inside `releasePayment` are now dead code paths within that method; left in place (as methods, still used elsewhere or by the future real fix) rather than deleted, to keep this mitigation diff minimal and reversible.

## Verification

- `apps/api/test/payment-governance-release-disabled.test.ts` — new, passing.
- `apps/api/test/payment-governance-tenant-scope.test.ts` — unmodified, still passing (6/6), confirming the security boundary is untouched.
- `pnpm --filter @semse/api build`, `pnpm --filter @semse/web build` — clean.
- `pnpm --filter @semse/api test:unit` — 2225 pass / 0 fail (full suite, includes the new test).
- `pnpm test:unit` (root) — 1048 pass / 0 fail.
- Manual verification pending next Railway deploy: `POST /v1/payments/release` against a real escrow should return 503, and the admin/finance "Liberar" button should render disabled with the tooltip.

## Rollback

Revert this batch's commit. The disabled behavior is strictly safer than the prior behavior it replaces, so there is no scenario where rolling back *this* change is itself the safe move — rollback would only be appropriate if reverting to investigate further, understanding that doing so restores the fake-success bug.
