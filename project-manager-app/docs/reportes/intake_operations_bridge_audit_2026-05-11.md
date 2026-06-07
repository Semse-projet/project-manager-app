# Intake Operations Bridge Audit

## Fecha
2026-05-11

## Estado
auditoria completada

## Objetivo auditado

Definir el puente minimo entre `ProjectIntake` y una operacion monetizable sin duplicar modelos existentes y sin invadir `smart-intake`.

Contrato objetivo:

```txt
ProjectIntake
-> Job
-> Marketplace Matching
-> BuildOpsProject
-> BuildOpsTask
-> ProTools Estimate/Scope
-> Milestones
-> Evidence Requirements
-> Payment/Escrow Readiness
```

## Entidades encontradas

### 1. Intake / origen

- `ProjectIntake`
  - Ubicacion: `packages/db/prisma/schema.prisma`
  - Campos clave:
    - `publishedJobId`
    - `rawDescription`
    - `normalizedTitle`
    - `detectedCategory`
    - `city`
    - `urgency`
    - `accuracyScore`
    - `missingFields`
    - `projectScopeJson`
    - `generatedEstimateJson`
    - `generatedMilestonesJson`
    - `status`
  - Servicio actual:
    - `apps/api/src/modules/smart-intake/smart-intake.service.ts`
  - Estado:
    - ya publica un `Job`
    - ya es idempotente a nivel `publish`

### 2. Job / oportunidad operativa

- `Job`
  - Ya existe como entidad canonica del trabajo.
  - Servicios actuales:
    - `apps/api/src/modules/jobs/jobs.service.ts`
    - `apps/api/src/modules/jobs/jobs.repository.ts`
  - Matching actual:
    - `apps/api/src/modules/matching/*`
  - Hallazgo:
    - `smart-intake` publica un trabajo real, pero `JobsRepository.create()` lo persiste con estado `POSTED`.
    - `smart-intake` responde `status: "published"` a nivel API, pero eso no implica que la fila en DB quede en `PUBLISHED`.

### 3. Marketplace / matching

- No existe un modelo Prisma dedicado a marketplace matching.
- Si existe motor de matching:
  - `MatchingService`
  - `MatchingRepository`
  - endpoint `POST /v1/matching/jobs`
- Hallazgo:
  - el matching hoy es calculado, no persistido
  - esto permite usar snapshot o resumen sin crear otro modelo

### 4. Operacion BuildOps

- `BuildOpsProject`
  - existe, pero no esta ligado al `Job`
  - campos actuales relevantes:
    - `title`
    - `description`
    - `trade`
    - `projectType`
    - `clientName`
    - `location`
    - `budgetEstimate`
    - `status`
    - `riskScore`
    - `riskLevel`
    - `sourceTool`
    - `sourceToolInput`
    - `sourceToolResult`
- `BuildOpsTask`
  - existe y puede colgar de `BuildOpsProject`
  - tiene `evidenceRequired` JSON util para requerimientos operativos
- Servicios actuales:
  - `apps/api/src/modules/buildops/*`

### 5. Milestones / evidencia / pagos del flujo legacy

- `Project`
  - entidad operativa legacy ligada a `Job`
  - se crea al aceptar una reserva
  - no nace desde `smart-intake`
- `Milestone`
  - depende de `Project`
- `Evidence`
  - depende de `Project` o `Milestone`
- `PaymentEscrow`
  - depende de `Project`
- Servicios:
  - `apps/api/src/modules/projects/*`
  - `apps/api/src/modules/milestones/*`
  - `apps/api/src/modules/evidence/*`
  - `apps/api/src/modules/payments/*`

### 6. Estimate / quote / docs

- No hay modelo Prisma dedicado a `Estimate` o `Quote`.
- Si existen piezas reutilizables:
  - `ProjectIntake.generatedEstimateJson`
  - `Invoice`
  - `FinanceService`
  - `ContractorEstimateService`
  - `ToolsService.quote(...)`

### 7. ProTools / planes derivados

- Existe infraestructura reusable en `apps/api/src/modules/tools/tools.service.ts`
- Capacidades:
  - `calculate(...)`
  - `quote(...)`
  - `milestones(...)`
  - `evidence(...)`
  - `escrow(...)`
- Fuente:
  - `packages/tools`
- Hallazgo:
  - esto permite preparar estimate/scope, checklist de evidencia, milestones y escrow plan sin crear otro motor

## Relaciones actuales

### Camino que ya existe

```txt
ProjectIntake.publishedJobId
-> Job.id
```

### Camino legacy de ejecucion real

```txt
Job
-> Reservation accepted
-> Project
-> Milestone
-> Evidence
-> PaymentEscrow
```

### Camino BuildOps actual

```txt
BuildOpsProject
-> BuildOpsTask
```

Hallazgo critico:

```txt
BuildOpsProject hoy no sabe a que Job pertenece.
Milestone/Evidence/PaymentEscrow hoy no pueden existir sin Project legacy.
```

