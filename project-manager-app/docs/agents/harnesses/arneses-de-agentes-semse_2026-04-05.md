# Arneses de Agentes SEMSE

## Definicion

El arnes de un agente es la capa que lo hace operable en el sistema. No decide negocio por si sola; orquesta componentes para que el agente trabaje dentro de limites claros.

## Componentes de un arnes

Un arnes serio para `SEMSE` debe incluir:

- entrada tipada
- actor resuelto
- contexto resuelto
- memoria inyectada
- thread persistido
- set de tools permitido
- loop con limites
- manejo de pausa
- auditoria
- salida tipada

## Arnes principal actual

Hoy el arnes principal es `MvsService`.

Funciones reales:

- resuelve thread desde `ConversationStore`
- agrega mensaje del usuario
- arma `AgentActor`
- define tools por rol
- ejecuta `ToolExecutor.agentLoop()`
- gestiona fallback si no hay modelo
- persiste respuesta del asistente

Referencia:

- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agents/mvs/mvs.service.ts`

## Arnes complementario por proyecto

En la capa `Projects + WebAssistant`, el arnes operativo del copiloto de proyecto hoy incluye:

- `ProjectWorkspaceView`
- `ProjectAgentContextView`
- `ProjectCopilotThreadView`
- `ProjectCopilotJournalView`
- `CorpusStatusView`
- `CopilotActionView`

Eso permite:

- retomar un thread por `projectId`
- buscar con citas dentro del proyecto
- ejecutar acciones aprobables
- refrescar el estado del workspace

## Tipos de arnes recomendados

### Arnes conversacional

- entrada: mensaje
- salida: respuesta + citas + thread
- estado: journal, thread, corpus

### Arnes de ejecucion

- entrada: command o evento
- salida: `AgentRun`
- estado: run status, heartbeat, dead-letter

### Arnes de aprobacion

- entrada: accion sensible
- salida: ejecucion o rechazo
- estado: `eligibility`, `risk`, `audit`

### Arnes de delegacion

- entrada: tarea compuesta
- salida: delegaciones y consolidacion
- estado: `AgentDelegation`

## Regla de implementacion

Cada nuevo agente debe declarar explicitamente:

- que entra
- que contexto consume
- que memoria puede leer
- que memoria puede escribir
- que tools puede usar
- como pausa
- como audita
- como termina
