# Tasks — Smart Intake pressure washing

**Spec:** `smart-intake-pressure-washing.spec.md`. DRAFT is not approval to deploy.

- [x] Category ID `pressure_washing`, bilingual registry and question types authored.
- [x] Scoring profile, size multiplier and detection precedence implemented in PR source.
- [x] Detection tests authored (category phrases, precedence cases, explicit ids).
- [ ] Specs, plan and tasks reviewed/APPROVED and indexed via `pnpm spec:index`.
- [ ] Cross-category regression suite for neighboring categories.
- [ ] Scoring and size multiplier bound tests.
- [ ] Risk flags (`roof_soft_wash_required`, `stain_removal_uncertain`, `water_source_needed`) verified as advice, not professional or legal conclusions.
- [ ] EN/ES wizard and unknown/other/not_sure tests.
- [ ] Anonymous/claimed intake authorization, old-record compatibility and privacy.
- [ ] CI strict spec validation, typecheck/build/e2e on exact SHA.
- [ ] Staged canary and rollback/no orphaned persisted categories.
- [ ] Evidence and delivery metadata updated only after deployment verified.
