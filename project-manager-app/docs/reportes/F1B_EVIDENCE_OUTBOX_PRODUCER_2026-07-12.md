# F1-B — Producer Evidence + outbox atómico

**Fecha:** 2026-07-12
**Rama:** `feat/f1b-evidence-outbox`
**Base:** `origin/main@d368669da9396815247baf564851699524d2dcd0`
**Scope:** T-012, T-013 y T-030–T-035; sin dispatcher, Redis ni consumers

## Resultado

El registro canónico de Evidence ahora persiste la fila de dominio y
`evidence.uploaded.v1` en una única transacción Prisma/PostgreSQL.

- el envelope se construye desde la Evidence ya persistida dentro del `tx`;
- `OutboxRepository` solo acepta el transaction client;
- la clave `evidence.uploaded.v1:<requestId>` está protegida por el unique
  compuesto tenant + idempotency key;
- un retry idéntico devuelve la Evidence original;
- reutilizar el mismo request ID con otro comando se rechaza;
- no hay enqueue, Redis, HTTP ni otra llamada de red dentro del callback;
- AuditLog y la invalidación de contexto existentes permanecen fuera de este
  corte y no se reemplazan todavía por consumers.

El dispatcher y los consumers continúan ausentes. Por tanto, las filas quedan
en `PENDING` hasta F1-C y no existe ningún efecto automático sobre hitos o pagos.

## Ciclo TDD

### Rojo

`evidence-outbox-producer.test.ts` falló inicialmente con
`ERR_MODULE_NOT_FOUND` porque `OutboxRepository` todavía no existía.

### Verde

- 4/4 tests unitarios de commit, rollback, ausencia de queue/network y rechazo
  temprano de request ID inválido;
- 3/3 tests sobre PostgreSQL 16 real:
  - dos comandos concurrentes -> una Evidence + un outbox;
  - fallo forzado de outbox -> cero filas en ambas tablas;
  - mismo request ID con payload distinto -> rechazo sin duplicados.

El historial completo de 59 migraciones se aplicó localmente con
`prisma migrate deploy`, incluida `20260712000000_f1_event_backbone`.

## Validación adicional

- `pnpm build:api`: PASS;
- suite unitaria API: 1818/1818 PASS;
- contratos F1-A + producer F1-B: 14/14 PASS;
- integración PostgreSQL 16 F1-B: 3/3 PASS;
- ESLint sobre los cuatro archivos fuente modificados: PASS;
- `pnpm spec:validate:strict`: 64 specs, 0 errores, 0 warnings;
- `pnpm spec:coverage`: 59/64 specs con tests (92%), 45/64 VERIFIED (70%);
- índice SDD idempotente y `git diff --check`: PASS.

El lint global de la API mantiene 51 errores y 1 warning preexistentes en
archivos ajenos a F1-B. Este corte no los modifica ni los oculta.

## Investigación externa de mejora

### Búsquedas ejecutadas

1. Atomicidad e interactive transactions —
   [Prisma transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions).
2. Idempotencia y restricciones compuestas —
   [Prisma schema unique constraints](https://www.prisma.io/docs/orm/reference/prisma-schema-reference) y
   [compound constraints](https://docs.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-composite-ids-and-constraints).
3. Arbitraje concurrente mediante unique indexes —
   [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) y
   [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html).

### Aplicado ahora

- transacción interactiva corta solo con dos writes dependientes;
- rollback automático si cualquiera de los writes falla;
- unique compuesto por tenant para arbitrar carreras;
- captura de `P2002` y lectura de la fila ganadora;
- rechazo explícito si un request ID intenta representar otro comando.

### Backlog

- mover AuditLog a una garantía atómica o a un consumer durable;
- métricas de colisiones idempotentes y edad de filas `PENDING`;
- claim/lease y dispatch en F1-C;
- receipts/efecto idempotente en F1-D.

### Descartado

- publicar directamente a Redis dentro de la transacción;
- confiar solo en un pre-check sin unique DB;
- crear una segunda Evidence después de una colisión;
- activar efectos sobre Milestone, Payment o Trust en este corte.

## Próximo corte

F1-C comienza por T-014 y T-040–T-046: tests de dos dispatchers, lease vencida
y Redis caído, seguidos por claim `FOR UPDATE SKIP LOCKED`, enqueue determinista
y kill switch apagado por defecto.
