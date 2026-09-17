# PR-5 — Transcript + Observation — implementation (data model + read/correction API + worker + admin UI)

**Date:** 2026-09-17
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Follows:** `docs/reportes/pr5_transcript_observation_zoom_2026-09-17.md` (the DRAFT-spec-only session). This report covers the implementation session that followed, after the product owner explicitly authorized proceeding ("Completa entonces crea lo que hace falta, aborda por completo todo lo que hace falta") without waiting for a separate PR-review round.

## 1. What changed since the spec-only report

The prior session classified the full "Transcript + Observation" capability as **ABSENT** and produced only a DRAFT spec (`docs/specs/core/knowledge-contributor-transcript-observation.spec.md`), deliberately stopping short of code per `AGENTS.md`'s "no code without an approved spec" rule and the unresolved ASR-provider question.

This session:
1. Moved the spec's `status` to `APPROVED`, with an explicit note recording the owner's in-session authorization as the approval event (spec header, see diff).
2. Implemented everything the spec itself says does **not** need the ASR decision: the `TranscriptSegment`/`Observation` data model, the read + correction API, the admin UI states, and — going one step further than the spec's own minimum — a real worker pipeline that honestly fails every extraction today (§11 already specified this exact behavior for the no-provider case, so implementing it is not a scope violation).
3. Did **not** resolve the ASR provider question (Whisper local vs. hosted). That remains an explicit open human decision (spec §11, unchanged). No `SEMSE_ASR_PROVIDER_URL` value was set, no third-party audio API was called, and no code path can silently start sending contributor audio to a hosted provider — `transcription-provider.ts` throws loudly if that env var is ever set without a real client behind it, rather than silently succeeding.

## 2. Data model (packages/db/prisma/schema.prisma)

- `KnowledgeExtractionStatus` gained `PROCESSING` (additive `ALTER TYPE ... ADD VALUE`), matching the FSM the spec specifies: `PENDING → PROCESSING → {COMPLETED, FAILED}`, no retreat.
- New model `TranscriptSegment`: `submissionId`/`assetId`/`extractionId` provenance, `startMs`/`endMs`/`text`/`confidence`.
- New model `Observation`: the seven optional fields (`objective`/`condition`/`decision`/`reason`/`method`/`action`/`result`), `sourceSegmentIdsJson` (never empty in practice — enforced at the point observations are created, not by a DB constraint), `generatedBy`, and the correction fields (`correctedFieldsJson`/`correctedByUserId`/`correctedReason`/`correctedAt`) that stay `null` until a human reviewer corrects it.
- Migration `20260917201250_knowledge_contributor_transcript_observation` hand-authored (this sandbox has no Docker/Postgres, same constraint as the original `20260916021251_knowledge_contributor_program` and its `20260916021252` fix-up migration) — purely additive, no existing table touched, matches the spec's §7 requirement exactly. `pnpm db:generate` and `npx prisma format` both ran clean against it.

## 3. API (apps/api/src/modules/contributor-program/)

