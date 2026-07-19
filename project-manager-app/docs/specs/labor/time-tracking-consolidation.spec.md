---
type: spec
feature: "time-tracking-consolidation"
domain: "labor"
version: "1.0"
status: "APPROVED"
branch: "devin/consolidar-time-tracking-fase1"
date: "2026-07-17"
author: "Devin"
spec_index: "docs/SPEC_INDEX.md"
---

# Spec: consolidación del tracking de tiempo

Depreca la persistencia duplicada de `TrackerSession` y la consolida en `TimeEntry` (Labor Engine), manteniendo los endpoints públicos `v1/time-tracker` como adaptador legacy. Fase 1 de la consolidación del dominio `labor` / `field-ops`.

---

## 1. Qué resuelve

**Problema:** el repositorio tiene dos tablas de tracking de tiempo:

- Legacy: `TrackerSession` (módulo `field-ops/time-tracker`, estados `RUNNING`/`PAUSED`/`STOPPED`).
- Canónica: `TimeEntry` / `LaborSheet` (Labor Engine, estados `running`/`paused`/`completed`, soporta `realtime`/`manual`, `purpose`, breaks, tarifa, etc.).

`CLAUDE.md` ya marca `field-ops/time-tracker` como legacy API. El reporte de arquitectura (`docs/reportes/2026-07-17_decisiones_entidades_canonicas.md`) declara `TimeEntry`/`LaborSheet` canónicos y `TrackerSession`/`WorklogEntry` como legacy a deprecar.

**Solución:**

- Extender `TimeEntry` con `contextEntityType`/`contextEntityId` para poder enlazar entradas a `FieldUnit` u otras entidades sin agregar columnas ad-hoc.
- Reescribir `FieldOpsRepository` para que lea/escriba `TimeEntry` en lugar de `TrackerSession`, manteniendo los tipos `TrackerSessionRecord` y `TrackerSessionView` para no romper el controlador ni la web.
- Migrar los datos existentes de `TrackerSession` a `TimeEntry` y eliminar la tabla `TrackerSession`, su enum y sus relaciones en `User`/`Job`.
- Los endpoints `v1/time-tracker` siguen operando como adaptador; la UI no cambia en esta fase.

---

## 2. Actores y Permisos

Sin cambios. Los endpoints legacy siguen usando `field-ops:read` y `field-ops:write`.

| Actor | Permiso | Puede hacer |
|---|---|---|
| PRO / CLIENT | `field-ops:read` | Ver snapshot, sesiones, resumen |
| PRO / CLIENT | `field-ops:write` | Iniciar, pausar, reanudar, detener, notas, entrada manual |

---

## 3. Escenarios de usuario (P1)

### P1 — Una sola tabla de tiempo

```
DADO    que un PRO inicia un timer desde /worker/field-ops
CUANDO  el backend persiste la sesión
ENTONCES se crea una fila en TimeEntry (modo realtime, propósito job_linked)
  Y     no se escribe en TrackerSession
```

### P1 — El resumen histórico sigue disponible

```
DADO    que existen sesiones legacy en TrackerSession
CUANDO  se aplica la migración
ENTONCES quedan como entradas completadas/pausadas/corriendo en TimeEntry
  Y     el resumen semanal/mensual sigue funcionando
```

### P1 — Los endpoints legacy no cambian de contrato

```
DADO    que la web consume /api/semse/time-tracker/sessions/*
CUANDO  se consolida el backend
ENTONCES los mismos BFF routes devuelven TrackerSessionView sin cambios
```

### P1 — Contexto genérico para unidades de campo

```
DADO    que TimeEntry tiene contextEntityType/contextEntityId
CUANDO  se registra tiempo vinculado a un FieldUnit
ENTONCES se guarda contextEntityType='FieldUnit' y contextEntityId=<fieldUnitId>
  Y     sin requerir una columna fieldUnitId dedicada
```

---

## 4. FSM

No cambia el flujo de negocio. Los estados canónicos de `TimeEntry` son `running`, `paused`, `completed` (y `pending_review`/`approved` para aprobaciones futuras). Para el adaptador legacy:

- `RUNNING` ↔ `running`
- `PAUSED` ↔ `paused`
- `STOPPED` ↔ `completed`

Transiciones permitidas:

- `running -> paused`
- `paused -> running`
- `running | paused -> completed`

---

## 5. Contratos de API

No cambian los endpoints públicos. Siguen vigentes:

- `GET /v1/time-tracker`
- `GET /v1/time-tracker/active`
- `GET /v1/time-tracker/sessions`
- `GET /v1/time-tracker/summary`
- `GET /v1/time-tracker/jobs`
- `POST /v1/time-tracker/sessions/start`
- `POST /v1/time-tracker/sessions/manual`
- `POST /v1/time-tracker/sessions/:sessionId/pause`
- `POST /v1/time-tracker/sessions/:sessionId/resume`
- `POST /v1/time-tracker/sessions/:sessionId/stop`
- `POST /v1/time-tracker/sessions/:sessionId/notes`

