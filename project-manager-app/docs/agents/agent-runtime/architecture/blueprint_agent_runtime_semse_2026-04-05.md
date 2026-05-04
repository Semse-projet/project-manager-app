# Blueprint Agent Runtime SEMSE

## Estado actual
- `ProjectCopilotHarness` operativo
- `PaymentsHarness` operativo
- `DisputeHarness` operativo
- `AgentWorkPlan` visible y aprobable
- `AgentDelegation` visible y cerrando con `AgentRun`
- `agent-runtime` absorbido en el monorepo

## Objetivo
Unificar instalación, attach, estado y consulta de runtimes externos dentro del sistema agentico de `SEMSE`.

## Módulos
- `apps/api/src/modules/agent-runtime`
- `apps/web/app/(app)/admin/agent-runtime`
- `apps/web/app/api/semse/agent-runtime/*`
- `packages/schemas/src/agent-runtime.view.ts`

## Capas
1. `Provider manifests`
2. `Host diagnostics`
3. `Install plan`
4. `Command policy engine`
5. `Bootstrap audit trail`
6. `Attached runtime catalog`
7. `ProjectCopilot runtime awareness`

## Source of truth
- Manifiestos: `agent-runtime.manifests.ts`
- Policy engine: `agent-runtime.policy.ts`
- Estado attached: `AgentMemory`
- Auditoría: `AuditLog`
- Runtime status visible: `AgentRuntimeService`

## Reglas
- `ALLOW`: solo comandos de verificación explícitamente permitidos
- `APPROVAL_REQUIRED`: comandos de instalación conocidos pero no auto-ejecutables
- `BLOCKED`: comandos peligrosos o no conformes

## Integración con copilot
- Si el prompt habla de `runtime`, `codex`, `claude`, `manus` o `installer`
- `ProjectCopilotHarness` consulta `AgentRuntimeService.status(tenantId)`
- responde con host + providers adjuntos

## Integración con catálogo interno
- `AgentsService.catalog(...)` mezcla:
  - catálogo estático `@semse/agents`
  - providers adjuntos como `runtime:<provider>`

## Riesgos controlados
- no se ejecuta instalación arbitraria
- no se permite `sudo`
- no se permite `curl | bash`
- no se acopla el sistema a un proveedor único

## Siguiente endurecimiento
1. `secret management`
2. policy por workspace
3. instalación real mediada por aprobación persistida
4. attach por proyecto además de tenant
