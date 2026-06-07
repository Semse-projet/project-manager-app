# Sprint 03 Schema Status

## Objetivo

Alinear `packages/schemas` con el runtime real y reducir duplicacion innecesaria de tipos.

## Trabajo Ejecutado

### Shared Schemas

Se consolidaron tipos inferidos en:

- `packages/schemas/src/ops.schema.ts`
- `packages/schemas/src/project.schema.ts`

Ahora exportan:

- `OpsDashboard`
- `OpsMutationResult`
- `AgentRunSummary`
- `AuditEntry`
- `RiskScore`
- `ControlSurfaceSnapshot`
- `CortexSnapshot`
- `ProjectStatus`
- `ProjectSummary`
- `ProjectEscrowSummary`
- `UpdateProjectStatus`

### Web

`apps/web/app/semse-api.ts` ya consume tipos compartidos desde `@semse/schemas`
en vez de redefinir localmente:

- `ControlSurfaceSnapshot`
- `CortexSnapshot`
- `OpsMutationResult`

### API

Los controllers de backend ya consumen schemas compartidos para validacion de
payloads y queries en estos agregados:

- `apps/api/src/modules/jobs/jobs.controller.ts`
- `apps/api/src/modules/reservations/reservations.controller.ts`
- `apps/api/src/modules/contracts/contracts.controller.ts`
- `apps/api/src/modules/projects/projects.controller.ts`
- `apps/api/src/modules/bids/bids.controller.ts`
- `apps/api/src/modules/payments/payments.controller.ts`
- `apps/api/src/modules/evidence/evidence.controller.ts`
- `apps/api/src/modules/disputes/disputes.controller.ts`

Se usan estos schemas de `@semse/schemas`:

- `createRuntimeJobSchema`
- `listJobsQuerySchema`
- `reserveJobSchema`
- `generateContractSchema`
- `signContractSchema`
- `listProjectsQuerySchema`
- `updateProjectStatusSchema`
- `bidSchema`
- `depositEscrowSchema`
- `releaseEscrowSchema`
- `paymentsWebhookSchema`
- `presignEvidenceSchema`
- `registerEvidenceSchema`
- `createProjectDisputeSchema`
- `assignDisputeSchema`
- `resolveProjectDisputeSchema`

Ademas, `apps/api/package.json` declara ya la dependencia explicita
`@semse/schemas` para no depender de resolucion accidental del workspace.

## Estado de Integracion

### Ya alineado

- snapshots de `ops` y `cortex`
- mutation results de `ops`
- shape basico de `project`
- validacion de `jobs`, `reservations` y `contracts` contra shared schemas
- validacion de `projects` y `bids` contra shared schemas
- validacion de `payments`, `evidence` y `disputes` contra shared schemas

### Todavia en transicion

- varios route handlers de `web` no validan runtime con zod compartido por estabilidad del build
- `job.schema.ts` y `marketplace.schema.ts` siguen siendo mixtos entre canonico y compatibilidad heredada
- la validacion final por `tsc` de esta ultima tranche quedo pendiente de reconfirmar por saturacion del runner, no por error confirmado del repo
- backend y web aun tienen algunos tipos locales fuera de este frente

## Decisiones

- usar tipos compartidos donde no rompa runtime o build
- no reintroducir validacion runtime en `app routes` si vuelve a desestabilizar `next build`
- priorizar primero tipos compartidos y luego validacion compartida

## Siguiente Paso

- auditar `payments`, `milestones` y `disputes` para identificar si sus payloads
  pueden pasar a validacion compartida sin romper runtime
- decidir que consumidores restantes del backend/web pueden pasar a tipos
  compartidos sin riesgo
- mantener documentadas las divergencias de transicion
