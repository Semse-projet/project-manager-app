# BuildOps Bridge Re-run / Versioning · 2026-05-12

## Resumen ejecutivo

Se implementó el frente `changes_requested -> rerun bridge -> sourceToolResult versionado -> plan revisable -> approval/promote`.

Resultado:

- `BuildOpsPlanVersion` pasa a ser la fuente histórica del plan.
- `BuildOpsProject.sourceToolInput/sourceToolResult` sigue como espejo activo por compatibilidad.
- El re-run solo se permite desde `clientPlanApprovalStatus = "changes_requested"`.
- El primer trigger es manual vía `POST /v1/buildops/plans/:buildOpsProjectId/rerun-bridge`.
- El re-run vuelve el plan a `pending`.
- Se bloquea el re-run si el plan ya fue promovido a legacy o si hay un re-run `running`.
- No se sobrescribe historial.
- No se tocó `PaymentEscrow`.
- No se implementó `cron`, `webhook`, `re-run` automático ni versionado UI.

## Auditoría inicial

### Modelos encontrados

- `BuildOpsProject` ya era el aggregate activo del plan y contenía:
  - `sourceToolInput`
  - `sourceToolResult`
  - `clientPlanApprovalStatus`
  - `clientPlanReviewComment`
  - `legacyPromotionStatus`
- `BuildOpsTask` ya funcionaba como proyección activa del plan.
- `Project`, `Milestone`, `JobTask` y `Evidence` ya tenían trazabilidad de legacy promotion vía `promotedFromBuildOpsProjectId`.
- No existía un modelo canónico para versionar planes BuildOps.

### Rutas encontradas

- `POST /v1/jobs/:jobId/operations/bridge`
- `POST /v1/buildops/plans/:buildOpsProjectId/approve`
- `POST /v1/buildops/plans/:buildOpsProjectId/request-changes`
- `POST /v1/buildops/plans/:buildOpsProjectId/reject`
- `POST /v1/buildops/plans/:buildOpsProjectId/unapprove`
- `POST /v1/buildops/plans/:buildOpsProjectId/promote-legacy`

### Servicios encontrados

- `IntakeOperationsBridgeService` calculaba y persistía el plan activo in-place.
- `BuildOpsPlanApprovalService` manejaba approval/unapprove.
- `BuildOpsLegacyPromotionService` promovía el plan aprobado a entidades legacy.

### Gap confirmado

- No existía historial/versionado.
- El bridge inicial no aceptaba contexto estructurado de re-run y no separaba cálculo de persistencia.

## Implementación

### Schema Prisma

Se agregó `BuildOpsPlanVersion` con campos:

- `id`
- `tenantId`
- `buildOpsProjectId`
- `versionNumber`
- `sourceToolInputJson`
- `sourceToolResultJson`
- `inputSnapshotJson`
- `clientPlanReviewCommentSnapshot`
- `runReason`
- `triggeredByUserId`
- `triggeredAt`
- `completedAt`
- `previousVersionId`
- `status`
- `errorMessage`
- `createdAt`
- `updatedAt`

Constraints / índices:

- `unique(buildOpsProjectId, versionNumber)`
- `index(tenantId, buildOpsProjectId, status)`
- `index(buildOpsProjectId, previousVersionId)`
- índice parcial único `active` por `buildOpsProjectId`
- índice parcial único `running` por `buildOpsProjectId`

### Servicio nuevo

`BuildOpsPlanRerunService`

Responsabilidades:

- valida estado `changes_requested`
- valida `OPS_ADMIN`
- bloquea si hay promotion legacy
- bloquea si ya existe versión `running`
- bootstrappea `version 1` desde el espejo activo si no existía historial
- crea nueva versión `running`
- ejecuta el bridge fuera de transacción
- marca versión previa `superseded`
- activa la nueva versión
- actualiza `BuildOpsProject.sourceToolInput/sourceToolResult`
- actualiza `BuildOpsTask` como proyección activa
- resetea approval a `pending`
- marca `failed` si el bridge falla

### Endpoint nuevo

`POST /v1/buildops/plans/:buildOpsProjectId/rerun-bridge`

Protección:

- `projects:status:update`
- `resolveRequestContext`

Regla adicional v1:

- requiere actor con rol `OPS_ADMIN`

### Reuso del bridge

Se agregó capa reusable en `IntakeOperationsBridgeService`:

- `computeBridgePlan(...)`
- `syncProjectedBuildOpsTasks(...)`

Con esto el re-run no llama al endpoint HTTP del bridge y reutiliza cálculo + proyección activa dentro del backend.

## Estados y reglas

### Estados de versión

- `running`
- `active`
- `superseded`
- `failed`

### Re-run permitido

- solo desde `clientPlanApprovalStatus = "changes_requested"`

### Re-run bloqueado

- `approved`
- `pending`
- `rejected`
- `null/undefined`
- `legacyPromotionStatus = "promoted"`
- cualquier artefacto legacy ya promovido desde ese `BuildOpsProject`
- cualquier versión `running` existente

