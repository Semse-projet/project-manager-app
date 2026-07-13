---
id: "platform.event-backbone-f1"
title: "F1 — Event Backbone transaccional"
type: spec
domain: "platform"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
date: "2026-07-12"
author: "Codex — consolidación SDD de arquitectura maestra"
branch: "docs/f1-event-backbone-spec"
spec_index: "docs/SPEC_INDEX.md"
privacyCritical: true
auditLog: true
sse: false
fsmTransicion: "N/A — lifecycle técnico de entrega"
paymentGovernance: false
related_files:
  - packages/schemas/src/domain-events.schema.ts
  - packages/schemas/src/domain-events-v2.schema.ts
  - apps/api/src/modules/domain-events
  - apps/api/src/modules/domain-events/outbox.repository.ts
  - apps/api/src/modules/evidence/evidence.repository.ts
  - apps/api/src/modules/evidence/evidence.service.ts
  - apps/api/src/infrastructure/queue
  - apps/worker/src/main.mjs
  - packages/db/prisma/schema.prisma
  - packages/db/prisma/migrations/20260712000000_f1_event_backbone
  - packages/shared/src/index.ts
related_tests:
  - apps/api/test/event-backbone-contract.test.ts
  - apps/api/test/event-backbone-prisma-contract.test.ts
  - apps/api/test/evidence-outbox-producer.test.ts
  - apps/api/test/evidence-outbox-integration.test.ts
related_endpoints:
  - v1/domain-events
related_events:
  - evidence.uploaded
  - milestone.submitted
related_agents:
  - evidence-coach
last_verified: "2026-07-12"
---

# Spec: F1 — Event Backbone transaccional

> Este spec convierte la dirección aprobada en la Arquitectura Maestra de
> SEMSE en un contrato implementable. No autoriza un big bang ni activa
> liberaciones monetarias automáticas.

## 1. Qué resuelve

**Para quién:** plataforma, equipos de dominio y operadores de Mission Control.

**Problema:** hoy un cambio de dominio puede confirmarse en PostgreSQL y perder
su evento porque `AuditLog`, notificaciones y AgentRuns ocurren después, en
operaciones separadas. Los retries viven parcialmente en memoria o Redis y no
existe una fuente durable común para replay, DLQ e idempotencia por consumidor.

**Solución:** persistir el estado de dominio y un evento canónico en una misma
transacción; despachar la outbox a BullMQ; procesar cada consumidor con
idempotencia persistente; y exponer estados de entrega, fallos y replay a Ops.

## 2. Estado actual auditado

### Capacidades que se conservan

- `packages/schemas/src/domain-events.schema.ts` define 36 eventos v1 con Zod.
- `DomainEventBus` valida eventos, agrega `AuditLog`, crea notificaciones
  best-effort y enruta AgentRuns.
- `AgentRun` ya tiene `correlationId`, attempts, dead-letter e idempotencia
  persistente para creación de runs.
- BullMQ y Redis ya ejecutan agent runs y developer runtime.
- `/v1/domain-events` ya permite catálogo manual, lista y trace con RBAC.
- Communications persiste `OutboundDelivery`, pero no es outbox transversal.

### Brechas que este spec cierra

- el write de dominio y el evento no son atómicos;
- el envelope v1 no tiene `eventId`, `orgId`, causation, schemaRef ni trace
  context completos;
- los nombres no versionan el contrato del payload;
- notificaciones y routing pueden perderse después del commit;
- no hay claim lease, dispatcher durable ni lag observable;
- no hay receipt idempotente por consumidor;
- no hay replay/DLQ persistente por evento;
- Evidence registra auditoría, pero no emite su evento canónico.

## 3. Decisiones bloqueadas

1. PostgreSQL + Prisma siguen siendo el system of record.
2. Se usa transactional outbox con polling; no se introduce Kafka, Debezium ni
   Temporal en F1.
3. BullMQ es transporte de ingreso, no fuente de verdad del evento.
4. La entrega es **at-least-once**; los consumidores deben ser idempotentes.
5. `jobId` de BullMQ ayuda a deduplicar, pero no reemplaza el receipt en DB.
6. No se realizan llamadas Redis, HTTP, LLM, storage ni providers dentro de la
   transacción de negocio.
