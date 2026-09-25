# PR-8 — Knowledge Registry — ZOOM + implementation

**Date:** 2026-09-18
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Follows:** PR-7 (`docs/reportes/pr7_human_review_workspace_media_viewer_2026-09-18.md`), merged as PR #660, commit `a6c96fc` (merge `c62cb7f`).

## 1. Why this session started with a question instead of code

"PR-8 Knowledge Registry" existed the same way PR-6 and PR-7 did before their own sessions: a two-word label in an old session report, no spec, no design doc. ZOOM surfaced something the label alone didn't: the original plan actually lists **two separate** future PRs here — PR-8 "Knowledge Registry" and PR-9 "Prometeo/RAG ingestion of approved field knowledge" — and a real, working RAG ingestion pipeline (`PrometeoService.ingestText` → chunk → embed → `DocumentChunk`, exported from `PrometeoModule`) already exists, unconnected to `contributor-program`. That pipeline is PR-9's target, not this PR's. Four concrete interpretations were put to the product owner, framed around this finding (build the registry as originally scoped; merge PR-8+PR-9 into the RAG pipeline instead; stop and fix the structural blocker first; something else). The owner picked: **build the Knowledge Registry as originally planned** — a query/browse layer over `PROMOTED` observations, kept separate from RAG/embedding.

## 2. ZOOM before writing any code

| Layer | Status | Evidence |
|---|---|---|
| `Observation.promotionStatus` (PR-6) | EXISTING | `PENDING`/`PROMOTED`/`REJECTED` |
| Any way to list/search PROMOTED observations across submissions | ABSENT | grep confirms zero endpoints, zero repository queries, zero UI outside a single submission's review panel |
| Real RAG ingestion pipeline (`PrometeoService.ingestText`) | EXISTING, unconnected | confirms the original plan's own PR-8/PR-9 split was correct — this session builds only PR-8 |
| **Real `Observation` rows with `promotionStatus: PROMOTED` in production** | **ABSENT** | same structural finding flagged in the PR-6 and PR-7 reports, still true — no LLM-based `Observation` generation exists yet, only PR-5's ASR/transcript step. The registry this PR builds is honest but functionally empty until that gap closes |

## 3. What was built

- **Spec**: `docs/specs/core/knowledge-contributor-registry.spec.md` (APPROVED), documenting the PR-8/PR-9 split and the "zero real rows" caveat explicitly rather than hiding it.
- **API**: `GET /v1/contributor-program/admin/observations/registry` — filters `trade`/`category`/`missionId`/`search` (plain `ILIKE` across the Observation text fields, not semantic search — that stays PR-9's job), paginated `page`/`pageSize`, `contributor-program:manage`-gated like every other admin endpoint in this module. `listPromotedObservations` in the repository always constrains to `promotionStatus: PROMOTED` regardless of filters.
- **Schema**: `knowledgeRegistryEntryViewSchema` (an `observationViewSchema` extended with mission context: `missionId`/`missionTitle`/`trade`/`category`), `listKnowledgeRegistryQuerySchema`, `knowledgeRegistryPageSchema`.
- **Web**: new admin page `admin/contributors/registry` — filter inputs (trade/category/free-text search, applied only on submit, not per keystroke), paginated result cards, and an explicit **empty state** ("no promoted knowledge yet") rather than a bare empty table — required given the §2 finding that this is the expected state in any real tenant today.
- Deliberately **not** in scope: RAG/embedding ingestion (PR-9), semantic search, non-admin access, and any fix to the missing-`Observation`-generation blocker — all explicitly called out as out-of-scope in the spec, not silently skipped.

## 4. Verification — against real local Postgres throughout

- `pnpm build:packages` + `pnpm --filter @semse/api build` — clean.
- `apps/web` `tsc --noEmit` — clean.
- Full `apps/api` test suite against the real DB: **2287 pass, 0 fail, 1 skipped** (pre-existing), including 5 new tests in `contributor-program-registry.test.ts` (only-PROMOTED-ever, filter combinations, pagination, tenant isolation, admin-only 403).
- `pnpm verify:prisma-contract:db` — no drift (no schema change this PR — reuses `Observation`/`KnowledgeMission` as-is).
- `pnpm --filter @semse/api lint` — 1 pre-existing, unrelated error (same one flagged in PR-6/PR-7: `prometeo/tool-governance/policy-decision-contract.ts`).
- `pnpm --filter @semse/web lint` — 0 errors, same 36 pre-existing warnings in untouched files, nothing new from the registry page.
- `pnpm typecheck` (workspace-wide) — clean.
- `pnpm spec:validate:strict` — 126 specs, 0 errors.
- `pnpm spec:index` — regenerated.
- `pnpm test:unit` (root) — 1122 pass, 0 fail.

## 5. Status (per capability)

| Capability | CODED | TESTED (real DB) | CI_GREEN | MERGED | Reachable in prod today |
|---|---|---|---|---|---|
| `GET admin/observations/registry` | yes | yes | no | no | yes, but returns an empty page — no `Observation` row has ever been promoted in a real tenant (see §2) |
| Registry admin UI | yes | typecheck-verified, no browser session run | no | no | same gap — will render the honest empty state, not a browser-testable "real" result |

## 6. Recommendation for next session

1. The structural blocker flagged in PR-6, PR-7, and again here is now three sessions running: without an LLM-based step that turns `TranscriptSegment`s into real `Observation` rows, PR-6 through PR-8's code is all correct but has nothing to act on. This should be the next session's first question to the product owner, not another downstream layer.
2. PR-9 ("Prometeo/RAG ingestion of approved field knowledge") is the natural next PR in the original sequence and now has a concrete, grounded design ready to go: on promote, call the already-exported `PrometeoService.ingestText(...)` so a promoted `Observation` becomes a real, searchable `PrometeoDocument`. This session deliberately left that wiring out of PR-8's scope per the product owner's choice.
3. PR-10 remains an unscoped label — same caveat applies: check for source material before assuming scope.
