# Sprint 02 Security Status

## Objetivo

Cerrar ownership y autorizacion por recurso en agregados vecinos de `projects`.

## Estado

### Completado

- `projects`
  - permisos semanticos
  - ownership por recurso
  - financial reads protegidos
  - lifecycle endurecido

- `evidence`
  - permiso `evidence:read`
  - permiso `evidence:write`
  - policy por ownership de proyecto
  - lecturas por `job`, `project` y `evidenceId` protegidas por ownership
  - registro de evidencia protegido por ownership real

- `disputes`
  - permiso `disputes:read`
  - lectura filtrada por ownership
  - create/assign/resolve bajo policy explicita
  - `OPS_ADMIN` como excepcion explicita

- `milestones`
  - `GET /v1/jobs/:jobId/milestones` ahora usa `milestones:read`
  - submit/approve/reject ya estaban gobernados por policy

### Revisado

- `payments`
  - lectura y escritura financiera siguen apoyadas en ownership financiero de `projects`
  - la integracion con `roles` quedo alineada

## Validacion

- `tsc -p apps/api/tsconfig.json --noEmit`: paso
- `build:api`: paso

## Riesgos Pendientes

- falta smoke especifico de `evidence`
- falta reforzar smoke de denegacion en `disputes`
- `payments` sigue dependiendo de `Project` como agregado financiero transitorio

## Siguiente Paso

- ejecutar cobertura minima de denegacion para `evidence` y `disputes`
- luego pasar a Sprint 03 de contratos y shared schemas
