# PR-4 — Local Recording / Offline Sync — ZOOM + LOOP report

**Date:** 2026-09-17
**Branch:** `claude/semse-field-knowledge-impl-f3eeyz`
**Rule applied:** existence is not completeness — every layer traced end to end, not stopped at the first matching file.

## 1. Repository truth

`git fetch origin main` showed main had advanced by one merge (`d79451e`/`6e005fa`, "Install aaa-zoom-loop-execution skill, adapted for SEMSE governance") since the PR-3 work; this session's designated branch had itself been squash-merged (PR #641, only the PR-2 slice — the LiveKit webhook fix from the same branch was **not** included in that squash, confirmed by diffing the merge commit). Per this repo's own newly-installed `aaa-zoom-loop-execution` skill (§SEMSE overrides #3: "this repo squash-merges PRs, a feature branch's tip is never an ancestor of main after merge"), the branch was rebuilt from `origin/main` and the two genuinely unmerged commits were cherry-picked back on, then force-pushed. `pnpm install --frozen-lockfile` and `pnpm db:generate` were re-run as that skill's repository-truth step requires. `docs/SPEC_INDEX.md` has no entry for the Contributor/Field-Knowledge domain — this program is still built via the ad-hoc report-documented path established by the F1 slice (#627), not the full `specify → plan → tasks` flow; consistent with PR-2/PR-3, this session continued that precedent rather than blocking on it.

## 2. ZOOM: what "Local Recording / Offline Sync" actually means for this program, traced end to end

The master report names four sub-gaps: native mobile media, robust local recording, **resumable upload**, and durable local/offline queueing. Tracing each:

| Piece | Classification | Evidence |
|---|---|---|
| Mobile UI for contributor submissions | **ABSENT** | `find apps/mobile -iname "*contributor*"` → nothing. The entire Contributor Program (missions, submissions, clip upload) exists only as a Next.js **web** flow. Mobile has an unrelated `EvidenceCapture.tsx` (Worker/Client evidence, photos only, `mediaTypes: ["images"]` — no video, no audio, no durable queue: a failed upload just flips a local React state flag to `"error"`, nothing persists past that screen unmounting) |
| Durable local outbox / offline queue | **ABSENT** (mobile), **N/A** (web) | Confirmed against the newly-installed `semse-mobile-offline-sync` skill: "no queue-and-replay sync mechanism visible in `apps/mobile/src/timer`... would need to be designed, not just found." The web contributor submission page has no offline story at all — it's a page requiring a live connection to even load, with a plain `<input type="file">` requiring the clip to already be recorded and saved externally |
| Resumable/chunked upload | **BROKEN** (found), **now fixed** — see §3 | The schema (`multipartUploadSessionCreateSchema`/`multipartUploadSessionCompleteSchema`) and three real API routes (`POST /v1/uploads/multipart-session`, `PUT .../parts/:partNumber`, `POST .../complete`) all existed and looked complete — endpoint URLs, chunk-size recommendations, a persisted JSON manifest, per-part etags. Tracing what the part-upload handler actually *did* with the request body revealed it never read it at all |
| Web client wiring to the above | **ABSENT** (found) — now wired, see §4 | `ClipUploader` (contributor submission page) only ever called the single-PUT path and threw "file too large (~25MB limit)" for anything bigger, never attempting the multipart session that already existed server-side |

## 3. Bug found and fixed: multipart upload never persisted or reassembled any bytes

Tracing `uploadMultipartPart`/`completeMultipartSession` in `apps/api/src/infrastructure/storage/evidence.controller.ts`, deeper than "the endpoint exists and returns 200":

- `uploadMultipartPart` read `x-part-size`/`content-length` **headers** for bookkeeping and fabricated a timestamp-based etag (`etag-${sessionId}-${partNumber}-${Date.now()}`) — it never touched `@Req().raw` (the actual byte stream) at all. Every uploaded chunk was silently discarded.
- `completeMultipartSession` only updated the JSON manifest's bookkeeping from client-supplied etags — it never assembled anything at the declared storage `key`. A client could "complete" a session and get `{status: "completed"}` with **no file ever existing** at that key.
- This is worse than "absent": it's a false-success surface that would let a contributor believe a large video clip uploaded successfully, register it as a submission asset, and only discover the corruption later (or never, if nobody opens the asset) — the exact "silent state promotion" this program's own truthful-state-model rule forbids (`local save ≠ uploaded`, `request sent ≠ completed`).
- This entire mechanism was added in the same commit as the Contributor Program F1 slice (`6ac6718`) — not a regression of previously-working code, so no historical fix was at risk of being reverted; `git log`/`git blame` confirmed a single origin commit with no follow-up fixes.

**Fix** (`uploads.controller.ts`, `evidence.controller.ts`):
- Exported the single-PUT path's existing, already-hardened validation primitives (`ALLOWED_CONTENT_TYPES`, `assertMagicBytes`, `validateUploadStream` — now parameterized with a caller-supplied byte ceiling) instead of duplicating them.
- `uploadMultipartPart` now actually pipes `req.raw` to a part file on disk (path-traversal-guarded the same way the existing session-manifest path already was) while streaming a real SHA-256 hash, and records the **actual** bytes written and that real hash as the etag.
- `completeMultipartSession` now: (a) rejects unless every part is both server-recorded as uploaded **and** the client's claimed etag matches the server's real one (closing a second gap — a client could previously "complete" with fabricated etags for parts it never sent), (b) reassembles the parts in strict order through the same magic-byte/content-type validation the single-PUT path uses, capped at the manifest's declared `fileSizeBytes`, (c) writes the result via the existing `StorageService` (no new storage mechanism), (d) verifies the assembled size exactly matches the declared size and deletes the file if it doesn't rather than leaving a truncated artifact, (e) cleans up the temporary part files.
- Added tenant isolation: neither handler previously checked the requester's tenant against the session — added `manifest.tenantId` (now recorded at session-create time) and a check that returns 404 (not 403, so a wrong-tenant caller can't confirm a session id exists) on mismatch.

