# F1 — Event Backbone: corte SDD previo a implementación

**Fecha:** 2026-07-12
**Rama:** `docs/f1-event-backbone-spec`
**Base:** `origin/main@bd0d98cd3c6815c5f0a0867852c4dbf7c1169e48`
**Estado:** spec/ADR/plan aprobados; tasks pendientes; sin cambios Prisma/runtime

## Objetivo

Transformar F1 del roadmap en un contrato ejecutable antes de tocar datos,
colas o producción, respetando Constitution y SDD Governance.

## Auditoría interna

Se verificó:

- `SemseEvent` v1 contiene 36 eventos Zod con metadata y triggers;
- `DomainEventBus` agrega AuditLog, notificaciones best-effort y AgentRuns;
- Jobs, Milestones, Disputes, Ratings y Users tienen productores parciales;
- Evidence registra estado y AuditLog, pero no emite evento canónico;
- el write de dominio, AuditLog y routing no comparten transacción;
- AgentRuns sí tienen idempotencia persistente y dead-letter parcial;
- BullMQ opera agent runs y developer runtime;
- Communications persiste deliveries, pero no es outbox general;
- Prisma no contiene `DomainOutboxEvent` ni receipts por consumer;
- `apps/worker` usa la API como frontera y no depende directamente de Prisma.

## Artefactos creados

- `docs/specs/platform/event-backbone.spec.md`;
- `docs/specs/platform/event-backbone.plan.md`;
- `docs/specs/platform/event-backbone.tasks.md`;
- `docs/architecture/ADR-022-transactional-outbox-bullmq.md`.

El primer slice queda acotado a:

```text
Evidence write + outbox
  -> BullMQ ingress
  -> evidence-readiness.v1 consumer
  -> Milestone.evidenceReadiness projection
```

No cambia Milestone.status, no aprueba evidencia y no toca pagos.

## Investigación externa de mejora

### Búsquedas ejecutadas

1. Transacciones Prisma, isolation y retry de conflictos —
   [Prisma Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
2. Claims concurrentes con row locks y `SKIP LOCKED` —
   [PostgreSQL SELECT](https://www.postgresql.org/docs/current/sql-select.html) y
   [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html).
3. Idempotencia, job IDs y deduplicación BullMQ —
   [Idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs),
   [Job IDs](https://docs.bullmq.io/guide/jobs/job-ids) y
   [Deduplication](https://docs.bullmq.io/guide/jobs/deduplication).
4. Outbox y evolución CDC —
   [Debezium Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html).

### Ideas detectadas

- Las transacciones deben ser cortas; network I/O dentro de una interactive
  transaction aumenta riesgo de deadlock y timeout.
- `SKIP LOCKED` es apropiado para una tabla queue-like con varios consumers,
  pero no para lecturas generales porque produce una vista inconsistente.
- BullMQ recomienda jobs simples e idempotentes; `jobId` único deduplica solo
  mientras el job retenido existe.
- El event ID debe ser estable para detectar duplicados downstream.
- Debezium ofrece una evolución posterior por CDC sin cambiar el principio de
  state + outbox atómicos.

### Decisiones

**Aplicado ahora en spec/plan:**

- state + outbox en un `$transaction` sin Redis/HTTP dentro;
- polling en batches pequeños con lease + `FOR UPDATE SKIP LOCKED`;
- job data por `eventId`, no payload completo;
- receipt DB por consumer y efecto+receipt atómicos;
- queue jobId como defensa adicional, no garantía única;
- payload minimization, redaction, DLQ/replay y métricas desde F1.

**Backlog:**

- Debezium/Kafka cuando replay multi-subscriber, throughput u operación de
  streams lo justifiquen;
- UI completa de Mission Control en F4;
- consumers con providers externos y compensación por dominio;
- retención/purge automatizados después de medir el canary.

**Descartado en F1:**

- Temporal: no resuelve el dual-write básico;
- Kafka/Debezium inmediato: añade operación antes de demostrar volumen;
- exactly-once distribuido: promesa incorrecta para DB + Redis + providers;
- usar solo BullMQ jobId: insuficiente tras auto-removal o replay.

## Decisiones de seguridad

- outbox/list/replay requieren permisos separados;
- replay requiere `OPS_ADMIN`, reason, tenant match y AuditLog;
- payload oculto por defecto en listados;
- eventos llevan referencias, no archivos/URLs firmadas/tokens;
- no se habilitan eventos financieros en el primer slice.

## Validaciones esperadas de este PR documental

- `pnpm spec:index` idempotente;
- `pnpm spec:validate:strict` sin errores/warnings;
- `pnpm spec:coverage` verde;
- enlaces relativos de artefactos nuevos válidos;
- `git diff --check` verde.

## Gate de implementación

La implementación solo puede comenzar desde `feat/f1-event-backbone`, siguiendo
`event-backbone.tasks.md` en orden y escribiendo primero los tests T-010–T-017.
Un cambio de alcance (payments, auto-approval, Kafka, Temporal o migración
masiva v1) exige actualizar spec/ADR antes de código.

