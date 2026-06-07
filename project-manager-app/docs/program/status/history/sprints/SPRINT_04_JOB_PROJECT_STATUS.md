# Sprint 04 Job Project Status

## Objetivo

Reducir el acoplamiento directo a `Project` e iniciar la transicion hacia
lecturas canonicas por `Job`, sin romper rutas ni contratos actuales.

## Trabajo Ejecutado

### Inventario de Dependencias

Se confirmo que `Project` sigue siendo el ancla operativa principal para:

- milestones
- payments
- evidence
- disputes
- trust
- snapshots de ops

Tambien se confirmo que ya existen rutas job-first en:

- `milestones`
- `payments`
- `evidence`
- `trust`

pero varias de ellas seguian resolviendo `jobId -> projectId` con logica
duplicada por agregado.

### Resolver Compartido

Se creo:

- `apps/api/src/common/project-link.resolver.ts`

Funciones publicadas:

- `findProjectLinkByProjectIdOrThrow`
- `findProjectLinkByJobIdOrThrow`

Estas funciones normalizan la resolucion del puente operativo:

- `tenantId`
- `projectId`
- `jobId`
- `assignedProOrgId`
- `job.clientOrgId`

### Integracion Aplicada

Se adopto el resolver compartido en:

- `apps/api/src/modules/milestones/milestones.repository.ts`
- `apps/api/src/modules/evidence/evidence.repository.ts`
- `apps/api/src/modules/payments/payments.repository.ts`

## Compatibilidad Preservada

- `evidence.listByJob` sigue devolviendo `[]` cuando el job todavia no tiene
  project operativo, en vez de elevar `NotFound`

## Estado

### Ya mejorado

- menos duplicacion de consultas `jobId -> projectId`
- ownership operativo derivado desde una pieza comun
- base preparada para mover mas lecturas a `Job`

### Pendiente

- `trust.repository.ts` sigue con resolucion propia
- `ops.service.ts` sigue leyendo `project` directamente para varias vistas
- no se ha movido lifecycle canonico desde `Project` a `Job`

## Validacion

- se ejecuto `tsc` acotado con timeout sobre `apps/api`
- no aparecio error tipado confirmado antes del corte
- la validacion completa sigue degradada por saturacion del runner

## Siguiente Paso

1. aplicar el resolver compartido en `trust` donde tenga sentido
2. inventariar consumers de `ops` que pueden pasar a lectura job-first
3. definir helper o facade comun para lecturas canonicas por `jobId`
