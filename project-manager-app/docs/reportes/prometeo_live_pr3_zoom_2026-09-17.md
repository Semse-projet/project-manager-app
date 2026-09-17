# PR-3 — Native Prometeo Live Media — ZOOM + LOOP report

**Date:** 2026-09-17
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz` (PR #641 — same branch as the PR-2 slice; see "Why this is on the same PR" below)
**Rule applied:** existence is not completeness. Every layer below was traced end to end (UI → client → controller → service → persistence → provider → webhook → worker → runtime), not stopped at the first file found.

## 1. Repository truth

`git fetch origin main` showed main had moved one commit ahead (`aa408a7`, docs/skills only, no conflict) since the PR-2 work; merged cleanly. The 2026-09-16 audit bundled in the start pack classifies "LiveKit backend" as `PARTIAL` and "Mobile app" as `PARTIAL`. That classification is not wrong, but it undersells what's real: this session traced every layer with actual evidence, including two things the prior audit did not catch because they only surface once a real LiveKit server is in the loop — which the prior audits, run without production credential visibility, could not check.

## 2. ZOOM classification (full chain)

| Layer | File(s) | Classification | Evidence |
|---|---|---|---|
| Mobile UI (lifecycle) | `apps/mobile/src/screens/LiveSessionScreen.tsx` | EXISTING | Full status FSM UI (request/accept/ready/pause/resume/end/cancel), Expo Go degradation path, 5 passing Jest tests |
| Mobile UI (native video/audio) | same file, `mediaBox` block | **ABSENT** | Literal placeholder string: "El componente de video en vivo requiere el SDK nativo de LiveKit (build de desarrollo) — pendiente de integrar." No `@livekit/react-native` or `react-native-webrtc` dependency anywhere in `apps/mobile/package.json` or `src/`. No CAMERA/RECORD_AUDIO permission declared in `app.json` (Android permissions list has only location/notification; `expo-image-picker`'s plugin config explicitly sets `microphonePermission: false`) |
| Mobile client (session control) | `apps/mobile/src/api/liveSessions.ts` | EXISTING | Typed wrappers for create/get/participants/transition/participant-ready/media-token, all hitting `/v1/prometeo/live-sessions/*` directly (no BFF layer for mobile) |
| Mobile client (realtime channel) | `LiveSessionScreen.tsx` line 69–70 | PARTIAL | Comment explicitly says "v1: polling en vez de SSE nativo (react-native-sse) — ver spec §5" — a real SSE endpoint exists server-side (below) but the mobile client polls every 4s instead of consuming it. Out of scope for this PR (transport optimization, not "native media"), noted for a future PR |
| API controller | `apps/api/src/modules/live-sessions/live-sessions.controller.ts` | EXISTING | create/get/participants/media-token/transition/participant-ready/sweep-expired/SSE `events`, all behind `@RequirePermissions` |
| Domain service | `apps/api/src/modules/live-sessions/live-sessions.service.ts` | EXISTING, correct | Optimistic concurrency (`expectedVersion`), idempotent `create` (idempotency key bound to the exact command), FSM validated via `canTransitionLiveSession`, audit trail on every mutation, distinct authorization for `accept` (not the creator) and `cancel` (owner only) |
| Persistence | `packages/db/prisma/schema.prisma` (`LiveSession`, `LiveSessionParticipant`) | EXISTING, correct | Tenant-scoped throughout, correct cascade rules, indexes matching the actual query patterns (including `[status, expiresAt]` for the sweep) |
| Resource authorization | `live-sessions.resource-access.ts` | EXISTING, correct | `canOpenSession` checks tenant + role/ownership against the underlying `Job`/`FreeProject`, documented as deliberately conservative (unclear cases go through explicit `addParticipant`, never inferred) |
| Provider adapter (LiveKit) | `livekit.service.ts` | EXISTING, **had a real bug** — see §3 | Hand-rolled HS256 JWT (ADR-026, documented reason: avoid adding `livekit-server-sdk` before a deploy-mode decision), participant token issuance, webhook signature verification |
| Webhook | `livekit-webhook.controller.ts` | **BROKEN, now fixed** — see §3 | — |
| Worker/queue | `apps/worker/src/main.mjs` (`LIVE_SESSION_SWEEP_ENABLED`) | EXISTING but **not ACTIVATED in production** — see §4 | Feature-flag gated, calls `POST /v1/prometeo/live-sessions/sweep-expired` every `LIVE_SESSION_SWEEP_INTERVAL_MS` |
| Audit/provenance | `AuditService.append` calls in every service mutation | EXISTING | `live_session.requested`, `.accept`/`.pause`/etc., `.participant_added`, webhook-driven transitions logged with `actorUserId: "platform"`-derived attribution |
| Tests | `apps/api/test/live-sessions.service.test.ts` (20), `apps/mobile/src/screens/LiveSessionScreen.test.tsx` (5) | EXISTING, real | Both suites run for real in this session (20/20, 5/5) — not assumed |
| Tests (webhook signature) | — | **ABSENT before this session** | No test exercised `verifyWebhook` or the webhook controller at all; added 10 new tests (§3) |
| Deploy/runtime (LiveKit config) | Railway `semse-API` production service | **CONFIGURED** | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` are present on the production service (checked read-only via the Railway API — names only, no values retrieved). This means the webhook bug in §3 was live in production, not theoretical |
| Deploy/runtime (sweep) | Railway `semse-worker` production service | **NOT ACTIVATED** | `LIVE_SESSION_SWEEP_ENABLED` is absent from the production worker's variable list — see §4 |

## 3. Bug found and fixed: LiveKit webhook signature verified against the wrong bytes

`livekit-webhook.controller.ts` computed `const raw = JSON.stringify(body ?? {})` — but Nest/Fastify had already JSON-parsed the incoming request body into `body` before the controller ran. Re-serializing a parsed object does not reliably reproduce the exact bytes the sender (LiveKit) signed: key order and whitespace can differ. This codebase already has the correct pattern one module over — `payments.controller.ts`'s Stripe webhook uses `@RawBody() rawBody?: Buffer` (Fastify's `rawBody: true`, set globally in `main.ts`) and verifies against that untouched buffer. The LiveKit webhook never did this.

**Real-world impact:** since LiveKit credentials are configured in the production `semse-API` service, this means real `room_started` / `participant_joined` / `room_finished` webhooks from LiveKit would very likely fail signature verification in production (401), so `LiveSession` status has effectively never been able to auto-advance from actual room state — only from client-driven calls (`participant-ready`, manual `transition`). This is exactly the kind of gap ZOOM mode exists to catch: the webhook file *existed*, looked complete, and had a docstring citing an ADR — but tracing it against the sibling Stripe webhook and against what "raw body" actually means in this Fastify app revealed it never worked against a real server.

**Fix** (`livekit-webhook.controller.ts`, `livekit.service.ts`):
- Controller now takes `@RawBody() rawBody?: Buffer` and verifies against it, matching the Stripe pattern; a missing raw body is now a clean `400`, not a bug-masking `JSON.stringify({})`.
- `verifyWebhook` widened to accept `string | Buffer`.
- Also hardened: `crypto.timingSafeEqual` throws `RangeError` on a length mismatch instead of returning `false` — a malformed/truncated `Authorization` header on this `@Public()` endpoint would have crashed the request into an uncaught 500 instead of a clean 401. Added an explicit length guard before the call.

**Evidence, not assertion:** `apps/api/test/livekit-webhook.test.ts` (new, 10 tests) proves:
1. a signature computed over the real raw bytes verifies;
2. the same signature checked against `JSON.stringify(JSON.parse(raw))` — the old bug's exact shape — does **not** verify (this is a regression fixture, not a hypothetical: the test constructs a pretty-printed raw body, the way a non-Node server actually emits JSON, and shows the reconstruction differs and correctly fails);
3. tampering with the body invalidates the signature;
4. a malformed/short signature is rejected without throwing;
5. an unconfigured `LiveKitService` rejects cleanly;
6. the controller dispatches `room_started → ACTIVE` and `room_finished → ENDED` only for a valid signature and a recognized `live-session:<tenant>:<id>` room name, and never calls `driveFromWebhook` otherwise.

All passing for real: `node --test apps/api/test/livekit-webhook.test.ts` → 10/10; no regression in `live-sessions.service.test.ts` (20/20) or the full API suite (2240/2240, 1 unrelated skip); `pnpm lint` 0 errors; `pnpm typecheck` clean across api/web/worker/mobile.

## 4. Finding reported, not silently fixed: sweep is off in production

`LIVE_SESSION_SWEEP_ENABLED` is not set on the `semse-worker` production service (confirmed read-only via the Railway API — I did not modify anything). This means expired `LiveSession` rows (2h TTL) are not currently being auto-transitioned to `CANCELLED`/`FAILED` in production; they'll sit in whatever status they were in until someone calls `sweep-expired` manually or the flag is turned on. This repo's own rule (`AGENTS.md`: "NUNCA: Tocar lógica de Railway, CI/CD o variables de entorno de producción") means I did not set this flag myself. **This needs a human decision**: turning it on is a one-line Railway variable change (`LIVE_SESSION_SWEEP_ENABLED=true` on `semse-worker`), but it's a production runtime change and is being surfaced here rather than made unilaterally.

## 5. Why the native mobile media piece is not attempted this session (real blocker)

The mobile UI, dependency manifest, and native permission config for camera/microphone/LiveKit are genuinely **ABSENT**, not just unwired — there is no `@livekit/react-native` (or `react-native-webrtc`) dependency, no CAMERA/RECORD_AUDIO permission declared, and `apps/mobile/AGENTS.md` itself warns "Expo HAS CHANGED — read the exact versioned docs before writing any code." Building this correctly requires:
- adding and correctly configuring a native SDK + Expo config plugin;
- a native dev-client build (`eas build --profile development` or a local Xcode/Android Studio build) — Expo Go cannot load native modules, which the existing code already accounts for;
- a physical device or simulator with camera/microphone to verify permission prompts, track publish/subscribe, and actual video rendering.

None of that is possible in this sandbox (no Xcode/Android SDK, no device, no simulator). Per this program's own rule ("real blockers only: ... hardware no disponible"), this is the legitimate stopping point for that specific leaf — not a size/complexity excuse. Writing speculative native integration code that cannot be compiled against a real native toolchain or verified against actual camera/mic/track behavior would produce exactly the "parece implementado" failure mode this protocol exists to prevent, in the opposite direction (looks-coded-but-unverifiable rather than looks-existing-but-absent).

**What a human with a device should do next**, in order, so the next session can pick up cleanly:
1. Decide the LiveKit React Native SDK version compatible with Expo SDK 57 (check `apps/mobile/AGENTS.md`'s own instruction to read the versioned Expo docs first).
2. Add the dependency + its Expo config plugin, and add `CAMERA`/`RECORD_AUDIO` to `app.json`'s Android `permissions` array and the matching iOS `NSCameraUsageDescription`/`NSMicrophoneUsageDescription` strings.
3. Build a development client (`eas build --profile development`) and install it on a device.
4. Replace the `mediaBox` placeholder in `LiveSessionScreen.tsx` with a real `Room` connection using the token already returned by `getLiveSessionMediaToken` (that endpoint is real, tested, and unaffected by anything in this session).
5. Verify against the real production LiveKit server (now that the webhook signature actually works) that `room_started`/`participant_joined` correctly drive `CONNECTING → ACTIVE` end to end.

## 6. Status (per capability, not a single "done")

**LiveKit webhook signature fix:**
- CODED: yes.
- TESTED_LOCAL: yes — 10 new tests, real assertions, not mocked-away.
- INTEGRATION_TESTED: yes, in the sense of the full API suite (2240/2240) and the existing live-sessions integration suite (20/20); not tested against an actual live LiveKit server (would need real LiveKit credentials and a way to trigger a real webhook, not available here).
- CI_GREEN: unknown — not run in this sandbox.
- REVIEWED / MERGED / DEPLOYED / ACTIVATED / VERIFIED_PRODUCTION: no.
- PHYSICAL_DEVICE_VERIFIED: not applicable (backend-only fix).

**Native mobile Prometeo Live media (camera/mic/video rendering):**
- CODED: no.
- Everything else: no / not applicable.
- Blocker: no native build toolchain or physical device/simulator in this sandbox (see §5). This is not being reported as "done," "should work," or "already exists" — it is reported as not started, with the exact reason and the exact next steps.

**Sweep-not-enabled-in-production finding:**
- Reported for a human decision; deliberately not acted on (production Railway config change is outside this session's authority per the repo's own rules).

## Why this is on the same PR (#641) as the PR-2 contributor-UX slice

This session's harness constrains work to a single designated branch (`claude/semse-field-knowledge-impl-f3eeyz`) and forbids pushing to a different one without explicit permission. The master prompt's "small, vertical, reviewable PRs" guidance would otherwise put this LiveKit webhook fix on its own PR, separate from the PR-2 contributor-UX changes — they are unrelated domains. Flagging this explicitly so the reviewer can split the two commits into separate PRs at merge time if preferred; the two changes do not depend on each other and can be reviewed/merged independently.
