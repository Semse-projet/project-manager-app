---
type: tasks
feature: "Agent Memory Governance (C85)"
domain: "knowledge"
plan: "docs/specs/knowledge/agent-memory-governance.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "feat/c85-agent-memory"
date: "2026-09-26"
---

# Tareas: Agent Memory Governance (C85)

> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [x] [T-001] Spec escrito (retroactivo, ver justificación en el plan) — pendiente de `pnpm spec:index`
- [x] [T-002] SHA de `origin/main` registrado (`4513d817`), migraciones locales aplicadas y verificadas
- [x] [T-003] Plan completo (este documento + `.plan.md`)
- [x] [T-004] Investigación externa documentada como "no aplica" con justificación (spec §11)

## Fase 1 — Tests y contratos

- [x] [T-010] Tests existentes (27) corridos primero para confirmar baseline verde antes de tocar código
- [x] [T-011] Tipos de gobernanza declarados en TS (`agent-memory.repository.ts`, `packages/knowledge/src/workspace/model.ts`) — sin Zod nuevo, siguiendo el patrón existente
- [~] [T-012] Fixtures de concurrencia — NO hecho; `correct()` concurrente sobre el mismo original no está probado (riesgo documentado en el plan)
- [x] [T-013] Gap confirmado por lectura de código antes de escribir: ni `AgentMemory` ni `WorkspaceMemoryEntry` tenían ningún campo de gobernanza

## Fase 2 — Datos y dominio

- [x] [T-020] Migración `20260926130946_c85_agent_memory_governance` generada por `prisma migrate dev` (no escrita a mano)
- [x] [T-021] SQL revisado línea por línea — sólo `ADD COLUMN`/`CREATE INDEX`; compatibilidad hacia atrás confirmada (15 call sites existentes de `WorkspaceMemoryRecord` siguen compilando)
- [x] [T-022] `correct`/`invalidate`/`supersede`/`flagConflict`/`getLineage`/`findById` implementados en ambos repositorios, tenant-scoped
- [x] [T-023] Eventos/outbox — decisión explícita de NO agregar (spec §6); auditoría vía `AuditService` existente en su lugar
- [x] [T-024] 34/34 unitarios + 7/7 integración (Postgres real) verdes

## Fase 3 — API/BFF/UI

- [x] [T-030] 7 endpoints en `KnowledgeController` con `RequirePermissions("knowledge:read" | "knowledge:manage")`
- [~] [T-031] BFF (`apps/web/app/api/semse/...`) — NO hecho, no hay caller de web todavía
- [~] [T-032] UI — NO hecho, fuera de alcance explícito de este spec
- [ ] [T-033] `docs/architecture/SEMSE_API_SURFACE_V1.md` — NO actualizado todavía con los 7 endpoints nuevos
- [x] [T-034] 4/4 tests de controller verdes

## Fase 4 — Verificación local

- [x] [T-040] Tests dirigidos (unit + integration + controller) verdes
- [x] [T-041] Regresión: suite completa de `agent-memory.service.test.ts` y `knowledge.controller.test.ts` corrida, no sólo los tests nuevos
- [x] [T-042] Build de `@semse/api` y `build:packages` limpio; typecheck/lint dirigidos — pendiente de ejecutar como paso siguiente en esta misma sesión
- [ ] [T-043] `pnpm spec:validate:strict` — pendiente de correr como paso siguiente en esta misma sesión
- [ ] [T-044] `pnpm spec:coverage` / `pnpm spec:index` — pendiente
- [x] [T-045] Spec marcado `code_status: COMPLETE`, `status: IMPLEMENTED` (no `VERIFIED`)

## Fase 5 — PR, CI y merge

- [ ] [T-050] Revisar diff y secretos — pendiente antes de push
- [ ] [T-051] Abrir PR con migración, rollback y evidencia
- [ ] [T-052] Esperar CI terminal (GitHub Actions) y registrar `ci_status`
- [ ] [T-053] Resolver review
- [ ] [T-054] Fusionar y registrar SHA; actualizar `merge_status`

## Fase 6 — Deploy y activación

- [ ] [T-060] Verificar pre-deploy/migración contra Railway (hoy sólo local)
- [ ] [T-061] Esperar deployment terminal de `semse-API`
- [ ] [T-062] Verificar health/readiness y logs en Railway
- [ ] [T-063] Activar canary — no aplica todavía, sin flag definido (cambio no requiere uno: es aditivo y no cambia comportamiento default)
- [ ] [T-064] Smoke autenticado multi-tenant en producción (correct/invalidate/supersede/conflicts + verificación cross-tenant real)
- [ ] [T-065] Validar métricas/SLO — no aplica (sin métricas nuevas declaradas)
- [ ] [T-066] Promover a `ACTIVE` o revertir/pausar
- [ ] [T-067] Registrar `production_evidence`, `last_verified` y `status: VERIFIED`

## Criterio de Done

- [x] Código completo y tests verdes (local)
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Deploy `DEPLOYED`
- [ ] Activación `CANARY` o `ACTIVE`
- [x] Migración `APPLIED` (local) — no `VERIFIED` en producción todavía
- [ ] Evidencia de producción enlazada
- [ ] Índice/matriz/roadmap actualizados (`CANONICAL_STATE_REGISTRY.md` sí; `SPEC_INDEX.md`/`SEMSE_API_SURFACE_V1.md` pendientes)
