---
type: plan
feature: "F1 — Event Backbone transaccional"
domain: "platform"
spec: "docs/specs/platform/event-backbone.spec.md"
version: "1.0"
status: "APPROVED"
branch: "feat/f1-event-backbone"
date: "2026-07-12"
---

# Plan técnico: F1 — Event Backbone transaccional

## 1. Resumen técnico

**Spec:** [`event-backbone.spec.md`](event-backbone.spec.md)

**Estrategia:** introducir contratos v2 y persistencia aditiva; probar atomicidad
en Evidence; añadir dispatcher API -> BullMQ -> worker -> consumer API; cerrar
con idempotencia DB, DLQ/replay y observabilidad. El bus v1 permanece activo
para productores no migrados.

**Complejidad:** alta.

**Riesgo principal:** confundir enqueue único con efecto exactly-once, o dejar
una ventana de pérdida/duplicado entre claim, BullMQ y consumer.

## 2. Constitution check

- [x] Spec APPROVED antes del plan.
- [x] Evidence-first: el slice solo proyecta readiness y no aprueba hitos.
- [x] AuditLog: replay y efectos del consumer dejan trazabilidad.
- [x] Privacy: payload mínimo; sin blobs, secretos ni signed URLs.
- [x] Tests antes del código definidos en T-002.
- [x] Multi-tenant: outbox, queries y receipts incluyen tenant.
- [x] Payment Governance: fuera de alcance; no se liberan fondos.

## 3. Stack afectado

```yaml
backend:
  framework: NestJS + Fastify
  modules:
    - apps/api/src/modules/domain-events
    - apps/api/src/modules/evidence
  schemas:
    - packages/schemas/src/domain-events.schema.ts
    - packages/schemas/src/domain-events-v2.schema.ts
  prisma_changes: true

workers:
  bullmq_jobs: true
  queue: semse-domain-events
  files:
    - apps/worker/src/main.mjs
    - apps/worker/src/domain-event-handlers.mjs

shared:
  files:
    - packages/shared/src/index.ts

frontend:
  changes: none

infrastructure:
  new_service: false
  new_provider: false
  new_env:
    - SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED
    - SEMSE_EVENT_CONSUMERS_ENABLED
```

## 4. Cambios de base de datos

Migración aditiva propuesta:

```prisma
enum DomainOutboxStatus {
  PENDING
  CLAIMED
  PUBLISHED
  FAILED
  DEAD_LETTER
}

enum DomainConsumptionStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  DEAD_LETTER
}

model DomainOutboxEvent {
  eventId          String             @id @default(uuid())
  eventType        String
  version          Int
  envelopeVersion  Int                @default(2)
  tenantId         String
  orgId            String
  module            String
  entityType       String
  entityId         String
  actorType        String
  actorId          String
  correlationId    String
  causationId      String?
  idempotencyKey   String
  schemaRef         String
  payloadJson       Json
  metadataJson      Json?
  traceContextJson  Json?
  occurredAt        DateTime
  recordedAt        DateTime           @default(now())
  status            DomainOutboxStatus @default(PENDING)
  attempts          Int                @default(0)
  maxAttempts       Int                @default(5)
  nextAttemptAt     DateTime            @default(now())
  lockedAt          DateTime?
  lockExpiresAt     DateTime?
  lockedBy          String?
  publishedAt       DateTime?
  lastError         String?
  replayCount       Int                 @default(0)
  consumptions      DomainEventConsumption[]

  @@unique([tenantId, idempotencyKey])
  @@index([status, nextAttemptAt, recordedAt])
  @@index([tenantId, correlationId, recordedAt])
  @@index([entityType, entityId, occurredAt])
}

model DomainEventConsumption {
  id             String                  @id @default(cuid())
  eventId         String
  tenantId        String
  consumerName    String
  status          DomainConsumptionStatus @default(PENDING)
  attempts        Int                     @default(0)
  maxAttempts     Int                     @default(5)
  startedAt       DateTime?
  completedAt     DateTime?
  nextAttemptAt   DateTime                @default(now())
  lastError       String?
  resultJson      Json?
  replayCount     Int                     @default(0)
  event           DomainOutboxEvent       @relation(fields: [eventId], references: [eventId], onDelete: Cascade)

  @@unique([eventId, consumerName])
  @@index([tenantId, status, nextAttemptAt])
}
```

Antes de implementar se validarán nombres contra Prisma format y convenciones
del schema real. No se elimina ni modifica `AuditLog` o `AgentRun`.

### Migración y rollback

- crear migración versionada `*_f1_event_backbone`;
- aplicar con `prisma migrate deploy` desde pipeline existente;
- rollout con kill switches apagados;
- rollback operacional: apagar switches y conservar tablas;
- no crear down migration destructiva durante incidente;
- purge/retención se implementa solo después del canary.

## 5. Módulos y responsabilidades

### Schemas

`packages/schemas/src/domain-events-v2.schema.ts`

- envelope v2 base;
- actor, trace context y event type versionado;
- `evidence.uploaded.v1`;
- helpers de suffix/version y schemaRef;
- adapter v2 -> v1 limitado a eventos migrados.

### API: domain-events

Archivos nuevos:

