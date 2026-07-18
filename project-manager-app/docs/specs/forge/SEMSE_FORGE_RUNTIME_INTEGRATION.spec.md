---
id: semse-forge-runtime-integration
title: "SEMSE Forge Runtime Integration"
domain: forge
status: APPROVED
owner: semse-core
risk: high
related_files:
  - packages/db/prisma/schema.prisma
  - packages/agents/src/runtime.ts
  - packages/agents/src/governance.ts
  - apps/api/src/modules/forge
  - packages/forge/src/policy.ts
  - packages/forge/src/orchestrator.ts
related_tests:
  - tests/unit/forge-runtime-integration.test.mjs
  - node --test tests/unit/forge-harness.test.mjs
related_endpoints:
  - POST /v1/forge/runs
  - GET /v1/forge/runs
  - GET /v1/forge/runs/:runId
  - POST /v1/forge/runs/:runId/transitions
  - POST /v1/forge/runs/:runId/tasks
  - POST /v1/forge/runs/:runId/tasks/:taskId/execute
  - POST /v1/forge/runs/:runId/approvals/:mode/decide
  - GET /v1/forge/mission-control
related_events:
  - FORGE_RUN_CREATED
  - FORGE_TASK_ASSIGNED
  - FORGE_HUMAN_REVIEW_REQUESTED
  - FORGE_RUN_BLOCKED
  - FORGE_RUN_ROLLED_BACK
related_agents:
  - forge-supervisor
  - spec-architect
  - backend-builder
  - frontend-builder
  - qa-verifier
  - security-reviewer
  - devops-release
last_verified: 2026-07-17
---

# SPEC: SEMSE Forge Runtime Integration

## 1. Objetivo

Conectar el plano de control de `packages/forge` con el runtime gobernado de `packages/agents` y persistir el ciclo de vida de una ejecución de ingeniería (`ForgeRun`) en PostgreSQL, exponiendo Mission Control para supervisión.

## 2. Alcance

A. **Adaptador `packages/forge` ↔ `packages/agents`**
   - Cada `ForgeTaskPacket` se ejecuta a través de un `AgentRun` con `agentType: "forge"`.
   - El runtime de `packages/agents` (`executeGovernedAgentRun`) evalúa la política de `packages/forge` (`evaluateForgePolicy`) para el rol y la acción solicitada.
   - El resultado incluye `policy`, `riskLevel`, `requiredApprovals` y `auditTrail`.

B. **Persistencia Prisma de `ForgeRun`**
   - Nuevo modelo `ForgeRun` en `packages/db/prisma/schema.prisma`.
   - Campos JSON para task graph, asignaciones, aprobaciones, eventos y correlación a `AgentRun`s.
   - Relación `Tenant` ↔ `ForgeRun`.

C. **Endpoints REST/OMEGA para Mission Control**
   - CRUD de `ForgeRun`.
   - Transiciones de FSM validadas por `ForgeHarness`.
   - Asignación y ejecución de tareas a través del adaptador.
   - Aprobaciones y vista de control (`mission-control`) para runs bloqueados/pendientes.

## 3. Decisiones arquitectónicas

- `packages/forge` sigue siendo el plano de control puro; no accede a Prisma.
- `apps/api` es el único lugar que escribe `ForgeRun` en la base de datos a través de `ForgeRepository`.
- `packages/agents` extiende `runtimeAgentRoles` y `runtimeAgentManifests` con `forge` para reutilizar `executeGovernedAgentRun` sin duplicar policy engine.
- La ejecución sincrónica en `POST /v1/forge/runs/:runId/tasks/:taskId/execute` crea, ejecuta y completa un `AgentRun` en el mismo request, actualizando `ForgeRun` inmediatamente. El modo asíncrono vía worker queda habilitado una vez `AgentRun` se encola.

## 4. Modelo de datos

```prisma
model ForgeRun {
  id                 String   @id @default(cuid())
  tenantId           String
  orgId              String
  title              String
  state              String   @default("idea")
  specId             String
  specPath           String
  specDigest         String
  specStatus         String
  tasksJson          Json     @default("[]")
  assignedAgentsJson Json     @default("{}")
  approvalsJson      Json     @default("[]")
  eventsJson         Json     @default("[]")
  agentRunIdsJson    Json     @default("[]")
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  tenant             Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, state, createdAt])
  @@index([tenantId, specId])
}
```

## 5. Endpoints

| Método | Ruta | Permiso | Propósito |
|--------|------|---------|-----------|
| POST | /v1/forge/runs | `agents:run:create` | Crear `ForgeRun` desde un spec. |
| GET | /v1/forge/runs | `ops:dashboard:read` | Listar runs del tenant. |
| GET | /v1/forge/runs/:runId | `ops:dashboard:read` | Detalle de un run. |
| POST | /v1/forge/runs/:runId/transitions | `ops:dashboard:write` | Transicionar estado (FSM). |
| POST | /v1/forge/runs/:runId/tasks | `ops:dashboard:write` | Agregar `ForgeTaskPacket`. |
| POST | /v1/forge/runs/:runId/tasks/:taskId/execute | `agents:run:create` | Ejecutar tarea vía `AgentRun` de `forge`. |
| POST | /v1/forge/runs/:runId/approvals/:mode/decide | `ops:dashboard:write` | Aprobar/rechazar una aprobación pendiente. |
| GET | /v1/forge/mission-control | `ops:dashboard:read` | Resumen de runs pendientes/bloqueados y aprobaciones. |

## 6. Secuencia de ejecución de tarea

```
POST /v1/forge/runs/:runId/tasks/:taskId/execute
  -> ForgeController
    -> ForgeService.executeTask
      -> ForgeRepository.findById
      -> ForgeHarness.assignTask
      -> ForgeAgentAdapter.execute
        -> AgentsRepository.create (agentType: forge)
        -> AgentsRepository.start
        -> executeGovernedAgentRun (agentType: forge)
          -> buildForge -> evaluateForgePolicy
        -> AgentsRepository.complete
      -> ForgeHarness.authorizeTaskAction
      -> ForgeRepository.update
  <- { agentRun, policy, forgeRun }
```

## 7. Criterios de aceptación

- `pnpm --filter @semse/agents build` pasa con el nuevo rol `forge`.
- `pnpm --filter @semse/forge build` pasa.
- `node --test tests/unit/forge-harness.test.mjs` pasa.
- `pnpm db:generate` genera el modelo `ForgeRun`.
- `pnpm typecheck` pasa con `ForgeModule` registrado.
- Los endpoints validan tenant, FSM y policy.
- No se escribe directamente a `main`.

## 8. Pendiente explícito

- Migración de base de datos real se generará cuando el entorno de desarrollo tenga PostgreSQL accesible.
- Ejecución asíncrona por worker: el `AgentRun` ya se encola, pero el handler especializado de worker para `forge` queda para la siguiente iteración.
- Sandbox de comandos y escritura real de archivos quedan fuera de este spec.
