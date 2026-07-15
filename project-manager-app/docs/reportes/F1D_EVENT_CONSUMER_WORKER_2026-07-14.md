# F1-D — Worker y consumer idempotente de eventos

**Fecha:** 2026-07-14
**Rama:** `agent/f1d-event-consumers`
**Base:** `origin/main@9d1580ba5604e250f3b8fe58ffd535f9d5baaa0f`
**Scope:** T-015, T-017 y T-050–T-058; sin replay Ops, lifecycle de pagos ni despliegue canary

## Resultado

El slice Evidence del Event Backbone ya consume desde la cola canónica
`semse-domain-events` y proyecta `Milestone.evidenceReadiness` con entrega
at-least-once e efecto lógico idempotente.

- el job Redis contiene exclusivamente `eventId`;
- el worker usa concurrencia 2, listener de error y `await worker.close()`;
- la ruta interna `POST /v1/domain-events/:eventId/process` exige permiso
  `domain-events:consume` y rol técnico `EVENT_CONSUMER`; el rol humano
  `WORKER` no recibe ese permiso;
- API reconstruye y valida `evidence.uploaded.v1` desde PostgreSQL, no desde el
  payload de Redis ni desde tenant headers del job;
- consumer y event type usan allowlists deny-by-default;
- el receipt único `(eventId, consumerName)` serializa duplicados;
- efecto, AuditLog y receipt `COMPLETED` confirman en la misma transacción;
- un duplicado devuelve `resultJson` sin repetir efecto;
- Evidence sin milestone produce un no-op durable y auditado;
- el efecto actualiza solo `evidenceReadiness`; no cambia `Milestone.status`,
  `paymentReadiness` ni tablas Payments;
- fallos reintentables persisten `FAILED` con backoff; el quinto intento queda
  `DEAD_LETTER`; errores HTTP terminales usan `UnrecoverableError` en BullMQ;
- Prometheus expone attempts, duplicates y dead letters por consumer.

No se añadió migración: F1-A ya había creado `DomainEventConsumption` y los
campos de readiness usados por este corte.

## Kill switches y rollout

Los valores seguros siguen siendo:

```text
SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED=false
SEMSE_EVENT_CONSUMERS_ENABLED=false
SEMSE_EVENT_CONSUMER_ALLOWLIST=
SEMSE_EVENT_TYPE_ALLOWLIST=
```

Este PR no modifica variables Railway. Un canary futuro debe desplegar API y
worker compatibles, configurar las dos allowlists solo para
`evidence-readiness.v1` / `evidence.uploaded.v1`, habilitar primero consumers y
después dispatcher, asignar `EVENT_CONSUMER` solo a la identidad del servicio y
conservar rollback por kill switch.

## Ciclo TDD

### Rojo

Las pruebas nuevas fallaron de forma controlada:

- `DomainEventsController.process` no existía;
- `domain-event-consumer.service.js` no existía;
- resultado: 7 pass / 2 fail antes de implementar.

### Verde

- 19/19 pruebas unitarias focalizadas:
  - cálculo determinístico missing/partial/complete;
  - kill switch y allowlists deny-by-default;
  - el kill switch corta antes de cualquier acceso a almacenamiento;
  - payload Redis estricto `{ eventId }`;
  - identidad de servicio y body interno estricto;
  - clasificación terminal/retryable;
  - métricas Prometheus;
- 4/4 sobre PostgreSQL 14 real:
  - dos deliveries concurrentes producen un efecto y un receipt;
  - Evidence sin milestone es no-op idempotente;
  - crash antes del commit revierte readiness y deja `FAILED`; retry completa;
  - cinco crashes dejan receipt durable `DEAD_LETTER`;
- 2/2 sobre Redis 7 + BullMQ real:
  - cola canónica transporta solo `eventId` y cierra limpiamente;
  - HTTP 422 termina tras un intento aunque el job permita cinco.

Los contenedores fueron efímeros y aislados; no se usaron datos ni secretos de
producción.

## Seguridad e invariantes

- El UUID se valida antes de consultar la outbox.
- Ni OPS ni un trabajador humano con rol `WORKER` pueden invocar el process
  route; se exige la identidad técnica `EVENT_CONSUMER`.
- Tenant/org/payload se derivan del evento durable y las relaciones se vuelven
  a comprobar en DB (`Evidence -> Project -> Milestone`).
- El AuditLog conserva eventId, correlationId, causationId, consumer,
  workerId y serviceActorId.
- No hay llamadas de red, Vision, storage, Notifications, agents o Payments
  dentro de la transacción del consumer.
- El error persistido se recorta y redacta antes de guardarse.

## Investigación externa aplicada

- PostgreSQL documenta que `INSERT ... ON CONFLICT` ofrece un resultado
  atómico aun con alta concurrencia; se usa para crear el receipt único y luego
  `SELECT ... FOR UPDATE` serializa el efecto:
  [INSERT / ON CONFLICT](https://www.postgresql.org/docs/17/sql-insert.html) y
  [Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html).
- BullMQ recomienda `await worker.close()` para shutdown graceful y mantener un
  listener de `error`; ambos se registraron:
  [Graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown) y
  [Workers](https://docs.bullmq.io/guide/workers).
- BullMQ `UnrecoverableError` mueve el job a failed sin consumir los intentos
  restantes; se usa únicamente para respuestas HTTP 4xx terminales, excluyendo
  408 y 429:
  [UnrecoverableError API](https://api.docs.bullmq.io/classes/v4.UnrecoverableError.html).

## Pendiente

F1-E debe implementar T-016 y T-060–T-066:

- list/detail tenant-scoped de outbox y deliveries;
- replay solo desde estado terminal, con RBAC, reason y auditoría;
- redacción operacional;
- trace extendido con outbox + receipts;
- controles desde Mission Control.

F1-F deberá ejecutar canary, health gates y verificación en Railway antes de
marcar el Event Backbone completo o desplegado.
