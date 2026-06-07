# Projects Access Policy

## Objetivo

Dejar explícita la policy actual del agregado `Project`, separando:

- permisos declarativos;
- ownership por recurso;
- reglas de lifecycle;
- limitaciones temporales hasta auth real.

## Nota de Vision

Esta policy no redefine el dominio canonico del producto.

- `Job` sigue siendo la unidad principal de negocio;
- `Project` se trata como capa operativa derivada o transicional dentro del
  backend actual;
- mientras existan endpoints `projects/*`, deben leerse como puente de
  implementacion y no como centro permanente del producto.

## Permisos

### `projects:read`

Permite intentar leer proyectos.

No concede acceso automático.
La lectura final depende también del ownership del recurso.

### `projects:financials:read`

Permite intentar leer `payments` y `escrow`.

No concede acceso automático.
La lectura final depende también del ownership del recurso.

### `projects:financials:write`

Permite intentar fondear escrow o liberar fondos.

No concede acceso automático.
La ejecución final depende también del ownership del recurso.

### `projects:status:update`

Permite intentar cambiar `Project.status`.

No concede acceso automático.
La actualización final depende de:

- ownership;
- rol;
- transición válida;
- estado de milestones;
- estado de escrow;
- disputas activas.

## Ownership

En el modelo actual, el ownership del proyecto se determina por:

- `project.job.clientOrgId`
- `project.assignedProOrgId`

Reglas:

- `OPS_ADMIN`: acceso total dentro del tenant
- org cliente dueña del `Job`: acceso al proyecto
- org pro asignada al proyecto: acceso al proyecto
- cualquier otra org del mismo tenant: sin acceso

## Financial Access

`GET /v1/projects/:projectId/payments`
`GET /v1/projects/:projectId/escrow`
`GET /v1/jobs/:jobId/payments`
`GET /v1/jobs/:jobId/escrow`

Acceso permitido a:

- `OPS_ADMIN`
- org cliente dueña

Acceso denegado a:

- actores sin ownership
- actores del mismo tenant sin vínculo
- roles con `projects:read` pero sin `projects:financials:read`

Nota:

Actualmente `PRO` no tiene `projects:financials:read`.

## Financial Write

`POST /v1/projects/:projectId/escrow/deposit`
`POST /v1/jobs/:jobId/escrow/fund`
`POST /v1/milestones/:milestoneId/escrow/release`

Acceso permitido a:

- `OPS_ADMIN`
- org cliente dueña

Acceso denegado a:

- `PRO`
- actores sin vínculo

## Status Update

`PATCH /v1/projects/:projectId/status`

Acceso permitido a:

- `OPS_ADMIN`
- org cliente dueña

Acceso denegado a:

- `PRO`
- actores sin vínculo

## Reglas de Lifecycle

### `open -> in_progress`

Permitido si el proyecto tiene `assignedProOrgId`.

### `open -> cancelled`

Permitido solo si no hay conflicto financiero ni ejecución incompatible.

### `in_progress -> blocked`

Permitido.

### `in_progress -> completed`

Permitido solo si:

- no hay disputas activas;
- existen milestones;
- todos los milestones están pagados.

### `in_progress -> cancelled`

No permitido si:

- hay fondos retenidos;
- ya hubo ejecución;
- ya hubo releases.

### `blocked -> in_progress`

Permitido.

### `blocked -> cancelled`

Sujeto a las mismas reglas financieras y de ejecución que cualquier cancelación.

### `completed` y `cancelled`

Estados terminales.
No se reabren con la policy actual.

## Auditoría

Cada cambio real de estado genera audit log con:

- actor;
- tenant;
- org;
- entity;
- action;
- `beforeJson.status`;
- `afterJson.status`;
- requestId;
- timestamp.

La transición al mismo estado es idempotente y no genera cambio adicional.

## Qué Sigue Siendo Temporal

El sistema aún resuelve actor desde headers:

- `x-user-id`
- `x-tenant-id`
- `x-org-id`
- `x-roles`

Eso sirve como bootstrap técnico.
No es autenticación final.

La seguridad real agregada en este trabajo está en:

- permisos por endpoint;
- policy por recurso;
- ownership explícito;
- validación de lifecycle.

## Próximo Paso

Cuando entre auth real:

- `resolveRequestContext` debe tomar identidad verificada;
- la policy de ownership debe mantenerse;
- `ActorContextService` debe quedar solo como soporte técnico, no como base de seguridad.
