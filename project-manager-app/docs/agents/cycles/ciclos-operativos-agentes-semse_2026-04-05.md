# Ciclos Operativos de Agentes SEMSE

## Ciclo base

El ciclo operacional minimo del agente en `SEMSE` es:

1. `ingest`
2. `resolve_context`
3. `hydrate_memory`
4. `plan`
5. `reason`
6. `tool_use`
7. `observe_result`
8. `decide_next_step`
9. `commit_output`
10. `audit`

## Ciclo actual implementado

El codigo actual ya implementa una version parcial y util:

1. recibir mensaje
2. resolver o crear thread
3. persistir mensaje del usuario
4. construir actor
5. resolver tools por rol
6. ejecutar `agentLoop`
7. pausar si necesita aclaracion
8. persistir respuesta
9. auditar

Referencias:

- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agents/mvs/mvs.service.ts`
- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agents/tools/executor.ts`

## Loop

El `loop` actual vive en `ToolExecutor.agentLoop()` y tiene estos elementos:

- `MAX_LOOP_ITERATIONS`
- set de tools disponibles
- armado de `ToolRunContext`
- llamada al modelo
- deteccion de `tool_calls`
- ejecucion de herramientas
- deteccion de pausa HITL
- retorno de texto final o pausa

## Tipos de ciclo recomendados

### 1. Ciclo conversacional

Uso:

- copiloto de proyecto
- preguntas operativas
- lectura de docs
- explicaciones de pagos o disputas

Artefactos:

- `AgentConversation`
- `ProjectCopilotJournal`
- `AuditLog`

### 2. Ciclo operacional

Uso:

- runs de riesgo
- planner
- evidence coach
- dispute analysis

Artefactos:

- `AgentRun`
- `AuditLog`
- `CopilotActionView`

### 3. Ciclo de aprobacion

Uso:

- liberar pagos
- aprobar milestones
- abrir o resolver disputas

Artefactos:

- `eligibility`
- `requiresApproval`
- `action risk classification`
- `AuditLog`

### 4. Ciclo de delegacion

Uso:

- dividir trabajo entre agentes especializados
- ejecutar sub-tareas aisladas

Artefactos:

- `AgentDelegation`
- `sourceRunId`
- `targetRunId`

## Reglas de estabilidad

- El loop nunca debe leer estado sensible solo desde frontend.
- Cada iteracion debe tener `requestId`.
- Cada pausa debe poder reanudarse.
- El contexto debe estar acotado a entidad y alcance.
- Toda ejecucion sensible debe dejar rastro auditable.

## Antipatrones

- usar solo `localStorage` como journal principal
- mezclar memoria de largo plazo con contexto efimero
- ejecutar acciones sin `eligibility`
- dejar `tool_use` sin limites de iteracion
- no registrar el motivo de una pausa o de una accion
