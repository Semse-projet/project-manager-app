# Plan — Smart Intake masonry and concrete

**Spec:** `smart-intake-masonry-concrete.spec.md` — SDD 2.0 DRAFT. The original Smart Intake specs remain historical baselines.

## Build
Reuse existing Smart Intake category registry, scoring and wizard. Insert `masonry_concrete` **before** `interior_painting` in `DETECTION_ORDER` so "retaining wall" is not absorbed by the painting keyword "wall". Avoid ambiguous keywords ("losa", bare "block"). Questions cover type, size, site condition and truck/equipment access. Structural, demolition and pump answers raise informational flags only.

## Data / transition / compatibility
No DB migration or new endpoint expected. Maintain existing anonymous intake ownership/claim/publish authorization and old enum/category values. Detect with deterministic keyword/explicit-category map; scoring and estimates must not alter already-approved historical jobs. Use graceful unknown/other/not-sure states.

## Tests / release
Unit detection and precedence against painting/flooring/drywall/kitchen; quantitative scoring/estimate bounds; EN/ES UI; anonymous and authenticated policy; backward compatibility. CI exact SHA + SDD strict + index. Category rollback must not orphan previously stored intakes.

## Known limitation
"Paint a concrete wall" classifies as masonry. Document, monitor, and consider verb-aware detection later.

## External validation
Check local structural and permit thresholds and realistic concrete/masonry rates before treating static fallback as market-validated. Keep any citation/source and decision in release evidence.
