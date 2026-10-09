# Tasks — Smart Intake moving

**Spec:** `smart-intake-moving.spec.md`. DRAFT is not approval to deploy.

- [x] Category ID `moving`, bilingual registry and question types authored.
- [x] Scoring profile, size multiplier and detection precedence implemented in PR source.
- [x] Detection tests authored (category phrases, precedence cases, explicit ids).
- [ ] Specs, plan and tasks reviewed/APPROVED and indexed via `pnpm spec:index`.
- [ ] Cross-category regression suite for neighboring categories.
- [ ] Scoring and size multiplier bound tests.
- [ ] Risk flags (`long_distance_pricing`, `specialty_handling_required`, `stairs_present`) verified as advice, not professional or legal conclusions.
- [ ] EN/ES wizard and unknown/other/not_sure tests.
- [ ] Anonymous/claimed intake authorization, old-record compatibility and privacy.
- [ ] CI strict spec validation, typecheck/build/e2e on exact SHA.
- [ ] Staged canary and rollback/no orphaned persisted categories.
- [ ] Evidence and delivery metadata updated only after deployment verified.
