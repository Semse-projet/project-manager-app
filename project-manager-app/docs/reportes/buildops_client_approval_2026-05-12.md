# BuildOps Client Approval

## Fecha de implementacion
2026-05-11

## Estado
cerrado para este alcance

Estado conceptual correcto:

```txt
Approval flow: implemented and validated.
Legacy promotion: not implemented yet; documented as next dependency.
Bridge re-run/versioning: not implemented yet.
```

## Resumen

Se implemento el flujo de aprobacion del plan del cliente sobre `BuildOpsProject` con rutas backend bajo `v1/buildops/plans/:buildOpsProjectId/*`.

Estados soportados:

```txt
pending
approved
changes_requested
rejected
```

Operaciones soportadas:

- aprobar plan como cliente
- aprobar plan como `OPS_ADMIN` con override y reason obligatorio
- pedir cambios
- rechazar
- desaprobar mientras no exista `JobReservation` aceptada ni artefactos legacy promovidos

## Decisiones tecnicas

### Routing

No se creo un controller paralelo bajo otro modulo. Los endpoints quedaron dentro del controller real de `buildops` para no duplicar ownership de rutas ni guards.

Rutas agregadas:

```txt
POST /v1/buildops/plans/:buildOpsProjectId/approve
POST /v1/buildops/plans/:buildOpsProjectId/request-changes
POST /v1/buildops/plans/:buildOpsProjectId/reject
POST /v1/buildops/plans/:buildOpsProjectId/unapprove
```

### Permisos

Se uso `projects:status:update` en vez de `projects:create`.

Motivo:

- `CLIENT` ya tiene `projects:status:update`
- `CLIENT` no tiene `projects:create`
- estas rutas mutan estado de plan, no crean recursos nuevos

### Autenticacion / trazabilidad

No se acepta `triggeredBy` ni identificadores de actor desde el body. Todos los cambios usan el actor autenticado resuelto por `resolveRequestContext(...)`.

### Concurrencia

Se uso `Prisma.TransactionIsolationLevel.Serializable` para las mutaciones del approval flow.

Motivo:

- `SELECT FOR UPDATE` sobre `BuildOpsProject` no serializa contra `JobReservation.accept()`
- `unapprove` necesita leer ausencia de `JobReservation` aceptada y luego mutar estado sin ventana TOCTOU
- el repo ya usa el mismo patron en pagos

Manejo:

- si Prisma devuelve conflicto serializable (`P2034` o equivalente), el servicio responde `409 Conflict`
- el mensaje usado es:

```txt
concurrent state change detected, please retry
```

### Guard defensivo de drift

`unapprove` y las transiciones desde `approved` tambien verifican que no existan milestones ya promovidos desde ese `BuildOpsProject`.

Si hay milestones con `checklistSchema.meta.buildOpsProjectId === bop.id`, se bloquea la transicion y se exige revision manual.

Esto cubre drift de datos tipo:

- resets manuales de `legacyPromotionStatus`
- restores parciales
- fallos historicos no limpiados
- intervenciones admin fuera del flujo

## Persistencia agregada

Se agregaron estos campos en `BuildOpsProject`:

- `clientPlanApprovalStatus`
- `clientPlanApprovedAt`
- `clientPlanApprovedById`
- `clientPlanApprovalSource`
- `clientPlanApprovalReason`
- `clientPlanReviewedAt`
- `clientPlanReviewComment`
- `clientPlanUnapprovedAt`
- `clientPlanUnapprovedById`
- `clientPlanUnapprovalReason`
- `legacyPromotionStatus`
- `legacyPromotedAt`

Indices agregados:

- `(tenantId, clientPlanApprovalStatus)`
- `(tenantId, legacyPromotionStatus)`

## Archivos principales

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260512100000_buildops_client_approval/migration.sql`
- `apps/api/src/modules/buildops/buildops.controller.ts`
- `apps/api/src/modules/buildops/buildops.module.ts`
- `apps/api/src/modules/buildops/buildops.service.ts`
- `apps/api/src/modules/buildops/buildops-plan-approval.service.ts`
- `apps/api/src/modules/buildops/buildops-plan-approval.types.ts`
- `apps/api/test/buildops-plan-approval.service.test.ts`
- `apps/api/test/buildops-plan-approval-integration.test.ts`
- `scripts/buildops-client-approval-smoke.mjs`

## Comandos ejecutados

```bash
npm run prisma:generate --workspace @semse/db
npm run build:api
npm exec --workspace @semse/db prisma migrate deploy
node --experimental-strip-types --test apps/api/test/buildops-plan-approval.service.test.ts
node --experimental-strip-types --test apps/api/test/buildops-plan-approval-integration.test.ts
node ./scripts/buildops-client-approval-smoke.mjs
npm run typecheck
npm run build:web
```

## Resultados

- `prisma:generate`: OK
- `build:api`: OK
- `migrate deploy`: OK
- unit test service: OK
- integration test DB real: OK
- smoke HTTP local: OK
- `typecheck`: OK
- `build:web`: OK

Resultado resumido del smoke:

```json
{
  "ok": true,
  "buildOpsProjectId": "bop_smoke_1778589478528_efqa2m",
  "clientApprovedAt": "2026-05-12T12:37:59.606Z",
  "adminOverrideApproved": "admin_override",
  "blockedAfterAcceptedReservation": {
    "unapproveStatus": 403,
    "requestChangesStatus": 403
  }
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

## Gap reconocido

El ajuste retroactivo pedido para `promote` no se aplico en codigo porque el repo todavia no tiene implementado el metodo/ruta de `legacy-promote`.

Hallazgo real:

- existe el bridge que crea `BuildOpsProject` y persiste `sourceToolResult`
- no existe todavia el metodo equivalente a `promoteBuildOpsPlanToLegacyProjectArtifacts(...)`

Consecuencia:

- el guard `clientPlanApprovalStatus === "approved" && clientPlanApprovedAt !== null` queda documentado como requisito obligatorio del siguiente frente de promotion
- no se invento codigo inexistente solo para cumplir el reporte

## Deuda restante

1. No hay historial completo de approval events; solo se conserva el ultimo estado/auditoria en `BuildOpsProject`.
2. No hay notificaciones al cliente/profesional cuando cambia el estado del plan.
3. `changes_requested` aun no dispara rerun del bridge; queda como el siguiente frente natural.
4. El promote legacy sigue pendiente de implementacion real.

## Criterio de aceptacion cumplido

Se cumple el criterio del frente:

```txt
un cliente puede aprobar el plan de su BuildOpsProject;
un admin puede aprobar como override con reason;
ambos pueden pedir cambios o rechazar con comentario;
ambos pueden desaprobar mientras no haya reservation aceptada ni artefactos legacy promovidos;
las transiciones invalidas fallan con errores claros;
las rutas son idempotentes cuando el estado destino ya fue alcanzado.
```
