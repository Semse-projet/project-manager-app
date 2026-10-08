# Plan — Smart Intake fencing/decks (PR #822)

**Spec:** `smart-intake-fencing-decks.spec.md` — SDD 2.0 DRAFT. The original Smart Intake specs remain historical baselines.

## Build
Reuse existing Smart Intake category registry, scoring and wizard. Insert `fencing_decks` before broad `general_carpentry`, preserve ambiguous "cerca de" phrase behavior and ensure bilingual category/options are aligned. Questions cover scope/type/material/terrain, with explicit feet vs square-feet semantics. Risks (`permit_likely_required`, `demolition_required`) are informational pending local verification, never binding permit decisions.

## Data / transition / compatibility
No DB migration or new endpoint expected. Maintain existing anonymous intake ownership/claim/publish authorization and old enum/category values. Detect with deterministic keyword/explicit-category map; scoring/estimates must not alter already-approved historical jobs. Use graceful unknown/other/not sure states.

## Tests / release
Unit detection false positives and overlap ordering; quantitative scoring/estimate bounds and units; EN/ES UI; anonymous and authenticated policy; backward compatibility. CI exact SHA + SDD strict + index + authenticated/anonymized smoke. Code canary only after review; category rollback must not orphan previously stored intakes.

## External validation
Check local fence/deck permit requirements and realistic size/price data before treating static fallback as market-validated estimate. Keep any citation/source and decision in release evidence.