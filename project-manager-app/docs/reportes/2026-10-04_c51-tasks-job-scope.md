# C51 — tasks: by-job, crear y cambiar estado exigen tenant + participación en el job (2026-10-04)

## Hallazgo
`GET /v1/tasks/by-job/:jobId` (`jobs:read`), `POST /v1/tasks` (`jobs:create`) y `PATCH /v1/tasks/:taskId/status` (`jobs:update`)
filtraban solo por tenant. Cualquier usuario del tenant con ese permiso podía leer las tareas de un trabajo de otra organización,
crear tareas en él y cambiar el estado de una tarea **sin asignado** (la comprobación previa solo cubría tareas asignadas a otra persona).

## Cambio (cuarto consumidor del `ResourceScopeResolver`, migración gradual)
- `tasks.service.ts`: `assertJobAccess` resuelve el `Job` dentro del tenant del actor (otro tenant / inexistente ⇒ 404) y exige org cliente,
  org profesional asignada u OPS_ADMIN (otra org del mismo tenant u org vacía ⇒ 403). Se aplica en `listByJob`, `create` y `updateStatus`.
- `updateStatus`: el **asignado explícito** conserva su derecho a cambiar su propia tarea; la regla previa (otro no asignado ⇒ 403 salvo
  OPS_ADMIN) se mantiene encima.
- El controller solo añade `orgId`/`roles` a la llamada; `tasks.module.ts` importa `ResourceScopeModule`. Sin migración, sin flags,
  sin CI, sin Railway, sin tocar `rbac.ts`.
- Sin base de datos (modo mock) el comportamiento no cambia.

## Pruebas (`tasks-job-scope.test.ts`, 4)
Otro tenant (incluido OPS_ADMIN) / inexistente ⇒ 404 sin escrituras; otra org u org vacía ⇒ 403 sin escrituras; cliente, profesional
asignado y OPS_ADMIN ⇒ 200 en las tres operaciones; el asignado explícito cambia su tarea aunque su org no figure y un participante no
asignado sigue sin poder cambiar una tarea ajena. Comprobado con mutación (sin las comprobaciones fallan 2 de 4).
Suite API: 2865 tests, 0 fallos (2 omitidos) con Postgres, igual que la CI.

## No cambiado a propósito
- Tareas **sin `jobId`** (espejadas de Agro/BuildOps): sin job no hay alcance que resolver; conservan el comportamiento actual.
- `listByWorker` (`GET /v1/tasks`) ya filtra por el propio usuario.

## `prometeo` (documentos, activos y órdenes por proyecto): necesita decisión del dueño
Se evaluó y **no** se tocó. Documentos, activos y órdenes de trabajo tienen `projectId` y `orgId` opcionales, y sin proyecto no está definido si
son biblioteca del tenant (p. ej. `visibility: public_training`) o propiedad de una org. Proteger solo el caso con `projectId` explícito no
cierra nada: omitir el parámetro devuelve todo el tenant. Propuesta, a confirmar:
1. Con `projectId` (query/body/fila): tenant + ProjectScope (como clima/intelligence/tasks).
2. Activos y órdenes sin proyecto: propiedad por `orgId` (`sameOrg`) u OPS_ADMIN.
3. Documentos sin proyecto: biblioteca del tenant (lectura para el tenant, borrado solo `knowledge:manage` de su org u OPS_ADMIN).
4. Listados sin `projectId`: solo filas sin proyecto accesibles + las de proyectos donde el actor participa (requiere un método de lista en el resolver).

C51 sigue **PARTIAL**.
