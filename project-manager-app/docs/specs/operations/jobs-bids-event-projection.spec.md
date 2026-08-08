---
id: "operations.jobs-bids-event-projection"
title: "Jobs & Bids Event Projection for Agent Context"
domain: "operations"
sdd_version: "2.0"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags:
  - SEMSE_JOBS_PROJECTION_ENABLED
  - SEMSE_JOBS_PROJECTION_PERSIST_ENABLED
  - SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS
  - SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED
  - SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED
  - SEMSE_EVENT_CONSUMERS_ENABLED
  - SEMSE_EVENT_CONSUMER_ALLOWLIST
  - SEMSE_EVENT_TYPE_ALLOWLIST
production_evidence: []
related_files:
  - apps/api/src/modules/jobs/jobs.repository.ts
  - apps/api/src/modules/jobs/jobs.service.ts
  - apps/api/src/modules/bids/bids.repository.ts
  - apps/api/src/modules/bids/bids.service.ts
  - apps/api/src/modules/domain-events/domain-event-consumer.service.ts
  - apps/api/src/modules/domain-events/domain-event-bus.service.ts
  - apps/api/src/modules/domain-events/outbox-dispatcher.service.ts
  - apps/api/src/modules/agents/agent-trigger-router.service.ts
  - apps/api/src/modules/ai-models/context/operational-context.service.ts
  - apps/api/src/modules/ai-models/context/operational-context.token.ts
  - apps/api/src/modules/ai-models/ai-models.controller.ts
  - apps/api/src/modules/agents/harnesses/project-copilot.harness.ts
  - apps/api/src/modules/evidence/evidence.repository.ts
  - apps/api/src/modules/projects/project-lifecycle-projection.ts
  - apps/api/src/modules/projects/projects.repository.ts
  - packages/db/prisma/schema.prisma
  - packages/schemas/src/domain-events-v2.schema.ts
  - docs/foundation/EVENT_CATALOG.md
  - docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md
  - docs/runbooks/F3_PROJECT_LIFECYCLE_EVENT_CANARY.md
  - docs/runbooks/F1F_EVENT_BACKBONE_CANARY.md
  - docs/specs/platform/event-backbone.spec.md
related_tests:
  - apps/api/test/jobs.fsm.test.ts
  - apps/api/test/jobs.controller.test.ts
  - apps/api/test/jobs.service.test.ts
  - apps/api/test/job-auto-complete.test.ts
  - apps/api/test/bids.controller.test.ts
  - apps/api/test/marketplace-bids.test.ts
  - apps/api/test/evidence-outbox-producer.test.ts
related_endpoints:
  - GET /v1/domain-events/outbox
  - GET /v1/domain-events/:eventId/deliveries
  - POST /v1/domain-events/:eventId/replay
  - POST /prometeo/chat
  - GET /operational-context
related_events:
  - job.created.v1
  - job.status_changed.v1
  - job.preferred_professional_selected.v1
  - bid.created.v1
  - bid.accepted.v1
  - bid.rejected.v1
related_agents:
  - prometeo
  - project-copilot
last_verified: ""
---

# Spec: Jobs & Bids Event Projection for Agent Context

> Contrato ejecutable SDD 2.0. Nace de una auditoría de arquitectura
> (comparación Buzz vs SEMSEproject, ver `docs/reportes/` si se archiva esa
> sesión) y del runbook DRAFT `docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md`.
> Este documento es el contrato formal que ese runbook necesitaba antes de
> ser ejecutable. `status` permanece `DRAFT` hasta sign-off humano.

## 1. Problema y resultado

**Para quién:** Prometeo (`POST /prometeo/chat`) y Project Copilot
(`project-copilot.harness.ts`), y transitivamente cualquier usuario que
converse con esos agentes sobre jobs o bids activos.

**Problema:** `OperationalContextService.buildContext()` arma el campo
`jobs` con una consulta `prisma.job.findMany()` directa, cacheada en memoria
por proceso 60s (`CONTEXT_TTL_SECONDS`) e invalidada manualmente desde 10
call sites distintos (`jobs.service.ts`, `domain-event-bus.service.ts`,
`disputes.service.ts`, etc.). No existe una fuente única que los ~16 agentes
especializados consulten para el estado de jobs/bids — cada uno arma su
propia vista con su propia ventana de staleness. `AgentMemory` no modela
estado de job/bid en absoluto hoy: es un vacío de coherencia, no una
decisión de diseño.