**New tests** (`apps/api/test/multipart-upload.test.ts`, 5 tests, run against a real temp filesystem — not mocked): a ~10MB, 2-part upload reassembles **byte-for-byte identical** to the original in the correct order; a session missing a part is rejected and never produces a file at the key; a size-mismatched assembly is rejected and cleaned up; a different tenant cannot upload a part into or complete someone else's session (404); an empty part is rejected. All 5 pass for real, plus no regression in the pre-existing `evidence.spec-contract.test.ts` (35/35) or the full API suite (2245/2245, 1 unrelated skip).

## 4. Second instance of the same bug class, one layer up: the web BFF also dropped the bytes

Tracing the client path that would actually use the now-fixed server capability surfaced the identical bug shape again, twice:

- **BFF proxy** (`apps/web/app/api/semse/uploads/multipart-session/[sessionId]/parts/[partNumber]/route.ts`): forwarded the PUT to the API with a `x-part-size` header but never read or forwarded the request **body** — so even a correct client would have had its bytes dropped at this layer. Fixed to `await request.arrayBuffer()` and forward it, mirroring the one BFF route that already did this correctly (`.../uploads/files/[...key]/route.ts`, the single-PUT proxy).
- **Client SDK function** (`apps/web/app/semse-api.ts`'s `uploadMultipartPart`): didn't even have a parameter for the chunk's bytes — its signature was `{sessionId, partNumber, contentLength}`, a number, not a `Blob`. Widened to take `chunk: Blob` and send it as the request body; also added `"knowledge_contribution"` to `createMultipartUploadSession`'s domain type (it was missing despite the schema already supporting it) and widened `completeMultipartUploadSession`'s return type to the real API response shape.

**Existing callers of the broken signature, found and corrected:** two internal pages — `apps/web/app/(app)/admin/disputes/page.tsx` and `apps/web/app/jobs/[jobId]/evidence/page.tsx` — already called this API, but neither has a real file input (both let an admin/dev type in a filename and a size in MB to exercise the multipart flow manually) and both **fabricated** the etags passed to `completeMultipartUploadSession` (`etag-part-${n}`) rather than using what the server returned. Confirmed via tracing (no `type="file"` anywhere in either component) these are internal test/demo tools, not a real production data path for end users — so the original bug had not yet lost real user data, but would have the moment either page (or the contributor flow) handled a real file. Fixed both to synthesize a same-sized `Blob` (still no real file available in these tools) and to thread the *server's real returned etag* through to completion instead of a fabricated string — which also means these pages now correctly fail loudly if a part write ever fails, instead of always reporting fake success.

## 5. Closing the loop: contributor clip upload now actually resumable for large clips

`ClipUploader` in `apps/web/app/contributors/dashboard/submissions/[acceptanceId]/page.tsx` — the real, end-user-facing surface this program depends on — previously threw "file too large (~25MB)" for anything the single-PUT path couldn't take, even though the multipart path existed. Now: when `planUpload` recommends `external_transfer`, it creates a multipart session, slices the `File` per the server-declared part boundaries, uploads each part (with a simple percentage progress indicator), completes the session, and registers the resulting key as a submission asset — using only the (now-fixed) existing pipeline, no new upload mechanism.

## 6. What remains ABSENT (not glossed over)

- **Native mobile capture** — still requires a native LiveKit/camera SDK, device permissions, and a native dev-client build; same external blocker already documented in the PR-3 report (no native toolchain or hardware in this sandbox).
- **A mobile contributor UI at all** — doesn't exist yet; the resumable-upload fix in this session only reaches contributors on the web.
- **Durable local outbox for offline capture** — genuinely absent on both platforms for this program. Web fundamentally cannot provide reliable background-durable capture the way a native app can; mobile has no queue-and-replay mechanism anywhere yet (confirmed against `semse-mobile-offline-sync`). Building this is real, scoped, buildable work but was not started this session in favor of fixing the multipart data-loss bug first — a correctness bug silently discarding contributor data is a higher-priority fix than adding a new offline layer on top of a broken upload path.

## 7. Status (per capability)

**Multipart upload data-loss fix (API + BFF + client + 3 call sites):**
- CODED: yes. TESTED_LOCAL: yes, 5 new tests against real file I/O, no mocks. INTEGRATION_TESTED: yes (full API suite 2245/2245, existing evidence contract suite 35/35, no regressions). CI_GREEN: unknown — not run in this sandbox. REVIEWED/MERGED/DEPLOYED/ACTIVATED/VERIFIED_PRODUCTION: no. PHYSICAL_DEVICE_VERIFIED: not applicable (no native surface touched).

**Contributor large-clip resumable upload (web):**
- CODED: yes. TESTED_LOCAL: `pnpm build:web` clean, `pnpm typecheck` clean, `pnpm lint` 0 errors; no automated test exercises the browser-side chunking/orchestration logic itself (this repo has no component-level test harness for `apps/web` beyond Playwright e2e, which was not run in this sandbox) — declaring this explicitly rather than claiming coverage that doesn't exist. INTEGRATION_TESTED/CI_GREEN/REVIEWED/MERGED/DEPLOYED/ACTIVATED/VERIFIED_PRODUCTION: no. PHYSICAL_DEVICE_VERIFIED: not applicable.

**Native mobile capture / durable offline outbox:**
- Not started. Blocker: no native build toolchain, device, or existing mobile contributor UI in this sandbox (same class of blocker as PR-3's native media gap). Recommended order for a session with a device: build the mobile contributor UI first (there is none), then the durable AsyncStorage-backed outbox (following `localTimer.ts`'s versioned-key convention, not `trackerLocalStore.ts` which is web-only per `semse-mobile-offline-sync`), then wire it to the now-fixed multipart upload path from §3–§5.
