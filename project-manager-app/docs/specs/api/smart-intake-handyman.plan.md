# Plan — Smart Intake handyman

**Spec:** `smart-intake-handyman.spec.md` — SDD 2.0 DRAFT. The original Smart Intake specs remain historical baselines.

## Build
Reuse existing Smart Intake category registry, scoring and wizard. Insert `handyman` at the **end** of `DETECTION_ORDER` (after `general_carpentry`) so every specific trade wins first; keywords are multi-word or unambiguous phrases. Questions cover task type, amount of work, who supplies materials, and access. The `licensed_trade` answer raises an informational `licensed_trade_possible` flag, never a licensing decision.

## Data / transition / compatibility
No DB migration or new endpoint expected. Maintain existing anonymous intake ownership/claim/publish authorization and old enum/category values. Detect with deterministic keyword/explicit-category map; scoring and estimates must not alter already-approved historical jobs. Use graceful unknown/other/not-sure states.

## Tests / release
Unit detection and precedence against specific trades; quantitative scoring/estimate bounds; EN/ES UI; anonymous and authenticated policy; backward compatibility. CI exact SHA + SDD strict + index. Category rollback must not orphan previously stored intakes.

## External validation
Check local licensing thresholds and realistic handyman rates before treating static fallback as a market-validated estimate. Keep any citation/source and decision in release evidence.