**Resultado esperado:** los agentes que consultan estado de jobs/bids leen
una proyección única, derivada de eventos, reconstruible por replay —
mismo patrón que F3 ya resolvió para el estado de proyecto. La query
directa y el cache de 60s siguen existiendo para los otros 13 campos de
`SemseOperationalContext` que esta spec no cubre (milestones, payments,
evidence, disputes, finance, risk, ecosystem5d, notifications,
assistantSettings, preferredProfessional).

## 2. Alcance

### Incluido

- Instrumentación de outbox transaccional en los write paths de `bids`
  (`create`, `accept`) y `jobs` (`create`, `updateStatus`) — dual-write
  junto al `DomainEventBus` existente en jobs, sin retirarlo.
- Generalización del dispatch del consumer
  (`domain-event-consumer.service.ts`) de dos `if` hardcodeados a un
  registro `eventType → consumer handler` pluggable — prerequisito
  transversal, no específico de este dominio (equivale a cerrar F1-F).
- Tabla de proyección `JobsBidsProjection`, mismo molde que
  `ProjectLifecycleProjection` (snapshot JSON, CAS por `revision` +
  `sourceUpdatedAt`).
- Consumer `jobs-bids-projection.v1` que reconstruye la proyección
  tenant-scoped.
- Read-through en `OperationalContextService.buildContext()` para el campo
  `jobs`, con fallback obligatorio a la query directa si la proyección
  falla o el tenant no está en el allowlist — no negociable en el path de
  `POST /prometeo/chat`, que hoy llama `buildContext()` sin `.catch()`.
- Sección `## Bids` nueva en `EVENT_CATALOG.md` (hoy no existe) y
  reconciliación de los nombres `job.*` ya listados ahí contra lo que el
  código emite realmente (`job.created`, `job.status_changed`,
  `job.preferred_professional_selected`, sin versión).
- Canary por tenant siguiendo `docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md`.

### Fuera de alcance

- Modificar el FSM de `Job`/`Bid` (`fsm-job-lifecycle`, ya `VERIFIED`) o sus
  transiciones — esta spec es puramente de lectura derivada, no de
  autoridad de escritura.
- Retirar `DomainEventBus`/`AgentTriggerRouter` — siguen siendo el
  mecanismo real de disparo síncrono de agentes; esta spec es dual-write,
  no reemplazo.
- Cubrir los otros 13 campos de `SemseOperationalContext` (milestones,
  payments, evidence, disputes, finance, risk, ecosystem5d,
  preferredProfessional, notifications, assistantSettings) — quedan en
  query directa + cache existente.
- Migrar `AgentMemory`/`AgentSkill` — la memoria procedural/de juicio por
  agente no es el problema que esta spec resuelve.
- Cualquier endpoint público nuevo — los ~16 agentes leen la proyección
  vía `buildContext()`, no hay superficie de usuario nueva. Ops ya puede
  inspeccionar los eventos vía `GET /v1/domain-events/outbox` una vez que
  `job.*`/`bid.*` estén en el allowlist, sin endpoint adicional.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Usuario autenticado vía `/prometeo/chat` o Project Copilot | heredado de la sesión (ya validado antes de `buildContext()`) | tenant + `userId` | recibir contexto de jobs/bids de su propio scope | leer proyección de otro tenant |
| `OPS_ADMIN` | `domain-events:read` / `domain-events:replay` (ya existen, sin scoping por aggregate — genéricos) | tenant | inspeccionar/reintentar eventos `job.*`/`bid.*` en `/v1/domain-events/*` | escribir sobre `Job`/`Bid` desde ahí |
| Worker (identidad de servicio) | rol `EVENT_CONSUMER` (mismo requisito que F3) | — | consumir y persistir la proyección | — |

- Tenant boundary: la proyección es `tenantId`-scoped igual que
  `ProjectLifecycleProjection`; ningún query cruza tenant.
