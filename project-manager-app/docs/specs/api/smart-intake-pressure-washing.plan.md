# Plan — Smart Intake pressure washing

**Spec:** `smart-intake-pressure-washing.spec.md` — SDD 2.0 DRAFT. The original Smart Intake specs remain historical baselines.

## Build
Reuse existing Smart Intake category registry, scoring and wizard. Place `pressure_washing` in `DETECTION_ORDER` first among the new categories, before `demolition`, `exterior_painting` and `cleaning`, so "pressure wash the exterior" is not absorbed by exterior painting's "exterior" keyword and "power washing my concrete driveway" is not routed to masonry. Questions cover surface, area size, dirt level, and water/power availability. Risk answers raise informational flags only (`roof_soft_wash_required`, `stain_removal_uncertain`, `water_source_needed`).

## Data / transition / compatibility
No DB migration or new endpoint expected. Maintain existing anonymous intake ownership/claim/publish authorization and old enum/category values. Detect with deterministic keyword/explicit-category map; scoring and estimates must not alter already-approved historical jobs. Use graceful unknown/other/not-sure states.

## Tests / release
Unit detection and precedence against neighboring categories; quantitative scoring/estimate bounds; EN/ES UI; anonymous and authenticated policy; backward compatibility. CI exact SHA + SDD strict + index. Category rollback must not orphan previously stored intakes.

## Known limitation
"Pressure wash then paint the exterior" classifies as pressure washing; the painting can be raised as a follow-up job.

## External validation
Wastewater, detergent and runoff rules vary by municipality. Pressure-washing pricing is usually per square foot or per job and varies by market; the static range needs validation. Keep any citation/source and decision in release evidence.
