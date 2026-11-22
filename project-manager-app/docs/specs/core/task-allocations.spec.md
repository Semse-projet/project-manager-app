---
id: "core.task-allocations"
title: "Asignación de tareas a personas de una cuadrilla (BO-10)"
domain: "core"
sdd_version: "2.0"
version: "0.2"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags:
  - "SEMSE_TASK_ALLOCATION_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/organizations/task-allocations.service.ts"
  - "apps/api/src/modules/organizations/task-allocations.controller.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/task-allocations.test.ts"
  - "apps/api/test/task-allocations-audit-integration.test.ts"
related_endpoints: []
related_events:
  - "task_allocation.assigned"
  - "task_allocation.status_changed"
  - "task_allocation.released"
related_agents: []
last_verified: "2026-11-21"
---
# BO-10 — Asignación de tareas a personas de una cuadrilla

Fuente: plan Astra `03_producto/07_CUADRILLAS_OBRAS_HITOS_TAREAS.md`. Depende de BO-07 (cuadrillas y alcance de supervisor). `JobTask` sigue siendo la **tarea canónica**: este slice no crea otra tabla de tareas ni toca `BuildOpsTask`.

## Alcance
- Modelo aditivo `TaskAllocation` (una fila por tarea y persona, índice único). No modifica `JobTask` ni `assignedTo`.
- API tras `SEMSE_TASK_ALLOCATION_ENABLED` (apagado → 404):
  - `POST/GET /v1/crews/:crewId/tasks/:taskId/allocations` y `POST .../:userId/release` (supervisor vigente de esa cuadrilla o gestor de cuadrillas de la Org).
  - `GET /v1/task-allocations/mine`, `POST /v1/task-allocations/:id/status` (la persona, solo lo suyo).

## Reglas
1. Una tarea compartida es **una** `JobTask` con varias asignaciones; asignar de nuevo es idempotente y no duplica.
2. El supervisor solo asigna en su cuadrilla; la membresía se revalida en cada llamada. Solo a miembros activos de esa cuadrilla y sobre tareas de la misma Org que no estén cerradas.
3. Liberar exige motivo, queda auditado y la persona puede ser asignada de nuevo (la fila se reabre sin duplicarse).
4. La persona avanza su asignación: `ASSIGNED → ACKNOWLEDGED/IN_PROGRESS/BLOCKED`, `ACKNOWLEDGED → IN_PROGRESS/BLOCKED`, `IN_PROGRESS → BLOCKED/SUBMITTED`, `BLOCKED → IN_PROGRESS`. Bloquear exige motivo. `SUBMITTED` y `RELEASED` son terminales aquí.
5. Ejecutar una tarea es independiente del reloj: este slice no toca horas, pago ni certificación.

## Criterios de aceptación
AC-01 flag apagado → 404 · AC-02 alcance del supervisor (otra cuadrilla 403, otro tenant 404, membresía suspendida 404) · AC-03 solo miembros activos y tarea válida · AC-04 sin duplicados · AC-05 no se modifica la tarea canónica · AC-06 liberar con motivo y reasignar · AC-07 la persona ve solo lo suyo · AC-08 transiciones y bloqueo con motivo.

## Fuera de alcance
Revisión de evidencia y reglas de aprobación (siguiente slice), notificaciones (BO-09), habilidades/insignias (BO-12), dependencias entre tareas, cambio de obra con trayecto.

## Capa web (slice `feat/bo-10-ui`)
`/worker/assignments` (la persona ve y avanza sus asignaciones, con título de la tarea) y `/worker/crew` (el supervisor elige su cuadrilla, escribe el código de la tarea, asigna a miembros y libera con motivo), con rutas BFF `crews/**` y `task-allocations/**`. La API sigue decidiendo: la UI solo refleja las transiciones. **Tareas internas:** `POST/GET /v1/crews/:crewId/tasks` crea y lista tareas canónicas (`JobTask`) de la Org de la cuadrilla usando las columnas `entityType="Crew"`/`entityId` (sin migración), porque las tareas del marketplace nacen sin `orgId` y no son asignables. La pantalla del supervisor elige de esa lista o crea una nueva. Evento `crew_task.created`. `taskTitle` se añadió a la vista de asignaciones (solo lectura, acotado al tenant). Con el flag apagado la API responde 404 y la UI muestra "aún no habilitadas".

## Riesgos
Escalada de alcance: un supervisor asignando fuera de su cuadrilla. Mitigado con revalidación de membresía y pruebas AC-02. `SUBMITTED` no implica aceptación ni pago.

## Aprobación y decisiones S0b (propietario, 2026-11-20)

- **Spec APPROVED** por el propietario, sin cambios.
- **D-S0B-01…05 ratificadas** tal como las propone
  `docs/reportes/2026-10-26_s0b-allocation-atomicity-cross-crew-contract.md` §4:
  1. una `JobTask` de origen `Crew` pertenece a esa crew; los supervisores de otra crew no la alcanzan;
  2. una asignación vigente de la misma `taskId+userId` en otra crew devuelve 409 neutral, sin idempotencia ni
     transferencia implícita;
  3. `assign([...])` es todo o nada: un error de base o de auditoría no deja asignaciones parciales;
  4. el traslado entre cuadrillas exige una acción explícita y aprobación empresarial; `RELEASED` no habilita
     cambiar de crew;
  5. se conserva `@@unique([taskId,userId])`; varias crews simultáneas sobre la misma tarea requerirían un ADR y
     una migración propios.
- **Gobernanza:** se aplica DEC-PLATFORM-001 (ACCEPTED). El código de #1054 es de **nivel 2**: aislamiento
  tenant/org/crew con `SEMSE_TASK_ALLOCATION_ENABLED` apagado. Exige:
  - dos revisiones automatizadas de herramientas distintas;
  - pruebas negativas sobre PostgreSQL real en CI (`S0B-PG-01`);
  - una pausa de 24 h tras el último commit;
  - la autorrevisión del propietario con este checklist, registrada en el PR.