Los BFF routes en `apps/web/app/api/semse/time-tracker/*` no se tocan.

---

## 6. Criterios de éxito

| Métrica | Valor objetivo |
|---|---|
| Tablas duplicadas eliminadas | `TrackerSession` fuera del schema |
| Consumidores rotos | 0 |
| `pnpm lint` | 0 errores en API/web |
| `pnpm typecheck` | pass |
| `pnpm --filter @semse/api test:unit` | 0 fallos nuevos |
| `pnpm spec:preflight` | pass |

---

## 7. Tests requeridos

- [ ] `pnpm typecheck` pasa tras regenerar el cliente Prisma.
- [ ] `pnpm lint` no reporta errores.
- [ ] `pnpm --filter @semse/api test:unit` mantiene cobertura actual (tests de `field-ops` y `labor-engine` se ajustan al nuevo mapeo).
- [ ] `pnpm spec:preflight` pasa.
- [ ] Migración es reversiva: rollback = restaurar `TrackerSession` desde backup (la data se migra a `TimeEntry`).

---

## 8. Impacto en otros dominios

| Dominio | Impacto | Acción requerida |
|---|---|---|
| field-ops | Alto | `FieldOpsRepository` lee/escribe `TimeEntry`; tipos y vistas legacy se mantienen |
| labor-engine | Medio | Extensión de `TimeEntry` con `contextEntityType`/`contextEntityId`; `LaborEngineService` acepta contexto opcional |
| Prisma/DB | Alto | Migración con data migration + `DROP TABLE "TrackerSession"` |
| Web | No | BFF routes y schemas no cambian |
| Prometeo | No | No consume `TrackerSession` directamente |

---

## 9. Supuestos y dependencias

- `TrackerSession` tiene datos productivos que deben migrarse a `TimeEntry`.
- `WorklogEntry` queda fuera de este spec (es diario de campo, no tracking de tiempo); se tratará en la consolidación de evidencias/diarios.
- El adaptador legacy se mantiene para no romper la UI; la Fase 2 migrará la UI a `/v1/labor/*` y podrá eliminarse `TimeTrackerController`.
- `TimeEntry` usa `purpose='job_linked'` para las entradas provenientes del adaptador legacy, evitando mezclar timers personales de Labor Engine.

---

## 10. Plan de migración

1. **Editar `packages/db/prisma/schema.prisma`:**
   - Agregar a `TimeEntry`: `contextEntityType String?` y `contextEntityId String?` con índices.
   - Eliminar modelo `TrackerSession`, enum `TrackerSessionStatus`, y campos de relación `trackerSessions` de `User` y `Job`.
2. **Crear migración `packages/db/prisma/migrations/20260718000000_consolidate_tracker_session/migration.sql`:**
   - `ALTER TABLE "TimeEntry" ADD COLUMN "contextEntityType" TEXT; ADD COLUMN "contextEntityId" TEXT;`
   - `CREATE INDEX` sobre las nuevas columnas.
   - `INSERT INTO "TimeEntry" (...) SELECT ... FROM "TrackerSession"` con mapeo de estados y generación de ids.
   - `DROP TABLE "TrackerSession" CASCADE;`
   - `DROP TYPE "TrackerSessionStatus";`
3. **Reescribir `apps/api/src/modules/field-ops/field-ops.repository.ts`:**
   - Reemplazar métodos de tracker-session por queries a `prisma.timeEntry`.
   - Mapear `TrackerSessionRecord` <-> `TimeEntry` (`RUNNING`→`running`, `STOPPED`→`completed`, `stoppedAt`↔`endedAt`).
   - Mantener `findJobForTracker` y `listJobsForTracker`.
4. **Actualizar `apps/api/src/modules/field-ops/tracker-session.ts`:**
   - Ajustar `computeTrackerElapsedSeconds` para usar `startedAt` como fallback cuando `resumedAt` es null.
5. **Extender `LaborEngineService` y `LaborEngineRepository` (opcional pero recomendado):**
   - Aceptar `contextEntityType`/`contextEntityId` en `startTimer`/`createManualEntry`/`createTimeEntry`.
   - Incluir `job` en las consultas de `TimeEntry` para que el adaptador pueda mapear vistas.
6. **Ejecutar `pnpm db:generate`**, `pnpm lint`, `pnpm typecheck`, `pnpm --filter @semse/api test:unit`, `pnpm spec:preflight`.
7. **Actualizar `docs/SPEC_INDEX.md` con `pnpm spec:index`.**
8. **Crear PR** con el spec, migración, schema y cambios de repositorio.

---

## 11. Checklist de aprobación

- [x] Escenarios P1 con criterio Given/When/Then
- [x] Contratos de API sin cambios documentados
- [x] No viola `DOMAIN_INVARIANTS.md` ni `STATE_MACHINES.md`
- [x] Plan de migración y rollback documentado
- [x] Tests requeridos listados
- [x] Spec agregado a `docs/SPEC_INDEX.md`
- [x] Status `APPROVED`
