# PR-11 — Field Knowledge Contributor Program: ASR via OpenAI Whisper — ZOOM + implementation

**Date:** 2026-09-24
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Follows:** PR-10 (`docs/reportes/pr10_reward_payout_hardening_2026-09-19.md`), merged as PR #663, commit `5f5b9c0`. Since then, a separate session merged PR #665 (demo-mission guards, unrelated to this slice) and two dependency-bump PRs (#664, #666) into `main`; this branch was resynced onto the current `main` (`164e3a5`) before starting this slice.

## 1. Why this session escalated before writing code

The standing structural gap flagged across PR-6 through PR-10 — "no production path yet creates a real `Observation` row" — was picked as this session's next scope by explicit product-owner choice (`AskUserQuestion`). ZOOM confirmed `createObservation` (repository) is called only from tests, never from `contributor-program.service.ts`. But tracing further up the chain found the *real* root cause was one layer earlier: `resolveTranscriptionProvider()` always returns `null`, so no `TranscriptSegment` ever exists for an Observation-synthesis step to consume in the first place. That is exactly PR-5's own explicitly-deferred human decision (spec §11: ASR provider choice, a privacy/cost tradeoff on field audio) — still unresolved, `SEMSE_ASR_PROVIDER_URL` still unset everywhere.

Per this repo's own governance (a still-open, already-documented human decision point, not a routine implementation choice), this was put back to the product owner via `AskUserQuestion`, in two rounds:

1. Whether to resolve the ASR question now, decouple Observation-synthesis from it, or pick different scope entirely → chose **resolve the ASR provider decision first**.
2. With real findings pulled from Railway (read-only) on the table — the `ollama` service is live in production but runs only text models (`qwen2.5:3b`, `glm4`), no ASR/Whisper; `OPENAI_API_KEY` is already configured for other purposes — local Whisper vs. hosted OpenAI Whisper API → chose **hosted, OpenAI Whisper API**.

Both answers are recorded as explicit user selections in this session, not inferred.

## 2. ZOOM before writing any code

| Layer | Status | Evidence |
|---|---|---|
| `createObservation` (repository) | ABSENT from any real flow | called only from `contributor-program-extraction.test.ts` — confirmed by grepping all of `apps/`/`packages/` |
| `resolveTranscriptionProvider()` | always `null` | unchanged since PR-5; `SEMSE_ASR_PROVIDER_URL` never set |
| `ollama` Railway service (project `SEMSEproject`, production) | LIVE, text-only | `describe-service` (read-only): `ollama pull qwen2.5:3b && ollama pull glm4` — no ASR model. "Local" would mean deploying a new service, not flipping a var |
| `OPENAI_API_KEY` on `semse-API` | already configured | confirmed in the PR-3 session; used today for RAG embeddings and the LLM orchestrator, never for audio |
| `StorageService.readBuffer` | filesystem-only | `effectiveProvider` is always `"local"`; `STORAGE_PROVIDER=s3` only logs a warning and still uses local disk — confirmed by reading the full file, not assumed. Matters because the ASR provider needs to read the audio bytes |
| Worker sweep kill switch | already exists | `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED` in `apps/worker/src/main.mjs` — independent gate from the new provider flag |
| `openai` SDK | already a dependency of `apps/api` | `^6.49.0`, already used the same way (`new OpenAI({ apiKey })`) in `infrastructure/llm/providers/openai.provider.ts` |

## 3. What was built

