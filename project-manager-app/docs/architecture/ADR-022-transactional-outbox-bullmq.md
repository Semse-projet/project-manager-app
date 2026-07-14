# ADR-022 — Transactional Outbox PostgreSQL con ingreso BullMQ

**Estado:** ACCEPTED
**Fecha:** 2026-07-12
**Decisión de producto/arquitectura:** Arquitectura Maestra Consolidada de SEMSE
**Spec:** [`../specs/platform/event-backbone.spec.md`](../specs/platform/event-backbone.spec.md)

## Contexto

SEMSE ya tiene eventos Zod v1, `AuditLog`, routing a AgentRuns,
notificaciones, Redis y BullMQ. Sin embargo, el write de dominio se confirma
antes de emitir el evento, por lo que una caída entre ambas operaciones puede
dejar estado sin consecuencia operativa. Redis tampoco debe ser la fuente
durable para replay o deduplicación de efectos.

F1 necesita una columna vertebral confiable sin introducir una plataforma de
streaming ni un orquestador nuevo antes de demostrar esa necesidad.

## Decisión

SEMSE adoptará:

1. una tabla outbox en el mismo PostgreSQL de cada write de dominio;
2. state + outbox en una transacción Prisma corta;
3. polling dispatcher concurrente con leases y `FOR UPDATE SKIP LOCKED`;
4. BullMQ como transporte de ingreso at-least-once;
5. receipts de consumo persistentes y únicos por `(eventId, consumerName)`;
6. efecto DB + receipt `COMPLETED` en una misma transacción;
7. retries, dead letter y replay auditado;
8. migración gradual desde `SemseEvent` v1 al envelope v2 versionado.

El dispatcher vivirá inicialmente dentro de `apps/api` para reutilizar Prisma
y el cliente BullMQ actuales. Los jobs se ejecutan en `apps/worker`, que llama
una ruta interna autenticada usando `eventId`; Redis no transporta el payload
canónico completo.

## Razones

- evita el dual-write DB/broker;
- reutiliza infraestructura ya operada por SEMSE;
- mantiene la base transaccional como fuente de verdad;
- permite múltiples dispatchers sin coordinación global;
- hace visibles lag, fallos, DLQ y replay;
- acota F1 a un slice vertical antes de ampliar dominios.

## Consecuencias positivas

- un commit de dominio no puede existir sin su fila outbox en productores
  migrados;
- una caída de Redis no pierde el hecho de dominio;
- los duplicados no repiten efectos lógicos si el consumer cumple el receipt;
- Mission Control puede explicar dónde se detuvo un evento;
- se preserva compatibilidad con consumers v1 mediante adapters explícitos.

## Costos y riesgos

- aumenta schema, índices y operación de tablas técnicas;
- la entrega sigue siendo at-least-once, no exactly-once distribuido;
- claims y leases mal implementados pueden crear starvation o duplicados;
- un consumer con red/provider no puede envolver todo su efecto en una
  transacción DB y necesita su propia idempotencia/compensación;
- retención y purge deben evitar crecimiento ilimitado.

## Alternativas consideradas

### Emitir directamente después del commit

Rechazada: es el comportamiento actual y mantiene la ventana de pérdida.

### Usar solo BullMQ con `jobId` único

Rechazada: Redis no comparte transacción con PostgreSQL; además, un job
eliminado deja de participar en deduplicación. `jobId` es defensa adicional,
no receipt durable.

### Debezium + Kafka

Pospuesta: ofrece CDC y replay a mayor escala, pero añade operación y gobierno
innecesarios para el volumen y topología actuales. La tabla se diseña para una
evolución futura sin comprometer F1.

### Temporal

Rechazada para F1: resuelve workflows durables largos, no el dual-write
fundamental entre estado de dominio y publicación.

### `pg_notify`

Rechazada como fuente de entrega: puede servir como wake-up hint futuro, pero
no sustituye la fila durable ni el polling de recuperación.

## Reglas de implementación

- no network I/O dentro de `$transaction`;
- batch y lease pequeños;
- orden determinístico `recordedAt, eventId`;
- `SKIP LOCKED` se usa solo sobre la tabla queue-like;
- el payload se valida antes del insert;
- `eventId` e idempotency key no cambian en retry;
- replay no edita el envelope original;
- payloads financieros requieren revisión de Payment Governance;
- toda acción Ops de replay deja AuditLog.

## Validación de la decisión

El ADR se considera demostrado cuando el slice Evidence prueba:

- rollback state+outbox;
- recuperación después de caída Redis;
- dos dispatchers sin doble claim;
- duplicate delivery sin doble efecto;
- DLQ y replay auditado;
- CI, Railway y Production Health Gate verdes.

## Fuentes externas consultadas

- [Prisma — Transactions and batch queries](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [PostgreSQL — SELECT locking clauses](https://www.postgresql.org/docs/current/sql-select.html)
- [BullMQ — Idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs)
- [BullMQ — Job IDs](https://docs.bullmq.io/guide/jobs/job-ids)
- [Debezium — Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html)

