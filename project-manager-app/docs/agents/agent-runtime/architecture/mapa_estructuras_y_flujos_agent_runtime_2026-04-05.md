# Mapa de estructuras y flujos

## Estructura de código

### Backend
- `apps/api/src/modules/agent-runtime/agent-runtime.module.ts`
- `apps/api/src/modules/agent-runtime/agent-runtime.controller.ts`
- `apps/api/src/modules/agent-runtime/agent-runtime.service.ts`
- `apps/api/src/modules/agent-runtime/agent-runtime.manifests.ts`
- `apps/api/src/modules/agent-runtime/agent-runtime.policy.ts`

### Frontend
- `apps/web/app/(app)/admin/agent-runtime/page.tsx`
- `apps/web/components/agent-runtime/agent-runtime-installer-page.tsx`
- `apps/web/app/api/semse/agent-runtime/providers/route.ts`
- `apps/web/app/api/semse/agent-runtime/bootstrap/route.ts`
- `apps/web/app/api/semse/agent-runtime/attach/route.ts`
- `apps/web/app/api/semse/agent-runtime/status/route.ts`
- `apps/web/app/api/semse/agent-runtime/attached/route.ts`

### Shared
- `packages/schemas/src/agent-runtime.view.ts`

## Flujo 1: Detect only
1. Admin abre `/admin/agent-runtime`
2. UI carga `/api/semse/agent-runtime/providers`
3. UI carga `/api/semse/agent-runtime/status`
4. UI envía `POST /api/semse/agent-runtime/bootstrap`
5. backend responde con:
   - diagnostics
   - install plan
   - command policies
   - warnings

## Flujo 2: Attach provider
1. Admin pulsa `Registrar provider`
2. UI envía `POST /api/semse/agent-runtime/attach`
3. backend persiste estado en `AgentMemory`
4. backend audita `agent.runtime.attach`
5. provider aparece en:
   - `status.attachedProviders`
   - `AgentsService.catalog(...)`
   - `ProjectCopilotHarness`

## Flujo 3: Consulta desde copilot
1. Usuario pregunta por runtime en `/projects/:projectId/ai`
2. `ProjectCopilotHarness.chat(...)`
3. consulta `AgentRuntimeService.status(tenantId)`
4. responde con host + providers adjuntos

## Relación con Payments/Disputes
- `AgentRuntime` no ejecuta pagos/disputas
- sí habilita proveedores externos para operar sobre el workspace
- el control de negocio sigue en `PaymentsHarness` y `DisputeHarness`
