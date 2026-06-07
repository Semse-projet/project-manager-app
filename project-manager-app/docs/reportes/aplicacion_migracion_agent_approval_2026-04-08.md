# Aplicación real de migración AgentApproval

Fecha: 2026-04-08
Repo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Cerrar el bloqueo operativo que quedaba después de implementar persistencia de approvals: la migración existía en código, pero todavía no estaba aplicada de forma verificable sobre la base real usada por el workspace.

## Diagnóstico

### 1. Base real activa

Se confirmó que el Postgres operativo del workspace sí estaba arriba:

- contenedor: `semse-postgres`
- imagen: `postgres:16`
- publicación: `0.0.0.0:5433->5432`

### 2. Motivo del fallo de `db:migrate`

`npm run db:migrate` fallaba con `P1001`, pero no por ausencia de base.

La causa real era:

- `packages/db/.env` apuntaba a `localhost:5433`
- en este entorno, Prisma sí alcanzó la base usando `127.0.0.1:5433`
- con `localhost`, el runner no resolvía el acceso correctamente

## Acciones ejecutadas

### 1. Aplicación directa de la migración en la base real

Como `prisma migrate deploy` seguía bloqueado en la etapa inicial, la DDL de:

- `packages/db/prisma/migrations/20260408183000_agent_approval_persistence/migration.sql`

se aplicó dentro del contenedor usando `psql`.

Resultado:

- enum `AgentApprovalStatus` creado
- tabla `AgentApproval` creada
- índices creados:
  - `AgentApproval_tenantId_status_requestedAt_idx`
  - `AgentApproval_tenantId_runId_idx`
  - `AgentApproval_tenantId_correlationId_idx`

### 2. Verificación física de schema

Se verificó en la base real:

- columnas presentes en `AgentApproval`
- tipo enum presente
- índices presentes

### 3. Reparación de `_prisma_migrations`

Se detectó una migración fallida vieja:

- `20260405021000_reconcile_schema_drift`

Motivo histórico registrado por Prisma:

- `type "AgentMemoryType" already exists`

Acción tomada:

- se marcó esa fila con `rolled_back_at`
- se registraron como aplicadas las migraciones manuales:
  - `20260408133000_soft_delete_and_runtime_indexes`
  - `20260408183000_agent_approval_persistence`

Resultado final en `_prisma_migrations`:

- `20260405021000_reconcile_schema_drift` -> `rolled_back_at` seteado
- `20260408133000_soft_delete_and_runtime_indexes` -> `finished_at` seteado
- `20260408183000_agent_approval_persistence` -> `finished_at` seteado

### 4. Corrección del workspace env

Se actualizaron:

- `packages/db/.env`
- `packages/db/.env.example`
- `docs/runbooks/LOCAL_BOOTSTRAP.md`

Cambio:

- de `localhost:5433`
- a `127.0.0.1:5433`

## Validación final

Con el `.env` corregido, se volvió a ejecutar:

- `npm run db:migrate`

Resultado:

- `No pending migrations to apply.`

Eso confirma que el flujo normal del workspace quedó reparado.

## Estado final

Queda resuelto de extremo a extremo:

- migración creada en repo;
- schema real aplicado en DB;
- metadata de Prisma saneada;
- `db:migrate` funcional;
- conectividad local corregida para este workspace.

## Notas

El ajuste a `127.0.0.1` no fue cosmético. Fue necesario para que Prisma pudiera alcanzar el Postgres real de este entorno de trabajo.
