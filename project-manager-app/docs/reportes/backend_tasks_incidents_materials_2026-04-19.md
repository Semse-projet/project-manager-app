# Backend: Tasks, Incidents, Materials — 2026-04-19

## Qué se implementó

### Prisma schema
Tres modelos nuevos en `packages/db/prisma/schema.prisma`:
- `JobTask` — tareas por job/milestone, campos: priority, status, assignedTo, dueDate
- `JobIncident` — incidencias en campo, campos: type, severity, status, reportedBy
- `MaterialRequest` — solicitudes de material, campos: item, quantity, unit, estimatedCost, status

Back-relations agregadas al modelo `Tenant`.

### Migración SQL
`packages/db/prisma/migrations/20260419001000_tasks_incidents_materials/migration.sql`  
Incluye CREATE TABLE + índices + FK para los 3 modelos.

### NestJS modules (apps/api)
Cada módulo: service + controller + module file.

| Módulo | Ruta API | Permisos |
|--------|----------|----------|
| `tasks` | `GET /v1/tasks`, `POST /v1/tasks`, `GET /v1/tasks/by-job/:jobId`, `PATCH /v1/tasks/:id/status` | `jobs:read` / `jobs:create` / `jobs:update` |
| `incidents` | `GET /v1/incidents`, `POST /v1/incidents`, `GET /v1/incidents/by-job/:jobId`, `GET /v1/incidents/all` (ops), `POST /v1/incidents/:id/resolve` | `jobs:read` / `jobs:create` / `ops:read` / `ops:write` |
| `materials` | `GET /v1/materials`, `POST /v1/materials`, `GET /v1/materials/by-job/:jobId`, `GET /v1/materials/all` (ops), `POST /v1/materials/:id/approve` | idem |

Todos registrados en `AppModule`.

### Modo sin DB
Cada service tiene `if (!databaseEnabled()) return MOCK_*` — funciona en dev sin Postgres.

### BFF routes (apps/web)
- `apps/web/app/api/semse/tasks/route.ts` — GET, POST
- `apps/web/app/api/semse/incidents/route.ts` — GET, POST
- `apps/web/app/api/semse/materials/route.ts` — GET, POST

### UI conectada a API
- `worker/tasks/page.tsx` — fetch a `/api/semse/tasks`, fallback a mock si API no disponible
- `worker/incidents/page.tsx` — fetch a `/api/semse/incidents`, estado reactivo
- `worker/materials/page.tsx` — fetch a `/api/semse/materials`, estado reactivo

### TypeScript
`tsc --noEmit` en ambos proyectos: **0 errores**. Prisma client regenerado.

## Próximo paso
1. Ejecutar migración en DB: `prisma migrate deploy` (cuando API esté corriendo)
2. Conectar páginas admin (QA/Finance/Reports) a endpoints reales
3. Integrar autonomy server `semse/node` en monorepo