7. El rollout es por productor/consumidor; el bus v1 permanece compatible
   mientras se migra cada dominio.
8. El primer slice es `evidence.uploaded.v1 -> evidence-readiness.v1`; no cambia
   lifecycle de Milestone ni toca Payment Governance.
9. Los payloads contienen referencias y metadatos mínimos; nunca blobs, tokens,
   signed URLs ni secretos.

## 4. Actores y permisos

| Actor               | Rol/identidad                        | Puede hacer                                           | No puede hacer                                           |
| ------------------- | ------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------- |
| Servicio de dominio | `PLATFORM` interno                   | escribir state + outbox mediante repository gobernado | emitir fuera de la transacción para productores migrados |
| Dispatcher          | identidad de plataforma              | claim, enqueue, ack/nack y renovar lease              | ejecutar reglas de negocio                               |
| Consumer worker     | identidad de plataforma              | procesar un consumer declarado y registrar receipt    | mutar otro bounded context sin adapter/policy            |
| Ops                 | `OPS_ADMIN` + `domain-events:read`   | consultar outbox, deliveries, lag y DLQ               | alterar payloads persistidos                             |
| Ops autorizado      | `OPS_ADMIN` + `domain-events:replay` | solicitar replay auditable de un fallo                | replay de un evento completado sin override separado     |
| Usuario normal      | cualquier rol de producto            | ninguno sobre outbox/replay                           | listar payloads o ejecutar replay                        |

Las rutas internas de procesamiento requieren identidad de servicio válida y
deny-by-default. `tenantId` limita datos, pero no autoriza por sí solo.

## 5. Envelope canónico v2

El contrato base es `SemseDomainEventV2`:

```ts
type SemseDomainEventV2<TPayload> = {
  eventId: string; // UUID estable, nunca se regenera en retry
  eventType: `${string}.${string}.v${number}`;
  version: number; // versión del payload; coincide con suffix
  envelopeVersion: 2;
  occurredAt: string; // instante del hecho de dominio
  recordedAt: string; // instante de persistencia en outbox
  tenantId: string;
  orgId: string;
  module: string; // evidence, buildops, payments, etc.
  entityType: string;
  entityId: string;
  actor: {
    type: "user" | "system" | "agent" | "webhook";
    id: string;
  };
  correlationId: string;
  causationId?: string;
  idempotencyKey: string;
  schemaRef: string;
  traceContext?: {
    traceparent: string;
    tracestate?: string;
  };
  payload: TPayload;
  metadata?: Record<string, unknown>;
};
```

### Invariantes del envelope

- `eventId` es globalmente único e inmutable.
- `idempotencyKey` es único por tenant y consecuencia de negocio.
- `occurredAt <= recordedAt`.
- `actor.id`, tenant, org y agregado no pueden quedar vacíos.
- `version` debe coincidir con `.vN` en `eventType`.
- `schemaRef` apunta al schema versionado exportado por `@semse/schemas`.
- `payload` se valida antes de insertar la outbox.
- un consumer no infiere tenant, actor o agregado desde texto libre del payload.

### Primer evento versionado

```ts
type EvidenceUploadedV1Payload = {
  evidenceId: string;
  projectId: string;
  jobId: string;
  milestoneId?: string;
  uploaderId: string;
  kind: "PHOTO" | "VIDEO" | "DOCUMENT";
  bucketKey: string;
  checksum?: string;
  capturedAt?: string;
  geo?: { lat: number; lng: number };
};
```

Nombre: `evidence.uploaded.v1`.

`bucketKey` es una referencia tenant-scoped. El evento nunca contiene el
archivo, una URL pública o credenciales de storage.

Para este productor:

- `idempotencyKey = evidence.uploaded.v1:${evidenceId}`;
- `entityType = Evidence` y `entityId = evidenceId`;
- `correlationId` proviene del contexto de request/workflow y se conserva en
  todos los retries;
- `causationId` se usa solo si otro evento originó el comando.

## 6. Compatibilidad con eventos v1

- `SemseEvent` v1 no se elimina ni cambia de forma incompatible en F1.
- El código nuevo exporta `SemseDomainEventV2` junto al contrato existente.
- Un adapter explícito puede proyectar `evidence.uploaded.v1` a
  `evidence.uploaded` para consumers legacy que todavía lo requieran.
