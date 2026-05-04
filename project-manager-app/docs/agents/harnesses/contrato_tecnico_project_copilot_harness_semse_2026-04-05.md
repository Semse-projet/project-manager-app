# Contrato Técnico de ProjectCopilotHarness en SEMSE

## Objetivo

Definir el contrato técnico exacto del `ProjectCopilotHarness` para pasar de la documentación conceptual a una implementación consistente.

Este documento no implementa código. Define:

- responsabilidades
- interfaces
- transiciones
- servicios involucrados
- ubicación archivo por archivo

## Alcance

El `ProjectCopilotHarness` es el arnés principal del copiloto de proyecto.

Debe gobernar:

- chat contextual
- búsqueda citada
- journal persistido
- acciones aprobables
- refresco de contexto
- integración con memoria durable
- transición futura a `plan mode`

No debe gobernar directamente:

- ejecución financiera final sin approval
- resolución compleja de disputa sin `DisputeHarness`
- swarm o coordinación general multiagente

## Source of truth por capa

- thread: `AgentConversation`
- eventos: `AuditLog` con `entityType = "ProjectCopilot"`
- contexto: `ProjectsRepository`
- workspace state: `ProjectsService.workspace()`
- corpus status: `ProjectsRepository.getCorpusStatusByProject()`
- memory durable: `AgentMemoryService`
- acciones sensibles: dominio + `ActionRiskClassifier`

## Responsabilidades funcionales

## 1. Conversación

Entrada:

- prompt del usuario
- `projectId`
- actor autenticado

Salida:

- respuesta textual
- citas candidatas
- `threadId`

Regla:

- toda conversación debe quedar anclada a `pageContext = project:${projectId}`

## 2. Context assembly

Debe consolidar:

- `ProjectWorkspaceView`
- `ProjectAgentContextView`
- `ProjectCopilotJournalView`
- `CorpusStatusView`

Regla:

- el harness usa estos cuatro artefactos como runtime mínimo

## 3. Search

Debe ejecutar búsqueda citada sobre:

- documentos
- evidence
- disputas
- actividad
- pagos

Regla:

- el backend es source of truth del resultado y de su auditoría

## 4. Actions

Debe mostrar y ejecutar:

- `PAYMENT_APPROVE`
- `PAYMENT_RELEASE`
- `DISPUTE_CREATE`
- `DISPUTE_RESOLVE`

Regla:

- `ProjectCopilotHarness` solo orquesta
- la elegibilidad y el riesgo se resuelven en backend

## 5. Refresh

Después de mutaciones o búsquedas relevantes debe refrescar:

- workspace
- context
- journal
- actions
- runs
- corpus status

## 6. Memory

Debe leer memoria durable relevante del proyecto y poder escribir:

- contexto condensado
- feedback humano útil

No debe escribir:

- instrucciones del sistema
- facts no validados

## Interface recomendada

```ts
type ProjectCopilotHarnessInput =
  | {
      kind: "chat"
      projectId: string
      message: string
      threadId?: string
    }
  | {
      kind: "search"
      projectId: string
      query: string
      topK?: number
    }
  | {
      kind: "action"
      projectId: string
      actionType: CopilotActionView["type"]
      payload: Record<string, unknown>
    }
  | {
      kind: "refresh"
      projectId: string
    }
```

```ts
type ProjectCopilotHarnessRuntime = {
  actor: AgentActor
  requestId: string
  projectId: string
  thread: ProjectCopilotThreadView | null
  workspace: ProjectWorkspaceView
  context: ProjectAgentContextView
  journal: ProjectCopilotJournalView
  corpusStatus: CorpusStatusView
  memory?: MemoryContext
}
```

```ts
type ProjectCopilotHarnessOutput =
  | {
      kind: "chat"
      threadId: string
      message: string
      citations: CitationRef[]
      refreshTargets: string[]
    }
  | {
      kind: "search"
      result: ProjectSearchResponseView
      refreshTargets: string[]
    }
  | {
      kind: "action"
      success: boolean
      message: string
      refreshTargets: string[]
    }
  | {
      kind: "refresh"
      workspace: ProjectWorkspaceView
      context: ProjectAgentContextView
      journal: ProjectCopilotJournalView
      corpusStatus: CorpusStatusView
      actions: CopilotActionView[]
      runs: AgentRunView[]
    }
```

## Runtime pipeline

## Paso 1. Resolve actor

Fuente:

- request headers
- RBAC actual

Salida:

- `AgentActor`

## Paso 2. Resolve thread

Fuente:

- `ProjectsRepository.getLatestCopilotThreadByProject()`
- `ConversationStore`

Regla:

- si el input trae `threadId`, validar pertenencia y tenant
- si no, usar el último thread activo del proyecto

## Paso 3. Resolve runtime context

Fuente:

- `ProjectsService.workspace()`
- `ProjectsService.agentContext()`
- `ProjectsService.copilotJournal()`
- `ProjectsService.corpusStatus()`

## Paso 4. Resolve memory

Fuente:

- `AgentMemoryService.recallForContext()`

Policy inicial recomendada:

