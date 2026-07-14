# F1-A — Contratos de eventos v2 y migración aditiva

**Fecha:** 2026-07-12
**Rama:** `feat/f1-event-backbone`
**Base:** `origin/main@bdde35f50b740bcc52c8ceb5705bac03309f5391`
**Scope:** T-001–T-011 y T-020–T-025; sin producer, dispatcher ni consumer

## Resultado

Se implementó el primer corte reversible de F1:

- `SemseDomainEventV2` con actor, tenant/org, versionado, causation,
  idempotency, schemaRef y trace context;
- payload estricto `evidence.uploaded.v1` sin URLs firmadas/tokens;
- adapter limitado a `evidence.uploaded` v1;
- enums Prisma para lifecycle de outbox y consumption;
- `DomainOutboxEvent` y `DomainEventConsumption` con FK tenant;
- constraints de idempotencia y receipt único;
- índices para pending/lag, correlation y agregado;
- migración SQL aditiva sin drops.

No se activa ningún comportamiento runtime. Evidence todavía no escribe outbox
y no existe dispatcher ni worker del backbone en este corte.

## Ciclo TDD

### Rojo

- contrato: import de exports F1 inexistentes;
- Prisma DMMF: modelos/enums ausentes;
- migración: archivo inexistente.

### Verde

- 7 tests del envelope/privacidad/adapter;
- 3 tests DMMF/migración;
- total focal: 10/10.

## Migración y validación local

`pnpm db:migrate` no pudo conectarse porque este workspace no tiene
`DATABASE_URL`. No se usó ni solicitó una credencial de producción.

Validaciones sustitutas locales:

- `prisma validate` con URL sintáctica ficticia: PASS;
- `prisma migrate diff --from-empty --to-schema-datamodel`: PASS;
- `pnpm db:generate`: PASS;
- `pnpm build:api`: PASS;
- contrato SQL verifica enums, tablas, uniques, índice operativo, FK y ausencia
  de `DROP`.

La aplicación real de migration history corresponde al PostgreSQL efímero de
CI mediante `prisma migrate deploy` y debe ser condición de merge.

## Investigación externa de mejora

### Búsquedas ejecutadas

1. Deploy de migraciones Prisma en CI/producción —
   [Prisma migrate deploy](https://docs.prisma.io/docs/cli/migrate/deploy) y
   [migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories).
2. UUID nativo para IDs distribuidos —
   [PostgreSQL UUID type](https://www.postgresql.org/docs/current/datatype-uuid.html).
3. Exclusión de secretos/PII de logs y eventos —
   [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

### Aplicado ahora

- migration history se versiona completa y se ejecuta por CI;
- `eventId` usa UUID nativo PostgreSQL/Prisma;
- payload Evidence es strict y no admite campos signedUrl/token;
- migration es aditiva y rollback operacional conserva filas.

### Backlog

- tests DB de atomicidad/concurrencia en F1-B;
- redaction de errores y payload en APIs Ops F1-E;
- retención/purge después de medir volumen del canary.

### Descartado

- aplicar migración manualmente contra producción desde el workspace;
- `db push` como sustituto de migration history;
- almacenar archivos, URLs firmadas o credenciales en el envelope.

## Próximo corte

F1-B comienza por T-012–T-017 en rojo y después implementa
`Evidence + DomainOutboxEvent` en una misma transacción. No debe incluir Redis o
network I/O dentro del transaction callback.