- El adapter conserva `correlationId`, actor, tenant y timestamp; no inventa
  datos ausentes.
- Un productor migrado escribe una sola outbox. No hace dual-write v1 + v2.
- Cada migración de evento debe registrar productor, consumidores v1, adapter y
  fecha de retiro.

## 7. Persistencia objetivo

### `DomainOutboxEvent`

Campos mínimos:

```text
eventId (PK UUID)
eventType, version, envelopeVersion
tenantId, orgId, module
entityType, entityId
actorType, actorId
correlationId, causationId
idempotencyKey
schemaRef
payloadJson, metadataJson, traceContextJson
occurredAt, recordedAt
status
attempts, maxAttempts, nextAttemptAt
lockedAt, lockExpiresAt, lockedBy
publishedAt, lastError
replayCount
```

Constraints e índices:

- unique `(tenantId, idempotencyKey)`;
- index `(status, nextAttemptAt, recordedAt)`;
- index `(tenantId, correlationId, recordedAt)`;
- index `(entityType, entityId, occurredAt)`;
- payload/envelope inmutables después del insert; solo cambia delivery state.

### `DomainEventConsumption`

Campos mínimos:

```text
eventId, consumerName (unique compuesto)
tenantId
status
attempts, maxAttempts
startedAt, completedAt, nextAttemptAt
lastError
resultJson
replayCount
```

El receipt `COMPLETED` se confirma en la misma transacción que el efecto DB del
consumer. Un duplicado devuelve el resultado persistido sin repetir el efecto.

### Estados de outbox

```text
PENDING -> CLAIMED -> PUBLISHED
    |          |
    +-> FAILED <-+
          |
          +-> PENDING       retry con backoff
          +-> DEAD_LETTER   attempts agotados

DEAD_LETTER -> PENDING      replay autorizado y auditado
```

Una lease vencida en `CLAIMED` puede volver a `PENDING`. `PUBLISHED` describe
ingreso confirmado a BullMQ, no éxito de todos los consumidores.

## 8. Transacción del productor

Para un productor migrado:

```text
validate input + policy
  -> prisma.$transaction(tx =>
       domain write
       outbox insert con el mismo tx
     )
  -> commit
  -> respuesta HTTP
```

Reglas:

- repositories aceptan `Prisma.TransactionClient` explícito;
- el evento se construye con datos confirmados del agregado;
- si falla el insert de outbox, falla y revierte el write de dominio;
- si falla el write, no existe evento;
- no se espera al dispatcher para responder al usuario;
- no se llama `DomainEventBus.emit()` dentro de la transacción.

## 9. Dispatcher y BullMQ

El dispatcher vive inicialmente en `apps/api` para reutilizar Prisma y la
conexión BullMQ existente. Debe ser seguro con múltiples réplicas.

Algoritmo de claim:

1. transacción corta;
2. seleccionar batch ordenado por `recordedAt, eventId` con row lock y
   `SKIP LOCKED`;
3. marcar lease (`CLAIMED`, `lockedBy`, `lockExpiresAt`);
4. commit;
5. fuera de la transacción, agregar jobs a `semse-domain-events`;
6. ack `PUBLISHED` o nack `FAILED` con backoff.

Opciones mínimas de queue:

- `jobId` derivado de `eventId`, sin `:`;
- `attempts: 5`;
- exponential backoff con jitter;
- completed retention limitada;
- failed retention mayor que completed;
- payload del job: `eventId`, no copia completa del evento.

BullMQ puede entregar más de una vez por crash, replay o expiración. El receipt
DB, no Redis, determina si un consumer ya aplicó su efecto.

## 10. Primer slice vertical: Evidence Readiness

### Productor

`EvidenceRepository.create` se migra para insertar en la misma transacción:

1. fila `Evidence`;
2. fila `DomainOutboxEvent` `evidence.uploaded.v1`.

### Consumer `evidence-readiness.v1`

Si `milestoneId` existe:

1. carga el Milestone tenant-scoped y su evidence vigente;
2. compara `requiredEvidenceTypes` con tipos presentes;
3. calcula `missing | partial | complete`;
4. actualiza `Milestone.evidenceReadiness` solo si cambió;
5. inserta/termina el receipt en la misma transacción;
6. deja audit trail con eventId y causationId.

