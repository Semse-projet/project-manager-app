# F1-C — Dispatcher durable de outbox e ingreso BullMQ

**Fecha:** 2026-07-13
**Rama:** `feat/f1c-outbox-dispatcher`
**Base:** `origin/main@af94698`
**Scope:** T-014 y T-040–T-046; sin worker, consumers, receipts ni replay

## Resultado

La outbox F1 ya puede reclamar filas de PostgreSQL con múltiples réplicas,
publicar un job mínimo y determinístico en BullMQ, y confirmar o reintentar la
entrega sin perder el estado durable.

- `SEMSE_DOMAIN_EVENT_QUEUE` fija la cola `semse-domain-events`;
- el job contiene únicamente `eventId` y usa `event-<eventId>` sin `:`;
- los claims usan una transacción corta, orden estable y
  `FOR UPDATE SKIP LOCKED`;
- cada claim crea una lease con owner/expiración e incrementa el intento;
- una lease vencida vuelve a ser elegible para otra réplica;
- el ACK cambia `CLAIMED -> PUBLISHED` y limpia la lease;
- un fallo cambia `CLAIMED -> FAILED`, aplica backoff exponencial y conserva un
  error redactado;
- el intento final cambia a `DEAD_LETTER`;
- Prometheus expone backlog, edad más antigua, último publish lag y DLQ;
- el scheduler evita batches solapados dentro de una réplica;
- `SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED` permanece `false` por defecto.

F1-D continúa ausente. Por seguridad, Railway debe conservar el switch apagado:
activar F1-C antes de desplegar el worker marcaría eventos como `PUBLISHED` y
los dejaría esperando en Redis sin consumer.

## Ciclo TDD

### Rojo

`event-outbox-dispatcher.test.ts` falló primero con `ERR_MODULE_NOT_FOUND`
porque todavía no existían el queue service ni el dispatcher.

### Verde

- 5/5 tests unitarios F1-C:
  - jobId, retries y retención;
  - ACK del mismo owner de lease;
  - NACK durable con error redactado;
  - kill switch apagado por defecto;
  - métricas Prometheus;
- 5/5 tests sobre PostgreSQL 16 real:
  - dos dispatchers reclaman ocho filas sin intersección;
  - reclaim de lease vencida;
  - Redis caído deja `FAILED` y `nextAttemptAt` futuro;
  - ACK real deja `PUBLISHED` y limpia locks;
  - quinto intento deja `DEAD_LETTER`;
- 1/1 test sobre Redis 7 + BullMQ real:
  - dos enqueues del mismo evento conservan un job con ID determinístico.

## Validación adicional

- build de `@semse/shared`: PASS;
- build de `@semse/api`: PASS;
- contratos F1-A, producer F1-B y dispatcher F1-C: 22/22 PASS;
- suite unitaria completa de API: PASS;
- `pnpm verify:workspace` / Railway preflight: PASS;
- ESLint global de `@semse/api`: PASS;
- smoke de API compilada contra PostgreSQL/Redis locales: health 200 y métricas
  F1-C expuestas con el dispatcher apagado;
- `pnpm spec:validate:strict`: 64 specs, 0 errores, 0 warnings;
- `pnpm spec:coverage`: 59/64 specs con tests (92%), 45/64 VERIFIED (70%);
- migraciones locales: 59 encontradas, 0 pendientes;
- `git diff --check`: PASS.

Los tests de integración utilizan PostgreSQL 16 y Redis 7 locales de Docker;
no se consultaron credenciales ni datos de producción.

## Investigación externa de mejora

### Búsquedas ejecutadas

1. Claims concurrentes sobre tablas queue-like —
   [PostgreSQL SELECT / locking clauses](https://www.postgresql.org/docs/current/sql-select.html).
2. Deduplicación, retry y retención —
   [BullMQ job IDs](https://docs.bullmq.io/guide/jobs/job-ids),
   [retry/backoff](https://docs.bullmq.io/guide/retrying-failing-jobs) y
   [auto-removal](https://docs.bullmq.io/guide/queues/auto-removal-of-jobs).
3. Inicio y cierre del scheduler —
   [NestJS lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events).

### Aplicado ahora

- `SKIP LOCKED` solo sobre la tabla queue-like y con orden determinístico;
- custom job ID sin separador `:`;
- cinco intentos BullMQ, backoff exponencial con jitter y retención acotada;
- lifecycle provider que no bloquea bootstrap;
- conexión Redis lazy/fail-fast y error durable en PostgreSQL;
- leases protegidas por `dispatcherId` para impedir ACK/NACK de otro owner.

### Backlog

- F1-D: worker, ruta interna, receipts y `evidence-readiness.v1`;
- F1-E: APIs Ops, replay auditado y redacción tenant-scoped;
- histograma de publish lag y alertas SLO en Mission Control;
- política de purge posterior a consumers terminales;
- habilitación canary solo después de desplegar F1-D.

### Descartado

- Redis como fuente de verdad;
- mantener la transacción abierta durante `queue.add`;
- confiar en `jobId` como garantía exactly-once;
- activar el dispatcher por defecto;
- introducir Kafka, Debezium, Temporal o `@nestjs/schedule` en este corte.

## Próximo corte

F1-D comienza por T-015 y T-050–T-058: worker `semse-domain-events`, ruta
interna por `eventId`, receipt idempotente y proyección
`evidence-readiness.v1`, sin cambiar lifecycle de Milestone ni Payments.
