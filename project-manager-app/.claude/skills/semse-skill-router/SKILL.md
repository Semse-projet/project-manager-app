---
name: semse-skill-router
description: Phase 1 (report-only/shadow-mode) skill-routing layer for this repo — dynamically discovers every skill under .claude/skills/, scores which one(s) are actually relevant to a task, and explains the decision, without ever blocking a merge or granting authorization. Use when unsure which of the 20+ project-local skills applies to a task, when onboarding a new skill and wanting to see how it would route, or when a session risks loading too many skills at once for a simple task.
---

# SEMSE Skill Router (Phase 1 — report-only)

Adapted from an uploaded governance kit ("SEMSE Skill Router & Governance Kit", v1 and v2 — the v2 live-audit findings are folded directly into this implementation, not kept as a separate document). This skill is the *implementation* of that kit's Phase 1: a lightweight, scalable, explainable routing layer over the skills already living in `.claude/skills/`. It solves one problem: as project-local skills grow past a couple dozen, nobody — human or agent — should have to keep the full mapping of "which skill(s) for which task" in their head, and no session should load every skill at once for a one-line fix.

**This is advisory, not authoritative.** It never blocks a PR, never fails CI, never grants permission to do anything. `semseproject`'s Approval Gate and `semse-audit-remediation`'s money/auth sign-off requirement sit entirely outside and above this tool — it can *tell you* those skills are probably relevant, it cannot waive them, and asking it to route around them (see `N3` in the test suite) has no effect on whether they still apply.

## How to use it

```bash
pnpm skill:route:report                          # discovery report: skill count, metadata coverage, warnings
pnpm skill:route -- "Fix a failed Prisma migration where prisma migrate deploy fails"
pnpm skill:route -- --json "<task description>"  # machine-readable output
```

Read the human-readable output's `reasons`/`warnings`/`excluded` sections before trusting `primary` — the point of this tool is the explanation, not the label. A low `confidence` (below ~0.15) or a `NO_CONFIDENT_DOMAIN_SKILL` warning means "use your own judgment," not "no skill exists."

## Architecture

```text
DISCOVERY  →  METADATA PARSING  →  DERIVED REGISTRY  →  ROUTING  →  REPORT
```

- `scripts/skill-router/lib/discover.mjs` — walks configured roots (default: `.claude/skills`) for `<id>/SKILL.md`. Adding a new skill requires zero changes here; it is picked up on the next run.
- `scripts/skill-router/lib/frontmatter.mjs` — a small hand-rolled YAML-frontmatter parser (scalars, inline/block lists, one level of nested mappings, folded `>` and literal `|` block scalars). Deliberately not a real YAML dependency: the schema below is small and fixed, and this keeps the tool runnable with zero install step. Never throws — a malformed frontmatter block degrades to "missing metadata," not a crash.
- `scripts/skill-router/lib/registry.mjs` — builds the derived registry. A skill with an explicit `routing:` frontmatter block (see `references/METADATA_SCHEMA.md`) uses it as declared. **Every real skill in this repo today has no such block** — none were mass-edited to add one (Refinement 5 from the kit's live audit: "do not mass-migrate metadata in Phase 1," since every skill already has a usable `name`/`description`). For those, category/triggers/specificity are *inferred* from the description text and flagged with a `MISSING_ROUTING_METADATA` info-level warning, never an error.
- `scripts/skill-router/lib/classify.mjs` + `score.mjs` + `router.mjs` — the actual routing algorithm (below).
- `scripts/skill-router/lib/report.mjs` — renders the shadow-mode discovery report and per-task route explanation.

## Precedence: four independent lanes, not one ladder

```text
GOVERNANCE LANE      (semseproject, semse-audit-remediation)
EXECUTION LANE       (aaa-zoom-loop-execution)
DOMAIN/SUPPORT LANE  (everything else — scored, one primary + up to 2 supporting)
```

Governance and execution are selected by rule, independently of the scored domain/support pass — never by score. This is the live-audit's Refinement 1: without this separation, `semseproject`'s deliberately broad description would out-score narrow domain skills on almost every task and become a false "universal primary." See `references/ROUTING_MODEL.md` for the full precedence order and the governance/execution trigger rules.

## The one thing worth knowing before trusting a route: specificity beats breadth

The live audit (kit v2, `11_LIVE_SKILL_AUDIT_MATRIX.md`) flagged `semse-ecosystem-architect` as the single biggest over-routing risk: its own frontmatter says it applies to "ANY work that touches SEMSE Project," which would otherwise crowd out every narrow domain skill. `registry.mjs`'s legacy-inference step handles this generically (not by special-casing that skill's id): a skill whose description is long and covers a lot of ground gets a *lower* inferred specificity than a skill with a short, narrow description — the opposite of what a naive "more words matched = more relevant" heuristic would do. `semse-ecosystem-architect` still wins when a task is genuinely about product/UX/architecture (see golden case G2 in the tests); it just stops winning by default on a one-line color-token fix (G2b/G5).

## Notas para futuros agentes / hallazgos abiertos

- **Zero real skills carry `routing:` metadata yet.** Every route today runs on legacy inference. If you're adding a *new* skill and want it to route more precisely than inference would, add an explicit `routing:` block per `references/METADATA_SCHEMA.md` — this is additive and optional, never required.
- **Keyword matching has real word-sense blind spots.** E.g. "worker" appears in `semse-local-observability-testing`'s description (the BullMQ worker *service*) and in RBAC/mobile-offline contexts (the WORKER *role*) — a task using the word ambiguously can pull in the wrong one. This is an accepted Phase-1 limitation (the kit's own "false-positive activation rate" metric exists precisely to observe this over time), not something silently patched over. If you see a bad route, that's evidence for adding `routing.excludes`/`routing.triggers` to the affected skill, not a bug in the classifier logic itself.
- **`classify.mjs`'s risk/mutation/scope classification is regex-keyword-based, not exhaustive.** It was tuned against the golden/negative cases in `tests/unit/skill-router-golden-cases.test.mjs` and `skill-router-negative.test.mjs`, not against a labeled corpus. Extend the regexes there if a new recurring phrasing pattern gets consistently misrouted — don't hardcode a skill id into `router.mjs` to special-case it.
- **No CI shadow hook was added.** The kit explicitly allows landing the report command first and deferring CI hookup ("if CI integration is invasive/noisy, land the report command first and document CI hookup as the next safe step"). `pnpm skill:route:report` exists and is safe to run manually or from a future non-blocking CI step; wiring it into `.github/workflows/ci.yml` is intentionally left undone.
- **No enforcement mode exists, and none should be added without evidence.** Per the kit's own Refinement 7, that requires first observing metadata coverage, routing determinism, low false-positive rate, and low human-override rate in practice — none of which exist yet for a tool that just shipped.
- **This skill is itself outside the numbered lane system it implements.** It doesn't route to itself; it's the tool you reach for, not a candidate the tool would select.
