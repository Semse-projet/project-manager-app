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

## Producción (verificado)

La migración `20260925150000_agro_farm_tenant_jobtask_bridge` se aplicó en
Railway ("SEMSEproject" → `semse-API`) el 2026-09-25 15:31 UTC, en el deploy
del PR #682 (T-058a): log `[pre-migrate] ✓ migrate deploy completo` y "All
migrations have been successfully applied", sin errores en ese deploy. No
tengo acceso a consultas SQL directas contra la base de producción en esta
sesión, así que las dos consultas de conteo (fincas con tenant, tareas
espejadas) quedan pendientes de correr manualmente:

```sql
SELECT count(*) FROM "AgroFarm" WHERE "tenantId" IS NOT NULL;
SELECT count(*) FROM "AgroFarmTask" WHERE "jobTaskId" IS NOT NULL;
```

## Actualización (T-058b)

Investigué qué significaba "pasar las lecturas de web/sync/Prometeo a
JobTask" antes de tocar código y encontré que no conviene hacerlo todavía: el
espejo se escribe en la misma transacción que `AgroFarmTask`, así que leer la
copia en vez del origen no cambia nada visible y sí obliga a traducir el
estado de vuelta y a mantener una ruta de respaldo para las fincas sin
tenant. Ese paso solo tiene sentido justo antes de retirar `AgroFarmTask`, y
hoy no todas las fincas lo tienen (T-058a solo asigna tenant una finca a la
vez). Lo dejo documentado en la spec como "no procede por ahora", no como
hecho.

En su lugar encontré el consumidor real que sí se beneficia de tener
`JobTask` como plataforma única: `GET /v1/tasks` ("mis tareas", cualquier
dominio), que ya existía y ya leía de `JobTask`, pero ningún rol de Agro
podía usarlo (exigía `jobs:read`, que WORKER no tiene, y que le daría acceso
a todo Jobs — pagos, viáticos, materiales — no solo a sus tareas). Con
aprobación del propietario de producto, dividí ese permiso: `GET /v1/tasks`
ahora exige `tasks:read:self` (más angosto; el endpoint ya filtra
server-side por `assignedTo = actor`), mientras que `by-job` y el resto de
Jobs siguen en `jobs:read`. `CLIENT`, `PRO` y `OPS_ADMIN` reciben el permiso
nuevo sin perder nada (ya tenían `jobs:read`); `WORKER` lo recibe de nuevo
(ya opera en varios dominios); `DEMO_AGRO` explícitamente no, para no violar
su aislamiento documentado del sandbox.

Resultado: un trabajador de finca cuya finca tiene tenant ve su tarea Agro en
`GET /v1/tasks`. Ninguna pantalla consume hoy ese endpoint (ni para Jobs ni
para Agro) — construir esa pantalla es trabajo de producto/UX aparte.

Tests agregados: `agro-jobtask-mirror-integration.test.ts` (E2E, la tarea
espejada aparece en `GET /v1/tasks`, otra persona no la ve, `by-job` sigue en
403, completar se refleja al filtrar por estado), `domain-rbac-permissions.test.ts`
y `agro-farm-policy.test.ts` (matriz de permisos), y actualicé
`tasks.controller.test.ts` (ya asumía `jobs:read` en `listByWorker`).

## Pendiente

- Construir una pantalla que consuma `GET /v1/tasks` (Agro y/o Jobs) — decisión de producto/UX, no alcance de esta sesión.