### Estado posterior exitoso

- `clientPlanApprovalStatus = "pending"`

No se agregó enum nuevo `review_required`.

## Atomicidad y patrón transaccional

### Transacción A · `Serializable`

- valida estado
- valida no promoted
- valida no `running`
- bootstrappea `version 1` si no existe historial
- crea nueva versión `running`

### Bridge fuera de transacción

- calcula nuevo `sourceToolInput`
- calcula nuevo `sourceToolResult`
- calcula proyección activa de tareas

### Transacción B · `Serializable`

- revalida no promoted
- revalida que la versión siga `running`
- marca versión previa `superseded`
- marca nueva versión `active`
- setea `completedAt`
- actualiza espejo activo en `BuildOpsProject`
- actualiza `BuildOpsTask`
- limpia aprobación previa:
  - `clientPlanApprovedAt`
  - `clientPlanApprovedById`
  - `clientPlanApprovalSource`
  - `clientPlanApprovalReason`
- devuelve el resumen del re-run

### Falla del bridge

- Transacción C corta
- marca la nueva versión `failed`
- guarda `errorMessage`
- deja `BuildOpsProject` intacto
- mantiene `clientPlanApprovalStatus = "changes_requested"`

## Idempotencia / concurrencia

- No se sobrescribe `sourceToolResult`.
- El historial vive en `BuildOpsPlanVersion`.
- El espejo activo vive en `BuildOpsProject`.
- Solo puede existir una versión `running` por plan.
- Solo puede existir una versión `active` por plan.
- Un segundo re-run simultáneo se bloquea con `409`.
- Después de un re-run exitoso, otra llamada inmediata también se bloquea por estado porque el plan vuelve a `pending`.

## Uso de `clientPlanReviewComment`

- El comentario sigue guardándose en `BuildOpsProject.clientPlanReviewComment`.
- Se toma snapshot en `BuildOpsPlanVersion.clientPlanReviewCommentSnapshot`.
- También se pasa estructurado al `inputSnapshotJson.rerunContext`.

En v1 el comentario queda como contexto estructurado y trazable; no se “fuerza” a ProTools a interpretarlo como señal semántica nueva si la capa de cálculo todavía no lo consume directamente.

## Archivos tocados

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260512170000_buildops_plan_versions/migration.sql`
- `apps/api/src/modules/intake-operations-bridge/intake-operations-bridge.types.ts`
- `apps/api/src/modules/intake-operations-bridge/intake-operations-bridge.service.ts`
- `apps/api/src/modules/buildops/buildops.module.ts`
- `apps/api/src/modules/buildops/buildops.controller.ts`
- `apps/api/src/modules/buildops/buildops-plan-rerun.types.ts`
- `apps/api/src/modules/buildops/buildops-plan-rerun.service.ts`
- `apps/api/test/buildops-plan-rerun.service.test.ts`
- `apps/api/test/buildops-plan-rerun-integration.test.ts`
- `scripts/buildops-rerun-bridge-smoke.mjs`

## Validaciones ejecutadas

### Prisma

- `npm run prisma:generate --workspace @semse/db`
- `npm exec --workspace @semse/db prisma migrate deploy`

Resultado:

- OK

### Build / typecheck

- `npm run build:api`
- `npm run typecheck`
- `npm run build:web`

Resultado:

- API: OK
- Typecheck: OK
- Web: OK con warnings viejos de hooks y warning viejo de `next.config.ts` (`experimental.nodeMiddleware`)

### Tests

- `node --experimental-strip-types --test apps/api/test/buildops-plan-rerun.service.test.ts`
- `node --experimental-strip-types --test apps/api/test/buildops-plan-rerun-integration.test.ts`

Resultado:

- unit: `pass 7 / fail 0`
- integration: `pass 2 / fail 0`

### Smoke HTTP

- `node ./scripts/buildops-rerun-bridge-smoke.mjs`

Resultado:

- primera llamada:
  - crea `version 1` bootstrap + `version 2` activa
  - crea `BuildOpsTask` proyectadas
  - resetea approval a `pending`
- segunda llamada:
  - bloquea con `409`
- plan marcado como promoted:
  - bloquea con `409`

## Gaps restantes

- no existe read endpoint de historial/versiones
- no existe recuperación automática de versiones `running` stale
- no se implementó `cron`
- no se implementó `webhook`
- no se implementó `PaymentEscrow`
- no se implementó UI de historial/versionado
- `clientPlanReviewComment` todavía no viaja a ProTools como semántica enriquecida; hoy viaja como contexto estructurado

## Estado final del frente

- `Approval flow`: cerrado previamente
- `Legacy promotion`: cerrado previamente
- `Bridge re-run / sourceToolResult versioning`: implementado y validado
- `changes_requested`: ya no es estado terminal

## Próximo frente recomendado

- exponer lectura de historial/versiones de `BuildOpsPlanVersion`
- diseñar reconciliación/version diff para cliente/ops
- evaluar re-run asistido o automatizado solo después de cerrar recuperación de `running` stale y visibilidad del historial
