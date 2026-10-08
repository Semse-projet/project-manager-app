# Checklist — Smart Intake handyman

**Spec:** `smart-intake-handyman.spec.md`, DRAFT.

- [ ] Handyman phrases detect `handyman`; specific trades (plumbing, electrical, carpentry, painting, roofing, HVAC, fencing) keep precedence.
- [ ] Explicit selection ids `handyman`, `manitas`, `mantenimiento` map to the category.
- [ ] Four questions available and correct ES/EN labels/options.
- [ ] Size multiplier bounded; estimate ranges are sane for small/medium/large.
- [ ] Licensed-trade warning not presented as a confirmed licensing requirement or exemption.
- [ ] Anonymous intake, claim and publish enforce existing ownership permissions.
- [ ] Old persisted records remain valid; unknown categories and answers degrade safely.
- [ ] No materialized quote/payment is automatically authorized from approximate estimate.
- [ ] SDD strict/index, tests, CI, merge/deploy provenance, smoke and rollback evidence.
- [ ] Update spec status to VERIFIED only after exact release SHA and activation evidence.
