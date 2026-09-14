# ADR-030 — Independent service provenance: real git SHA in health endpoints

- **Date:** 2026-09-14
- **Status:** Accepted
- **Owners:** SEMSE Execution Program, Phase 0 (D08)
- **Affected domains:** API, Web, Worker health/status surfaces; Railway deployment configuration

## Context

As of 2026-08-31, `docs/reportes/2026-09-11_f01_procedencia_release_api_web_worker.md` documented that the active Railway deployments of semse-API, semse-web and semse-worker had **zero Git-commit backing** — they were pushed via `railway up`/an agent CLI skill, and the commit messages Railway recorded for them do not exist anywhere in `git log --all`. Only semse-vision was deployed from a real GitHub-triggered build. Separately, `apps/api/src/modules/health/health.controller.ts` hardcodes a static `build: "2026-05-18a"` string that has never reflected the real deployed commit.

This is a direct violation of `01_CURRENT_BASELINE_AND_NON_NEGOTIABLES.md` §1.7 ("Reliability law" — production truth must distinguish code-exists / deployed / verified) and blocks Phase 0's exit gate ("migration/deploy path verified").

## Existing implementations found

- `apps/api/src/modules/health/{health.controller.ts, health.service.ts}` — hardcoded build string, no real provenance.
- No equivalent found for Web/Worker at Phase-0 inspection depth; not confirmed whether they expose any status endpoint at all.
- Railway's own deployment metadata (`meta.commitHash`, `meta.branch`) is genuinely populated by Railway itself for GitHub-triggered deploys (confirmed for semse-vision in the F01 report) — the gap is purely that the *application* never surfaces this to a caller, not that Railway lacks the data for Git-triggered deploys.

## Options considered

### Option A — Custom build-time step that writes a generated file
Generate a `build-info.json` (or similar) during CI/build with the commit SHA baked in, then have the health endpoint read that file. Works even for non-Railway hosting, but adds a build-step dependency and another thing that can silently go stale if the build step is skipped.

### Option B — Read `RAILWAY_GIT_COMMIT_SHA` at runtime (chosen)
Railway automatically injects `RAILWAY_GIT_COMMIT_SHA` (and related `RAILWAY_GIT_*` variables) as environment variables for GitHub-connected services at deploy time. Reading it at runtime requires no build-step change, and it is automatically `undefined`/absent for any deploy that is *not* Git-triggered — which is exactly the signal Phase 0 needs (an un-backed deploy should show `"unknown"`, not fabricate a value).

### Option C — Do nothing, keep manual provenance audits (status quo)
Rejected: the 2026-09-11 F01 audit already proved manual, point-in-time audits are insufficient — provenance must be a standing, always-queryable property of the running service.

## Decision

`CREATE` (the mechanism doesn't exist; the endpoint does).

Read Railway's `RAILWAY_GIT_COMMIT_SHA` environment variable at runtime and expose it as `gitSha` in the health response, alongside a `buildTime` and the existing `service`/`status` fields. When the variable is absent (local dev, or — critically — any future non-Git-triggered deploy), return the literal string `"unknown"` rather than fabricating or falling back to a hardcoded value. This makes an un-backed deploy immediately visible in the health response itself, closing the exact gap the F01 report found by manual audit.

Implemented for semse-API in this same batch (see code change). Web/Worker equivalents are noted as a follow-up rather than implemented here, per explicit scope instruction to keep this batch small — see "Deferred" below.

## Why

- Zero build-step changes required; uses data Railway already provides for real GitHub-triggered deploys.
- Fails safe: an un-backed deploy (the exact failure mode the F01 report found) now shows `"unknown"` in production, visible to anyone who checks `/v1/health`, instead of requiring another manual `railway deployment list` archaeology session.
- Minimal, reviewable, low-risk change — appropriate for a Phase-0 exit-gate item, not a Phase-1+ feature.

## Invariants

- The health endpoint must never report a fabricated or cached-from-elsewhere SHA when the real one is unavailable — `"unknown"` is the only acceptable fallback value.
- Adding this field must not change the existing `status`/`service`/`persistence`/`authMode` fields' meaning or presence (backward compatible).

## Migration plan

1. Add `gitSha` (from `process.env.RAILWAY_GIT_COMMIT_SHA ?? "unknown"`) and `buildTime` (from `RAILWAY_DEPLOYMENT_CREATED_AT` if available, else `"unknown"`) to `health.controller.ts`'s response for semse-API.
2. Remove the hardcoded `"2026-05-18a"` string entirely — it must not remain as a secondary field.
3. Add a test asserting the fallback returns `"unknown"` when the env var is absent, and that a set env var is read through correctly.
4. **Deferred (not in this batch):** apply the same pattern to Web and Worker health/status endpoints, if/when they exist and the change proves similarly trivial. Not confirmed as trivial during Phase 0 — needs its own look before committing to a specific implementation.

## Compatibility

- **API:** additive fields only (`gitSha`, `buildTime`); no existing field removed except the meaningless hardcoded `build` string, which no known caller should depend on for anything real given it was already wrong.
- **Mobile:** no impact expected; verify no mobile client parses the old `build` field specifically before removing it (not confirmed during Phase 0 — flagged for the implementer to double check at merge time).
- **Events:** none.
- **Database:** none.
- **Workflows:** none.

## Risks

- If any caller does key off the literal old `build` field value, removing it is a breaking (if minor) change — mitigated by this being a health/diagnostic endpoint, not a business-logic contract.
- `RAILWAY_GIT_COMMIT_SHA` is Railway-specific; if SEMSE ever migrates hosting providers, this needs a provider-agnostic equivalent — acceptable for now given the current single-provider reality.

## Verification

- Unit test for the fallback-to-`"unknown"` behavior and for correctly surfacing a set env var.
- `pnpm --filter @semse/api build` green.
- Manual verification: after the next Railway deploy of semse-API, `GET /v1/health` should show a real 40-character commit SHA matching the deployed commit, not `"unknown"` and not the old hardcoded string.

## Rollback

Revert the health-controller change; this is a pure read-only diagnostic addition with no state/schema/migration to unwind.
