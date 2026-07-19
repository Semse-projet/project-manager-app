# Reporte — Prometeo Memory: persistencia (A)

**Fecha:** 2026-07-18
**Rama:** `devin/1784471884-prometeo-memory-persistence`
**Alcance:** Follow-up A del set aprobado (Orchestrator/Copilot/Workspace). Da
persistencia al estado de sesión que hasta ahora vivía en `Map` process-local.

## Qué se implementó

Tres modelos Prisma nuevos (migración **aditiva**, solo `CREATE TABLE`/índices):

- `prometeo_workspace_state` — estado del shell de tres paneles por
  `(tenantId, userId)` (unique compuesto).
- `prometeo_copilot_session` — sesiones del Copilot, `id = sessionId`.
- `prometeo_orchestration` — registros de orquestación, `id = orchestrationId`.

Migración: `packages/db/prisma/migrations/20260719030000_prometeo_memory/`.

### Capa de repositorio (por dominio)

Cada dominio expone una interfaz de repositorio + token de inyección, con dos
implementaciones:

- `Prisma…Repository` — persiste en PostgreSQL vía `PrismaService`.
- `InMemory…Repository` — usada en tests unitarios **y** como *fallback*.

**Degradación controlada:** si una operación Prisma falla (DB ausente/no
conectada), el repositorio Prisma cae a un store en memoria y registra un
`warn` una sola vez. Esto conserva el arranque local y los golden paths sin DB,
manteniendo el mismo comportamiento no bloqueante que ya tiene `PrismaService`.

### Servicios

`WorkspaceService`, `PrometeoCopilotService` y `OrchestrationService` pasan a
async y leen/escriben a través de sus repositorios (DI por token). Controllers
actualizados a `await`. Se conservan sin cambios: contratos, endpoints, RBAC,
FSMs, ruteo determinista de agentes, lógica de aprobación y aislamiento por
tenant. `interpret`/`consultAgent`/`detectContext`/`executeAction` siguen siendo
síncronos (no persisten).

## Gates

- `pnpm build:packages` + `pnpm build:api` — OK
- `pnpm --filter @semse/api test:unit` — 1890/1890 OK (tests de servicio
  reescritos a async + nuevos tests de persistencia repo↔servicio)
- `pnpm typecheck` — OK
- `pnpm lint` — 0 errores (54 warnings preexistentes, no relacionados)

## Fuera de alcance (siguiente)

- **C** — IDs UUID estrictos en los contratos Zod.
- **B** — registrar eventos canónicos en `EVENT_CATALOG.md` y emitirlos vía
  `DomainEventsService`. No se inventaron eventos en este PR.