- `contributor-program.repository.ts`: `listExtractionsForSubmission`, `findObservationById`, `correctObservation` (atomic conditional `updateMany` on `correctedAt: null` — the actual 409 guard), `claimNextPendingTranscriptionExtraction` (atomic conditional `updateMany` on `status: PENDING` — the actual idempotency guard the spec's §6 asks for, without needing `SELECT ... FOR UPDATE SKIP LOCKED` for single-claim correctness), `failExtraction`, `completeExtractionWithTranscript` (transactional: creates all segments + flips the extraction to `COMPLETED` atomically), `createObservation`.
- `contributor-program.service.ts`: `getExtractionsForSubmission` (OPS_ADMIN + tenant-scoped, per spec §5's literal contract — see §6 below for what was **not** built), `correctObservation` (404/409 exactly as specified, audit-logged as `contributor_program.observation.corrected`), `processPendingExtractions` (the worker-facing pipeline — claims up to N rows, and for each one: no provider configured → `FAILED` with reason `ASR_PROVIDER_NOT_CONFIGURED`, audit-logged as `contributor_program.extraction.failed`; a provider that threw → `FAILED` with that error's message; a provider that succeeded → `completeExtractionWithTranscript` + `contributor_program.extraction.completed` audit event).
- `contributor-program.controller.ts`: `GET admin/submissions/:submissionId/extractions`, `POST admin/observations/:observationId/correct`, `POST admin/extractions/process-pending` (internal, worker-driven, same permission-gated pattern as `POST .../live-sessions/sweep-expired`).
- `transcription-provider.ts` (new file): the pluggable ASR interface. `resolveTranscriptionProvider()` returns `null` today because `SEMSE_ASR_PROVIDER_URL` is unset everywhere (confirmed in the PR-3 session via read-only Railway checks) — this is the correct, honest, by-design behavior, not a bug or a stub left unfinished.

## 4. Worker (apps/worker/src/main.mjs)

- New `sweepPendingContributorExtractions()`, same shape as `sweepExpiredLiveSessions`/`sweepExpiredReservations` (calls the API's `process-pending` endpoint, logs the result, never throws past the sweep boundary).
- Gated behind `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED` (kill switch, same convention as `LIVE_SESSION_SWEEP_ENABLED`) — **off by default**, so this PR does not silently start running a pipeline in production the moment it deploys. Turning it on today would just move every `PENDING` `TRANSCRIPTION` row to `FAILED` with an honest reason — exactly the spec's documented behavior for "worker exists and runs, but the ASR question isn't resolved yet."

## 5. Web (apps/web/)

- `semse-api.ts`: `fetchAdminContributorExtractions`, `correctAdminContributorObservation`, plus the `KnowledgeExtractionView`/`TranscriptSegmentView`/`ObservationView` types (mirrors the existing pattern of locally-typed client functions rather than importing the Zod-inferred types, consistent with every other function in this file).
- Two new BFF routes: `admin/submissions/[id]/extractions` (GET) and `admin/observations/[id]/correct` (POST), same proxy shape as every other BFF route in this module.
- `admin/contributors/submissions/page.tsx`: `ExtractionsSection` (lazy-loaded per submission, so the admin list view doesn't pay the extra query cost until a reviewer actually opens it), rendering all 5 states the spec's §5 UI contract requires — loading, empty ("no extraction yet"), pending, processing, failed (with reason), completed (segments + observations) — plus an inline correction form per uncorrected `Observation` that only submits fields the reviewer actually changed, and visually distinguishes corrected vs. raw observations (`Badge` success vs. default).
- `language-context.tsx`: 16 new es/en key pairs under `contributors.admin.extractions.*`.

## 6. What was deliberately not built (staying inside the spec's literal contract)

- **A contributor-facing "read my own transcript" endpoint.** The spec's actor table (§3) describes this capability in prose, but its Contratos section (§5) — the part that actually gates implementation per this repo's own SDD convention — only specifies the admin endpoint. Building an un-contracted endpoint would have been inventing scope the spec itself didn't commit to. This is a real, named gap for a follow-up, not a silent omission.
- **Any real ASR integration.** Unchanged from the DRAFT-spec session: still an explicit human decision (cost + privacy tradeoff between local Whisper and a hosted provider), still blocked on that decision alone, not on anything built this session.
- **`SELECT ... FOR UPDATE SKIP LOCKED`** for multi-instance worker claim throughput. The atomic conditional `updateMany` already guarantees single-claim correctness (no row is ever processed twice); the spec itself flagged the throughput refinement as "por definir en plan, no en este spec."

## 7. Verification run this session

- `npx prisma format` + `pnpm db:generate` — clean.
- `pnpm --filter @semse/schemas build` — clean.
- `pnpm --filter @semse/api build` — clean (no type errors from the new repository/service/controller/provider code).
- `pnpm --filter @semse/api test:unit` (builds first) — **2233 pass, 0 fail**, 17 skipped (DB-dependent tests, including the 4 new ones in `contributor-program-extraction.test.ts`, skipped because this sandbox has no Postgres — same constraint noted in every prior report this session).
- `apps/web` typecheck (`tsc --noEmit`) — clean.
- `pnpm lint` (api + web) — 0 errors, 36 pre-existing warnings in files this PR never touched.
- `pnpm typecheck` (workspace-wide: packages, api, web, worker syntax check, mobile) — clean.
- `pnpm spec:validate` and `pnpm spec:validate:strict` — 121 specs, 0 errors, 0 warnings.
- `pnpm spec:index` — regenerated `docs/SPEC_INDEX.md`.
- `pnpm test:unit` (root) — 1058 pass, 0 fail, 6 skipped, 11 todo (all pre-existing, unrelated to this change).

New test file `apps/api/test/contributor-program-extraction.test.ts` (4 tests, DB-gated like the rest of this module's tests):
1. `claimNextPendingTranscriptionExtraction` is idempotent under a simulated concurrent second claim.
2. `processPendingExtractions` honestly fails a `PENDING` row to `FAILED`/`ASR_PROVIDER_NOT_CONFIGURED` when no provider is configured (the only state possible today) — this is the test that most directly proves the "never fabricate a transcript" invariant holds in code, not just in the spec's prose.
3. `getExtractionsForSubmission` returns segments + observations correctly and rejects a non-admin actor.
4. Correcting an already-corrected `Observation` is rejected as a conflict (the 409 the spec's §5 requires), not silently overwritten.

These could not be executed against a real database in this sandbox (no Docker/Postgres available, same limitation as every prior PR in this session) — `TESTED_LOCAL` status for the DB-dependent assertions is therefore **not yet claimed**; they need to run once against a real Postgres (CI, or a local `docker compose up`) before this PR can honestly claim more than CODED.

## 8. Status (per capability, 10-state model)

| Capability | CODED | TESTED_LOCAL | CI_GREEN | REVIEWED | MERGED | DEPLOYED | ACTIVATED | VERIFIED_PRODUCTION |
|---|---|---|---|---|---|---|---|---|
| Data model (`TranscriptSegment`/`Observation`/`PROCESSING`) | yes | partial* | no | no | no | no | no | no |
| Read API (`GET .../extractions`) | yes | partial* | no | no | no | no | no | no |
| Correction API (`POST .../observations/:id/correct`) | yes | partial* | no | no | no | no | no | no |
| Worker pipeline (honest-fail today) | yes | partial* | no | no | no | no | **no — kill switch off by default** | no |
| Admin UI (5 states) | yes | yes (typecheck + manual review of the 5 rendered branches; no browser session run in this sandbox) | no | no | no | no | no | no |

\* "partial" = build/typecheck/lint verified; the 4 new DB-integration tests are written and skip-verified (they run and correctly skip without `DATABASE_URL`, proving no syntax/import errors) but have never executed against a real database.

Not claimed, and should not be inferred from this report: CI green, human review, merge, deploy, or any production activation. The worker's kill switch (`CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED`) stays unset/off — this PR does not turn on any new production behavior by itself.

## 9. Recommendation for next session

1. Run the new DB-integration tests against a real Postgres (CI will do this automatically; confirm before merge).
2. Decide the ASR provider question (spec §11) — still the only blocker for real transcript content instead of honest `FAILED` rows.
3. Decide whether the contributor-facing "read my own transcript" endpoint (named in §3, not contracted in §5) should be added as a spec amendment or a follow-up spec.
4. Once ready, turn on `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED` in a non-production environment first and confirm the honest-failure behavior end-to-end (canary plan per spec §8: demo tenant first).
