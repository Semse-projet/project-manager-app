# Tasks — Smart Intake fencing/decks (PR #822)

**Spec:** `smart-intake-fencing-decks.spec.md`. DRAFT is not approval to deploy.

- [x] Category ID `fencing_decks`, bilingual registry and question types authored.
- [x] Scoring profile and detection precedence implemented in PR source.
- [x] Initial keyword false-positive tests authored ("cerca de" is not fence by itself).
- [ ] Specs, plan and tasks reviewed/APPROVED and indexed via `pnpm spec:index`.
- [ ] Cross-category regression suite (carpentry, roofing, landscaping).
- [ ] Scoring and size multiplier tests including ft vs ft² boundaries and source valuation.
- [ ] Structural/demolition warnings as advice, not proof of permits.
- [ ] EN/ES wizard and unknown/other/not_sure tests.
- [ ] Anonymous/claimed intake authorization, old-record compatibility and privacy.
- [ ] CI strict spec validation, typecheck/build/e2e on exact SHA.
- [ ] Staged canary and rollback/no orphaned persisted categories.
- [ ] Evidence and delivery metadata updated only after deployment verified.