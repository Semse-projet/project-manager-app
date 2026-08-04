# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Two-level layout — work in `project-manager-app/`, not here

This checkout (`Semse-projet/project-manager-app`) has an unusual shape: the root you're in now is a **superseded staging area**, and the actively developed monorepo lives one directory down, in [`project-manager-app/`](project-manager-app/). Its own `README.md`, `ROADMAP.md`, and `SEMSE_CONTEXT.md` at this root are one-paragraph stubs that all say "supersedido desde 2026-07-16" and redirect to the same-named files under `project-manager-app/`.

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
pnpm install --frozen-lockfile
pnpm db:generate                     # generate Prisma client — needed before most dev/build tasks

pnpm dev:api                         # NestJS API, watch mode
pnpm dev:web                         # Next.js web
pnpm dev:worker                      # BullMQ worker
pnpm dev:api:local-llm               # API wired to local Ollama (qwen2.5:3b) instead of a hosted LLM

pnpm build:api / build:web / build:packages
pnpm lint                            # api + web eslint
pnpm typecheck                       # workspace-wide tsc

pnpm test:unit                       # root tests/unit/*.test.{mjs,ts} via node --test, no DB required
pnpm --filter @semse/api test:unit   # API unit tests (jest via scripts/run-tests.mjs)
pnpm --filter @semse/api test:integration
pnpm test:e2e                        # full Playwright suite
pnpm test:e2e:semse:health           # single-spec Playwright example — swap the spec path/name to target another

pnpm verify:workspace                # full local pre-PR gate: modules, prisma usage, toolchain, dockerfiles, railway preflight, api unit tests
pnpm check                           # test:unit + prisma generate + build:api + build:web
```

Single root unit test file: `pnpm build:packages && node --experimental-strip-types --test tests/unit/<file>.test.ts`.

New Prisma model: edit `packages/db/prisma/schema.prisma` → `pnpm --filter @semse/db prisma migrate dev --name <name>` → `pnpm db:generate` → add types in `packages/schemas/src/`.

## Reference docs (in `project-manager-app/`)

- `docs/SOURCE_OF_TRUTH.md` — precedence when specs, code, production, and docs disagree; ownership table per layer.
- `docs/SPEC_INDEX.md` — status of every domain spec; check before implementing a feature.
- `docs/architecture/CURRENT_ARCHITECTURE.md` / `IMPLEMENTATION_STATUS_MATRIX.md` — current-state architecture and what's actually live vs. planned.
- `.specify/memory/constitution.md` — governing principles, required reading before feature work per `AGENTS.md`.

## Project-local skills

`project-manager-app/.claude/skills/` has repo-specific skills worth checking before diving in: `semse-audit-remediation` (RBAC/JobStatus/evidence-upload fixes tied to the audit remediation plan), `semse-local-observability-testing` (running the full local stack — Postgres, Redis, API, worker, autonomy-server — with structured logging), `testing-worker-tracker` (exercising `/worker/tracker` in a browser), and a scoped `semse-ecosystem-architect` for product/design work.
