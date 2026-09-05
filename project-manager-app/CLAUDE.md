# SEMSEproject — CLAUDE.md

## Architecture principles

- **SEMSE Core governs** — auth, tenantId, permissions always come from core
- **Each module owns its domain** — no cross-module DB writes
- **Modules consume, not own** — jobs/workers/payments are consumed via services, not duplicated
- **Offline-first for field ops** — trackerLocalStore pattern for sync queues
- **AI via Ollama locally** — `dev:api:local-llm` script, model `qwen2.5:3b`

## Domain module notes

Non-obvious context for `apps/api/src/modules/` (the module list itself is in the tree):
- `field-ops/` — being replaced; new work goes to the Labor Engine
- `ai-models/` — Prometeo orchestrator, not a generic model wrapper

## Labor Engine

`field-ops/time-tracker` remains only as legacy API (jobs list still consumed) —
`/worker/tracker` and `/admin/labor-engine` run fully on the Labor Engine.

## Web BFF pattern

All web→API calls go through `/app/api/semse/[module]/route.ts` — never direct from client.
API functions live in `/app/semse-api.ts`.

## Prisma workflow

When adding new models:
1. Edit `packages/db/prisma/schema.prisma`
2. `pnpm --filter @semse/db prisma migrate dev --name <migration_name>`
3. `pnpm db:generate`
4. Add new types to `packages/schemas/src/`

## Railway deployment

4 services: semse-API, semse-web, semse-worker, semse-vision.
Deploys from `main` branch automatically.
