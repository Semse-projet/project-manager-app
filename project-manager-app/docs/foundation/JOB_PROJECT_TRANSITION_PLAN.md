# Job Project Transition Plan

## Objetivo

Mover el dominio hacia `Job` como agregado canonico sin romper el API actual,
manteniendo `Project` como agregado operativo transitorio mientras se reubican
lecturas, ownership y lifecycle.

## Estado Actual

`Job` ya es la entidad canonica de producto y marketplace en la vision.

`Project` sigue siendo hoy el agregado operativo al que estan anclados:

- milestones
- escrow y payments
- evidence
- disputes
- trust by project
- snapshots de ops

## Regla de Transicion

No hacer un reemplazo big bang.

La transicion se ejecuta en este orden:

1. contratos y lenguaje
2. lecturas derivadas desde `Job`
3. lifecycle y ownership
4. escrituras nuevas
5. compatibilidad legacy

## Responsabilidades Futuras

### Job

Debe ser canonico para:

- marketplace
- ownership base del trabajo
- estado comercial del trabajo
- relacion cliente/profesional
- contrato
- hitos desde perspectiva de negocio
- trust principal

### Project

Debe quedar reducido a:

- contenedor operativo legado
- puente tecnico para ejecucion historica
- compatibilidad de rutas y relaciones que aun dependen de `projectId`

## Inventario de Dependencias Actuales

### Ancladas a Project en Prisma

- `Milestone.projectId`
- `PaymentEscrow.projectId`
- `PaymentTxn.projectId`
- `Dispute.projectId`
- `Evidence.projectId`
- `TrustSignal.projectId`

### Backend API

- `modules/projects/*`
- `modules/milestones/*`
- `modules/payments/*`
- `modules/evidence/*`
- `modules/disputes/*`
- `modules/trust/*`
- `modules/ops/ops.service.ts`
- `modules/reservations/reservations.repository.ts` crea `Project` al aceptar

### Web y Schemas

- `packages/schemas/src/project.schema.ts`
- `packages/schemas/src/ops.schema.ts`
- `apps/web/app/semse-control-surface.tsx`

## Fases

### Fase A

Hacer que las lecturas por `jobId` sean la primera clase, aunque por debajo
sigan resolviendo `projectId`.

Objetivos:

- `payments` por job ya existe y debe consolidarse como via principal
- `milestones` por job deben ser preferidos en consumo
- `evidence` por job debe ser preferido en consumo
- `trust` por job debe ser preferido en consumo

### Fase B

Desacoplar ownership y policy de `Project`.

Objetivos:

- ownership resuelto primero desde `Job`
- `Project` consume ownership derivado del job
- policies dejan de tratar `Project` como fuente primaria de verdad

### Fase C

Mover lifecycle canonico a `Job`.

Objetivos:

- definir status canonico de `Job`
- mantener `Project.status` como espejo operativo o compatibilidad
- bloquear divergencias entre ambos

### Fase D

Reducir superficie publica centrada en `Project`.

Objetivos:

- nuevas rutas se diseñan job-first
- rutas project-centric quedan como legacy compat
- `ops` consume snapshots derivados del job

## Primer Corte Recomendado

1. documentar rutas y consumers job-first existentes
2. introducir helpers de resolucion `job -> project` en repositorios compartidos
3. mover `milestones`, `evidence` y `trust` a lectura canonica por job
4. mantener project endpoints sin romper shape

## No Hacer

- no eliminar `Project` del schema aun
- no renombrar rutas existentes sin capa de compatibilidad
- no duplicar lifecycle completo en `Job` y `Project` sin politica de sincronizacion
- no migrar financial writes sin cerrar primero ownership y lecturas