- Ownership/resource policy: no aplica un actor "owner" nuevo — el
  consumidor de la proyección es siempre el propio flujo de chat del
  usuario autenticado, nunca un endpoint de lectura directa por tercero.
- Step-up o aprobación humana: no aplica (sin efecto de escritura sobre
  dominio, sin liberación de fondos).
- Datos `privacyCritical`: no. `Job`/`Bid` son datos operativos generales
  (título, estado, monto de bid, ETA) — no PII/legal/financiero sensible
  en el sentido del Artículo VIII; siguen elegibles para LLM cloud, igual
  que hoy.
- Requisitos de auditoría: cada evento consumido deja `DomainEventConsumption`
  + `AuditLog` (`entityType: DomainEvent`), mismo patrón que F1/F3 — ver
  Artículo V de la constitución.

## 4. Escenarios y criterios de aceptación

### P1 — Agente lee estado coherente de un job

```gherkin
DADO un job con bids activos en un tenant con la proyección habilitada
CUANDO Prometeo arma el contexto para responder una pregunta sobre ese job
ENTONCES el campo `jobs` de `SemseOperationalContext` proviene de la
  proyección, no de una query directa nueva
Y coincide con el resultado que daría `prisma.job.findMany()` para el mismo
  usuario en el mismo instante
```

Casos borde:

- [ ] la proyección falla o está stale para el tenant canario → `buildContext()`
      hace fallback a la query directa sin lanzar excepción en
      `/prometeo/chat` (path sin `.catch()` hoy)
- [ ] dos reconstrucciones simultáneas del mismo job/bid → CAS por
      `revision`+`sourceUpdatedAt` deja una sola fila, mismo mecanismo que
      `ProjectLifecycleProjection`
- [ ] tenant fuera del allowlist de canary → el campo `jobs` sigue viniendo
      de la query directa, sin tocar la proyección en absoluto

### P1 — Evento de job/bid no muta dominios ajenos

```gherkin
DADO un evento `job.status_changed.v1` o `bid.accepted.v1` consumido
CUANDO el consumer `jobs-bids-projection.v1` lo procesa
ENTONCES `PaymentEscrow`, `Milestone` y `Contract` no cambian como efecto
  de ese consumer
Y `AuditLog` registra el consumo con `entityType: DomainEvent`
```

### P1 — Replay no duplica efecto

```gherkin
DADO un evento ya `COMPLETED` para el consumer `jobs-bids-projection.v1`
CUANDO se reintenta la entrega o se ejecuta `POST /v1/domain-events/:eventId/replay`
ENTONCES la respuesta indica `duplicate: true`
Y la proyección conserva una sola fila con la misma `revision`
```

## 5. Contratos

### API — sin endpoint nuevo (ver "Fuera de alcance")

La única superficie API que cambia de comportamiento es interna a
`OperationalContextService.buildContext()`; no se declara un endpoint REST
nuevo. `GET /v1/domain-events/outbox` y `GET /v1/domain-events/:eventId/deliveries`
(ya existentes, F1-E) ganan cobertura sobre `job.*`/`bid.*` una vez
allowlisted — sin cambio de contrato en sí.

### Agente/Prometeo

```yaml
tools: []
input_schema: SemseOperationalContext (sin cambio de forma; solo cambia la
  fuente del campo `jobs`)
output_schema: sin cambio
source_citations_required: false
approval_policy: none (lectura derivada, sin escritura de dominio)
forbidden_behavior:
  - "Nunca presentar la proyección como autoridad de escritura de Job/Bid"
  - "Nunca omitir el fallback a query directa en el path de /prometeo/chat"
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno — `Job`/`Bid` mantienen su FSM actual
  (`fsm-job-lifecycle`, `VERIFIED`) como única autoridad de escritura.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md` (sin cambios
  propuestos ahí).
