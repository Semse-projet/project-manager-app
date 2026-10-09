# Checklist — Smart Intake moving

**Spec:** `smart-intake-moving.spec.md`, DRAFT.

- [ ] Category phrases detect `moving`; neighboring categories keep their own phrases.
- [ ] Detection order verified: after `cleaning`.
- [ ] Explicit selection ids `mudanza`, `mudanzas`, `moving` map to the category.
- [ ] Four questions available and correct ES/EN labels/options.
- [ ] Size multiplier bounded; estimate ranges are sane for small/medium/large.
- [ ] Risk flags (`long_distance_pricing`, `specialty_handling_required`, `stairs_present`) not presented as professional, legal or guaranteed conclusions.
- [ ] Known limitation documented and monitored.
- [ ] Anonymous intake, claim and publish enforce existing ownership permissions.
- [ ] Old persisted records remain valid; unknown categories and answers degrade safely.
- [ ] No materialized quote/payment is automatically authorized from approximate estimate.
- [ ] SDD strict/index, tests, CI, merge/deploy provenance, smoke and rollback evidence.
- [ ] Update spec status to VERIFIED only after exact release SHA and activation evidence.