```text
outbox.repository.ts
outbox.service.ts
outbox-dispatcher.service.ts
domain-event-consumer.service.ts
domain-event-queue.service.ts
domain-events.types.ts
```

Archivos modificados:

```text
domain-events.module.ts
domain-events.controller.ts
domain-events.service.ts
domain-events.repository.ts
```

Responsabilidades:

- repository: queries Prisma/raw SQL y transaction clients;
- outbox service: construir/validar filas y replay policy;
- dispatcher: scheduler, leases, ack/nack y métricas;
- queue service: conexión BullMQ y jobId estable;
- consumer service: receipt, dispatch por allowlist y efecto idempotente;
- controller: lectura/replay e internal consume con RBAC explícito.

### API: Evidence

`EvidenceRepository.create` recibirá un transaction client opcional o moverá la
unidad atómica a un método específico `createWithOutbox`. `EvidenceService` no
llama red/Redis dentro de esa transacción.

### Worker

- agregar `SEMSE_DOMAIN_EVENT_QUEUE` en shared;
- registrar `Worker` con concurrency inicial 2;
- job data contiene solo `eventId` y replay generation;
- handler llama la ruta interna con auth de servicio;
- error HTTP retryable lanza; 4xx terminal se clasifica explícitamente;
- shutdown cierra el worker nuevo.

## 6. Claim y concurrencia

El claim se implementará con SQL parametrizado dentro de `$transaction`:

```sql
SELECT "eventId"
FROM "DomainOutboxEvent"
WHERE (
  "status" IN ('PENDING', 'FAILED')
  AND "nextAttemptAt" <= now()
) OR (
  "status" = 'CLAIMED'
  AND "lockExpiresAt" < now()
)
ORDER BY "recordedAt", "eventId"
FOR UPDATE SKIP LOCKED
LIMIT $batch;
```

Luego actualiza solo los ids reclamados con lease. No se mantiene la
transacción abierta durante `queue.add`.

## 7. Consumer Evidence Readiness

Transacción del consumer:

1. cargar outbox por eventId y validar schema;
2. crear/claim receipt único `evidence-readiness.v1`;
3. si `COMPLETED`, devolver duplicate/no-op;
4. si hay milestone, cargar evidence tenant-scoped y required types;
5. calcular estado determinístico;
6. actualizar `Milestone.evidenceReadiness` si cambió;
7. agregar AuditLog con eventId/correlation;
8. marcar receipt `COMPLETED` en el mismo tx.

La transacción no llama Vision, Notifications, storage ni agents.

## 8. Contratos API previstos

- `GET /v1/domain-events/outbox`;
- `GET /v1/domain-events/:eventId/deliveries`;
- `POST /v1/domain-events/:eventId/replay`;
- `POST /v1/domain-events/:eventId/process` interno.

Se añadirán a `SEMSE_API_SURFACE_V1.md` solo con la implementación y tests.

## 9. Observabilidad

- métricas definidas en el spec;
- logs estructurados con event/correlation/consumer/attempt;
- readiness no debe fallar por backlog corto, pero reporta degradación;
- backlog/oldest age y DLQ se integran a Ops en F1 API; UI completa queda F4;
- no loggear payload completo por defecto.

## 10. Fases

### F1-A — Contratos y pruebas rojas

- schemas v2 y tests de contrato;
- tests de atomicidad, claim, idempotencia, DLQ y replay;
- migration draft validada con `prisma migrate diff`.

### F1-B — Persistencia

- migración aditiva;
- repositories outbox/consumption;
- producer Evidence state+outbox;
- fault tests de rollback.

### F1-C — Dispatcher e ingreso

- queue constant/client;
- claim lease concurrente;
- enqueue ack/nack/backoff;
- métricas de lag.

### F1-D — Consumer y worker

- worker queue handler;
- internal process route;
- Evidence Readiness idempotente;
- retries y dead letter.

### F1-E — Ops y replay

- list/delivery APIs;
- replay policy + audit;
- tenant/RBAC/redaction tests;
- trace extendido.

### F1-F — Canary y cierre

- switches OFF en deploy inicial;
- shadow/canary Evidence;
- fault injection Redis/API;
- Railway health y reporte;
- promover spec a IMPLEMENTED/VERIFIED solo según evidencia.

## 11. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| doble efecto tras crash | media | alto | receipt + efecto en mismo tx |
| outbox bloqueada por lease huérfana | media | alto | TTL y reclaim test |
| índice caliente/tabla creciente | media | medio | batch pequeño, índices, retención posterior |
| payload con PII/secreto | media | crítico | schemas allowlist y redaction tests |
| producer hace dual-write v1/v2 | media | alto | adapter downstream; una sola outbox |
| retry de error terminal | media | medio | clasificación 4xx/retryable |
| consumer cambia pagos accidentalmente | baja | crítico | scope test y ausencia de Payment services |

## 12. Gate antes de tasks/implementación

- [x] Spec aprobado y ADR aceptado.
- [x] Schema/migración conceptual identificados.
- [x] Ownership de API, dispatcher y worker definido.
- [x] Tests preceden código.
- [x] Rollout/rollback/kill switches definidos.
- [x] No se introduce infraestructura externa nueva.

