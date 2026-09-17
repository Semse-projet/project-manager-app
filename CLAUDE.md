# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Two-level layout — work in `project-manager-app/`, not here

This checkout (`Semse-projet/project-manager-app`) has an unusual shape: the root you're in now is a **superseded staging area**, and the actively developed monorepo lives one directory down, in [`project-manager-app/`](project-manager-app/). `ROADMAP.md` and `SEMSE_CONTEXT.md` at this root are one-paragraph stubs that say "supersedido desde 2026-07-16" and redirect to the same-named files under `project-manager-app/`. `README.md` at this root is not a stub — it's still-valid guidance on canonicity, source-of-truth precedence, the nine domains, and contribution rules (no mass renames, no secrets, ask before destructive git ops); read it too.

Everything that matters — source, tests, `package.json`, CI config, specs — lives under `project-manager-app/`. `cd` there before running any command below. Root-level content outside it (`SEMSE Pro Tools v2/`, `prompts/`, `reportes-semanales/`, `utils/`, the various dated `*_REPORT.md`/`*_CHECKPOINT.md` files) is historical prototypes and session logs kept as reference input — don't build features there and don't treat it as authorized architecture.

The canonical monorepo's own agent contract is imported below, so it loads automatically in this session:

@project-manager-app/AGENTS.md

@project-manager-app/CLAUDE.md

## Monorepo map (`project-manager-app/`)

pnpm workspace, Node >=22, `pnpm@10.33.0`.

```
apps/
  api/              NestJS + Fastify + Prisma — domain API
  web/              Next.js — canonical frontend (BFF pattern, see imported CLAUDE.md)
  worker/           BullMQ background jobs
  vision-service/   visual/image analysis service
  autonomy-server/  standalone autonomy runtime
  mobile/           Expo/React Native offline client
  angular/, assistant-portal/   secondary/transitional surfaces, not canonical
packages/
  db/               Prisma schema — source of truth for the data model
  schemas/          Zod contracts — source of truth for API/domain types
  agents/, autonomy/, knowledge/, auth/, product-events/, sdk/, shared/, tools/, ui/
docs/
  SPEC_INDEX.md, SOURCE_OF_TRUTH.md, architecture/, foundation/, specs/, runbooks/, reportes/
.specify/           Spec Kit governance — constitution.md + SEMSE spec/plan/tasks/checklist templates
```

Nine bounded-context domains own `apps/api/src/modules/`: SEMSE Core, Connect, Payments, Trust, AI, Agro, BuildOps, Knowledge, Integrations.

## Commands