Si no hay `milestoneId`, el consumer completa como no-op explicado. No inventa
un milestone ni cambia `Project`.

### Límite de seguridad

`complete` en evidence readiness **no** ejecuta:

- `DRAFT/READY -> SUBMITTED`;
- aprobación humana;
- Payment Governance;
- release de fondos;
- cambio de Trust Score.

Es una proyección de preparación, no una autorización.

## 11. Contratos API

### `GET /v1/domain-events/outbox`

```yaml
auth: requerida
permissions: [domain-events:read]
privacyCritical: true
input: status?, eventType?, correlationId?, limit?, cursor?
output: items redacted, nextCursor, counts, oldestPendingAgeMs
errores: { 400: filtro inválido, 403: permiso insuficiente }
efectos:
  auditLog: false
  evento: none
  sse: false
  paymentGovernance: false
```

Solo devuelve eventos del tenant del actor. Payload se omite por defecto y solo
se expone con permiso sensible separado.

### `GET /v1/domain-events/:eventId/deliveries`

```yaml
auth: requerida
permissions: [domain-events:read]
privacyCritical: true
output: outbox state + consumers + attempts + errores redacted
errores: { 403: permiso insuficiente, 404: evento no existe en tenant }
```

### `POST /v1/domain-events/:eventId/replay`

```yaml
auth: requerida
permissions: [domain-events:replay]
roles: [OPS_ADMIN]
privacyCritical: true
input: { consumerName?: string, reason: string }
output: { eventId, replayCount, status, auditRef }
errores:
  400: reason vacío
  403: permiso/rol insuficiente
  404: evento no existe en tenant
  409: evento/consumer ya está PENDING, PROCESSING o COMPLETED
efectos:
  auditLog: true
  evento: ops.event_replay_requested.v1
  sse: false
  paymentGovernance: false
```

### Ruta interna de consumo

El worker usa una ruta interna autenticada o adapter equivalente para procesar
`eventId`. No acepta payload arbitrario del job. La ruta se documentará en
`SEMSE_API_SURFACE_V1.md` al implementarse y exige identidad de servicio y
`domain-events:consume`.

## 12. Escenarios de aceptación

### P1 — Atomicidad

```text
DADO un registro de Evidence válido
CUANDO se confirma el comando
ENTONCES Evidence y DomainOutboxEvent existen
  Y comparten tenant, agregado, correlation e idempotency
  Y si se induce fallo al insertar outbox, ninguna Evidence queda creada
```

### P1 — Redis no disponible

```text
DADO PostgreSQL disponible y Redis caído
CUANDO se registra Evidence
ENTONCES el comando confirma Evidence + PENDING outbox
  Y no afirma entrega
CUANDO Redis vuelve
ENTONCES el dispatcher publica el mismo eventId sin recrear Evidence
```

### P1 — Entrega duplicada

```text
DADO evidence.uploaded.v1 entregado dos veces al mismo consumer
CUANDO ambas ejecuciones compiten
ENTONCES existe un solo receipt COMPLETED
  Y Milestone.evidenceReadiness refleja un solo efecto lógico
```

### P1 — DLQ y replay

```text
DADO un consumer que falla maxAttempts veces
CUANDO agota retries
ENTONCES queda DEAD_LETTER con error redacted y métrica
CUANDO OPS autorizado solicita replay con motivo
ENTONCES se registra auditoría, incrementa replayCount y vuelve a PENDING
```

### P2 — Trazabilidad

```text
DADO un correlationId
CUANDO Ops consulta el trace
ENTONCES ve evento, outbox state, queue attempt, consumers y audit timeline
  SIN datos de otro tenant
```

## 13. Tests requeridos antes de implementación

- contract Zod del envelope v2 y `evidence.uploaded.v1`;
- rechazo de suffix/version inconsistente;
- rollback state+outbox ante fallo inducido;
- unique `(tenantId, idempotencyKey)` bajo concurrencia;
- claim concurrente: dos dispatchers no reclaman el mismo eventId;
- lease vencida vuelve a ser elegible;
- enqueue usa jobId determinístico;
- Redis caído conserva PENDING/FAILED durable;
- consumer aplica efecto + receipt atómicamente;
- duplicate delivery no repite efecto;
- retry llega a DEAD_LETTER;
- replay exige rol, permiso, tenant y reason;
- replay de COMPLETED responde 409;
- trace no cruza tenants y redacta payload sensible;
- compat adapter v2 -> v1 conserva campos obligatorios;
- Evidence sin milestone produce no-op idempotente;
- evidence readiness no cambia lifecycle ni payments.

