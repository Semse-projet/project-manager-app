# Tasks — Smart Intake handyman

**Spec:** `smart-intake-handyman.spec.md`. DRAFT is not approval to deploy.

- [x] Category ID `handyman`, bilingual registry and question types authored.
- [x] Scoring profile, size multiplier and last-place detection precedence implemented in PR source.
- [x] Detection tests authored (handyman phrases, explicit ids, specific-trade precedence).
- [ ] Specs, plan and tasks reviewed/APPROVED and indexed via `pnpm spec:index`.
- [ ] Cross-category regression suite (carpentry, plumbing, electrical, painting).
- [ ] Scoring and size multiplier bound tests.
- [ ] Licensed-trade warning as advice, not a licensing determination.
- [ ] EN/ES wizard and unknown/other/not_sure tests.
- [ ] Anonymous/claimed intake authorization, old-record compatibility and privacy.
- [ ] CI strict spec validation, typecheck/build/e2e on exact SHA.
- [ ] Staged canary and rollback/no orphaned persisted categories.
- [ ] Evidence and delivery metadata updated only after deployment verified.
