# BuildOps Legacy Promotion

## Fecha de implementacion
2026-05-12

## Resumen ejecutivo

Se cerro el frente pendiente de promotion manual desde `BuildOpsProject` aprobado hacia artefactos legacy operativos.

El flujo nuevo promueve en forma manual y segura:

```txt
BuildOps plan aprobado
  -> Project legacy existente por jobId
  -> Milestone legacy
  -> JobTask legacy
  -> Evidence real desde ProjectIntake.uploadedImagesJson, si existe
```

No crea `Project` desde cero y no crea `PaymentEscrow` placeholder.

## Estado final

```txt
Approval flow: cerrado previamente.
Legacy promotion: implementado y validado en este frente.
Re-run/versionado: pendiente.
changes_requested: sigue siendo estado terminal temporal.
sourceToolResult: no fue versionado.
```

## Auditoria inicial

### Modelos encontrados

- `BuildOpsProject`: plan persistido, approval state, `legacyPromotionStatus`, `legacyPromotedAt`, `sourceToolResult`.
- `Job`: punto de enlace con `BuildOpsProject`, `Project`, `JobReservation`, pagos y milestones.
- `Project`: nace desde assignment (`JobReservation.accept()` / bid accept), no desde BuildOps promotion.
- `Milestone`: tiene `checklistSchema` y `requiredEvidenceTypes`, suficiente para promover requisitos/evidence checklist.
- `JobTask`: task legacy de ejecucion por job; permite mapear tasks base desde `BuildOpsTask`.
- `Evidence`: representa uploads reales; no sirve como requirement abstracto.
- `PaymentEscrow`: ledger real de fondos depositados; no sirve para readiness draft.
- `JobReservation`: fuente canonica de assignment aceptado.
- `ProjectIntake`: fuente de `uploadedImagesJson`.

### Rutas encontradas

- `v1/buildops/*`: controller real de BuildOps, incluyendo approval routes y recovery de stale promotions.
- `v1/projects/*`: lectura de proyectos, milestones, escrow y pagos legacy.
- `v1/jobs/*`: lectura/estado de jobs.
- `v1/tools/*`: quote, milestones, evidence, escrow y otros resultados de tools.
- `v1/milestones/*`: lifecycle de milestones legacy.

### Servicios encontrados

- `BuildOpsService`
- `BuildOpsPlanApprovalService`
- `ReservationsRepository.accept()`
- `BidsRepository.accept()`
- `MilestonesService` / `MilestonesRepository`
- `TasksService`
- `PaymentsService`
- `IntakeOperationsBridgeService`

### Tests encontrados

- `buildops-plan-approval.service.test.ts`
- `buildops-plan-approval-integration.test.ts`
- `intake-operations-bridge.service.test.ts`
- tests de tools/copilot ya existentes

### Gaps encontrados antes de implementar

1. No existia `legacy-promote` en el repo.
2. No habia trazabilidad persistida en `Project`, `Milestone`, `JobTask` ni `Evidence` para saber de que `BuildOpsProject` venian.
3. `unapprove` ya estaba preparado para bloquear por `legacyPromotionStatus` o milestones promovidos, pero faltaba el flujo real que marcara y creara esos artefactos.
4. `PaymentEscrow` no podia usarse para readiness porque modela fondos reales, no plan draft.

## Correccion documental del frente anterior

Se corrigio el wording del reporte anterior para dejar explicito:

```txt
Approval flow: implemented and validated.
Legacy promotion: not implemented yet; documented as next dependency.
Bridge re-run/versioning: not implemented yet.
```

Archivo corregido:

- `docs/reportes/buildops_client_approval_2026-05-12.md`

## Implementacion

### Endpoint nuevo

```txt
POST /v1/buildops/plans/:buildOpsProjectId/promote-legacy
```

Proteccion:

- permiso `projects:status:update`
- actor desde `resolveRequestContext`

### Servicio nuevo

- `apps/api/src/modules/buildops/buildops-legacy-promotion.service.ts`

Operacion principal:

```txt
promoteApprovedPlanToLegacy(buildOpsProjectId, actorContext)
```

### Mapper nuevo

- `apps/api/src/modules/buildops/buildops-legacy-promotion.mapper.ts`

Responsabilidades:

- parsear `sourceToolResult` persistido real
- mapear `milestonePlan` a `Milestone`
- mapear `evidenceChecklist` a `checklistSchema` + `requiredEvidenceTypes`
- mapear `BuildOpsTask` a `JobTask`
- mapear `ProjectIntake.uploadedImagesJson` a `Evidence` real

### Trazabilidad agregada

En entidades legacy:

- `Project.promotedFromBuildOpsProjectId`
- `Project.promotedAt`
- `Project.promotedByUserId`
- `Milestone.promotedFromBuildOpsProjectId`
- `Milestone.promotedAt`
- `Milestone.promotedByUserId`
- `JobTask.promotedFromBuildOpsProjectId`
- `JobTask.promotedFromBuildOpsTaskId`
- `JobTask.promotedAt`
- `JobTask.promotedByUserId`
- `Evidence.promotedFromBuildOpsProjectId`
- `Evidence.promotedAt`
- `Evidence.promotedByUserId`