- **Spec**: `docs/specs/core/knowledge-contributor-asr-openai-whisper.spec.md` (APPROVED, `risk: high`).
- **`OpenAIWhisperTranscriptionProvider`** (`transcription-provider.ts`): reads the audio via `StorageService.readBuffer`, calls `client.audio.transcriptions.create({ model: "whisper-1", response_format: "verbose_json" })`, maps `segments[]` to `TranscriptSegment`-shaped rows (seconds→ms, `avg_logprob` → a confidence proxy via `exp()`). 120s request timeout set explicitly (the sibling `DeepSeekProvider` in this codebase has no timeout — this one doesn't repeat that gap).
- **Explicit, separate activation gate**: `SEMSE_ASR_PROVIDER=openai-whisper`, deliberately independent of `OPENAI_API_KEY`'s mere presence (which is already true in production for unrelated reasons) — so merging this PR does **not** silently start sending real contributor audio to OpenAI. An unrecognized value fails loudly rather than silently falling back to "no provider."
- **`resolveTranscriptionProvider` signature change**: now takes a `TranscriptionStorageReader` (structurally satisfied by the already-injected `StorageService`) so the provider can read the audio it needs to transcribe.
- **`mapWhisperSegments`**: extracted as a pure, exported function so the timestamp/confidence math is unit-testable without a network call or mocking the OpenAI SDK.
- Explicitly **not** built in this slice: Observation-LLM-synthesis from `TranscriptSegment` (PR-12 — approved by the product owner but deliberately kept as a separate, reviewable change since it also touches a privacy-routing decision per `semse-prometeo-orchestrator`'s SPEC-GTW-001 finding); local/self-hosted Whisper (declined); real activation in production (a deliberate later Railway step, not part of this merge); legal/DPIA review of OpenAI's data-retention terms for field audio (outside this agent's authority — flagged as a recommendation, not resolved).

## 4. Verification — against real local Postgres and a real app boot

- `pnpm build:packages` + `pnpm --filter @semse/api build` — clean.
- New `apps/api/test/contributor-program-transcription-provider.test.ts` (no DB needed, pure logic): 7/7 pass — env-var gating (unset → `null`; set without key → throws; set with key → real instance; unrecognized value → throws) and `mapWhisperSegments` (timestamp conversion, confidence derivation, empty-text filtering, empty-list honesty).
- Updated `contributor-program-extraction.test.ts`'s existing "no ASR provider configured" test to assert against the real new env var name (`SEMSE_ASR_PROVIDER`, not the retired `SEMSE_ASR_PROVIDER_URL`) — still passes against real Postgres, same FAILED/`ASR_PROVIDER_NOT_CONFIGURED` behavior as before this PR (no behavior change in the default/no-flag state).
- Full `apps/api` test suite against the real DB: **2303 pass, 0 fail, 1 skipped** (pre-existing).
- `pnpm test:unit` (root): **1123 pass, 0 fail** (5 skipped/11 todo, pre-existing).
- `pnpm --filter @semse/api lint` — clean (no output; the previously-flagged pre-existing unrelated error in `prometeo/tool-governance/policy-decision-contract.ts` is no longer present, likely resolved by an unrelated PR merged since PR-10).
- `pnpm typecheck` (workspace-wide, includes `apps/api`, `apps/web`, `apps/worker`, `apps/mobile`) — clean.
- **Booted the built API** (`node apps/api/dist/main.js` against real local Postgres + Redis) — `ContributorProgramModule` initialized cleanly, `api_bootstrap_complete` logged. No new circular-DI edge was introduced by this slice (only `transcription-provider.ts`'s internal signature changed; no module wiring touched), but booted anyway per this session's own established discipline (`tsc` alone doesn't catch runtime import-order bugs).
- `pnpm spec:validate:strict` — 130 specs, 0 errors.
- `pnpm spec:index` — regenerated.
- `pnpm verify:workspace` — see PR description / follow-up for result (ran in background due to runtime; confirmed separately before push).

## 5. Status (per capability)

| Capability | CODED | TESTED (real DB) | Boot-verified | CI_GREEN | MERGED |
|---|---|---|---|---|---|
| `OpenAIWhisperTranscriptionProvider` (transcribe via hosted Whisper) | yes | yes (pure-logic tests; no live OpenAI credential/network in this sandbox — see spec §9) | yes | no | no |
| Explicit `SEMSE_ASR_PROVIDER` activation gate | yes | yes | yes | no | no |

**Not yet true, by design:** real ASR transcription running in production. Both `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED` and `SEMSE_ASR_PROVIDER=openai-whisper` must be deliberately set in Railway — this PR ships the capability, it does not activate it. Their current production values were not confirmed in this session (Railway read attempts on `semse-API`'s service/variables were denied by this sandbox's auto-mode classifier) — a human should check both before assuming any change in production behavior from this merge.

## 6. Recommendation for next session

1. **PR-12: Observation synthesis from `TranscriptSegment` via LLM.** Now genuinely unblocked (a real transcript can exist once ASR is activated), but still its own slice — it touches a documented, unresolved privacy-routing gap (SPEC-GTW-001 in `semse-prometeo-orchestrator`: `privacyCritical` isn't enforced for 5 of the model-gateway's slugs) that deserves its own reviewable change rather than being bundled with the ASR integration.
2. **Before activating `SEMSE_ASR_PROVIDER=openai-whisper` in production**: get a legal/compliance read on OpenAI's data-retention/usage terms for the audio sent (worker voices, jobsite context) — this session's product-owner decision covered *which provider*, not a GDPR/CCPA sign-off, which is outside this agent's authority to grant.
3. Confirm the real current values of `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED` and `SEMSE_ASR_PROVIDER` in Railway production (this session's read attempts on `semse-API` were denied by the sandbox's own classifier) before assuming any activation state.
