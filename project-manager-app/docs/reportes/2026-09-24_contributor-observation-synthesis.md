# PR-12 — Field Knowledge Contributor Program: Observation Synthesis via LLM — ZOOM + implementation

**Date:** 2026-09-24
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Follows:** PR-11 (`docs/reportes/2026-09-24_contributor-asr-openai-whisper.md`), merged as PR #667, commit `5846bd0` (merge `cc7073a`).

## 1. Why this session did not need a fresh AskUserQuestion round

The product owner already approved building this in the PR-11 session,
explicitly as a separate slice (PR-11 spec §2, "Fuera de alcance"). PR-11's
report flagged it as "touches an unresolved privacy-routing gap
(SPEC-GTW-001)" — that flag was raised before the exact code path was
traced. This session read `ai-model-router.service.ts` in full: `privacyLevel:
"sensitive"` forces `ollama-local` before any `taskType` routing or
`forceModelSlug`, with no fallback (fails closed), and `ollama-local` is
**not** one of the five slugs SPEC-GTW-001 describes as bypassing
`AdaptiveRouter` — it goes through `LLMOrchestrator.chat()`, which is
explicitly passed `localOnly`/`privacyCritical` computed from
`privacyLevel`. Using `privacyLevel: "sensitive"` is the already-audited,
already-tested (`ai-model-router-privacy.test.ts`) mechanism for exactly
this case — not a new product/privacy decision requiring sign-off, so no
`AskUserQuestion` was needed this time.

## 2. ZOOM before writing any code

| Layer | Status | Evidence |
|---|---|---|
| `createObservation` (repository) | existed since PR-5, never called in production | confirmed again this session |
| Reusable pattern for structured-JSON LLM extraction | already exists | `finance/receipt-ocr.service.ts` — same `AiModelGatewayService.generate()` shape (systemPrompt + input + requireJson + tolerant JSON parsing) this PR needed |
| Privacy routing for this exact call | already correct, already tested | `AiModelRouterService.selectRoute()` — see §1 |
| Module cycle | `AiModelsModule` imports `PrometeoModule`, already in the `ContributorProgramModule`↔`PaymentsModule` cycle from PR-10 | confirmed by booting: first attempt without `forwardRef` on the new edge threw `ReferenceError: Cannot access 'AiModelsModule' before initialization` — same TDZ pattern as PR-10, fixed the same way |

## 3. What was built

- **Spec**: `docs/specs/core/knowledge-contributor-observation-synthesis.spec.md` (APPROVED, `risk: high`).
- **`observation-synthesis.ts`** (new, pure logic, no DB/network): `buildSynthesisPrompt` assigns short aliases (`s1`, `s2`, ...) to real segment ids so the model never has to copy long cuids; `parseSynthesisResponse` validates every citation against the known alias set — any hallucinated alias is dropped, any observation left with zero valid citations is dropped entirely, and an observation with a valid citation but all seven OCDR fields `null` is also dropped (citing a segment while saying nothing isn't an observation).
- **`ContributorProgramService.synthesizeObservations`** (private, called only from `processPendingExtractions` right after a transcription completes): builds the prompt from the real, just-persisted `TranscriptSegment` rows, calls the gateway with `taskType: "field_report_generation"` + `privacyLevel: "sensitive"`, persists each valid observation via `repository.createObservation` with `generatedBy: "contributor-observation-synthesis:<real modelSlug>"`, audits each creation.
- **Best-effort, never blocks the transcript**: synthesis failure (gateway fails closed, bad JSON, anything) is caught by the caller, audited as `observation.synthesis_failed`, and never turns a successful transcription into a FAILED extraction — the transcript is real and reviewable on its own regardless.
- **Module wiring**: `AiModelsModule` imported into `ContributorProgramModule` — required `forwardRef` (see ZOOM finding above), a real bug caught by booting, not by `tsc`.

## 4. Verification — against real local Postgres and a real app boot

- `pnpm build:packages` + `pnpm --filter @semse/api build` — clean.
- New `apps/api/test/observation-synthesis.test.ts` (no DB): **10/10 pass** — prompt shape, citation validation (real/hallucinated/mixed/duplicated), all-null-fields rejection, malformed JSON tolerance, code-fence stripping.
- Extended `contributor-program-extraction.test.ts` with 3 new tests against real Postgres, reaching the private `synthesizeObservations` the same way `event-outbox-dispatcher.test.ts`/`satellite-webhooks-consumer.test.ts` already do (an `as unknown as {...}` cast) rather than a full live-ASR round trip: (1) creates only the observation with a real citation, drops the hallucinated one, asserts `privacyLevel: "sensitive"` was actually sent; (2) no-op with zero segments (never calls the model); (3) throws — never fabricates — when the gateway fails closed. All pass.
- Updated `contributor-program.service.test.ts`/`contributor-program-registry.test.ts` constructors with a throwing `fakeAiGateway` (neither file's tests exercise this path).
- Full `apps/api` test suite against the real DB: **2316 pass, 0 fail, 1 skipped** (pre-existing).
- Root `pnpm test:unit`: **1123 pass, 0 fail**.
- `pnpm --filter @semse/api lint` — clean.
- `pnpm typecheck` (workspace-wide) — clean.
- **Booted the built API** against real local Postgres + Redis — caught and fixed the `AiModelsModule` TDZ bug (see ZOOM), confirmed clean boot afterward (`api_bootstrap_complete`, `ContributorProgramModule` and `AiModelsModule` both initialized).
- `pnpm spec:validate:strict` — 131 specs, 0 errors. `pnpm spec:index` regenerated.
- `pnpm verify:workspace` — run in background; confirmed separately (see PR).

## 5. Status (per capability)

| Capability | CODED | TESTED (real DB) | Boot-verified | CI_GREEN | MERGED |
|---|---|---|---|---|---|
| LLM-based Observation synthesis from real TranscriptSegment rows | yes | yes | yes | no | no |
| Privacy-routed (`ollama-local`-only) AI call for field content | yes | yes (asserted in test) | yes | no | no |

**Not yet true, by design:** any real Observation synthesized in production. This depends on two prior activations (PR-11's `SEMSE_ASR_PROVIDER=openai-whisper` + the worker's `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED`) plus one more, unconfirmed in this session: whether `semse-API` itself (not just the `ollama` Railway service) has `OLLAMA_BASE_URL`/`ENABLE_OPEN_SOURCE_MODELS=true` set. If not, synthesis fails closed honestly (P4 in the spec) rather than silently or with fabricated data.

## 6. Recommendation for next session

1. Confirm `semse-API`'s own `OLLAMA_BASE_URL`/`ENABLE_OPEN_SOURCE_MODELS` configuration in Railway (this session's reads on that service were denied by the sandbox's classifier, same as PR-11) before assuming `ollama-local` is actually reachable once PR-11+PR-12 are both activated.
2. With PR-11 and PR-12 merged, the full pipeline (mission → submission → ASR → synthesis → human review/correction → promotion → RAG ingestion → registry) is code-complete end-to-end for the first time in this program. The standing recommendation from PR-6 through PR-11 — no real production data has exercised any of it yet — still holds; the next real milestone is a canary activation with real Railway config confirmed, not more code.
