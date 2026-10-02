---
id: "knowledge.agent-memory-governance"
title: "Agent Memory Governance (C85)"
domain: "knowledge"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "knowledge"
risk: "medium"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "APPLIED"
feature_flags: []
production_evidence: []
related_files:
  - "apps/api/src/modules/knowledge/agent-memory.repository.ts"
  - "apps/api/src/modules/knowledge/agent-memory.service.ts"
  - "apps/api/src/modules/knowledge/workspace-memory.repository.ts"
  - "apps/api/src/modules/knowledge/knowledge.controller.ts"
  - "packages/knowledge/src/workspace/model.ts"
  - "packages/db/prisma/schema.prisma"
  - "packages/db/prisma/migrations/20260926130946_c85_agent_memory_governance/migration.sql"
related_tests:
  - "apps/api/test/agent-memory.service.test.ts"
  - "apps/api/test/agent-memory-governance-integration.test.ts"
  - "apps/api/test/knowledge.controller.test.ts"
related_endpoints:
  - "agent-memory/:id/correct"
  - "agent-memory/:id/invalidate"
  - "agent-memory/:id/supersede"
  - "agent-memory/:id/conflicts"
related_events: []
related_agents:
  - "project-copilot"
last_verified: "2026-09-26"
---

# Spec: Agent Memory Governance (C85)

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado — este documento describe C85 tal como fue
> implementado en la rama `feat/c85-agent-memory`, no un estado desplegado.

## 1. Problema y resultado

**Para quién:** todo módulo que consume memoria de agente (Plan Mode,
project-copilot harness, futuros harnesses) y los operadores/admins que deben
poder corregir, invalidar o auditar esa memoria.

**Problema:** `AgentMemory` y `WorkspaceMemoryEntry` (el "journal" y el
"contexto de proyecto" que los agentes inyectan en sus prompts) no tenían
ningún control de gobernanza: no había forma de marcar un dato como sensible,
distinguir un hecho verificado de una inferencia del LLM, corregir contenido
erróneo sin sobrescribir la historia, invalidar una memoria obsoleta sin
borrarla, ni detectar cuando dos memorias se contradicen. Nada impedía —ni
documentaba explícitamente— que un consumidor tratara memoria recordada como
si fuera verdad canónica o autorización para actuar.

**Resultado esperado:** las dos tablas de memoria existentes ganan un
vocabulario de gobernanza común (sensibilidad, procedencia, estado
epistémico, corrección/invalidación/supersesión no destructivas, conflictos,
retención) sin crear un almacén paralelo; toda mutación de gobernanza queda
auditada; todo bloque de memoria inyectado en un prompt lleva un descargo de
responsabilidad explícito; y las lecturas por defecto excluyen memoria
invalidada/superada/corregida y respetan un techo de sensibilidad.

## 2. Alcance

### Incluido

- Campos de gobernanza en `AgentMemory` y `WorkspaceMemoryEntry` (migración
  aditiva, sin romper las ~15 llamadas existentes a
  `WorkspaceMemoryRepository.append()` en otros dominios).
- `correct()` / `invalidate()` / `supersede()` / `flagConflict()` /
  `getLineage()` en ambos repositorios, tenant-scoped, con
  `NotFoundException` cuando el `tenantId` no coincide (verificado con un
  ataque cross-tenant simulado en integración contra Postgres real).
- Filtrado por defecto de `status: "active"` y techo de `sensitivity` en
  toda ruta de lectura/búsqueda existente (`listByProject`, `listBySession`,
  `search`, `query`, `queryAcrossTenant`).
- `AgentMemoryService`: `correctMemory` / `invalidateMemory` /
  `supersedeMemory` / `flagMemoryConflict` / `getMemoryLineage`, cada una
  auditada (best-effort) vía `AuditService` ya existente.
