# Plan — Smart Intake demolition

**Spec:** `smart-intake-demolition.spec.md` — SDD 2.0 DRAFT. The original Smart Intake specs remain historical baselines.

## Build
Reuse existing Smart Intake category registry, scoring and wizard. Place `demolition` in `DETECTION_ORDER` before `exterior_painting` and `masonry_concrete`, after `pressure_washing`, so "demoler un muro de concreto" is demolition rather than masonry and "tear down a wall" is not absorbed by painting's "wall"; bathroom and kitchen remodels keep precedence over demolition wording. Questions cover what is demolished, size, building age, and who handles debris. Risk answers raise informational flags only (`structural_assessment_required`, `permit_likely_required`, `hazmat_testing_recommended`).

## Data / transition / compatibility
No DB migration or new endpoint expected. Maintain existing anonymous intake ownership/claim/publish authorization and old enum/category values. Detect with deterministic keyword/explicit-category map; scoring and estimates must not alter already-approved historical jobs. Use graceful unknown/other/not-sure states.

## Tests / release
Unit detection and precedence against neighboring categories; quantitative scoring/estimate bounds; EN/ES UI; anonymous and authenticated policy; backward compatibility. CI exact SHA + SDD strict + index. Category rollback must not orphan previously stored intakes.

## Known limitation
A remodel described mainly by its demolition ("gut the kitchen") routes to the remodel category when that room keyword is present; otherwise to demolition.

## External validation
Permit, asbestos/lead testing and structural rules vary by jurisdiction and age of building; flags are advisory. Demolition pricing depends heavily on disposal fees, access and hazardous-material findings and needs market validation. Keep any citation/source and decision in release evidence.
