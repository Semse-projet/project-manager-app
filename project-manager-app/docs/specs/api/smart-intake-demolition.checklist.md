# Checklist — Smart Intake demolition

**Spec:** `smart-intake-demolition.spec.md`, DRAFT.

- [ ] Category phrases detect `demolition`; neighboring categories keep their own phrases.
- [ ] Detection order verified: before `exterior_painting` and `masonry_concrete`, after `pressure_washing`.
- [ ] Explicit selection ids `demolicion`, `demolition` map to the category.
- [ ] Four questions available and correct ES/EN labels/options.
- [ ] Size multiplier bounded; estimate ranges are sane for small/medium/large.
- [ ] Risk flags (`structural_assessment_required`, `permit_likely_required`, `hazmat_testing_recommended`) not presented as professional, legal or guaranteed conclusions.
- [ ] Known limitation documented and monitored.
- [ ] Anonymous intake, claim and publish enforce existing ownership permissions.
- [ ] Old persisted records remain valid; unknown categories and answers degrade safely.
- [ ] No materialized quote/payment is automatically authorized from approximate estimate.
- [ ] SDD strict/index, tests, CI, merge/deploy provenance, smoke and rollback evidence.
- [ ] Update spec status to VERIFIED only after exact release SHA and activation evidence.
