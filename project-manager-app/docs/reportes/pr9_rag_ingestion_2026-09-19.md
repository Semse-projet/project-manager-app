# PR-9 — Prometeo/RAG Ingestion — ZOOM + implementation

**Date:** 2026-09-19
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Follows:** PR-8 (`docs/reportes/pr8_knowledge_registry_2026-09-18.md`), merged as PR #661, commit `516d68a` (merge `8eac35e`).

## 1. Why this session started with a question anyway

Unlike PR-6/PR-7/PR-8, "Prometeo/RAG ingestion of approved field knowledge"
already had a concrete technical target identified in the PR-8 session:
`PrometeoService.ingestText` (chunk → embed → `DocumentChunk`), already
exported from `PrometeoModule` and in production use for other domains,
just never called from `contributor-program`. So this wasn't a "what does
this even mean" question — it was a real design decision: `Observation`
can move `PROMOTED → REJECTED` after being promoted (PR-6's free
transitions, no conflict guard). If promoting indexes into Prometeo,
should rejecting a previous promotion de-index it? Four concrete options
were put to the product owner; the owner picked the **full lifecycle**:
index on promote, de-index on reject.

## 2. ZOOM before writing any code

| Layer | Status | Evidence |
|---|---|---|
| `PrometeoService.ingestText` | EXISTING, in prod for other domains | used today by `admin/prometeo`'s manual text/file ingestion |
| `PrometeoService.deleteDocument({tenantId, id})` | EXISTING | already used by the Prometeo admin UI to delete documents |
| Any call from `contributor-program` into `PrometeoService` | ABSENT | `ContributorProgramModule` never imported `PrometeoModule` — confirmed by grep |
| A field linking `Observation` → the `PrometeoDocument` it produced | ABSENT | needed a migration; without it there's no way to know what to delete on reject, or to avoid duplicates on re-promote |
| `Observation`'s text fields at promote time | already correct | the PR-5 bug fix (`correctObservation` writing corrected text into the actual columns, not just `correctedFieldsJson`) means the row's `objective/condition/...` already reflect corrected text — no extra merge logic needed to compose the RAG text |

## 3. What was built

- **Spec**: `docs/specs/core/knowledge-contributor-rag-ingestion.spec.md` (APPROVED).
- **Data model**: `Observation.ragDocumentId String?` — `null` while not indexed. Migration generated via `prisma migrate dev --create-only` against local Postgres and applied via `prisma migrate deploy`.
- **Cross-module wiring**: `ContributorProgramModule` now imports `PrometeoModule`; `ContributorProgramService` takes `PrometeoService` as a constructor dependency (checked for circular-import risk first — nothing else imports `ContributorProgramModule`, so this is safe).
- **Lifecycle**, all inside the existing `setObservationPromotion` private helper (shared by `promoteObservation`/`rejectObservationPromotion`, no new endpoint):
  - Promote: composes a labeled text block (`Objetivo/Condición/Decisión/Razón/Método/Acción/Resultado`, skipping empty fields) and calls `ingestText` with `sourceType: "field_observation"`, `sourceRef: observation.id`; stores the resulting document id in `ragDocumentId`.
  - Reject-after-promote (`ragDocumentId` non-null): calls `deleteDocument` and clears the field.
  - Reject-never-promoted (`ragDocumentId` already null): no Prometeo call at all.
  - Re-promote after a reject: indexes a fresh document — never tries to reuse the deleted one.
  - The Prometeo call happens *before* the repository write, so a failure there (a real Prometeo/embedding-provider error) never leaves `promotionStatus`/`ragDocumentId` partially applied — the whole promotion fails and nothing changes.
- **Schema/web**: `ObservationView.ragDocumentId` exposed; the admin review page's promotion badge now shows a second "Indexada en RAG" / "No indexada" badge alongside the promotion status, so a reviewer can confirm a promoted Observation is actually searchable.

## 4. Verification — against real local Postgres throughout

- `prisma migrate dev --create-only` + `prisma migrate deploy` — real migration, really applied (`ALTER TABLE "Observation" ADD COLUMN "ragDocumentId" TEXT;`).
- `pnpm build:packages` + `pnpm --filter @semse/api build` — clean.
- `apps/web` `tsc --noEmit` — clean.
- Full `apps/api` test suite against the real DB: **2288 pass, 0 fail, 1 skipped** (pre-existing), including 2 new/extended tests in `contributor-program-extraction.test.ts`:
  - the existing PR-6 promote/reject/re-promote lifecycle test extended with a call-tracking fake `PrometeoService` — asserts `ingestText` was called with the right tenant/org/sourceRef/composed text, `ragDocumentId` was set, `deleteDocument` was called with that exact id on reject, and re-promoting produces a *different* document id (never reuses the deleted one).
  - a new test confirming rejecting a never-promoted Observation calls neither `ingestText` nor `deleteDocument`.
- `pnpm verify:prisma-contract:db` — no drift.
- `pnpm --filter @semse/api lint` — 1 pre-existing, unrelated error (same one flagged in PR-6/PR-7/PR-8: `prometeo/tool-governance/policy-decision-contract.ts`).
- `pnpm --filter @semse/web lint` — 0 errors, same pre-existing warnings.
- `pnpm typecheck` (workspace-wide) — clean.
- `pnpm spec:validate:strict` — 127 specs, 0 errors.
- `pnpm spec:index` — regenerated.
- `pnpm test:unit` (root) — 1122 pass, 0 fail.

## 5. Status (per capability)

| Capability | CODED | TESTED (real DB) | CI_GREEN | MERGED | Reachable in prod today |
|---|---|---|---|---|---|
| Index on promote | yes | yes (fake Prometeo, real DB) | no | no | yes, but see caveat below |
| De-index on reject-after-promote | yes | yes | no | no | same caveat |

**The recurring structural caveat, now resolved for the first time**: this
is the first PR in this sequence where the caveat from PR-6/PR-7/PR-8 is
no longer purely theoretical — because this PR's own tests exercise a
*real* `promoteObservation` call end-to-end (fake Prometeo, but a real
Observation row through a real service call), it's directly verified that
the moment a real `Observation` does get created and promoted, indexing
works correctly. The remaining gap is exactly what it always was: nothing
in production creates that first real `Observation` row yet.

## 6. Recommendation for next session

1. This closes the loop the PR-6/7/8 reports kept flagging: promotion,
   review, browsing, and now RAG indexing are all built and correct. The
   single remaining blocker for the entire program slice is the
   LLM-based `Observation`-generation step from `TranscriptSegment`s —
   still never scoped into any PR. This should be the next session's
   first question to the product owner, not PR-10.
2. PR-10 remains an unscoped label — same caveat applies: check for
   source material before assuming scope.
