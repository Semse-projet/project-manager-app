---
id: "agro.task-jobtask-convergence"
title: "Agro — tenant de la finca y espejo de tareas en JobTask (T-051)"
domain: "agro"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: []
production_evidence: []
related_files:
  - packages/db/prisma/schema.prisma
  - packages/db/prisma/migrations/20260925150000_agro_farm_tenant_jobtask_bridge/migration.sql
  - apps/api/src/modules/agro/agro-jobtask-mirror.ts
  - apps/api/src/modules/agro/agro-task.repository.ts
  - apps/api/src/modules/agro/agro-sync.service.ts
  - apps/api/src/modules/agro/agro-farm.repository.ts
  - apps/api/src/modules/agro/agro-task-ref.resolver.ts
  - apps/api/src/modules/demo/demo.service.ts
  - apps/api/src/modules/tasks/tasks.controller.ts
  - packages/auth/src/rbac.ts
related_tests:
  - apps/api/test/agro-jobtask-mirror-integration.test.ts
  - apps/api/test/agro-sync.service.test.ts
  - apps/api/test/demo.service.test.ts
  - apps/api/test/agro-farm-policy.test.ts
  - apps/api/test/domain-rbac-permissions.test.ts
  - apps/api/test/tasks.controller.test.ts
related_endpoints:
  - farms
  - farms/:farmId/tasks
  - farms/:farmId/tenant
  - tasks/:taskId
  - sync/events
  - v1/tasks
related_events: []
related_agents: []
last_verified: "2026-09-25"
---

# Spec: tenant de la finca y espejo de tareas Agro en JobTask

> Aprobación: el propietario de producto eligió "Tenant en la finca" en la sesión del 2026-09-25 (T-051).

## 1. Resultado

Las tareas Agro empiezan a converger hacia `JobTask` (`domain = "agro"`), la plataforma de tareas canónica, sin cambiar lo que leen hoy la web, el sync offline y Prometeo. Paso 3b/3c del plan de migración (AS-IS §7).

## 2. Decisión de tenancy

`JobTask.tenantId` es obligatorio y `AgroFarm` no tenía tenant, solo propietario. Un usuario puede pertenecer a varias orgs y tenants, así que el tenant de una finca no se deduce del usuario.

- `AgroFarm.tenantId` es opcional, con FK a `Tenant` y `ON DELETE SET NULL`.
- **Fincas nuevas:** toman el tenant de la sesión de quien las crea, solo si existe en `Tenant`. Con auth por cabeceras el tenant puede no existir, y la FK rompería el alta.
- **Fincas existentes (backfill):** se les asigna tenant solo si el propietario tiene membresías ACTIVE en exactamente un tenant. Si es ambiguo, quedan en NULL.
- **Fincas sin tenant:** funcionan igual que antes de T-051, sin espejo.

## 3. Espejo AgroFarmTask → JobTask

- Cada escritura de `AgroFarmTask` se refleja en `JobTask` dentro de la **misma transacción**: alta, edición y transiciones por la web o el API, y alta, completar y bloquear por el sync offline. Si el espejo falla, la escritura se revierte.
- **Vínculo:** `AgroFarmTask.jobTaskId`, único, con FK `ON DELETE SET NULL`.
- **Id determinista:** `agrotask_<AgroFarmTask.id>`, igual en el backfill y en el código. Reintentar es idempotente (upsert).
- **Espejo tardío:** si la finca obtiene tenant más tarde, cada tarea se refleja en su siguiente escritura.
- **Mapeo de campos:**
  - Estado: PENDING→pending, IN_PROGRESS→in_progress, COMPLETED→done, BLOCKED→blocked, CANCELLED→canceled.
  - Prioridad: en minúsculas.
  - Tipo: `type` pasa a `taskType`.
  - `dueAt` pasa a `dueDate`, `assignedToId` a `assignedTo` y `cancelledAt` a `canceledAt`.
  - `createdBy`: el actor, o el propietario en el backfill y en el espejo tardío.
- **Marcas:** `sourceTool = "agro_farm_task"`, `vertical = "agro"`, `entityType = "AgroFarm"`, `entityId = farmId`.
- **Sin duplicados:** `AgroTaskRefResolver.listOpen` excluye los espejos, porque la tarea ya aparece por su fuente `AGRO_FARM_TASK`. Una referencia `JOB_TASK` a un espejo sigue resolviendo.
- **Reset de la demo:** borra antes los `JobTask(domain="agro")` de la finca, porque el espejo no cuelga de ella por FK.

## 3bis. Asignar tenant a una finca sin tenant (T-058, parcial)

`POST /v1/agro/farms/:farmId/tenant` (sin cuerpo) permite al **propietario**
asignar tenant a su finca cuando el backfill la dejó ambigua o el tenant de la
sesión no existía al crearla:

- Solo el propietario (`farm.manage`); un miembro recibe 403, un ajeno 404.
- Solo si la finca **no tiene tenant todavía**; reasignar (incluso al mismo
  tenant) es 400.
- Solo al **tenant de la propia sesión** del propietario, nunca uno arbitrario
  pasado por parámetro — mismo criterio que `createFarm`.
