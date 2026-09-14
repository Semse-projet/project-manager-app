# ADR-033 — Closing the D08 deferral: Web/Worker deploy provenance + canonical `@semse/shared` owner

- **Date:** 2026-09-14
- **Status:** Accepted
- **Owners:** SEMSE Execution Program, Phase 1 (D08 follow-up)
- **Affected domains:** Web health surface, Worker startup diagnostics, `@semse/shared`

## Context

ADR-030 implemented `gitSha`/`buildTime` provenance for semse-API's `/v1/health` and explicitly deferred the same for Web and Worker ("not confirmed as trivial during Phase 0 — needs its own look before committing to a specific implementation"). This ADR does that look and closes the deferral.

Findings from inspecting the current repository:

- **Web** already has a Railway-facing health endpoint: `apps/web/app/api/semse/healthz/route.ts`, wired as the actual healthcheck target in `infra/railway/web.railway.json` (`healthcheckPath: "/api/semse/healthz"`). It returned only `{ status, service }` — no provenance. Extending it is exactly as trivial as ADR-030 anticipated.
- A second, unreferenced route (`apps/web/app/api/sense/health/route.ts`, note `sense` not `semse`) returns the same shape and is not wired into any Railway config or runtime seed — left untouched; out of scope for this ADR and not a D08 concern.
- **Worker** (`apps/worker/`) has **no HTTP surface at all** — no `createServer`/Fastify/Express anywhere in `apps/worker/src`, and `infra/railway/worker.railway.json` has no `healthcheckPath`. There is nothing to extend a health *endpoint* on. It does have a structured JSON startup-diagnostic log line already (`main.mjs`, `label: "startup"`), which is the only existing "is this the code I think it is" surface for the worker today.
- The original `getDeployProvenance()`/`DeployProvenance` primitive lived under `apps/api/src/modules/health/`, private to the API app. Both Web and Worker already depend on `@semse/shared` (`workspace:*` in both `package.json`s), which is the correct existing canonical home for a primitive three apps need identically — per the program's "one source of truth per concept" / no-duplicate-primitive rule, this should not become three independent copies of the same five-line function.

## Decision

`EXTEND` the ADR-030 mechanism to Web and Worker; `REPLACE_DUPLICATE` — well, more precisely `CREATE`-canonical-then-migrate: move `getDeployProvenance()` into `@semse/shared` as the one owner, and have API/Web/Worker all read from it.

1. **Canonical owner:** `packages/shared/src/deploy-provenance.ts` now owns `DeployProvenance`/`getDeployProvenance()`, re-exported from `@semse/shared`'s barrel. The former `apps/api/src/modules/health/deploy-provenance.ts` is deleted; `health.controller.ts` imports from `@semse/shared` instead. No behavior change for API — same function, same fallback semantics, same test coverage (moved to `tests/unit/deploy-provenance.test.ts`, the existing project convention for `@semse/shared` unit coverage).
2. **Web:** `apps/web/app/api/semse/healthz/route.ts` now calls `getDeployProvenance()` and includes `gitSha`/`buildTime` in its response, alongside the existing `status`/`service` fields. This is the service's actual Railway healthcheck target, so provenance is now visible on the same endpoint Railway itself polls.
3. **Worker:** no HTTP surface exists and none is being added for this alone — creating one would be new infrastructure disproportionate to a diagnostic field, and the program's anti-goals explicitly warn against manufacturing surfaces the architecture doesn't otherwise need. Instead, `gitSha`/`buildTime` are added to the worker's existing structured startup log line, queryable via `railway logs` the same way the F01 report's own investigation method (`railway deployment list` cross-referenced with `git log`) worked — except now it doesn't require that manual step, since the worker states its own provenance at boot without being asked.

## Why

- Closes the exact gap ADR-030 named as deferred, using the same fallback contract (`"unknown"`, never fabricated) already established and tested there.
- Moving the primitive to `@semse/shared` before triplicating it avoids exactly the kind of duplicate-primitive drift `01_CURRENT_BASELINE_AND_NON_NEGOTIABLES.md` §1.5 prohibits — API, Web and Worker now share one implementation, so a future fallback-behavior change (e.g. reading a different env var) happens once.
- Worker gets provenance without inventing an HTTP server it has no other reason to run — respects the "no second workflow engine / no infrastructure the design doesn't need" anti-goal while still closing the observability gap.

## Invariants

- `"unknown"` remains the only acceptable fallback when `RAILWAY_GIT_COMMIT_SHA`/`RAILWAY_DEPLOYMENT_CREATED_AT` are absent — never fabricated, never silently defaulted to a stale cached value. Unchanged from ADR-030, now enforced identically across all three services since they share one implementation.
- Web's `/api/semse/healthz` response stays backward compatible: `status`/`service` unchanged, `gitSha`/`buildTime` additive only.
- Worker's startup log line stays backward compatible: existing fields unchanged, `gitSha`/`buildTime` additive only.

## Migration plan

1. `packages/shared/src/deploy-provenance.ts` + `.js` re-export shim (matching this package's existing convention of a checked-in `.js` sibling per `.ts` source module, needed for `node --experimental-strip-types --test` to resolve `.js`-specifier imports directly against source).
2. Re-export from `packages/shared/src/index.ts`.
3. `apps/api/src/modules/health/health.controller.ts` imports `getDeployProvenance` from `@semse/shared`; the old local file and its standalone dist-importing test are deleted.
4. `apps/web/app/api/semse/healthz/route.ts` calls `getDeployProvenance()` and returns `gitSha`/`buildTime`.
5. `apps/worker/src/main.mjs` calls `getDeployProvenance()` and logs `gitSha`/`buildTime` in the existing startup diagnostic.
6. Test coverage for the pure function moves to `tests/unit/deploy-provenance.test.ts` (same three cases ADR-030 established: absent → `"unknown"`, present → passthrough, empty-string → `"unknown"`).

## Compatibility

- **API:** no behavior change — same values, same endpoint, different import path.
- **Web:** additive fields only on `/api/semse/healthz`.
- **Worker:** additive fields only on the startup log line; no schema, no new port, no new health surface.
- **Events/Database:** none.

## Risks

- None beyond those already accepted in ADR-030 (Railway-specific env vars; acceptable given the single-provider reality).

## Verification

- `pnpm --filter @semse/shared build`, `pnpm --filter @semse/api build`, `pnpm --filter @semse/web build`, `pnpm --filter @semse/worker check` all clean.
- `pnpm typecheck` clean across api/web/worker/mobile.
- `pnpm test:unit` green (1048 pass / 0 fail at time of this batch).
- Manual verification pending next Railway deploy: `GET /api/semse/healthz` on semse-web should show a real commit SHA; `railway logs --service semse-worker` startup line should show the same for semse-worker.

## Rollback

Revert this batch's commit. Pure read-only diagnostic addition plus an internal import-path move; no state, schema, or migration to unwind.
