# Persistencia de Agent Approvals

Fecha: 2026-04-08
Repo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Cerrar el residuo que había quedado en la nueva capa de agentes: los `approvals` ya no debían vivir en memoria dentro de `AgentApprovalService`, sino quedar persistidos en Prisma y alineados con el runtime gobernado del ecosistema SEMSE.

## Cambios implementados

### 1. Schema Prisma

Se añadió persistencia formal para approvals de agentes en:

- `packages/db/prisma/schema.prisma`

Cambios:

- enum `AgentApprovalStatus`
- model `AgentApproval`
- relación inversa en `Tenant.agentApprovals`
- índices:
  - `@@index([tenantId, status, requestedAt])`
  - `@@index([tenantId, runId])`
  - `@@index([tenantId, correlationId])`

### 2. Migración manual

Se creó:

- `packages/db/prisma/migrations/20260408183000_agent_approval_persistence/migration.sql`

La migración:

- crea el tipo enum `AgentApprovalStatus` si no existe;
- crea la tabla `AgentApproval`;
- crea los índices operativos para listados por tenant, run y correlation trace.

### 3. Servicio de approvals

Se reemplazó el `Map` en memoria por acceso real a Prisma en:

- `apps/api/src/modules/agents/agent-approval.service.ts`

El servicio ahora:

- registra approvals con `upsert`;
- lista approvals persistidos por tenant;
- obtiene approvals por `approvalId`;
- registra decisiones `approved/rejected`;
- mantiene compatibilidad del contrato público usando mapeo explícito:
  - DB: `PENDING | APPROVED | REJECTED`
  - API/runtime: `pending | approved | rejected`

También sigue emitiendo audit trail estructurado en:

- `agent.approval.create`
- `agent.approval.decision`

### 4. Documentación del paquete

Se actualizó:

- `packages/agents/README.md`

para reflejar que la capa de approvals ya no es en memoria y ahora queda persistida en Prisma.

## Correcciones de integración

Durante la implementación apareció un drift ya conocido del repo entre:

- `node_modules/.prisma/client`
- `node_modules/@prisma/client`

`prisma generate` actualizó `.prisma/client`, pero `@prisma/client` seguía exponiendo el schema viejo. Para estabilizar el build se resincronizaron los artefactos generados del cliente.

Sin esa resincronización, `nest build` seguía viendo un `PrismaService` sin la propiedad `agentApproval`.

## Validación ejecutada

Checks verdes:

- `npm run build --workspace @semse/agents`
- `npm run build --workspace @semse/schemas`
- `npm run test:unit --workspace @semse/api`
- `npm run build:api`
- `node --check apps/worker/src/main.mjs`

Resultado:

- tests API: `6/6 pass`
- build API: `OK`
- worker syntax check: `OK`

## Estado de migración en entorno local

Se intentó ejecutar:

- `npm run db:migrate`

Resultado:

- `P1001: Can't reach database server at localhost:5433`

Conclusión:

- la migración quedó lista en código;
- el repo compila y tipa con el nuevo modelo;
- no se pudo aplicar sobre la base local porque el PostgreSQL configurado para este workspace no estaba levantado en este entorno.

## Estado final

La capa de agentes queda mejor cerrada que antes:

- approvals persistidos;
- trazabilidad por `runId` y `correlationId`;
- continuidad del contrato público;
- audit trail mantenido;
- runtime, API y worker siguen compilando.

## Siguiente paso recomendado

Cuando el Postgres local vuelva a estar disponible:

1. levantar la BD configurada en `packages/db/.env`;
2. ejecutar `npm run db:migrate`;
3. validar un flujo real con un agente que abra approval y una decisión posterior desde `ops`.
