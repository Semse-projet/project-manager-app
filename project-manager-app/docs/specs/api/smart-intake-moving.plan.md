# Plan — Smart Intake moving

**Spec:** `smart-intake-moving.spec.md` — SDD 2.0 DRAFT. The original Smart Intake specs remain historical baselines.

## Build
Reuse existing Smart Intake category registry, scoring and wizard. Place `moving` in `DETECTION_ORDER` after `cleaning`, so "limpieza despues de la mudanza" stays cleaning; keywords are phrases ("moving company", "mudanza", "need movers") because bare "moving" matches inside "removing" and "movers" inside "removers". Questions cover type of move, size, distance, and access/special items. Risk answers raise informational flags only (`long_distance_pricing`, `specialty_handling_required`, `stairs_present`).

## Data / transition / compatibility
No DB migration or new endpoint expected. Maintain existing anonymous intake ownership/claim/publish authorization and old enum/category values. Detect with deterministic keyword/explicit-category map; scoring and estimates must not alter already-approved historical jobs. Use graceful unknown/other/not-sure states.

## Tests / release
Unit detection and precedence against neighboring categories; quantitative scoring/estimate bounds; EN/ES UI; anonymous and authenticated policy; backward compatibility. CI exact SHA + SDD strict + index. Category rollback must not orphan previously stored intakes.

## Known limitation
A message mixing a move and cleaning ("mudanza con limpieza") routes by keyword order and may need explicit category selection.

## External validation
Moving rates vary widely by region, season, crew size and hours; the flat range here is a static placeholder and needs market validation. Licensing and insurance requirements for movers vary by jurisdiction. Keep any citation/source and decision in release evidence.
