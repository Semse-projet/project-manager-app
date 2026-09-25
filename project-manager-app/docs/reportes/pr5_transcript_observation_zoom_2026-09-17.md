# PR-5 — Transcript + Observation — ZOOM report (spec produced, implementation deliberately not started)

**Date:** 2026-09-17
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Rule applied:** existence is not completeness — every layer traced (schema → repository → service → controller → schema/DTO → web UI → worker), not stopped at "the Prisma model exists."

## 1. Repository truth

`git fetch origin main` showed main had advanced by one commit since PR #643 merged: `dd53811`, adding two new project skills — `semse-ci-pr-workflow` and `semse-upload-flow`. This branch was rebuilt from `origin/main` (fully merged this time, no commits to preserve) per the newly-documented squash-merge gotcha in `semse-ci-pr-workflow`.

**A real, separate finding surfaced immediately from reading the new `semse-upload-flow` skill**: it claimed (correctly, at the time it was written) that `external_transfer`/multipart upload had "no real upload path anywhere in this repo" and that the correct fix for a fake multipart demo flow was to delete it entirely. That claim is now stale — PR-4 (this same session, earlier) fixed the actual multipart infrastructure to work for real, and extended the exact two call sites (`admin/disputes`, `jobs/[jobId]/evidence`) that skill describes, rather than deleting them. Left uncorrected, that skill would have led a future agent to revert a working, tested fix and reintroduce the silent-data-loss bug. Corrected the skill file in place (see diff) rather than treating it as authoritative — consistent with `aaa-zoom-loop-execution`'s own rule: "never assume an old audit, report, plan, or architecture document still describes the current system exactly."

## 2. ZOOM: what "Transcript + Observation" actually is today

Traced the full chain for the capability, not just "does a `KnowledgeExtraction` model exist":

| Layer | Classification | Evidence |
|---|---|---|
| Prisma model `KnowledgeExtraction` | EXISTING | `packages/db/prisma/schema.prisma`; migration `20260916021251_knowledge_contributor_program` |
| Row creation on submit | EXISTING (write-only) | `contributor-program.service.ts` `submitSubmission`: for every VIDEO/AUDIO asset, creates one `KnowledgeExtraction` row, `kind: TRANSCRIPTION, status: PENDING` |
| Actual processing (ASR, NER, segmentation) | **ABSENT** | No worker job, no AI adapter anywhere in `apps/worker` or `apps/api`. The code's own comment says so explicitly: "No video/audio ML model is wired up yet" |
| Read API for extractions | **ABSENT** | `repository.createExtraction` has no `list`/`find` counterpart; `contributor-program.schema.ts` has no extraction type; no controller endpoint returns this data. **These rows are write-only today — created, never read back by anything.** |
| Admin review UI showing transcript/observation | **ABSENT** | `admin/contributors/submissions` (built in the F1 slice, verified again this session) never references extractions |
| `TranscriptSegment` model (timestamped text) | **ABSENT** | Not a distinct concept anywhere in code. `KnowledgeExtractionKind.SEGMENTATION` exists as an enum value with zero rows ever created for it |
| `Observation` model (OBJECTIVE→CONDITION→DECISION→REASON→METHOD→ACTION→RESULT) | **ABSENT** | No model, type, or field with this concept exists in the repository at all — this is pure product-report prose (the uploaded program report), never implemented |
| TRANSCRIPT vs OBSERVATION vs HYPOTHESIS vs VERIFIED FACT distinction | DESIGNED_ONLY | Exists only as prose in the uploaded report; no code represents or enforces it |

**A second real bug found**: the code comment citing its own design rationale pointed at `docs/specs/core/knowledge-contributor-program` as the authorizing spec — that file has never existed in this repository. A comment citing a nonexistent spec as authority is itself a small but real traceability defect (an agent or reviewer following that citation would hit a 404-equivalent). Fixed by pointing it at the real spec produced this session (see §3) instead of leaving a dangling reference.

