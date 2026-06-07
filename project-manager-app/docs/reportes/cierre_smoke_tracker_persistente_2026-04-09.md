# Cierre smoke tracker persistente — 2026-04-09

## Objetivo

Cerrar el residuo operativo del tracker persistente:

- reproducir el fallo real del smoke autenticado;
- corregir los bloqueos adyacentes del ecosistema;
- dejar `npm run smoke:tracker` verde contra API local real.

## Hallazgos reales

### 1. Drift de soft delete en base de datos

`GET /v1/jobs` estaba fallando con:

- `The column Job.deletedAt does not exist in the current database.`

La migración:

- `/home/yoni/labsemse/project-manager-app/packages/db/prisma/migrations/20260408133000_soft_delete_and_runtime_indexes/migration.sql`

figuraba aplicada en Prisma, pero no estaba materializada en la base real.

### 2. RBAC incompleto para Field Ops

El smoke entraba con roles:

- `OPS_ADMIN`
- `WORKER`

pero `/v1/field-ops/tracker` devolvía `403` porque faltaban:

- `field-ops:read`
- `field-ops:write`

en:

- `/home/yoni/labsemse/project-manager-app/packages/auth/src/index.ts`

### 3. Delegado Prisma ausente para `TrackerSession`

Aunque el schema y el client generado ya conocían `TrackerSession`, el runtime no exponía un delegado usable en `PrismaService` para:

- `prisma.trackerSession.findFirst(...)`

Eso rompía `GET /v1/field-ops/tracker`.

### 4. Inserción raw sin id por defecto SQL

Al bajar `TrackerSession` a SQL explícito, apareció un detalle adicional:

- `TrackerSession.id` no tenía default útil a nivel SQL para inserts raw

### 5. SQL inválido en `UPDATE`

El armado del `SET` con `Prisma.join(...)` en `pause/resume/stop` estaba generando:

- `ERROR: syntax error at or near "object"`

## Correcciones aplicadas

### Reparación de drift en DB

Se añadió script reutilizable:

- `/home/yoni/labsemse/project-manager-app/packages/db/scripts/repair-soft-delete-drift.ts`

Y comando raíz:

- `npm run db:repair-soft-delete`

Resultado:

- se repararon `Job`, `Contract`, `Milestone`, `PaymentEscrow` y `Dispute`

### RBAC alineado

Se añadieron `field-ops:read` y `field-ops:write` a:

- `WORKER`
- `OPS_ADMIN`

en:

- `/home/yoni/labsemse/project-manager-app/packages/auth/src/index.ts`

### Repositorio del tracker endurecido

Se reforzó:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/field-ops/field-ops.repository.ts`

con SQL explícito para `TrackerSession` en:

- snapshot
- recent sessions
- find by id
- create
- update

Esto evitó depender del delegado runtime roto.

### Id explícito para inserts raw

Se pasó a generar `id` de `TrackerSession` con:

- `randomUUID()`

### Update parametrizado

Se reemplazó el armado frágil del `UPDATE` por:

- `prisma.$executeRawUnsafe(...)`

con placeholders posicionales y `SET` explícito.

## Verificación final

### Build y tests

- `npm run test:unit --workspace @semse/api` → OK
- `npm run build:api` → OK

### Smoke real

- `SEMSE_API_URL=http://127.0.0.1:4121 npm run smoke:tracker` → OK

Salida final:

- `session a2840608-d05c-43ad-9c3a-d64f5bdbe4f8 completed with 2s`

## Estado

El tracker persistente quedó validado end-to-end a nivel API:

- `auth`
- `job create`
- `snapshot`
- `start`
- `pause`
- `resume`
- `stop`
- `snapshot final`

## Riesgo remanente

No queda bloqueo backend para el tracker. El siguiente paso útil es una e2e web real sobre:

- `/worker/tracker`

para validar:

- restauración tras reload;
- navegación dentro del ecosistema;
- interacción desde los proxies `/api/semse/tracker/*`.