Run from `project-manager-app/` (CI's working directory is also `project-manager-app/`):

```bash
docker compose -f infra/docker/compose.semse-mvp.yml up -d   # Postgres :5433, Redis :6379, MinIO :9000/:9001, MailHog :8025
pnpm install --frozen-lockfile
pnpm db:generate                     # generate Prisma client — needed before most dev/build tasks
pnpm db:migrate                      # apply already-versioned migrations to your local DB

pnpm dev:api                         # NestJS API, watch mode
pnpm dev:web                         # Next.js web
pnpm dev:worker                      # BullMQ worker
pnpm dev:api:local-llm               # API wired to local Ollama (qwen2.5:3b) instead of a hosted LLM

pnpm build:api / build:web / build:packages
pnpm lint                            # api + web eslint
pnpm typecheck                       # workspace-wide tsc

pnpm test:unit                       # root tests/unit/*.test.{mjs,ts} via node --test, no DB required
pnpm --filter @semse/api test:unit   # API unit tests — also node --test under the hood (scripts/run-tests.mjs), not jest despite the package's separate `test` (jest) script
pnpm --filter @semse/api test:integration
pnpm test:e2e                        # full Playwright suite
pnpm test:e2e:semse:health           # single-spec Playwright example — swap the spec path/name to target another

pnpm verify:workspace                # full local pre-PR gate: modules, prisma usage, toolchain, dockerfiles, railway preflight, api unit tests
pnpm check                           # test:unit + prisma generate + build:api + build:web
```

Single root unit test file: `pnpm build:packages && node --experimental-strip-types --test tests/unit/<file>.test.ts`.

Single API unit test file (many import from `apps/api/dist/`, so build first): `pnpm build:packages && pnpm --filter @semse/api build && node --experimental-strip-types --test apps/api/test/<file>.test.ts`.

New Prisma model: edit `packages/db/prisma/schema.prisma` → `pnpm --filter @semse/db prisma migrate dev --name <name>` → `pnpm db:generate` → add types in `packages/schemas/src/`.

## Reference docs (in `project-manager-app/`)

- `docs/SOURCE_OF_TRUTH.md` — precedence when specs, code, production, and docs disagree; ownership table per layer.
- `docs/SPEC_INDEX.md` — status of every domain spec; check before implementing a feature.
- `docs/architecture/CURRENT_ARCHITECTURE.md` / `IMPLEMENTATION_STATUS_MATRIX.md` — current-state architecture and what's actually live vs. planned.
- `.specify/memory/constitution.md` — governing principles, required reading before feature work per `AGENTS.md`.

## Project-local skills

`project-manager-app/.claude/skills/` has repo-specific skills worth checking before diving in. Two are gating/governance skills, read first when applicable:

- `semseproject` — the master governance skill (normative precedence hierarchy, identity/policy/approval/audit contracts, risk matrix, agent operating modes) that gates any mutating, financial, or cross-tenant agent action; read its `SKILL.md` before any of the others when the task involves agentic mutation.
- `semse-audit-remediation` — RBAC/JobStatus/evidence-upload fixes tied to `docs/AUDIT_REMEDIATION_PLAN.md`; owns the SDD governance gate for that specific backlog.

A third skill sits alongside these two as an execution-discipline layer rather than a governance one — it's subordinate to both where they'd conflict:

- `aaa-zoom-loop-execution` — end-to-end completion discipline (don't stop at "it exists", trace the full chain, verify before advancing) for large or ambiguous multi-step work. Domain-agnostic method adapted from an uploaded pack; its own "don't ask for routine decisions" autonomy rule never overrides `semseproject`'s Approval Gate or `semse-audit-remediation`'s money/auth sign-off requirement — see its SKILL.md's "SEMSE overrides" section.

Task/module-specific skills (each documents a real, already-verified gap or gotcha — not aspirational design — and ends with a "notas para futuros agentes" section flagging what it doesn't cover):

- `semse-design-tokens` — keeping `packages/design-tokens/src/colors.ts`, `apps/web/app/globals.css` (4 blocks), and `apps/mobile/src/theme` in sync; the `--brand-dark`/`--ok-dark` "bright second stop" pattern; the safe-fix heuristic for `#hex`→`var(--token)` sweeps, including the hex-alpha-suffix trap.
- `semse-rbac-permissions` — the real role→permission map in `packages/auth/src/rbac.ts`, `@RequirePermissions`, the dev header-auth shortcut, and the RC3 "missing permission" bug shape.
- `semse-prisma-workflow` — the 4-step migration order and the `_prisma_migrations`/`P3018` reconciliation trap.
- `semse-bff-pattern` — the web BFF route shape (`apps/web/app/api/semse/**/route.ts` + `_server.ts`) and the fact that client-side API functions live in **4** files, not just `semse-api.ts`.
- `semse-domain-events` — `EVENT_CATALOG.md` discipline and the fact that the outbox pattern is not applied uniformly across bounded contexts.
- `semse-spec-kit-flow` — how to actually run the SDD flow `AGENTS.md` requires for new (non-backlog) features: templates, SEMSE-specific frontmatter, validation scripts.
- `semse-labor-engine-boundary` — the real field-ops (legacy) vs. Labor Engine (current) split across 3 overlapping API controllers, so you don't invest in or "fix" code destined for removal.
- `semse-mobile-offline-sync` — corrects the `CLAUDE.md` implication of one shared offline pattern: mobile's `localTimer.ts` is separate from web's `trackerLocalStore.ts`.
- `semse-report-writer` — where/how to write the end-of-session report `AGENTS.md` requires, and the naming inconsistency already present in `docs/reportes/`.
- `semse-security-baseline` — quick-reference for the RC4-RC6 root-cause bug shapes (IDOR, unverified payment status, auth weaknesses) already confirmed in this codebase.
- `semse-ci-pr-workflow` — what `quality-gates`/`unit-coverage`/`e2e` actually check, the fact that CI workflow files live at the outer repo root not under `project-manager-app/`, the squash-merge branch-reset gotcha, and the `spec:preflight` naming trap (it runs Railway preflight, not spec validation).
- `semse-upload-flow` — the canonical 3-step presigned-URL upload contract (plan → PUT to a BFF proxy → register) that fixed RC2, and the still-unsolved `external_transfer`/large-file gap.

A scoped `semse-ecosystem-architect` also exists for product/design work, and `semse-local-observability-testing`/`testing-worker-tracker` cover local-stack and tracker-UI testing respectively.
