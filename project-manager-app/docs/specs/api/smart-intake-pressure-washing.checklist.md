# Checklist — Smart Intake pressure washing

**Spec:** `smart-intake-pressure-washing.spec.md`, DRAFT.

- [ ] Category phrases detect `pressure_washing`; neighboring categories keep their own phrases.
- [ ] Detection order verified: first among the new categories, before `demolition`, `exterior_painting` and `cleaning`.
- [ ] Explicit selection ids `lavado`, `lavado_presion`, `pressure_washing`, `hidrolavado` map to the category.
- [ ] Four questions available and correct ES/EN labels/options.
- [ ] Size multiplier bounded; estimate ranges are sane for small/medium/large.
- [ ] Risk flags (`roof_soft_wash_required`, `stain_removal_uncertain`, `water_source_needed`) not presented as professional, legal or guaranteed conclusions.
- [ ] Known limitation documented and monitored.
- [ ] Anonymous intake, claim and publish enforce existing ownership permissions.
- [ ] Old persisted records remain valid; unknown categories and answers degrade safely.
- [ ] No materialized quote/payment is automatically authorized from approximate estimate.
- [ ] SDD strict/index, tests, CI, merge/deploy provenance, smoke and rollback evidence.
- [ ] Update spec status to VERIFIED only after exact release SHA and activation evidence.