- `agentRole = "project-copilot"`
- `memoryTypes = ["instruction", "context", "feedback", "fact"]`
- `entityType = "Project"`
- `entityId = projectId`
- `limit = 8`

## Paso 5. Resolve tools and actions

El harness no expone tools arbitrarias al frontend.

Expone operaciones controladas:

- `chat`
- `search`
- `action`
- `refresh`

Internamente puede apoyarse en:

- `AgentsService.chat()`
- `ProjectsService.search()`
- `ProjectsService.copilotActions()`
- `ProjectsService.agentRuns()`

## Paso 6. Apply policies

Policies iniciales:

- search siempre auditable en backend
- action siempre pasa por elegibilidad
- action sensible dispara refresh completo
- action `HIGH` se prepara para transición futura a `plan`

## Paso 7. Audit

Eventos mínimos:

- `project.copilot.chat`
- `project.copilot.search`
- `project.copilot.action`
- `project.copilot.refresh`

## Paso 8. Refresh targets

Targets estándar:

- `workspace`
- `context`
- `journal`
- `runs`
- `actions`
- `corpus`

## Servicios involucrados

## Backend

- `ProjectsController`
- `ProjectsService`
- `ProjectsRepository`
- `AgentsService`
- `ConversationStore`
- `AgentMemoryService`
- `ActionRiskClassifier`
- `AuditService`

## Frontend

- `ProjectAiPage`
- `ProjectAiConsole`
- `apps/web/lib/semse/ai.ts`
- `/api/semse/projects/[projectId]/*`

## Endpoints actuales que el harness ya puede reutilizar

- `GET /v1/projects/:projectId/agent-context`
- `GET /v1/projects/:projectId/agent-runs`
- `POST /v1/projects/:projectId/search`
- `GET /v1/projects/:projectId/copilot-actions`
- `GET /v1/projects/:projectId/copilot-thread`
- `GET /v1/projects/:projectId/copilot-journal`
- `POST /v1/projects/:projectId/copilot-events`
- `GET /v1/projects/:projectId/corpus-status`
- `GET /v1/projects/:projectId/workspace`
- `POST /v1/agents/chat`

## Gaps actuales

## 1. Chat no usa memory durable todavía

`AgentsService.chat()` hoy persiste thread y genera respuesta contextual básica, pero no hidrata `AgentMemoryService`.

## 2. No existe un servicio explícito llamado `ProjectCopilotHarness`

La lógica está repartida entre:

- `ProjectsService`
- `ProjectsRepository`
- `AgentsService`
- frontend

## 3. Refresh vive más en la UI que en una capa de runtime

La UI hace un buen trabajo, pero el contrato de refresh todavía no está formalizado en backend.

## 4. No hay `plan mode`

Solo hay `requiresApproval` y `eligibility`.

## Estructura recomendada archivo por archivo

## Backend

### Nuevo archivo recomendado

`apps/api/src/modules/agents/harnesses/project-copilot.harness.ts`

Responsabilidad:

- orquestar `chat`, `search`, `action`, `refresh`
- concentrar resolve actor/context/thread/memory/policies

### Nuevo archivo recomendado

`apps/api/src/modules/agents/harnesses/project-copilot.types.ts`

Responsabilidad:

- inputs
- outputs
- runtime contracts
- refresh targets

### Reutilizar

`apps/api/src/modules/projects/projects.service.ts`

Responsabilidad:

- seguir siendo source of truth del dominio

### Reutilizar

`apps/api/src/modules/agents/memory/agent-memory.service.ts`

Responsabilidad:

- recall/remember

## Frontend

### Mantener

`apps/web/components/projects/project-ai-console.tsx`

Responsabilidad:

- render
- UX de interacción
- no decidir políticas

### Mantener

`apps/web/lib/semse/ai.ts`

Responsabilidad:

- cliente tipado hacia proxy routes

### Opcional

Crear un adaptador de cliente:

`apps/web/lib/semse/project-copilot.ts`

Responsabilidad:

- consumir un contrato más cohesivo del harness

## Secuencia mínima de implementación futura

1. crear `project-copilot.types.ts`
2. crear `project-copilot.harness.ts`
3. mover a ese harness la orquestación de `chat` y `refresh`
4. integrar `AgentMemoryService.recallForContext()`
5. hacer que `ProjectsController` delegue operaciones del copiloto al harness
6. dejar la UI consumiendo el mismo contrato, pero sin lógica operativa dispersa

## Checklist de aceptación

- chat del proyecto usa thread del proyecto
- chat del proyecto puede inyectar memory durable
- search sigue auditado solo en backend
- actions siguen gobernadas por elegibilidad y riesgo
- refresh queda formalizado como output del harness
- frontend queda como consumidor del contrato, no como orquestador principal

## Conclusión

El `ProjectCopilotHarness` debe convertirse en la primera implementación real del modelo `AgentHarness` en `SEMSE`.

Es la mejor pieza para empezar porque:

- ya tiene UI
- ya tiene journal
- ya tiene thread
- ya tiene search
- ya tiene actions
- ya tiene runtime state suficiente

Solo falta consolidar esas piezas bajo un contrato único.
