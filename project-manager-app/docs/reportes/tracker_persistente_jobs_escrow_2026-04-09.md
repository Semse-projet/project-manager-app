# Tracker persistente por trabajo + escrow — 2026-04-09

## Objetivo

Endurecer el `Time Tracker` del worker para que:

- el tiempo quede persistido server-side;
- no se detenga al cerrar la web o salir de la app;
- solo se detenga con acciones explícitas de `pausar` o `detener`;
- quede conectado a trabajos reales (`jobId`);
- muestre contexto operativo del job, escrow, pagos y contrato.

## Diagnóstico inicial

El tracker anterior en:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/worker/tracker/page.tsx`

era un cronómetro local del navegador:

- el tiempo vivía en `useState`;
- se perdía al cerrar la app o recargar;
- no existía sesión persistente en backend;
- se mezclaba `jobId` con `fieldUnitId`;
- la vista mostraba worklogs, pero no controlaba una sesión viva real.

## Implementación

### 1. Persistencia real en base de datos

Se añadió `TrackerSession` al schema Prisma en:

- `/home/yoni/labsemse/project-manager-app/packages/db/prisma/schema.prisma`

Con:

- `tenantId`
- `orgId`
- `jobId`
- `createdBy`
- `status`
- `startedAt`
- `resumedAt`
- `pausedAt`
- `stoppedAt`
- `accumulatedSeconds`
- `notes`

Y se aplicó la migración:

- `/home/yoni/labsemse/project-manager-app/packages/db/prisma/migrations/20260409160000_tracker_sessions/migration.sql`

### 2. Contratos compartidos

Se creó el contrato compartido:

- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/tracker.schema.ts`

Incluye:

- payload de inicio;
- payload de pausa/reanudación/detención;
- payload de entrada manual;
- `TrackerSessionView`;
- `TrackerSnapshotView`.

### 3. Backend API

Se reforzó `field-ops` para exponer sesiones de tracker persistentes:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/field-ops/field-ops.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/field-ops/field-ops.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/field-ops/field-ops.repository.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/field-ops/tracker-session.ts`

Endpoints nuevos:

- `GET /v1/field-ops/tracker`
- `POST /v1/field-ops/tracker/start`
- `POST /v1/field-ops/tracker/manual`
- `POST /v1/field-ops/tracker/:sessionId/pause`
- `POST /v1/field-ops/tracker/:sessionId/resume`
- `POST /v1/field-ops/tracker/:sessionId/stop`

Comportamiento:

- la sesión activa se busca por `tenantId + createdBy + status in (RUNNING, PAUSED)`;
- `RUNNING` sigue contando con `resumedAt` + `accumulatedSeconds`;
- `PAUSED` congela tiempo;
- `STOPPED` cierra la sesión;
- se auditan `start`, `pause`, `resume`, `stop` y `manual_created`.

### 4. Proxies web

Se añadieron rutas server-side en Next:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/tracker/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/tracker/start/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/tracker/manual/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/tracker/[sessionId]/pause/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/tracker/[sessionId]/resume/route.ts`
- `/home/yoni/labsemse/project-manager-app/apps/web/app/api/semse/tracker/[sessionId]/stop/route.ts`

Estos usan `fetchSemseDataForRequest`, o sea identidad por sesión web y no config estática.

### 5. Cliente web y pantalla

Se extendió:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/semse-api.ts`

Y se reemplazó la implementación de:

- `/home/yoni/labsemse/project-manager-app/apps/web/app/(app)/worker/tracker/page.tsx`

Ahora la vista:

- recupera snapshot real del tracker;
- reconstruye el tiempo desde backend;
- mantiene la sesión al salir de la app;
- conecta el tracker a `jobId` real;
- muestra resumen de `escrow`, `payments` y `contract` del trabajo;
- añade links rápidos a:
  - `/jobs/[jobId]`
  - `/jobs/[jobId]/escrow`
  - `/jobs/[jobId]/evidence`
- mantiene entradas manuales dentro del mismo modelo de sesión.

## Verificación ejecutada

### Prisma

- `cd /home/yoni/labsemse/project-manager-app && npm run prisma:generate --workspace @semse/db` → OK
- `cd /home/yoni/labsemse/project-manager-app && npm run db:migrate` → OK

Resultado:

- migración `20260409160000_tracker_sessions` aplicada correctamente.

### Tests

- `cd /home/yoni/labsemse/project-manager-app && npm run test:unit --workspace @semse/api` → OK

Se añadió test nuevo:

- `/home/yoni/labsemse/project-manager-app/apps/api/test/field-ops-tracker.test.ts`

### Compilación

- `cd /home/yoni/labsemse/project-manager-app && npm run build --workspace @semse/schemas` → OK
- `cd /home/yoni/labsemse/project-manager-app && npm run build:api` → OK
- `cd /home/yoni/labsemse/project-manager-app && npm exec tsc --workspace @semse/web -- --noEmit` → OK
- `cd /home/yoni/labsemse/project-manager-app && npm run build:web` → OK

### Runtime básico

Se levantó API compilada localmente y se verificó:

- `GET /v1/health` → OK

### Smoke autenticado end-to-end

Se cerró el smoke real del tracker contra API local con sesión persistida:

- `cd /home/yoni/labsemse/project-manager-app && SEMSE_API_URL=http://127.0.0.1:4121 npm run smoke:tracker` → OK

Salida final:

- `session a2840608-d05c-43ad-9c3a-d64f5bdbe4f8 completed with 2s`

Para dejar ese smoke verde hubo que cerrar tres fallos reales del ecosistema:

1. drift de base de datos en soft delete:
   - `Job.deletedAt` y columnas hermanas figuraban como migradas en Prisma pero faltaban en la BD real;
   - se reparó con el script:
     - `/home/yoni/labsemse/project-manager-app/packages/db/scripts/repair-soft-delete-drift.ts`
   - y con el comando raíz:
     - `npm run db:repair-soft-delete`

2. RBAC incompleto para `field-ops`:
   - `WORKER` y `OPS_ADMIN` no tenían `field-ops:read` / `field-ops:write` en:
     - `/home/yoni/labsemse/project-manager-app/packages/auth/src/index.ts`

3. runtime Prisma inconsistente para `TrackerSession`:
   - el delegado `trackerSession` no estaba disponible en runtime aunque el schema ya existía;
   - se regeneró Prisma y se endureció el repositorio del tracker con SQL explícito sobre `TrackerSession`, evitando ese punto frágil.

## Resultado funcional

El tracker ahora:

- persiste en backend;
- sigue corriendo aunque el usuario cierre la web;
- no se corta por navegación interna del ecosistema;
- solo se detiene al pausar o detener explícitamente;
- queda vinculado a un trabajo real;
- muestra contexto financiero y contractual del job;
- deja auditoría estructurada.

## Riesgo remanente real

El flujo backend y el smoke autenticado ya quedaron verdes. Lo que todavía falta automatizar es la prueba e2e completa desde interfaz web real sobre `/worker/tracker`, con navegación, recuperación tras reload y ejercicio de los proxies `/api/semse/tracker/*`.
