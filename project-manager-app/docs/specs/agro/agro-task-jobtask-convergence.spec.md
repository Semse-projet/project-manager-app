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
related_tests:
  - apps/api/test/agro-jobtask-mirror-integration.test.ts
  - apps/api/test/agro-sync.service.test.ts
  - apps/api/test/demo.service.test.ts
related_endpoints:
  - farms
  - farms/:farmId/tasks
  - tasks/:taskId
  - sync/events
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

## 4. Fuera de alcance

- Cambiar las lecturas de web, sync y Prometeo a `JobTask` (paso 3d), y después retirar `AgroFarmTask`.
- Asignar tenant a fincas que quedaron sin él: no hay endpoint; queda como tarea aparte.
- Escribir desde `JobTask` hacia `AgroFarmTask`: el espejo es unidireccional. Ningún código escribe hoy `JobTask(domain="agro")` fuera del espejo.

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
- `prisma migrate diff` sin drift después de aplicar la migración.
