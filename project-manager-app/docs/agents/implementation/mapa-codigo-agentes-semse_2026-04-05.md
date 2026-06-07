# Mapa de Codigo de Agentes SEMSE

## Runtime principal

- `apps/api/src/modules/agents/mvs/mvs.service.ts`
  - arnes principal
  - thread lifecycle
  - role resolution
  - tool set
  - fallback

- `apps/api/src/modules/agents/tools/executor.ts`
  - `tool_use loop`
  - contexto de ejecucion
  - pausa por aclaracion
  - limites de iteracion
  - herramientas disponibles

## Persistencia

- `apps/api/src/common/conversation.store.ts`
  - threads persistidos
  - resume, append, close

- `packages/db/prisma/schema.prisma`
  - `AgentConversation`
  - `AgentMemory`
  - `AgentDelegation`
  - `AgentWorkPlan`

## Ontologia

- `packages/agents/src/semseproject.ts`
  - capas de memoria
  - power levels
  - modos operativos
  - verdad observada vs canonica

## Superficie actual de copiloto por proyecto

- `apps/api/src/modules/projects/projects.repository.ts`
  - contexto
  - journal
  - corpus status
  - search
  - copilot actions

- `apps/api/src/modules/projects/projects.service.ts`
  - audit de eventos
  - coordinacion de search y journal

- `apps/web/components/projects/project-ai-console.tsx`
  - UI del copiloto
  - busqueda citada
  - acciones aprobables
  - refresh del workspace

## Siguiente capa recomendada

1. mover memoria util desde `AuditLog` a `AgentMemory`
2. agregar indexacion real por chunks y versiones
3. crear `AgentHarness` tipado por dominio
4. introducir delegacion controlada con `AgentDelegation`
5. conectar `AgentWorkPlan` al copiloto de proyecto
