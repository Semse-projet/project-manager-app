# Fundamentos de Agentes SEMSE

## Objetivo

Definir la base estable del sistema de agentes para que el trabajo sea:

- iterativo
- auditable
- replicable
- gobernable
- extensible

## Definicion operativa de agente

En `SEMSE`, un agente no debe modelarse como "un chat con nombre". Debe modelarse como una unidad operacional compuesta por:

1. `identidad`
2. `loop`
3. `contexto`
4. `memoria`
5. `logica`
6. `tools`
7. `permisos`
8. `audit trail`
9. `delegacion`

## Capas reales ya presentes en el codigo

Base actual observable en el codigo:

- `AgentConversation` para thread persistido
- `AgentMemory` para memoria persistente por rol
- `AgentDelegation` para sub-tareas entre agentes
- `AgentWorkPlan` para planes estructurados
- `ToolExecutor.agentLoop()` para el `tool_use loop`
- `MvsService` para el arnes principal de ejecucion

Referencias:

- `/home/yoni/app semse/project-manager-app/apps/api/src/common/conversation.store.ts`
- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agents/tools/executor.ts`
- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agents/mvs/mvs.service.ts`
- `/home/yoni/app semse/project-manager-app/packages/db/prisma/schema.prisma`
- `/home/yoni/app semse/project-manager-app/packages/agents/src/semseproject.ts`

## Principios de diseno

### 1. Source of truth distribuido pero claro

- `ConversationStore` guarda el hilo conversacional
- `AuditLog` guarda los eventos relevantes
- `AgentMemory` guarda memoria reutilizable
- `AgentRun` guarda ejecucion operacional
- `Projects` y el dominio guardan el contexto de negocio

### 2. Contexto no es memoria

- `contexto` = estado activo del caso o proyecto
- `memoria` = conocimiento que sobrevive a una iteracion

### 3. Logica no es prompt

La logica de un agente vive en:

- reglas de permisos
- selecccion de tools
- validacion de inputs
- loop de herramienta
- clasificacion de riesgo
- condiciones de pausa
- decisiones de delegation y approval

### 4. Replicabilidad

Un trabajo del agente debe poder reanudarse con:

- mismo `projectId`
- mismo `pageContext`
- mismo `threadId`
- mismos eventos del journal
- mismo snapshot de corpus

## Modelo recomendado

### Identidad

- `agentRole`
- `powerLevel`
- `allowedTools`
- `allowedModes`

### Estado minimo

- `thread`
- `context snapshot`
- `memory snapshot`
- `work plan`
- `recent events`
- `current constraints`

### Salidas minimas

- respuesta textual
- acciones sugeridas
- acciones ejecutadas
- citas
- runs
- evidencia de auditoria

## Regla de arquitectura

Si una capacidad no puede explicar:

- que contexto leyo
- que memoria uso
- que tool ejecuto
- que decision tomo
- que evento emitio

entonces esa capacidad todavia no esta lista para operar como agente serio.
