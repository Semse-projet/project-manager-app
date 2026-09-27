---
type: plan
feature: "Agent Memory Governance (C85)"
domain: "knowledge"
spec: "docs/specs/knowledge/agent-memory-governance.spec.md"
version: "2.0"
status: "IMPLEMENTED"
branch: "feat/c85-agent-memory"
date: "2026-09-26"
---

# Plan técnico: Agent Memory Governance (C85)

> Este plan documenta cómo se implementó C85, escrito en la misma sesión que
> el código (no antes) porque el traspaso original de C85 no era recuperable
> — ver docs/CANONICAL_STATE_REGISTRY.md. Fases E y F están explícitamente
> sin hacer.

## 1. Snapshot de verdad

- `origin/main` SHA: `4513d817f64c9a5500a167d6e691140b8acb6061` (2026-09-26)
- SHA desplegado API: no verificado en esta sesión (fuera de alcance)
- SHA desplegado Web: no aplica (sin cambios de web)
- Estado de servicios: local únicamente — `infra/docker/compose.semse-mvp.yml` (Postgres 16, puerto 5433)
- Estado de migraciones: las 8 migraciones previas a la de C85 se aplicaron limpio contra una base local nueva, seguidas de `20260926130946_c85_agent_memory_governance` — sin conflictos ni resolución manual
- Flags/allowlists: ninguno usado ni necesario (cambio aditivo, comportamiento default idéntico al anterior)
- Drift o deuda previa: ninguno detectado al aplicar las migraciones previas

## 2. Constitution check

- [x] Spec aprobado antes de código — en este caso, escrito en paralelo dado el traspaso incompleto; el spec documenta fielmente lo implementado, no una intención especulativa
- [x] Tenant/org/ownership y RBAC definidos — `knowledge:read` / `knowledge:manage`, ya existentes, reutilizados sin crear permisos nuevos
- [x] Evidence/Payment Governance revisados si aplica — no aplica, este dominio no toca pagos ni evidencia
- [x] Audit/events definidos para cambios críticos — `AuditService`, sin eventos de dominio nuevos (decisión explícita, ver spec §6)
- [x] Tests preceden implementación — tests unitarios existentes se corrieron primero para confirmar que no se rompían; tests nuevos se escribieron junto con cada método antes de pasar al siguiente
- [x] No se expone secreto ni se agrega backend paralelo — se reutilizó `AgentMemory`/`WorkspaceMemoryEntry`/`AgentMemoryService` explícitamente, sin tabla ni servicio paralelo
- [x] Código, CI, merge, deploy y activación se medirán por separado — ver metadata del spec (`code_status: COMPLETE`, todo lo demás en estado inicial)

## 3. Arquitectura y autoridad

- Fuente de verdad de escritura: Postgres vía Prisma, tablas `AgentMemory` y `WorkspaceMemoryEntry` (sin cambios de propietario)
- Read models/proyecciones: ninguno nuevo — las mismas consultas existentes ahora filtran `status`/`sensitivity`
- Módulos afectados: `apps/api/src/modules/knowledge/*` únicamente
- Contratos Zod: no se tocó `packages/schemas` — los tipos de gobernanza se declararon en TS puro dentro de `agent-memory.repository.ts` y `packages/knowledge/src/workspace/model.ts` (mismo patrón que ya usaban `AgentMemoryType`/`WorkspaceMemoryKind`, que tampoco son Zod)
- API/BFF/UI: 4 endpoints nuevos en `KnowledgeController` (correct/invalidate/supersede/conflicts) + 2 de lectura (list/search ya existían implícitamente vía `getRecentJournal`/`searchMemories`, ahora expuestos por HTTP) + 1 de lineage; sin UI
- Worker/queues: sin cambios
- Agentes/tools: `project-copilot.harness.ts` y `plan-mode.service.ts` siguen usando `AgentMemoryService` sin cambios de firma que rompan su uso actual
- ADR requerido: no — es una extensión de un módulo existente siguiendo un patrón ya presente en el propio schema (`AgentWorkPlan.approvedAt/rejectedAt/cancelledAt`), no una decisión arquitectónica nueva

## 4. Datos y migración

- Cambio Prisma: 15 columnas nuevas + 3 índices por tabla en `AgentMemory` y `WorkspaceMemoryEntry` (ver spec §7 para la lista completa)
- SQL y checksum: `packages/db/prisma/migrations/20260926130946_c85_agent_memory_governance/migration.sql`, generado y aplicado por `prisma migrate dev` (no escrito a mano)
- Expand/contract: expand puro, ver spec §7
- Backfill/shadow read: automático vía `DEFAULT` de columna — no requirió backfill manual
- Compatibilidad durante deploy: sí — los 15 call sites existentes de `WorkspaceMemoryRecord`/`.append()` compilan sin cambios (campos nuevos opcionales)
- Pre-deploy command: `pnpm db:migrate` (`prisma migrate deploy`) — no ejecutado contra Railway en esta sesión
- Rollback o forward-fix: `DROP COLUMN` de las 15 columnas por tabla; ningún dato existente se pierde porque nada se escribió en ellas fuera de los defaults
- Prueba de migración: `prisma migrate dev` completo contra Postgres 16 local, seguido de 7 tests de integración reales sobre las tablas migradas — PASS