## Duplicaciones potenciales

No conviene crear:

- otro modelo `Job`
- otro modelo `Project`
- otro modelo `Milestone` paralelo al legacy solo para repetir lo mismo
- otro modelo `PaymentReadiness`
- otro modelo `EvidenceRequirement`

Reutilizacion minima recomendada:

- `BuildOpsProject.sourceToolResult` para persistir planes sugeridos pre-assignment
- `BuildOpsTask.evidenceRequired` para requerimientos operativos por tarea
- `PaymentsService.paymentReadinessByJob(...)` para readiness calculado
- `MatchingService.matchJob(...)` para snapshot de matching

## Gaps reales

### Gap 1. Falta vinculo fuerte `Job -> BuildOpsProject`

Sin este vinculo no hay idempotencia limpia para el bridge.

Recomendacion:

- agregar `jobId` opcional y unico en `BuildOpsProject`

### Gap 2. Falta clave estable para tareas base

`BuildOpsTask` existe, pero no tiene una llave natural para no duplicar tareas generadas por el bridge.

Recomendacion:

- agregar `templateKey` opcional en `BuildOpsTask`
- usar `@@unique([projectId, templateKey])`

### Gap 3. `Milestone` legacy no sirve antes de assignment

`Milestone` depende de `Project`, y `Project` hoy nace cuando la reserva es aceptada.

Consecuencia:

- el bridge no debe forzar creacion de `Project`
- los milestones iniciales deben persistirse como plan sugerido dentro de `BuildOpsProject.sourceToolResult`

### Gap 4. No hay modelo de matching persistido

Consecuencia:

- el bridge debe devolver y/o persistir un snapshot resumido de matching, no una entidad nueva

### Gap 5. `smart-intake` no genera directamente un `SemseToolResult`

Consecuencia:

- el bridge debe normalizar el intake a payload de ProTools o a un resultado derivado compatible
- en esta fase, como `smart-intake` actual solo cubre painting, el puente puede arrancar con adaptador de painting

## Implementacion minima recomendada

### Servicio nuevo

`IntakeOperationsBridgeService`

Metodo principal:

```ts
bridgePublishedJobToOperations({
  jobId,
  tenantId,
  orgId,
  userId,
  roles,
}): Promise<...>
```

### Endpoint recomendado

```txt
POST /v1/jobs/:jobId/operations/bridge
```

Motivo:

- el flujo cerrado por `smart-intake` ya termina en `jobId`
- evita volver a colgar operacion de una entidad cuyo rol ya fue publicar

### Estrategia de persistencia

Persistir:

- `BuildOpsProject` real
- `BuildOpsTask` reales

Persistir como plan en metadata del proyecto:

- scope/estimate summary
- matching snapshot
- milestone plan sugerido
- evidence checklist sugerido
- escrow draft sugerido
- payment readiness snapshot

No persistir todavia como entidades legacy:

- `Project`
- `Milestone`
- `Evidence`
- `PaymentEscrow`

Motivo:

- eso pertenece a la fase posterior de assignment / contract / accepted reservation

## Estrategia de idempotencia

### BuildOpsProject

- `find or create` por `jobId`

### BuildOpsTask

- `find or create` por `projectId + templateKey`

### Milestones / evidence / payment draft

- si ya existen en `BuildOpsProject.sourceToolResult`, se consideran reutilizados
- si faltan, se regeneran y se guardan en el mismo proyecto

### Matching

- snapshot recalculable
- actualizar sin duplicar entidad

## Contrato minimo recomendado

Resultado del bridge:

```txt
projectIntakeId
jobId
buildOpsProjectId
buildOpsTaskIds
estimate status + scope summary + missing inputs
matching summary
milestone plan summary
evidence requirements summary
payment readiness summary
idempotency summary
```

## Decision tecnica

La implementacion minima correcta no es:

```txt
Job -> Project legacy inmediato
```

La implementacion minima correcta es:

```txt
Job
-> BuildOpsProject vinculado al job
-> BuildOpsTask base
-> planes sugeridos de milestones/evidence/payment en metadata BuildOps
-> matching snapshot
```

Y dejar:

```txt
Project -> Milestone -> Evidence -> Escrow
```

para la fase donde ya exista reserva/aceptacion/contrato.

## Riesgos abiertos

- `smart-intake` hoy esta centrado en painting; el adaptador ProTools de fase 1 sera trade-specific.
- `Job.status` tiene semantica inconsistente entre `published` y `POSTED`.
- `BuildOps` actual es shell operativo, no sistema canonico de milestones/pagos.

## Siguiente implementacion

1. migracion minima para `BuildOpsProject.jobId` y `BuildOpsTask.templateKey`
2. modulo `intake-operations-bridge`
3. endpoint `POST /v1/jobs/:jobId/operations/bridge`
4. test de idempotencia
5. smoke directo contra API
