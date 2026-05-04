# Bloque 1 - Indices y Soft Delete - 2026-04-08

## Objetivo

Cerrar el primer bloque del backlog:

1. reauditar índices Prisma contra el schema real;
2. dejar soft delete cableado y respetado por el backend actual.

## Hallazgos reales

### 1. El diagnóstico viejo estaba parcialmente desactualizado

Ya existían en el core:

- `AuditLog @@index([tenantId, occurredAt])`
- `Job @@index([tenantId, status])`
- `Dispute @@index([tenantId, status])`
- `AgentRun @@index([correlationId])`

También quedó confirmado que el repo ya tenía `db:seed`, `db:reset` y `packages/db/prisma/seed.ts`, así que ese punto no seguía siendo un gap real.

### 2. El hueco verdadero de soft delete

El schema ya tenía `deletedAt` en varios modelos:

- `Job`
- `Contract`
- `Milestone`
- `PaymentEscrow`
- `Dispute`

Pero ninguna query del backend lo estaba respetando. En la práctica, un registro archivado seguía entrando en lecturas, agregaciones y validaciones como si estuviera activo.

## Cambios realizados

### 1. Índices añadidos al schema Prisma

Se actualizó `packages/db/prisma/schema.prisma` con los índices faltantes de más retorno operativo:

- `Job @@index([tenantId, clientOrgId])`
- `Contract @@index([professionalOrgId, deletedAt])`
- `Dispute @@index([tenantId, projectId, status])`
- `AgentRun @@index([tenantId, correlationId])`

### 2. Migration SQL versionada

Se dejó versionada la migration manual:

- `packages/db/prisma/migrations/20260408133000_soft_delete_and_runtime_indexes/migration.sql`

Esa migration:

- agrega columnas `deletedAt` si aún no existen en `Job`, `Contract`, `Milestone`, `PaymentEscrow` y `Dispute`
- crea índices nuevos para soft delete y runtime lookup

### 3. Soft delete respetado por lecturas y agregaciones

Se añadieron filtros activos sobre `deletedAt: null` en los repositorios que operan con esos modelos:

- `apps/api/src/modules/jobs/jobs.repository.ts`
- `apps/api/src/modules/disputes/disputes.repository.ts`
- `apps/api/src/modules/contracts/contracts.repository.ts`
- `apps/api/src/modules/milestones/milestones.repository.ts`
- `apps/api/src/modules/payments/payments.repository.ts`
- `apps/api/src/modules/projects/projects.repository.ts`
- `apps/api/src/modules/projects/project-link.repository.ts`
- `apps/api/src/modules/trust/trust.repository.ts`
- `apps/api/src/modules/ratings/ratings.repository.ts`
- `apps/api/src/modules/reservations/reservations.repository.ts`
- `apps/api/src/modules/bids/bids.repository.ts`
- `apps/api/src/modules/evidence/evidence.repository.ts`
- `apps/api/src/modules/ops/ops.repository.ts`

Efecto práctico:

- jobs archivados ya no aparecen en listados ni dashboards
- disputes archivados ya no cuentan como abiertos
- milestones archivados ya no distorsionan confianza ni estado del proyecto
- escrows archivados ya no entran en resúmenes financieros activos
- contratos archivados dejan de bloquear flujos como si siguieran vigentes

### 4. Endpoints no destructivos para archive / restore

Se implementaron endpoints reales en:

- `apps/api/src/modules/jobs/jobs.controller.ts`
- `apps/api/src/modules/disputes/disputes.controller.ts`

Nuevas rutas:

- `POST /v1/jobs/:jobId/archive`
- `POST /v1/jobs/:jobId/restore`
- `POST /v1/disputes/:disputeId/archive`
- `POST /v1/disputes/:disputeId/restore`

Se cablearon sus servicios y repositorios:

- `apps/api/src/modules/jobs/jobs.service.ts`
- `apps/api/src/modules/jobs/jobs.repository.ts`
- `apps/api/src/modules/disputes/disputes.service.ts`
- `apps/api/src/modules/disputes/disputes.repository.ts`

Y se agregaron permisos nuevos en RBAC compartido:

- `jobs:archive`
- `jobs:restore`
- `disputes:archive`
- `disputes:restore`

También se alineó el seed de roles/permisos en:

- `packages/db/prisma/seed.ts`

## Validación local

Matriz verde:

```bash
npm run db:generate
npm run lint --workspace @semse/api
npm run test:unit --workspace @semse/api
npm run build:api
```

Además fue necesario resincronizar el Prisma client generado entre:

- `node_modules/.prisma/client`
- `node_modules/@prisma/client`

porque el workspace estaba compilando contra tipos viejos aunque `prisma generate` ya hubiera regenerado el cliente canónico.

## Incidencia encontrada

`prisma migrate dev --create-only` no pudo ejecutarse contra la base local porque el PostgreSQL esperado en `localhost:5433` no estaba disponible.

Error real:

- `P1001: Can't reach database server at localhost:5433`

Para no dejar el bloque a medias, la migration SQL quedó creada manualmente y versionada en el repo.

## Resultado

- el re-auditor de índices quedó aterrizado sobre el schema real, no sobre una lista vieja
- soft delete ya no es decorativo: el backend lo respeta
- `jobs` y `disputes` tienen archive/restore sin hard delete
- dashboards, queries operativas y validaciones dejaron de mezclar registros archivados con activos
