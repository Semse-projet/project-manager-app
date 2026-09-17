# Optional `routing:` frontmatter metadata

This block is **entirely optional**. No skill in this repo has one today —
Phase 1 was deliberately shipped without a mass metadata-migration pass
(the live audit found every existing `name`/`description` sufficient for
legacy inference). Add this to a `SKILL.md`'s frontmatter only when you want
routing to be more precise than inference would produce, or to correct a
route you've observed to be wrong.

```yaml
---
name: semse-your-skill
description: One-line description Claude reads to decide when to load this skill.
routing:
  version: 1
  category: domain            # governance | execution | domain | support
  scope:
    - some_capability_area
  triggers:
    - a phrase a real task would contain
    - another such phrase
  excludes:
    - a phrase that looks similar but is NOT this skill's job
  phases:
    - implementation           # discovery|spec|implementation|verification|release|post_release|report
  precedence:
    subordinate_to: []         # skill ids this one must never override
    may_constrain: []          # skill ids this one is allowed to add constraints on top of
  specificity: 70              # 0-100; higher = narrower/more authoritative in its scope
  status: active               # active | experimental | deprecated
  supersedes: []
  superseded_by: []
  notes: optional free-text context for the router / future agents
---
```

## Parsing rules a skill author should know

- `triggers`/`scope`/`excludes`/`phases`/`supersedes`/`superseded_by` accept
  either a YAML block list (`- item` per line) or an inline flow list
  (`[a, b, c]`).
- `category` must be one of `governance`/`execution`/`domain`/`support` —
  anything else is dropped with an `INVALID_METADATA` warning (never a
  crash), and the skill falls back to the inferred category for that field
  only.
- `phases` values outside the seven known phases are individually dropped
  with a warning; the rest of the list is kept.
- `specificity` outside `[0, 100]` is dropped with a warning (falls back to
  `undefined`, i.e. no tie-breaker bonus).
- Unknown fields are preserved on the parsed object untouched (never
  dropped) so a future schema version can add fields without this parser
  discarding them — see `unknown_field_behavior: ignore_and_preserve` in the
  original kit's `02_METADATA_SCHEMA.yaml`.
- Missing or invalid metadata **never** blocks anything in Phase 1 — worst
  case is a warning in `pnpm skill:route:report`'s output.
