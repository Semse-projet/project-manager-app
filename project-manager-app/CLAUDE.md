# SEMSEproject — CLAUDE.md

## Monorepo structure

```
apps/
  api/          NestJS backend — @semse/api
  web/          Next.js frontend — @semse/web
  worker/       Background worker — @semse/worker
  vision-service/  FastAPI (Python) — computer vision
  autonomy-server/ Node agent server
packages/
  db/           Prisma schema + migrations — @semse/db
  schemas/      Shared Zod schemas + types — @semse/schemas
  ui/           Shared React components — @semse/ui
```

## Key commands

```bash
# Dev
pnpm dev:api              # API on :4132
pnpm dev:web              # Web on :3001
pnpm dev:api:local-llm    # API with Ollama (qwen2.5:3b)

# DB
pnpm db:generate          # Regenerate Prisma client
pnpm db:migrate           # Apply pending migrations
pnpm db:seed              # Seed development data

# Build & validate
pnpm build:packages       # Build shared packages first
pnpm check                # Full: unit tests + typecheck + build
pnpm typecheck            # TypeScript check all packages

# Tests
pnpm --filter @semse/api test:unit          # All API unit tests
pnpm --filter @semse/api test:unit -- --testPathPattern=labor  # Labor Engine only

# Smoke tests
pnpm smoke:tracker        # Time tracker E2E smoke
```

## Architecture principles

- **SEMSE Core governs** — auth, tenantId, permissions always come from core
- **Each module owns its domain** — no cross-module DB writes
- **Modules consume, not own** — jobs/workers/payments are consumed via services, not duplicated
- **Offline-first for field ops** — trackerLocalStore pattern for sync queues
- **AI via Ollama locally** — `dev:api:local-llm` script, model `qwen2.5:3b`

## Active domain modules (API)

Key modules in `apps/api/src/modules/`:
- `field-ops/` — current time tracker (TrackerSession, being replaced)
- `jobs/` — formal job lifecycle
- `evidence/` — file uploads + vision pipeline
- `payments/` + `escrow/` — Stripe integration
- `matching/` — SmartMatch algorithm
- `pricing/` — cotizaciones
- `ai-models/` — Prometeo orchestrator + Ollama provider
- `governance/` — quadratic voting, MCA
- `agro/` — agriculture vertical

## Labor Engine — COMPLETE (API + Worker UI + Admin UI)

**Done (2026-07):** domain module `labor-engine/` (controller/service/repository),
entities `TimeEntry`, `FreeProject`, `LaborSheet`, `TimeEvidence` (migration
`20260630000000_labor_engine_v1`), BFF routes `/app/api/semse/labor/*`, client
helpers in `/app/(app)/labor-api.ts`. Endpoints: free-projects CRUD + convert,
realtime timer (start/pause/resume/stop/notes), manual entries (with breaks),
weekly/monthly summaries, admin overview.

**Worker UI:** `/worker/tracker` runs fully on the Labor Engine — timer with
3 modes (job real / proyecto libre / solo calcular), offline-first via
`trackerLocalStore` (events sync to labor-api), 6 tabs (Timer, Resumen,
Registros, Proyectos, Reportes, Asistente/Cronos).

**Admin UI:** `/admin/labor-engine` — multi-worker active timers, team hours +
estimated cost (pricing baseline), QualityGuard alerts (stale timer >12h,
overtime >48h/week, single entries >12h), SmartMatch panel (matching module).

`field-ops/time-tracker` remains only as legacy API (jobs list still consumed).

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
See memory: `railway_credentials.md` for IDs.