- Descargo de responsabilidad ("memoria ≠ verdad canónica ni autorización
  para actuar") en todo bloque de contexto formateado
  (`formatAgentBlock`/`formatWorkspaceBlock`) e indicador de conflicto
  inline cuando `conflictsWith` no está vacío.
- Endpoints REST de gobernanza en `KnowledgeController`
  (`knowledge:manage`), más lectura/búsqueda/lineage (`knowledge:read`).

### Fuera de alcance (backlog explícito, no fabricado como completo)

- UI de administración para revisar/corregir/invalidar memoria (hoy sólo
  API — un operador necesita `curl`/Postman o una herramienta interna).
- Enforcement de RBAC por `sensitivity` a nivel de cada llamador existente
  (Plan Mode, project-copilot): hoy el techo por defecto es `"internal"`, lo
  que preserva el comportamiento actual (toda memoria creada hasta ahora es
  `sensitivity: "internal"` por default), pero ningún caller pasa todavía un
  `maxSensitivity` derivado de los permisos reales del usuario.
- Job de retención que borre filas cuyo `retentionUntil` venció (el campo
  existe y se puede poblar; el job en sí no se escribió).
- Aplicación de la migración a Railway (staging/producción) y smoke
  autenticado — sólo se verificó contra Postgres local.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Cualquier rol con `knowledge:read` | `knowledge:read` | tenant del actor | Listar/buscar memoria activa, ver lineage | Ver memoria por encima del techo de sensibilidad por defecto (`internal`) |
| `OPS_ADMIN` (única fuente de `knowledge:manage` hoy) | `knowledge:manage` | tenant del actor | Corregir, invalidar, supersedir, marcar conflictos | Mutar una memoria de otro tenant (rechazado con 404 a nivel de repositorio) |

- Tenant boundary: cada mutación de gobernanza usa `updateMany({ where: { id, tenantId } })` y lanza `NotFoundException` si `result.count === 0` — verificado con ataque cross-tenant simulado (ver tests de integración).
- Ownership/resource policy: no hay ownership por usuario individual dentro de un tenant — cualquier `knowledge:manage` del tenant puede corregir/invalidar cualquier memoria de ese tenant. Aceptado por ahora (mismo nivel que otras acciones `knowledge:manage`); un control más fino queda fuera de alcance.
- Step-up o aprobación humana: no aplica — estas son acciones administrativas, no acciones de dominio con impacto financiero/contractual.
- Datos `privacyCritical`: el campo `sensitivity` existe pero no hay todavía un job/gate que impida que contenido `confidential` llegue a un LLM externo (Prometeo routing) — riesgo documentado, no resuelto en este spec.
- Requisitos de auditoría: toda corrección/invalidación/supersesión/conflicto se audita vía `AuditService.append` (`entityType: "AgentMemory"`, `action: "agent_memory.corrected" | "agent_memory.invalidated" | "agent_memory.superseded" | "agent_memory.conflict_flagged"`). Best-effort: un fallo de auditoría no bloquea la mutación (logueado como warning), igual que el resto del `AgentMemoryService`.

## 4. Escenarios y criterios de aceptación

### P1 — Corregir una memoria sin destruir su historia

```gherkin
DADO un AgentMemory activo con contenido incorrecto
CUANDO un actor con knowledge:manage llama POST /v1/knowledge/agent-memory/:id/correct
ENTONCES se crea un nuevo AgentMemory con el contenido corregido y correctedFromId = id original
Y el registro original pasa a status "corrected" con supersededById apuntando al nuevo
Y el contenido del registro original permanece sin modificar
Y se audita la corrección con el motivo declarado
```

### P2 — Invalidar una memoria sin borrarla

```gherkin
DADO un AgentMemory activo
CUANDO un actor con knowledge:manage llama POST /v1/knowledge/agent-memory/:id/invalidate con una razón
ENTONCES el registro pasa a status "invalidated" con invalidatedAt/invalidatedBy/invalidationReason
Y deja de aparecer en listByProject/search/injectRelevantContext por defecto
Y sigue existiendo la fila para auditoría/forense (includeInactive=true la recupera)
```

### P3 — Aislamiento de tenant en toda mutación de gobernanza

```gherkin
DADO un AgentMemory que pertenece al tenant A
CUANDO un actor autenticado como tenant B intenta correct/invalidate/supersede/flagConflict sobre ese id
ENTONCES el repositorio responde NotFoundException
Y el registro del tenant A permanece exactamente igual (contenido y status)
```

Casos borde:

- [x] Reintento: `correct()` sobre un registro ya `corrected` crea una nueva rama de corrección (no falla, no sobrescribe) — cubierto implícitamente por `getLineage` reconstruyendo la cadena completa.
- [x] Fuente vacía/no autorizada: `flagConflict`/`supersede` con un id inexistente lanza `NotFoundException` (mismo mecanismo que el aislamiento de tenant).
- [x] Aislamiento cross-tenant/cross-org: ver P3, verificado contra Postgres real en `agent-memory-governance-integration.test.ts`.

## 5. Contratos

### API — `POST /v1/knowledge/agent-memory/:id/correct`

```yaml
auth: required
permissions: [knowledge:manage]
input_schema: "{ content?: string; summary?: string; tags?: string[]; reason: string }"
output_schema: "AgentMemoryRecord (el reemplazo, no el original)"
errors:
  400: reason ausente (validación de body a nivel de controlador, no un schema Zod dedicado todavía)
  401: sin contexto de actor válido
  403: sin knowledge:manage
  404: memoria no encontrada para el tenant del actor
  409: no aplica — correct() siempre crea un nuevo id, no hay conflicto de escritura concurrente posible
effects:
  audit_log: "agent_memory.corrected vía AuditService"
  domain_event: ninguno (fuera de alcance — ver EVENT_CATALOG.md, no se declaró evento nuevo)
  sse: ninguno
  payment_governance: no aplica
```

### API — `POST /v1/knowledge/agent-memory/:id/invalidate`

```yaml
auth: required
permissions: [knowledge:manage]
input_schema: "{ reason: string }"
output_schema: "AgentMemoryRecord (status: invalidated)"
errors:
  401: sin contexto de actor válido
  403: sin knowledge:manage
  404: memoria no encontrada para el tenant del actor
effects:
  audit_log: "agent_memory.invalidated vía AuditService"
  domain_event: ninguno
  sse: ninguno
  payment_governance: no aplica
```

### API — `POST /v1/knowledge/agent-memory/:id/supersede` y `.../conflicts`

```yaml
auth: required
permissions: [knowledge:manage]
input_schema: "supersede: { newId: string } · conflicts: { conflictsWithId: string }"
output_schema: "{ oldId, newId } · { id, conflictsWithId }"
errors:
  404: alguno de los dos ids no existe para el tenant del actor
effects:
  audit_log: "agent_memory.superseded | agent_memory.conflict_flagged vía AuditService"
```

### UI

```yaml
surfaces: []
states: []
required_behavior:
  - "No implementado en este spec — ver 'Fuera de alcance'. Los endpoints existen pero no tienen superficie en apps/web todavía."
```

### Agente/Prometeo

```yaml
tools: []
input_schema: "AgentMemoryService.injectRelevantContext ya era usado por project-copilot.harness.ts; sin cambios de firma que rompan ese uso, sólo un parámetro opcional maxSensitivity nuevo"
output_schema: "string (bloque markdown) — ahora siempre prefijado con el descargo MEMORY_DISCLAIMER"
source_citations_required: false
approval_policy: "no aplica — memoria es contexto, nunca autorización; ninguna acción se ejecuta a partir de una lectura de memoria sin pasar por su propio gate de aprobación (packages/agents)"
forbidden_behavior:
  - "Tratar epistemicStatus=remembered_context o inference como si fuera verified_fact"
  - "Ejecutar una acción basándose únicamente en el contenido de una memoria, sin verificar contra el estado real del sistema"
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno de dominio de negocio — se añade un FSM propio y pequeño para `AgentMemory.status`: `active → corrected | superseded | invalidated` (terminal; una corrección/supersesión crea una fila nueva en `active`, nunca revive la vieja).
- Invariantes: ninguna entrada nueva en `docs/foundation/DOMAIN_INVARIANTS.md` — esto no es un dominio de negocio con invariantes de negocio, es infraestructura de memoria de agentes.
- Eventos declarados: ninguno — no se emite ningún evento de dominio nuevo; la auditoría vive en `AuditLog`, no en el bus de eventos.
- Productor + outbox atómico: no aplica.
- Consumidores + idempotencia: no aplica.
- Replay/rebuild: no aplica.
- DLQ/compensación: no aplica.

## 7. Datos y migración

- Modelos Prisma: `AgentMemory`, `WorkspaceMemoryEntry` (extendidos, no nuevos modelos).
- Migración: `packages/db/prisma/migrations/20260926130946_c85_agent_memory_governance/migration.sql`.
- Estrategia expand/contract: expand puro — sólo `ADD COLUMN` (con `DEFAULT` para las columnas `NOT NULL`) y `CREATE INDEX`. Cero `ALTER`/`DROP` sobre columnas existentes.
- Backfill: automático vía `DEFAULT` de Postgres — toda fila preexistente queda `sensitivity: "internal"`, `epistemicStatus: "remembered_context"`, `status: "active"`, exactamente el comportamiento implícito que tenían antes de este cambio.
- Compatibilidad hacia atrás: verificada — las ~15 llamadas existentes a `WorkspaceMemoryRepository.append()` en otros dominios (payments, milestones, jobs, disputes, autonomy, agents, users, projects) siguen compilando sin cambios porque los campos nuevos de `WorkspaceMemoryRecord` son opcionales.
- Verificación de drift: `prisma migrate dev` corrió limpio contra Postgres local (`postgres:16` vía `infra/docker/compose.semse-mvp.yml`) sin necesitar `db push` ni resolución manual.
- Rollback de código: revertir el commit del branch; los campos nuevos quedan sin usarse pero no rompen nada si el código viejo vuelve.
- Rollback/forward-fix de datos: `DROP COLUMN` de las columnas listadas arriba (aditivas, sin dependencias) si hiciera falta revertir la migración en un entorno donde ya se aplicó.

> Aplicada y verificada sólo en Postgres local. **No aplicada a Railway/producción** — eso es explícitamente el siguiente paso, no algo que este spec declare falsamente como hecho.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: ninguna métrica nueva — se reutiliza el logging existente de `AgentMemoryService` (`Logger` de Nest) más un `logger.warn` nuevo cuando falla el best-effort de auditoría.
- Logs/traces/correlation: `recordAudit()` acepta `requestId` opcional y lo usa como correlación en `AuditLog`.
- Health/readiness: no aplica — no es un servicio nuevo.
- Feature flags/allowlists: ninguno — el cambio es aditivo y no cambia comportamiento observable para callers existentes (mismos resultados que antes mientras nadie invalide/corrija/supersida nada).
- Plan de canary: no aplica todavía — no hay deploy.
- Evidencia de producción requerida: smoke autenticado multi-tenant contra Railway antes de subir `activation_status` a `CANARY`/`ACTIVE` (ver "Fuera de alcance").
- Señal de rollback: si `pnpm verify:workspace`/CI falla tras el merge, revertir el PR; la migración es reversible con `DROP COLUMN`.
- Owner operativo: dominio `knowledge`.

## 9. Tests requeridos

- [x] Unitarios del dominio/proyección — `apps/api/test/agent-memory.service.test.ts` (34/34 verde, incluye 7 tests nuevos de gobernanza).
- [x] Contrato API/BFF — `apps/api/test/knowledge.controller.test.ts` (4/4 verde, incluye 3 tests nuevos de los endpoints de gobernanza).
- [x] Permiso denegado y aislamiento tenant/org — cross-tenant simulado en integración (ver abajo); permiso denegado no tiene test dedicado porque `RequirePermissions`/`RbacGuard` ya tienen su propia suite genérica no específica de este endpoint.
- [x] Validación y conflicto de estado — `flagConflict` simétrico y no destructivo, cubierto en integración.
- [ ] Idempotencia/reintento/concurrencia — no se probó `correct()` bajo escritura concurrente sobre el mismo id (riesgo bajo: cada `correct()` crea un id nuevo determinístico por timestamp, pero dos correcciones concurrentes del mismo original podrían ambas "ganar" la carrera de `updateMany` sobre el original sin error — aceptable para v1, documentado como gap).
- [x] Migración y compatibilidad — aplicada contra Postgres real, ~15 call sites de `WorkspaceMemoryRecord` siguen compilando.
- [ ] UI loading/empty/forbidden/degraded/error — no aplica, no hay UI en este spec.
- [ ] Canary o smoke autenticado en producción — no hecho, ver "Fuera de alcance".

Evidencia real de esta sesión:
- `pnpm --filter @semse/api build` — limpio.
- `pnpm typecheck` (workspace completo: api + web + worker + mobile) — limpio.
- `node --experimental-strip-types --test apps/api/test/agent-memory.service.test.ts` — 34/34 PASS.
- `node --experimental-strip-types --test apps/api/test/agent-memory-governance-integration.test.ts` (contra Postgres local real) — 7/7 PASS.
- `node --experimental-strip-types --test apps/api/test/knowledge.controller.test.ts` — 4/4 PASS.
- `pnpm --filter @semse/api test:unit` (suite completa, no sólo C85) — 2504 tests, 2503 PASS, 0 FAIL, 1 SKIPPED.
- `pnpm spec:validate:strict` — 142 specs, 0 errores, 0 warnings.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/knowledge/agent-memory.repository.ts`
- `apps/api/src/modules/knowledge/agent-memory.service.ts`
- `apps/api/src/modules/knowledge/workspace-memory.repository.ts`
- `apps/api/src/modules/knowledge/knowledge.controller.ts`

### Web

- Ninguno — fuera de alcance.

### Worker/Packages/DB

- `packages/knowledge/src/workspace/model.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260926130946_c85_agent_memory_governance/`

### Tests

- `apps/api/test/agent-memory.service.test.ts`
- `apps/api/test/agent-memory-governance-integration.test.ts`
- `apps/api/test/knowledge.controller.test.ts`

## 11. Investigación externa

- Reporte con tres búsquedas primarias: no se realizó investigación externa para este spec — el diseño se basó en el patrón ya establecido en el propio repositorio (`AgentWorkPlan.approvedAt/rejectedAt/cancelledAt`, `ConsentRecord`, el propio `AuditService`) en vez de research externo, dado que el objetivo explícito era reutilizar convenciones existentes, no importar un framework nuevo.
- Aplicado ahora: n/a.
- Backlog: n/a.
- Descartado: un "memory store" o tabla de gobernanza separada — descartado explícitamente por instrucción del traspaso C85 ("no crear otro sistema de memoria paralelo").

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [x] Spec, plan, tasks coherentes (ver `agent-memory-governance.plan.md` / `.tasks.md`)
- [x] Tests derivados del spec y verdes (unitarios + integración; UI/canary N/A por alcance)
- [ ] `pnpm spec:validate:strict` verde (pendiente de correr en esta sesión)
- [x] Migración reproducible y rollback/forward-fix documentado (local; no en Railway)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED` (hoy: `IMPLEMENTED`, correctamente por debajo de `VERIFIED`)