## 14. SLO y métricas

| Métrica                            | Objetivo F1  |
| ---------------------------------- | ------------ |
| write de dominio + outbox p95      | < 500 ms     |
| outbox publish lag p95             | < 2 s        |
| eventos PENDING > 60 s             | 0 sostenidos |
| pérdida state/event en fault tests | 0            |
| duplicate logical effects          | 0            |
| DLQ sin owner > 15 min             | 0            |
| replay audit coverage              | 100%         |

Métricas mínimas:

- `semse_outbox_pending_total`;
- `semse_outbox_oldest_pending_age_seconds`;
- `semse_outbox_publish_lag_seconds`;
- `semse_event_consumer_attempts_total`;
- `semse_event_consumer_duplicates_total`;
- `semse_event_dlq_total`;
- `semse_event_replays_total`.

Logs incluyen `eventId`, `eventType`, tenant redacted/hashed cuando aplique,
correlationId, consumerName, attempt y traceparent.

## 15. Migración, rollout y rollback

### Rollout

1. migración aditiva de enums/tablas/índices;
2. schemas y repositories sin productores activos;
3. dispatcher deshabilitado por kill switch;
4. consumer Evidence en shadow/read-only;
5. activar productor Evidence + outbox;
6. activar dispatcher y consumer en canary;
7. verificar lag, duplicate/no-op y rollback tests;
8. ampliar solo después del reporte F1.

### Kill switches

- `SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED`;
- `SEMSE_EVENT_CONSUMERS_ENABLED`;
- allowlist de eventType/consumer.

### Rollback

- apagar dispatcher/consumers;
- conservar filas outbox y receipts para diagnóstico/replay;
- volver Evidence al flujo previo sin borrar tablas;
- no ejecutar down migration destructiva en incidente;
- reactivar después de corregir y revalidar el mismo eventId.

## 16. Seguridad, privacidad y retención

- payload minimization y allowlist por evento;
- sin PII innecesaria, blobs, prompts, tokens, headers auth o signed URLs;
- lectura tenant-scoped y permiso sensible para payload;
- errores almacenados redacted, sin stack/provider secret;
- replay y overrides siempre auditados con actor y motivo;
- retención de eventos alineada con evidencia/proyecto y política legal;
- purge solo después de `PUBLISHED` + consumers terminales + ventana de replay;
- eventos financieros futuros requerirán Payment Governance explícito.

## 17. No objetivos F1

- Kafka/Debezium/Temporal;
- event sourcing del estado completo;
- ledger double-entry;
- migración de los 36 eventos v1;
- UI completa de Mission Control;
- auto-approval de Evidence o Milestone;
- liberación de pagos;
- webhooks salientes SAT-007;
- exactly-once distribuido.

## 18. Dependencias y documentos

- `docs/architecture/CURRENT_ARCHITECTURE.md`;
- `docs/foundation/EVENT_CATALOG.md`;
- `docs/foundation/STATE_MACHINES.md`;
- `docs/foundation/DOMAIN_INVARIANTS.md`;
- `docs/specs/api/evidence.spec.md`;
- `docs/architecture/ADR-022-transactional-outbox-bullmq.md`;
- plan: `docs/specs/platform/event-backbone.plan.md`;
- tasks: `docs/specs/platform/event-backbone.tasks.md`.

## Checklist de aprobación

- [x] Problema, bounded context y compatibilidad v1 definidos.
- [x] Envelope versionado y payload inicial definidos.
- [x] Atomicidad, dispatcher, retries, idempotencia, DLQ y replay definidos.
- [x] Tenant/RBAC/privacy y audit definidos.
- [x] Payment Governance excluido explícitamente del slice.
- [x] Tests y SLO definidos.
- [x] Migración, rollout, kill switch y rollback definidos.
- [x] Arquitectura registrada en ADR-022.
- [x] Aprobación de dirección proviene de la Arquitectura Maestra consolidada
      entregada el 2026-07-12; cualquier cambio de alcance exige revisión del spec.
