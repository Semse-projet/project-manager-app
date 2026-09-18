# PR-6 — Evidence Promotion — ZOOM + implementation

**Date:** 2026-09-18
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Follows:** PR-5 (`docs/reportes/pr5_transcript_observation_implementation_2026-09-17.md`), merged as `main`#9737d5d.

## 1. Why this session started with a question instead of code

"PR-6 Evidence Promotion" existed in this repository as exactly one artifact: a three-word parenthetical ("Evidence promotion adapter") inside a list of not-yet-built PRs in an old session report (`docs/reportes/knowledge_contributor_program_pr2_2026-09-17.md`). No spec, no design doc, no code, no prose anywhere else. That's materially different from PR-5, which had a detailed uploaded program report describing the exact `Observation` field taxonomy — there, filling gaps from the pipeline's own architecture was a routine technical decision backed by real source material. Here, inventing a whole domain concept from a label would have been guessing, not engineering judgment, so four concrete interpretations were put to the product owner instead. The owner picked: **a human reviewer promotes an existing `Observation` (PR-5) to citable knowledge** — a new `promotionStatus` on `Observation`, independent of PR-5's correction mechanism.

## 2. ZOOM before writing any code

Traced the full chain, not just "does `Observation` exist":

| Layer | Status | Evidence |
|---|---|---|
| `Observation` model (PR-5) | EXISTING | already has correction fields |
| Correction endpoint (PR-5) | EXISTING | `POST .../observations/:id/correct` |
| Any promotion concept | ABSENT | no field, no model, no prose anywhere |
| **Production path that creates an `Observation` row** | **ABSENT** | `repository.createObservation` has zero callers in `contributor-program.service.ts` or `apps/worker` — grepped before writing the spec. Only PR-5's own tests call it directly. LLM-based `Observation` generation was explicitly out of PR-5's scope ("depende de que exista un transcript real primero") |

**This is the finding worth flagging plainly**: today, nothing in production ever creates an `Observation`. Promotion is therefore correct and tested, but has zero real rows to act on until (a) an ASR provider is chosen (PR-5 §11, still open) and (b) LLM-based `Observation` generation is built (never scoped into any PR yet). Spec §0 documents this explicitly rather than letting "the promote button exists" be mistaken for "promotion is live."

## 3. What was built

- **Data model**: `ObservationPromotionStatus` enum (`PENDING`/`PROMOTED`/`REJECTED`, default `PENDING`) + `promotedByUserId`/`promotedAt`/`promotionReason` on `Observation`. Migration generated for real this time via `prisma migrate dev --create-only` against a local Postgres 16 (this sandbox has it installed — started it, created a `semse`/`semse`/`semse` DB matching CI's shape) and applied with `prisma migrate deploy`, not hand-authored blind like PR-5's migration had to be.
- **API**: `POST admin/observations/:id/promote` and `POST admin/observations/:id/reject-promotion`, both `contributor-program:manage`, `reason` required, audit-logged (`contributor_program.observation.promoted` / `...promotion_rejected`).
- **Deliberately not conflict-guarded like correction**: promotion is an editorial call a reviewer can revise (promote something they'd rejected, or vice versa) — each transition just gets its own audit entry, never a 409. This is a real, spec-documented design choice (§2), not an oversight — the spec explains why it differs from PR-5's correction 409.
- **Admin UI**: promotion badge (3 states, visually distinct from PR-5's correction badge — they're independent axes) + promote/reject buttons with a mandatory reason prompt, in the same `ObservationCard` PR-5 built.
- **Web BFF** routes + `semse-api.ts` client functions, same pattern as every other endpoint in this module.

## 4. Verification — this time against a real database throughout

PR-5's session lost significant time because CI failures couldn't be reproduced locally (no DB in this sandbox) and the log-fetch tool hard-truncated before reaching failures twice in a row. This session used the lesson directly: this sandbox already has PostgreSQL 16 installed, so every step below ran against a real `semse`/`semse`/`semse` database matching `ci.yml` exactly, not just build/typecheck:

- `prisma migrate dev --create-only` + `prisma migrate deploy` — real migration, really applied.
- `pnpm --filter @semse/api build` — clean.
- Full `apps/api` test suite (`node ./apps/api/scripts/run-tests.mjs`) run **twice** against the real DB: **2252 pass, 0 fail, 1 skipped** (pre-existing) both times, including the 2 new promotion tests actually executing (not skipped, unlike every DB-gated test in the PR-5 session).
- `pnpm verify:prisma-contract:db` — no drift.
- `pnpm --filter @semse/api lint` — 1 pre-existing error, confirmed via `git status`/`git log` to be in a file this PR never touches (`prometeo/tool-governance/policy-decision-contract.ts`, from an unrelated already-merged PR) — not this PR's to fix.
- `pnpm --filter @semse/web lint` — 0 errors, only pre-existing warnings in untouched files.
- `apps/web` `tsc --noEmit` — clean.
- `pnpm typecheck` (workspace-wide) — clean.
- `pnpm spec:validate:strict` — 122 specs, 0 errors.
- `pnpm spec:index` — regenerated.
- `pnpm test:unit` (root) — 1122 pass, 0 fail.

## 5. Status (per capability)

| Capability | CODED | TESTED (real DB) | CI_GREEN | MERGED | Reachable in prod today |
|---|---|---|---|---|---|
| `promotionStatus` field + migration | yes | yes | no | no | n/a — additive, no data yet |
| Promote/reject API | yes | yes | no | no | **no real `Observation` rows exist to promote** (see §2) |
| Admin UI badges/buttons | yes | typecheck-verified, no browser session run | no | no | same gap |

## 6. Recommendation for next session

1. The real blocker for this whole program slice (PR-5 and PR-6 both) is still the same one: an ASR provider decision, **plus** — newly surfaced by this session's ZOOM — an actual LLM-based `Observation`-generation step, which has never been scoped into any PR. Either PR-7 or a new PR needs to own that, or PR-6/PR-5 stay structurally unreachable in production regardless of how correct their code is.
2. PR-7 (Human Review Workspace) is next in the original sequence — same caveat applies: check for source material before assuming scope, the way this session did for PR-6.