- Eventos declarados: propuestos para `docs/foundation/EVENT_CATALOG.md`,
  sección `## Bids` nueva —

  ```text
  job.created.v1                          (reconciliar nombre actual sin versión)
  job.status_changed.v1                   (reconciliar nombre actual sin versión)
  job.preferred_professional_selected.v1  (reconciliar nombre actual sin versión)
  bid.created.v1                          (nuevo, no existe hoy)
  bid.accepted.v1                         (nuevo, no existe hoy)
  bid.rejected.v1                         (nuevo — cubre el bulk-reject
                                            implícito de bids competidoras
                                            en bids.repository.ts:accept)
  ```

  No editar `EVENT_CATALOG.md` con estos nombres hasta que esta spec pase a
  `APPROVED` — mientras tanto son propuesta, no catálogo vigente
  (`AGENTS.md`: "Nunca inventar nombres de eventos fuera de
  `EVENT_CATALOG.md`").
- Productor + outbox atómico:
  - `bids.repository.ts:create` — nuevo `$transaction` (hoy no envuelto),
    idempotency key `bid.created.v1:<jobId>:<orgId>`.
  - `bids.repository.ts:accept` — ya tiene `$transaction`; se agrega el
    insert de outbox adentro, sin restructurar el resto.
  - `jobs.repository.ts:create`/`updateStatus` — nuevo `$transaction`
    (hoy no envuelto); dual-write junto al `DomainEventBus.emit()`
    existente en `jobs.service.ts`, que se mantiene intacto para su rol
    real (audit, notificaciones, invalidación de cache,
    `AgentTriggerRouter`).
- Consumidores + idempotencia: `jobs-bids-projection.v1`, registrado en el
  dispatch genérico (prerequisito transversal, ver Alcance). Idempotencia
  vía `DomainEventConsumption` único por `[eventId, consumerName]`, mismo
  mecanismo que `evidence-readiness.v1`/`project-lifecycle-projection.v1`.
- Replay/rebuild: `POST /v1/domain-events/:eventId/replay` ya soporta esto
  de forma genérica (F1-E) — sin contrato nuevo, solo nuevo `eventType`
  fluyendo por el mismo mecanismo.
- DLQ/compensación: mismas reglas que F1/F3 — evento en `DEAD_LETTER` >
  15 min sin revisión de Ops es señal de rollback (ver runbook).

## 7. Datos y migración

- Modelos Prisma: nuevo `model JobsBidsProjection` — mismo shape que
  `ProjectLifecycleProjection` (`id, tenantId, jobId unique, schemaVersion,
  revision, snapshotJson, sourceUpdatedAt, generatedAt, createdAt,
  updatedAt`), índices `[tenantId, updatedAt]` y `[jobId, revision]`.
- Migración: aditiva, `CREATE TABLE` únicamente — mismo patrón que
  `20260728000000_project_lifecycle_projection`. Sin tocar `Job`/`Bid`.
- Estrategia expand/contract: no aplica contract — solo expand (tabla
  nueva, sin columnas nuevas en modelos existentes).
- Backfill: no requerido — la tabla parte vacía y se puebla por eventos
  nuevos; jobs/bids preexistentes se resuelven por fallback a query
  directa hasta que un evento los toque.
- Compatibilidad hacia atrás: total — código anterior sigue funcionando
  porque el read-through es opt-in por flag y tenant.
- Verificación de drift: comparar `jobs` de proyección vs query directa
  por muestreo durante canary (ver checklist de cierre en el runbook).
- Rollback de código: revertir PR, la migración aditiva no requiere
  revertirse.
- Rollback/forward-fix de datos: no borrar la tabla ni los
  `DomainOutboxEvent`/`DomainEventConsumption` asociados — quedan para
  diagnóstico y replay, igual que F1/F3.

> Nunca usar `prisma db push` para producción — aplica igual que al resto
> del repo (`CLAUDE.md` raíz ya lo señala como deuda existente en otros
> flujos; esta spec no la repite).

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: heredadas de F1 sin cambio
  (`docs/specs/platform/event-backbone.spec.md`, sección 14) — write de
  dominio + outbox p95 < 500ms, outbox publish lag p95 < 2s, eventos
  `PENDING` > 60s = 0 sostenidos. Nuevas para el read-through de
  `buildContext()` (sin precedente en el repo, definidas por primera vez
  acá): tasa de fallback a query directa < 1%, sin incremento medible de
  5xx en `/prometeo/chat`, cero mismatches sostenidos por muestreo.
- Logs/traces/correlation: reutiliza `correlationId`/`causationId` del
  envelope `SemseDomainEvent` v2, ya estándar en outbox.
- Health/readiness: sin cambio — no se agregan nuevos checks.
- Feature flags/allowlists: ver frontmatter — cuatro flags nuevos
  (`SEMSE_JOBS_PROJECTION_*`) siguiendo el naming y el default `false` de
  F3, más los allowlists globales ya existentes de F1
  (`SEMSE_EVENT_TYPE_ALLOWLIST`/`SEMSE_EVENT_CONSUMER_ALLOWLIST`).
- Plan de canary: `docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md` (DRAFT,
  este spec es su prerequisito de gobernanza).
- Evidencia de producción requerida: mismo estándar que F3 — PR/SHA/merge,
  deployments terminales, resultado del checklist de cierre, tenant
  canario, sin inventar IDs de ejemplo.
- Señal de rollback: cualquier métrica del checklist fuera de objetivo, o
  incremento de 5xx en `/prometeo/chat` atribuible al cambio.
- Owner operativo: `semse-core`.

## 9. Tests requeridos

- [ ] Unitarios del dominio/proyección (builder determinista, revision hash)
- [ ] Contrato API/BFF — no aplica endpoint nuevo; cubrir el cambio de
      fuente dentro de `buildContext()`
- [ ] Permiso denegado y aislamiento tenant/org (cross-tenant no lee
      proyección ajena)
- [ ] Validación y conflicto de estado — CAS no permite downgrade de
      revision
- [ ] Idempotencia/reintento/concurrencia — dos reconstrucciones
      simultáneas dejan una sola fila
- [ ] Migración y compatibilidad — tabla aditiva, sin romper código
      anterior
- [ ] `OperationalContextService` — suite nueva completa (hoy no existe
      ningún test real del servicio, solo un stub mockeado en
      `ai-models.controller.test.ts`); cubrir especialmente
      `invalidateScope()` porque lo comparten los 10 call sites de
      invalidación existentes, no solo este cambio
- [ ] Fallback de `buildContext()` a query directa cuando la proyección
      falla — específico del hard-fail path de `/prometeo/chat`
- [ ] Canary o smoke autenticado en producción (ver runbook)

## 10. Mapa de implementación

### API

- `apps/api/src/modules/jobs/jobs.repository.ts`
- `apps/api/src/modules/jobs/jobs.service.ts`
- `apps/api/src/modules/bids/bids.repository.ts`
- `apps/api/src/modules/bids/bids.service.ts`
- `apps/api/src/modules/domain-events/domain-event-consumer.service.ts`
- `apps/api/src/modules/ai-models/context/operational-context.service.ts`

### Web

- Ninguno — sin superficie UI nueva.

### Worker/Packages/DB

- `packages/db/prisma/schema.prisma` (`JobsBidsProjection`)
- `packages/db/prisma/migrations/<timestamp>_jobs_bids_projection/migration.sql`
- `packages/schemas/src/domain-events-v2.schema.ts` (schemas Zod de los
  6 eventos nuevos/versionados)

### Tests

- `apps/api/test/jobs-bids-projection.test.ts` (nuevo)
- `apps/api/test/jobs-bids-projection-events.test.ts` (nuevo)
- `apps/api/test/operational-context.service.test.ts` (nuevo — no existe
  hoy)
- `apps/api/test/bids-outbox-producer.test.ts` (nuevo)

## 11. Investigación externa

- Reporte con tres búsquedas primarias: no aplica — el diseño se derivó
  íntegramente de código propio (`evidence.repository.ts`,
  `project-lifecycle-projection.ts` como plantillas ya verificadas en
  producción), no de investigación externa nueva.
- Aplicado ahora: reutilización directa del patrón CAS+outbox de F1/F3.
- Backlog: ninguno identificado.
- Descartado: identidad criptográfica por agente / relay tipo Nostr (Buzz)
  — evaluado en la auditoría comparativa y descartado explícitamente por
  no resolver ningún problema real de este dominio.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