**Classification of the full "Transcript + Observation" capability: ABSENT**, with exactly one real, reachable code path (`PENDING` row creation on submit) that currently leads nowhere observable.

## 3. Why implementation was not started this session (and what was produced instead)

Unlike PR-3/PR-4, this is not a bug in existing, working scaffolding — it is genuinely new domain modeling (a `TranscriptSegment` model, an `Observation` model with a specific structured schema, a new worker pipeline, new read/correction API surface) with a real, unresolved product/architecture decision blocking the core of it: **which ASR (speech-to-text) provider** processes contributor audio/video. That choice has real cost (a hosted provider, and `OPENAI_API_KEY` is configured in production, confirmed read-only via Railway in the PR-3 session) and real privacy implications (contributor field audio/video — voices, jobsite locations — going to a third-party API, in direct tension with this repo's own stated principle "AI via Ollama locally"). This repo's own governance (`AGENTS.md`: "Nunca generar código sin spec aprobado para el dominio"; the `semseproject` skill's normative hierarchy, which ranks platform policy including `AGENTS.md` **above** in-session instructions) requires a spec and, for a provider/privacy decision like this, human sign-off — not a routine technical decision "backed by repository evidence" the way PR-3/PR-4's bug fixes were.

Produced instead, per the project's own SDD flow (`specify` step):

- **`docs/specs/core/knowledge-contributor-transcript-observation.spec.md`** (`status: DRAFT`) — the first formal spec for any slice of this program. Covers: problem/outcome, scope (explicitly excludes real ASR integration, names it as the open blocking question), actors/permissions, three acceptance scenarios (processed transcript, pending/processing shown honestly, failed extraction never blocking the rest of the review), API contracts for reading extractions and correcting an `Observation`, the `PROCESSING` status this needs added to `KnowledgeExtractionStatus`, data/migration plan (additive only), observability gaps found (this module has zero metrics today — a real finding, not an assumption), required tests, and an explicit external-research section naming the Whisper-local-vs-hosted-provider question as unresolved.
- The corrected code comment (§2) and the corrected `semse-upload-flow` skill (§1).

**What this spec's model/API work does *not* need the ASR decision to proceed**: the `TranscriptSegment`/`Observation` Prisma models, the read API, the admin UI states (including "pending"/"processing" honestly, per the project's own truthful-state-model rule), and the `PROCESSING` status addition are all buildable and testable today, independent of which provider eventually populates them. That is real, unblocked follow-up work for the next session once this spec (or at least its data-model section) is reviewed — the ASR provider choice only blocks the worker's actual processing step, not the scaffolding around it.

## 4. Status (per capability)

**Spec production:**
- CODED: n/a (this is a spec, not code).
- DRAFT spec written, ZOOM evidence table included, open questions explicitly marked rather than guessed. Not yet reviewed or approved by a human.

**Comment/skill corrections (§1, §2):**
- CODED: yes (comment fix, skill fix). TESTED_LOCAL: `pnpm --filter @semse/api build` clean (comment-only change, verified it didn't break anything). CI_GREEN/REVIEWED/MERGED/DEPLOYED: no, not yet pushed.

**Transcript + Observation capability itself:**
- Not started. Blocker: requires human decision on ASR provider (cost + privacy tradeoff, direct tension with this repo's stated "AI via Ollama locally" principle) before the processing half can be built; the spec itself needs review/approval per this repo's own `AGENTS.md` contract before any of the new Prisma models are added. This is not a size/complexity excuse — the data-model and read-API portions are independently ready to implement once someone (ideally the product owner) confirms the spec's scope, and a separate decision resolves the provider question.

## 5. Recommendation for next session

1. Get `docs/specs/core/knowledge-contributor-transcript-observation.spec.md` reviewed; move to `APPROVED` (or amend per feedback).
2. Independent of the ASR decision, implement the `plan`/`tasks` steps for the data model + read/correction API + admin UI states (fully specified already, no blocker).
3. Get an explicit human decision on the ASR provider question in §11 of the spec before building the worker's actual processing step.
