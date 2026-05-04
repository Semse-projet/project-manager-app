# Integration Execution Status

## Fecha

- 2026-03-12

## Frente

- Prisma
- Shared Schemas
- Ops Backend
- Web Proxy + UI Runtime

## Trabajo Ejecutado

### 1. Prisma

Se reforzo la transicion hacia ownership por organizacion sin romper la herencia:

- `JobReservation.professionalOrgId`
- `Contract.clientOrgId`
- `Contract.professionalOrgId`
- relaciones inversas en `Org`

Lectura:

- usuario sigue sirviendo para firma y auditoria
- organizacion pasa a ser referencia canonica de ownership

### 2. Shared Schemas

Se alinearon contratos hacia el dominio canonico:

- `marketplace.schema.ts` ahora usa ids por organizacion para job, reservation y contract
- `job.schema.ts` se amplio con `clientOrgId`, `category`, `location` y `budgetType`
- se agregaron `project.schema.ts` y `ops.schema.ts`
- `ops.schema.ts` ahora incluye snapshots de `control-surface` y `cortex`

### 3. Ops Backend

`ops.dashboard` ahora expone:

- compatibilidad heredada:
  - `published`
  - `awarded`
- y estados mas cercanos a la vision:
  - `posted`
  - `reserved`
  - `accepted`
  - `inProgress`
  - `review`
  - `dispute`
  - `completed`
  - `cancelled`

Tambien se agrego `projects.cancelled`.

### 4. Web

Se corrigio el punto correcto de integracion:

- `apps/web` no habla directo al backend; usa rutas proxy `/api/semse/*`
- el proxy ahora preserva `403/404/409` upstream en lugar de colapsarlos a `502`
- los warnings quedan normalizados para `control-surface` y `cortex`
- las rutas proxy validan snapshots y resultados con `@semse/schemas`

## Conflictos Resueltos

### Ownership mezclado entre usuario y organizacion

Se resolvio con cambio aditivo:

- no se elimino trazabilidad por usuario
- se introdujo ownership canonico por organizacion

### Desalineacion entre proxy web y cliente React

Se detecto que el cliente ya usaba `/api/semse/*`.
La correccion se aplico en el proxy, no reescribiendo el flujo del frontend.

### Divergencia entre ops y vision

Se mantuvo compatibilidad con estados heredados y se anadieron campos que reflejan mejor el flujo canonico.

## Riesgos Pendientes

- `Project` sigue siendo agregado transitorio
- auth real sigue pendiente; headers siguen siendo bootstrap tecnico
- falta revalidacion limpia de build/check despues de todos los cambios
- `apps/web/package.json` ya declara `@semse/schemas`; conviene correr install si el workspace local no esta actualizado

## Siguiente Tranche

1. correr `npm install --workspaces` si hace falta refrescar links del workspace
2. correr `prisma generate`
3. correr `build:api`
4. correr `build:web`
5. correr smoke de `projects`
6. revisar si `jobs` debe empezar a absorber responsabilidades hoy concentradas en `Project`
