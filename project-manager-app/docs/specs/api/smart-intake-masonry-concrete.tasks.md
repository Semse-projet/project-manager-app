# Tasks — Smart Intake masonry and concrete

**Spec:** `smart-intake-masonry-concrete.spec.md`. DRAFT is not approval to deploy.

- [x] Category ID `masonry_concrete`, bilingual registry and question types authored.
- [x] Scoring profile, size multiplier and detection precedence (before `interior_painting`) implemented in PR source.
- [x] Detection tests authored (concrete/brick/retaining wall, explicit ids, painting/flooring/drywall regression).
- [ ] Specs, plan and tasks reviewed/APPROVED and indexed via `pnpm spec:index`.
- [ ] Cross-category regression suite (painting, flooring, drywall, kitchen, bathroom).
- [ ] Scoring and size multiplier bound tests.
- [ ] Structural/demolition/pump warnings as advice, not engineering or permit conclusions.
- [ ] EN/ES wizard and unknown/other/not_sure tests.
- [ ] Anonymous/claimed intake authorization, old-record compatibility and privacy.
- [ ] CI strict spec validation, typecheck/build/e2e on exact SHA.
- [ ] Staged canary and rollback/no orphaned persisted categories.
- [ ] Evidence and delivery metadata updated only after deployment verified.
