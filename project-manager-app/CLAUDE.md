# SEMSEproject — CLAUDE.md

## Architecture principles

- **SEMSE Core governs** — auth, tenantId, permissions always come from core
- **Each module owns its domain** — no cross-module DB writes
- **Modules consume, not own** — jobs/workers/payments are consumed via services, not duplicated
- **Offline-first for field ops** — trackerLocalStore pattern for sync queues
- **AI via Ollama locally** — `dev:api:local-llm` script, model `qwen2.5:3b`

## Skill discovery (Claude y Codex)

Antes de actuar, leer AGENTS.md y el catálogo común docs/agents/SEMSE_SKILL_CATALOG.md. El catálogo describe 23 skills de Claude una vez incluida la habilidad de GitHub Cost Guard; **seleccionar por tarea** y leer sólo los SKILL.md pertinentes. No cargar toda la biblioteca en cada turno.

Para sugerir el enrutamiento sin otorgar permisos: pnpm skill:route -- "<tarea>" o pnpm skill:route:report desde esta carpeta. La skill semseproject y los gates de AGENTS.md tienen prioridad sobre las recomendaciones del router.

- Problemas de PR, jobs, squash o CI: .claude/skills/semse-ci-pr-workflow/SKILL.md.
- GitHub Billing, límites de Actions, Code Quality, startup_failure, optimización de costos y gastos: .claude/skills/semse-github-operations-cost-guard/SKILL.md **junto con** semse-ci-pr-workflow cuando aplique.
- Cualquier tarea financiera, mutante, de acceso o producción requiere aprobación conforme a la gobernanza; conocer una skill no permite pagos, modificaciones presupuestarias, cambios en CI/Railway o saltarse checks.

La raíz externa también tiene un descriptor para Codex en .agents/skills/semse-github-operations-cost-guard/SKILL.md, el cual remite al archivo canónico sin duplicarlo.

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
