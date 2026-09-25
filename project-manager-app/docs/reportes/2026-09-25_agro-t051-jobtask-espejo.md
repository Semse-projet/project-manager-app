# 2026-09-25 — Agro T-051: tenant de la finca y espejo de tareas en JobTask

Spec: `docs/specs/agro/agro-task-jobtask-convergence.spec.md`. Continúa T-050, T-056 y T-057.

## Decisión

`JobTask.tenantId` es obligatorio y una finca Agro no tenía tenant. El propietario de producto eligió **tenant en la finca**:

- `AgroFarm.tenantId` es opcional.
- Una finca nueva toma el tenant de la sesión de quien la crea, si existe en `Tenant`.
- Una finca existente recibe tenant solo si su propietario pertenece a un único tenant.
- Una finca sin tenant sigue como antes, sin espejo.

## Qué cambió

- **Migración aditiva `20260925150000_agro_farm_tenant_jobtask_bridge`:**
  - `AgroFarm.tenantId`, con FK a `Tenant` y `SET NULL`.
  - `AgroFarmTask.jobTaskId`, único, con FK a `JobTask` y `SET NULL`.
  - Backfill idempotente del tenant de la finca y de los espejos, con id `agrotask_<id>`.
- **`agro-jobtask-mirror.ts`:** refleja cada escritura de `AgroFarmTask` en `JobTask(domain="agro")` dentro de la misma transacción. Lo usan el repositorio de tareas (alta, edición y transiciones) y el sync offline (alta, completar y bloquear).
- **`AgroTaskRefResolver.listOpen`:** ya no lista los espejos, así una tarea no aparece dos veces en "buscar → relacionar".
- **Reset de la demo:** borra los espejos antes de borrar la finca, porque no cuelgan de ella por FK.

## Qué no cambió

La web, el sync y Prometeo siguen leyendo `AgroFarmTask`. La FSM y la auditoría (`AgroAuditEvent`) son las mismas.

## Verificación

- `agro-jobtask-mirror-integration.test.ts`: 2 tests E2E contra Postgres (HTTP y backfill ejecutado dos veces).
- Suite unitaria del API: 2475 pass / 0 fail.
- Suite de integración del API: 110 pass / 0 fail.
- Suite raíz: 1139 pass / 0 fail.
- Sin errores:
  - eslint del API y `tsc` del web;
  - `prisma validate` y `migrate diff` (sin drift);
  - `spec:validate:strict`.

## Actualización (T-058a)

Se agregó `POST /v1/agro/farms/:farmId/tenant` para que el propietario asigne
tenant a su finca cuando el backfill la dejó sin él: solo si no tiene tenant
todavía, y solo al tenant de su propia sesión (nunca uno arbitrario). No migra
las tareas existentes; el espejo llega en la siguiente escritura de cada una.
Test agregado en `agro-jobtask-mirror-integration.test.ts` (asignación,
rechazo por rol, rechazo por reasignación, rechazo por tenant inexistente).

## Pendiente

- **T-058b:** pasar las lecturas de web, sync y Prometeo a `JobTask`.
- **Producción:** confirmar que la migración se aplicó en Railway y cuántas fincas y tareas quedaron con espejo:
  - `SELECT count(*) FROM "AgroFarm" WHERE "tenantId" IS NOT NULL`
  - `SELECT count(*) FROM "AgroFarmTask" WHERE "jobTaskId" IS NOT NULL`
