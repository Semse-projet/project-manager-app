# Checklist — Smart Intake masonry and concrete

**Spec:** `smart-intake-masonry-concrete.spec.md`, DRAFT.

- [ ] Concrete, brick, paver and retaining-wall phrases detect `masonry_concrete`.
- [ ] Painting, flooring, drywall and kitchen phrases keep their own categories.
- [ ] "Retaining wall" is not swallowed by `interior_painting`.
- [ ] Explicit selection ids `albanileria`, `masonry`, `concreto`, `concrete` map to the category.
- [ ] Four questions available and correct ES/EN labels/options.
- [ ] Size multiplier bounded; estimate ranges are sane for small/medium/large.
- [ ] Structural/demolition/pump warnings not presented as engineering, permit or legal conclusions.
- [ ] Known limitation ("paint a concrete wall" → masonry) documented and monitored.
- [ ] Anonymous intake, claim and publish enforce existing ownership permissions.
- [ ] Old persisted records remain valid; unknown categories and answers degrade safely.
- [ ] No materialized quote/payment is automatically authorized from approximate estimate.
- [ ] SDD strict/index, tests, CI, merge/deploy provenance, smoke and rollback evidence.
- [ ] Update spec status to VERIFIED only after exact release SHA and activation evidence.