## 5. Seguridad y política

- Permisos: `knowledge:read` (lectura/búsqueda/lineage), `knowledge:manage` (mutaciones) — ambos ya existían en `packages/auth/src/rbac.ts`, sólo `OPS_ADMIN` tiene `knowledge:manage` hoy
- Tenant/org/resource scope: cada mutación exige `tenantId` coincidente vía `updateMany` + `NotFoundException`; verificado con simulación de ataque cross-tenant
- Step-up/aprobación: no aplica — acciones administrativas sobre memoria, no acciones de dominio con impacto financiero
- Auditoría: `AuditService.append` en las 4 mutaciones, best-effort (no bloquea si falla)
- Riesgos de pagos/evidencia: ninguno — dominio no relacionado
- Abuse cases: un actor con `knowledge:manage` de un tenant intentando mutar memoria de otro tenant → `NotFoundException`, verificado; un actor sin `knowledge:manage` intentando mutar → bloqueado por `RbacGuard`/`RequirePermissions` (mecanismo genérico, no se agregó test dedicado a este endpoint específico)

## 6. Eventos, idempotencia y reconstrucción

- Productores: ninguno — no se emite evento de dominio
- Outbox atómico: no aplica
- Consumers/receipts: no aplica
- Replay: no aplica
- DLQ: no aplica
- Rebuild: no aplica — `getLineage()` reconstruye la cadena de corrección/supersesión leyendo `supersedesId`/`correctedFromId` directamente, no vía replay de eventos
- Correlation/traces: `requestId` opcional en cada método de gobernanza del servicio, propagado a `AuditLog.afterJson`

## 7. Estrategia de implementación

### Fase A — Tests y contratos ✅

- Se leyeron los tests existentes (`agent-memory.service.test.ts`, 27 casos) antes de tocar código, para no romper contratos implícitos.

### Fase B — Datos y dominio ✅

- Migración aditiva (ver §4).
- `AgentMemoryRepository`/`WorkspaceMemoryRepository`: `correct`/`invalidate`/`supersede`/`flagConflict`/`getLineage`/`findById`.
- `AgentMemoryService`: métodos de gobernanza + disclaimer en los bloques formateados + filtrado por sensibilidad en `injectRelevantContext`.
- Invariantes y concurrencia: aceptado un gap — dos `correct()` concurrentes sobre el mismo original no están serializados (ver spec §9, marcado explícitamente como no probado).

### Fase C — API/BFF/UI ✅ (API only)

- 7 endpoints nuevos en `KnowledgeController`, gateados por `knowledge:read`/`knowledge:manage`.
- Sin UI — fuera de alcance explícito.

### Fase D — Verificación local/CI ✅ (local only)

- `pnpm --filter @semse/api build` limpio.
- 34/34 unitarios, 7/7 integración (Postgres real), 4/4 controller.
- Lint dirigido y `spec:validate:strict` — pendientes de correr en esta misma sesión, después de este plan.
- CI real (GitHub Actions) — no corrido, no hay push todavía.

### Fase E — Integración ❌ No hecho

- PR y checks: no abierto todavía.
- Merge SHA: no aplica.
- Config/migración pre-deploy: no aplica.

### Fase F — Producción ❌ No hecho

- Deployment terminal: no aplica.
- Health/readiness: no aplica.
- Canary autenticado: no aplica.
- Métricas/SLO: no aplica.
- Activación gradual: no aplica.
- Rollback ensayado: sólo documentado (`DROP COLUMN`), no ensayado en un entorno real.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Dos `correct()` concurrentes sobre el mismo original crean dos reemplazos "ganadores" | baja | media (memoria duplicada, no pérdida de datos) | Aceptado para v1; `getLineage()` seguiría reconstruyendo cada rama por separado | Detectar en logs `agent_memory.corrected` duplicados con el mismo `correlationId` |
| Contenido `sensitivity: confidential` llega igual a un LLM externo vía Prometeo routing porque ningún caller pasa `maxSensitivity` real todavía | media | alta si el contenido es realmente sensible | Todo lo existente hoy es `sensitivity: "internal"` por default (comportamiento sin cambios); el campo está listo para que un follow-up conecte el RBAC real del usuario | Auditar `AgentMemory`/`WorkspaceMemoryEntry` por `sensitivity != "internal"` antes de conectar cualquier routing externo nuevo |
| Migración no aplicada aún a Railway | alta (es un hecho, no un riesgo hipotético) | media | Aplicar `pnpm db:migrate` en el pre-deploy step antes de que el código nuevo llegue a producción | Si el deploy falla por columna faltante, el rollback de código es inmediato (revertir el PR) |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| n/a | Se reutilizaron convenciones internas (`AgentWorkPlan`, `ConsentRecord`, `AuditService`) en vez de research externo | Ver spec §11 |

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (ver spec §10)
- [x] Migración y rollback definidos
- [x] Tests ordenados antes del código (se corrieron primero los existentes; los nuevos se escribieron junto con cada método)
- [ ] Canary/feature flag definidos — no aplica en este alcance (sin deploy)
- [x] Evidencia requerida para cada estado de entrega — ver spec §9
- [x] Scope cabe en un PR reversible — un solo módulo (`knowledge`), migración aditiva, sin tocar otros dominios
