# PR-7 — Human Review Workspace — inline media viewer — ZOOM + implementation

**Date:** 2026-09-18
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Follows:** PR-6 (`docs/reportes/pr6_evidence_promotion_2026-09-18.md`), merged as PR #659, commit `e786907` (merge `1ee5656`).

## 1. Why this session started with a question instead of code

"PR-7 Human Review Workspace" existed the same way PR-6 did before its own session: a three/four-word label in an old session report, no spec, no design doc, no code anywhere else describing what "workspace" was supposed to mean beyond the review page that already exists (`apps/web/app/(app)/admin/contributors/submissions/page.tsx`, built in earlier PRs). Rather than invent scope from a label, four concrete ZOOM-grounded interpretations were put to the product owner. The owner picked: **add an inline media viewer to the existing review page** — the reviewer currently sees only `· {kind} — {clipRole} ({processingStatus})` text for every asset and has no way to actually see or hear the evidence without leaving the app.

## 2. ZOOM before writing any code

Traced the full chain, not just "does the review page exist":

| Layer | Status | Evidence |
|---|---|---|
| Review page listing assets | EXISTING | `ReviewPanel` in `submissions/page.tsx`, plain-text-only asset list |
| Asset storage | EXISTING | `KnowledgeAsset.storageKey` populated by `registerAsset`, already `include`d (not `select`d) by `findSubmissionById`/`listSubmissionsForReview`, so no repository change needed to reach it |
| A servable URL for that storage key | EXISTING but unused by this module | `GET /v1/uploads/files/*` (`uploads.controller.ts`), `@Public()` by pre-existing design ("tenant-scoped UUID keys, hard to enumerate"); `StorageService.publicUrl(key)` already builds the exact URL |
| Anything wiring asset → URL → `<video>/<audio>/<img>` | ABSENT | zero `<video>`/`<audio>`/`storageKey` references in the page (grepped before writing the spec) |

**Finding worth flagging plainly**: the missing piece was never storage or access — both already existed and were already correct for this purpose. The gap was purely presentational: nothing on the API view models ever exposed a servable URL, and nothing on the page rendered one. Explicitly out of scope for this PR (documented in the spec): changing the `@Public()` access policy on the uploads endpoint, transcript-synced scrubbing, and any review-queue/SLA/assignment feature — none of those were part of the approved interpretation.

## 3. What was built

- **Spec**: `docs/specs/core/knowledge-contributor-human-review-workspace.spec.md` (status APPROVED), documenting the ZOOM findings above and scoping the change to `previewUrl` + three inline media elements, with an explicit non-negotiable: `previewUrl` null → honest fallback text, never a broken media element.
- **API**: `ContributorProgramService` now takes an injected `StorageService` (added to `ContributorProgramModule`'s imports) and builds `previewUrl: asset.storageKey ? this.storage.publicUrl(asset.storageKey) : null` in a private `toAssetView`, used by both `registerAsset`'s return value and `toSubmissionView`'s asset list — the same accessor for every place a `KnowledgeAssetView` is produced.
- **Schema**: `knowledgeAssetViewSchema` gained `previewUrl: z.string().nullable().optional()`; `apps/web/app/semse-api.ts`'s local `KnowledgeAssetView` type mirrors it.
- **Web UI**: `ReviewPanel`'s asset list now renders `<video controls>` for `VIDEO`, `<audio controls>` for `AUDIO`, `<img>` for `IMAGE` (each only when `previewUrl` is non-null), falling back to the original plain-text line otherwise — so a `TEXT` asset or an asset that somehow lost its `storageKey` never shows a broken player.

## 4. Verification — against real local Postgres throughout

Continuing the practice established in the PR-6 session (this sandbox has PostgreSQL 16 pre-installed, used instead of relying on CI-log archaeology):

- `pnpm db:generate` + `pnpm db:migrate` (`prisma migrate deploy`) against `postgresql://semse:semse@127.0.0.1:5432/semse` — up to date, no new migration needed (this PR is additive at the API/view-model layer only, no schema change).
- `pnpm build:packages` — clean.
- `pnpm --filter @semse/api build` — clean (after resolving a stale-Prisma-client false-positive from an unrelated already-merged commit by re-running `pnpm db:generate`).
- `apps/web` `tsc --noEmit` — clean.
- Full `apps/api` test suite run against the real DB: **2282 pass, 0 fail, 1 skipped** (pre-existing), including 1 new test (`submission view exposes previewUrl for assets with a storageKey, null otherwise`) covering VIDEO/IMAGE/AUDIO (non-null, URL matches `StorageService.publicUrl(storageKey)` exactly) and TEXT-without-storageKey (null), both on `registerAsset`'s direct return and on the reviewer-facing `getSubmission` view.
- `pnpm verify:prisma-contract:db` — no drift.
- `pnpm --filter @semse/api lint` — 1 pre-existing error, same one confirmed unrelated in the PR-6 session (`prometeo/tool-governance/policy-decision-contract.ts`), not touched by this PR.
- `pnpm --filter @semse/web lint` — 0 errors, only pre-existing warnings in untouched files (the new `<img>` in `submissions/page.tsx` carries an explicit `eslint-disable-next-line @next/next/no-img-element`, consistent with the existing pattern in `EvidenceItemDetailPanel.tsx`/`agent-chat-panel.tsx`).
- `pnpm typecheck` (workspace-wide) — clean.
- `pnpm spec:validate:strict` — 125 specs, 0 errors.
- `pnpm spec:index` — regenerated.
- `pnpm test:unit` (root) — 1122 pass, 0 fail.

## 5. Status (per capability)

| Capability | CODED | TESTED (real DB) | CI_GREEN | MERGED | Reachable in prod today |
|---|---|---|---|---|---|
| `previewUrl` on `KnowledgeAssetView` | yes | yes | no | no | yes — additive field, populated whenever `storageKey` is set |
| Inline `<video>/<audio>/<img>` in review page | yes | typecheck-verified, no browser session run | no | no | yes, gated on assets that already have a `storageKey` (existing upload flow) |

## 6. Recommendation for next session

1. This PR closes a real, user-facing gap (reviewers could not see evidence without leaving the app) using infrastructure that already existed and was already correct — no new access-control surface was introduced.
2. The PR-6 report's structural blocker (no production path creates an `Observation` row yet — ASR provider decision + LLM-based `Observation` generation, neither scoped into any PR) is unrelated to this PR's scope and still stands; it does not block this PR since it operates on `KnowledgeAsset`, which is populated by the existing upload flow independent of `Observation` generation.
3. PR-8 through PR-10 remain unscoped labels in the original session report — same caveat applies: check for source material before assuming scope, as done here and in PR-6.