- No migra las tareas ya existentes: el espejo llega en su siguiente
  escritura, igual que cualquier finca que obtiene tenant más tarde (§3).
- Se audita como `farm.tenant_assigned`.

## 3ter. "Mis tareas" entre dominios (T-058b)

**Decisión (sesión 2026-09-25):** en vez de cambiar lo que leen las pantallas
de Agro, sync y Prometeo — que ya leen bien de `AgroFarmTask` y no ganan nada
leyendo la copia derivada mientras existan fincas sin tenant (ver análisis
abajo) — se conecta Agro al consumidor real de `JobTask` como plataforma
única: `GET /v1/tasks` ("mis tareas", cualquier dominio), que ya existía sin
usarlo ningún rol de Agro.

- **Por qué no "cambiar las lecturas" tal cual decía el plan:** el espejo se
  escribe en la misma transacción que `AgroFarmTask`, así que leer la copia en
  vez del origen no cambia nada visible y sí añade riesgo (traducir el estado
  de vuelta) y una ruta doble de respaldo, porque las fincas sin tenant no
  tienen copia. Ese paso solo tiene sentido justo antes de retirar
  `AgroFarmTask`, y hoy no todas las fincas tienen tenant (T-058a solo migra
  una por una). Se deja documentado como no procedente por ahora, no como
  hecho.
- **Permiso nuevo, angosto:** `tasks:read:self` en vez de `jobs:read` para
  `GET /v1/tasks` (`TasksController.listByWorker`). El endpoint ya filtra
  server-side por `assignedTo = actor`, así que el permiso solo decide quién
  puede pedir *sus* tareas — no abre el resto de Jobs (`by-job`, materiales,
  incidencias, pagos, viáticos), que siguen exigiendo `jobs:read` completo.
- **Roles:** `CLIENT`, `PRO` y `OPS_ADMIN` lo reciben porque ya tenían
  `jobs:read` (sin regresión). `WORKER` lo recibe de nuevo — ya opera en
  varios dominios (`bids:read`, `travel:manage`, `payments:connect:self`), así
  que ver sus tareas Agro junto con las de otros dominios encaja con el rol.
  **`DEMO_AGRO` no lo recibe**: su comentario explícito dice que el
  aislamiento del sandbox depende de que ese set nunca crezca hacia `jobs`.
- **Resultado:** un trabajador de finca cuya finca tiene tenant ve su tarea
  Agro (por su `jobTaskId` espejado) en `GET /v1/tasks`, junto con tareas de
  otros dominios si las tiene. Nadie ve tareas de otra persona.
- **Sin UI todavía:** ninguna pantalla consume hoy `GET /v1/tasks` ni su BFF
  (`/api/semse/tasks`) — ni para Jobs ni para Agro. Construir esa pantalla es
  trabajo de producto/UX aparte, no alcance de este cambio.

## 4. Fuera de alcance

- Cambiar las lecturas de las pantallas de Agro, el sync o Prometeo a
  `JobTask` (ver §3ter: no procede mientras existan fincas sin tenant), y
  después retirar `AgroFarmTask`.
- Migrar en bloque las tareas ya existentes de una finca al asignarle tenant (§3bis): siguen lazy, una por una, en su siguiente escritura.
- Escribir desde `JobTask` hacia `AgroFarmTask`: el espejo es unidireccional. Ningún código escribe hoy `JobTask(domain="agro")` fuera del espejo.
- Construir la pantalla "mis tareas" entre dominios (§3ter): solo se conecta el permiso y el endpoint ya existente.

## 5. Campos SEMSE

```yaml
privacyCritical: false
auditLog: "sin cambios: AgroAuditEvent sigue registrando task.* sobre AgroFarmTask"
sse: false
fsmTransicion: "sin cambios: la FSM de AgroFarmTask decide; JobTask solo refleja el estado"
paymentGovernance: false
```

## 6. Verificación

- `agro-jobtask-mirror-integration.test.ts` (Postgres real, HTTP):
  - tenant de la sesión al crear la finca, y tenant inexistente sin romper el alta;
  - espejo en alta, iniciar, editar y completar;
  - sync offline al crear y completar;
  - finca sin tenant, sin espejo;
  - `listOpen` sin duplicados, y la referencia `JOB_TASK` al espejo sigue resolviendo;
  - backfill de la migración ejecutado dos veces: idempotente, y el propietario ambiguo queda sin tenant.
  - T-058b: la tarea espejada de un WORKER aparece en `GET /v1/tasks`; otra
    persona sin tareas no ve nada; `by-job` sigue en 403 para WORKER; completar
    la tarea en Agro se refleja al filtrar por `status=done`.
- `domain-rbac-permissions.test.ts`: `listByWorker` exige `tasks:read:self`, distinto de `listByJob` (`jobs:read`) y del resto de métodos.
- `agro-farm-policy.test.ts`: `tasks:read:self` para WORKER/PRO/CLIENT/OPS_ADMIN, no para DEMO_AGRO; WORKER sigue sin `jobs:read`.
- `prisma migrate diff` sin drift después de aplicar la migración.