## Reglas implementadas

### Estados permitidos y bloqueados

```txt
approved          -> puede promover
pending           -> bloqueado
rejected          -> bloqueado
changes_requested -> bloqueado
```

### Atomicidad

La promotion corre dentro de:

```txt
Prisma.TransactionIsolationLevel.Serializable
```

Regla:

```txt
todo o nada
```

No queda `Project` nuevo porque el flujo reutiliza el `Project` existente por `jobId`.

### Idempotencia

- si `legacyPromotionStatus === promoted`, el endpoint retorna `already_promoted`
- no duplica `Milestone`
- no duplica `JobTask`
- no duplica `Evidence`

### Integracion con unapprove

Despues de promotion:

- `legacyPromotionStatus = promoted`
- `unapprove` queda bloqueado

## Mapeo real aplicado

```txt
BuildOpsProject aprobado
  -> Project legacy existente por jobId
  -> milestonePlan.milestones[] -> Milestone[]
  -> BuildOpsTask[] -> JobTask[]
  -> evidenceChecklist -> checklistSchema / requiredEvidenceTypes
  -> ProjectIntake.uploadedImagesJson -> Evidence[] reales
```

## Lo que se implemento a proposito como NO-op

### Project legacy

No se crea aqui.

Motivo:

- `Project` ya nace en `ReservationsRepository.accept()` o `BidsRepository.accept()`
- promotion solo lo reutiliza y le agrega trazabilidad

### PaymentEscrow

No se crea aqui.

Motivo:

- `PaymentEscrow` representa fondos reales depositados
- el readiness de pagos sigue viviendo en `sourceToolResult.paymentReadiness`
- funding/escrow real sigue siendo frente separado del flujo de pagos/contratos

## Archivos tocados

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260512143000_buildops_legacy_promotion_trace/migration.sql`
- `apps/api/src/modules/buildops/buildops.controller.ts`
- `apps/api/src/modules/buildops/buildops.module.ts`
- `apps/api/src/modules/buildops/buildops-legacy-promotion.service.ts`
- `apps/api/src/modules/buildops/buildops-legacy-promotion.mapper.ts`
- `apps/api/src/modules/buildops/buildops-legacy-promotion.types.ts`
- `apps/api/test/buildops-legacy-promotion.service.test.ts`
- `apps/api/test/buildops-legacy-promotion-integration.test.ts`
- `scripts/buildops-legacy-promotion-smoke.mjs`
- `docs/reportes/buildops_client_approval_2026-05-12.md`

## Validaciones ejecutadas

```bash
npm run prisma:generate --workspace @semse/db
npm exec --workspace @semse/db prisma migrate deploy
npm run build:api
npm run typecheck
npm run build:web
node --experimental-strip-types --test apps/api/test/buildops-legacy-promotion.service.test.ts
node --experimental-strip-types --test apps/api/test/buildops-legacy-promotion-integration.test.ts
node ./scripts/buildops-legacy-promotion-smoke.mjs
```

## Resultados

- `prisma:generate`: OK
- `prisma migrate deploy`: OK (`No pending migrations to apply.`)
- `build:api`: OK
- `typecheck`: OK
- `build:web`: OK con warnings viejos de hooks no relacionados
- unit tests de promotion: OK
- integration tests de promotion: OK
- smoke HTTP local: OK

Resultado resumido del smoke:

```json
{
  "ok": true,
  "buildOpsProjectId": "bop_smoke_1778622814956_qtscyq",
  "firstPromote": {
    "status": "promoted",
    "milestonesCreated": 2,
    "tasksCreated": 2,
    "evidenceCreated": 1,
    "alreadyPromoted": false,
    "paymentEscrowCreated": false
  },
  "secondPromote": {
    "status": "already_promoted",
    "milestonesCreated": 0,
    "tasksCreated": 0,
    "evidenceCreated": 0,
    "alreadyPromoted": true,
    "paymentEscrowCreated": false
  },
  "blockedUnapproveStatus": 409
}
```

## Warnings no bloqueantes

`build:web` mantuvo warnings viejos de hooks en pantallas no relacionadas:

- `admin/travel`
- `client/disputes`
- `client/leads`
- `worker/disputes`
- `worker/evidence`
- `DisputeResolutionWorkspace`
- warning previo de `next.config.ts` experimental `nodeMiddleware`

No bloquean este frente.

## Gaps restantes

1. `bridge re-run` cuando `clientPlanApprovalStatus = changes_requested`
2. versionado real de `sourceToolResult`
3. usar `clientPlanReviewComment` como input estructurado para ProTools
4. definir quien dispara el re-run (admin, cliente, webhook o cron)
5. payment / escrow real sigue dependiendo del flujo de contrato + funding; no se invento un sistema paralelo aqui

## Proximo frente recomendado

```txt
BuildOps bridge re-run / plan regeneration flow
```

Motivo:

- `changes_requested` sigue siendo estado terminal temporal
- ya existe approval
- ya existe promote legacy
- falta el ciclo completo de iteracion del plan
