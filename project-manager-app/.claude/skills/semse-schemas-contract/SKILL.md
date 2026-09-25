---
name: semse-schemas-contract
description: packages/schemas is the source of truth for API/domain types "in name only" — nothing enforces that a page actually imports from it, and nothing checks it stays in sync with packages/db/prisma/schema.prisma. Use before adding a new page/screen that consumes a job/bid/dispute/etc record, before trusting a local `type`/`interface` you find in a web page as authoritative, or when debugging a status/casing mismatch between API and UI.
---

# SEMSE `packages/schemas` contract — real drift risk

## The package itself: flat, hand-written Zod, no codegen

`packages/schemas/src/` is flat — ~60 files, one per entity/bounded-context (`job.schema.ts`, `payment.schema.ts`, `dispute.schema.ts`, `travel.schema.ts`, `trust.schema.ts`, plus `anatomy-*`/`repo-*`/`runtime-*` triads for the knowledge graph), all re-exported through one barrel `packages/schemas/src/index.ts`. There is **no codegen** anywhere (`ts-to-zod`, `zod-prisma`, `openapi-generator`, `json-schema-to-zod` — none of these appear in any `package.json`). Every schema is hand-written and hand-kept-in-sync with `packages/db/prisma/schema.prisma` by whoever edits it.

Not everything in this "Zod contracts" package is actually Zod: `client.types.ts` and `escrow-view.types.ts` are plain TS interfaces (UI-facing / API-response-aligned types respectively) with no runtime validation — don't assume `import { X } from "@semse/schemas"` always means "this is validated at a boundary."

`apps/api`, `apps/web`, and `apps/mobile` all depend on it as `"@semse/schemas": "workspace:*"` and import directly (96/107/50 files respectively) — no generation step, no build-time check that a consumer's usage matches the current shape beyond normal `tsc`.

## The real gap: nothing stops a hand-rolled duplicate type

`packages/schemas/src/job.schema.ts:115-125` documents a real, already-fixed casing bug:

```ts
/**
 * The Prisma `JobStatus` enum is uppercase and NestJS's `toVisibleJob` mapper
 * returns it uppercase too — but `jobRecordStatusSchema` (and every frontend
 * consumer of `JobRecordView`) has always expected lowercase. Apply this at
 * every BFF boundary that forwards a job record from the API to the browser...
 */
export function normalizeJobRecordStatus<T extends { status?: unknown }>(record: T): T { ... }
```

The BFF route that's supposed to apply it does (`apps/web/app/api/semse/jobs/route.ts`). But **not every page actually imports `JobRecordView`/`JobRecordStatus` from `@semse/schemas` at all** — some define their own parallel type instead, silently outside the fix's protection:

- `apps/web/app/(app)/admin/jobs/page.tsx:11-30` — hand-rolled `type JobStatus = "draft"|"posted"|"published"|...` and `interface Job {...}`, no import from `@semse/schemas`. `STATUS_META: Record<JobStatus, {...}>` (line 32) depends on this local union staying exhaustive by hand.
- `apps/web/app/(app)/worker/opportunities/page.tsx:9-21` — same pattern, but worse: `type Job = { ..., status: string, ... }` — `status` is a bare `string`, zero compile-time protection at all.

Both compile fine today because the shapes happen to line up. If `packages/schemas` changes the status enum or a field, **neither page will get a type error** — just a silent runtime mismatch (a missing `STATUS_META` entry, a status string the UI doesn't recognize). This is the same bug *class* `semse-audit-remediation` tracks under "JobStatus casing," but the mechanism — a page-level type that was never wired to the schema in the first place, not a casing bug in an already-shared type — isn't covered by that skill or by `semse-bff-pattern` (which documents routing, not where a page's types should come from).

**Before writing a new page/screen that touches a job/bid/dispute/etc record: import the `*View`/`*Input` type from `@semse/schemas` instead of hand-rolling one**, even if it's "just a display page." If you're touching an existing page and notice a local type that duplicates a `@semse/schemas` shape, that's a real (if low-urgency) finding worth flagging or fixing — not a false positive.

## No automated check catches Prisma ↔ schemas drift either

`scripts/verify-prisma-runtime-contract.mjs` (run via `verify:prisma-contract:db` in CI, see `semse-ci-pr-workflow`) is a real 3-level drift detector, but its own docstring scopes it to code-accessor ↔ `schema.prisma` ↔ migrations ↔ DB — it never mentions `packages/schemas` (confirmed: grep for "schemas" inside that script returns nothing). `scripts/validate-workspace.mjs` only checks that `packages/schemas` *builds*, not that it's semantically in sync with the Prisma schema. So `semse-prisma-workflow`'s step 4 ("Add new types to `packages/schemas/src/`") is enforced by nothing but discipline — skipping it produces no test failure, no CI failure, nothing, until a consumer breaks at runtime.

## Mobile-specific gotcha: Jest maps to compiled `dist/`, not `src/`

`apps/mobile/jest.config.js:9-12` maps `@semse/schemas` (and `@semse/design-tokens`) to `<rootDir>/../../packages/schemas/dist/index.js` — the **compiled** output, not the TypeScript source. If you edit `packages/schemas/src/*.ts` and run mobile tests without rebuilding the package first (`pnpm --filter @semse/schemas build`, or the workspace-wide `pnpm build:packages`), mobile tests will silently exercise the **stale** pre-edit shape. A passing mobile test suite after a schema edit does not by itself mean the mobile app sees your change.

Also worth knowing, not a bug: `apps/mobile/src/api/labor.ts:1-22` re-exports `@semse/schemas` types under older local aliases (`export type JobSite = JobSiteView`, etc.) — a deliberate back-compat shim from when mobile screens were migrated onto the shared schemas without renaming call sites. Don't "clean up" this indirection without checking every screen still using the old alias name first.

## Notas para futuros agentes / hallazgos abiertos

- No se auditaron los 96+107+50 call sites uno por uno — solo se confirmaron `admin/jobs/page.tsx` y `worker/opportunities/page.tsx` como ejemplos concretos de tipo duplicado. Es razonable esperar más páginas con el mismo patrón; si tocás una y ves un `type`/`interface` local que se parece a algo en `packages/schemas`, tratalo como sospechoso por defecto, no como excepción.
- No se investigó si existe un lint rule custom (ESLint) que podría, en teoría, prohibir tipos locales que dupliquen un export de `@semse/schemas` — de la evidencia reunida no parece existir, pero no se revisó la config completa de ESLint en detalle.
- El grep por TODO/FIXME/`@deprecated` en los 60 archivos de `packages/schemas/src/` no encontró nada — el paquete en sí está limpio; el riesgo real está enteramente en el lado de los consumidores, no en el schema package.
- No se confirmó si `apps/angular/` o `apps/assistant-portal/` (superficies secundarias/transicionales) también importan `@semse/schemas` — la investigación se limitó a api/web/mobile, que son las tres superficies canónicas.
