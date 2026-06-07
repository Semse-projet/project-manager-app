# Memoria de Agentes SEMSE

## Definicion

La memoria es conocimiento persistente reutilizable por el agente fuera de una sola iteracion.

## Capas de memoria

Tomando la ontologia ya presente en `packages/agents/src/semseproject.ts`, la memoria debe separarse en:

- `session`
- `case`
- `documental`
- `canonical`
- `evolutionary`

## Persistencia real disponible

`AgentMemory` ya existe en Prisma y soporta:

- `INSTRUCTION`
- `CONTEXT`
- `FEEDBACK`
- `FACT`

ademas de:

- `importance`
- `entityType`
- `entityId`
- `expiresAt`

Referencia:

- `/home/yoni/app semse/project-manager-app/packages/db/prisma/schema.prisma`

## Mapeo recomendado

### Session memory

- thread actual
- prompt reciente
- aclaraciones activas

Persistencia:

- `AgentConversation`

### Case memory

- decisiones del proyecto
- reglas operativas del caso
- restricciones del cliente

Persistencia:

- `AgentMemory` tipo `CONTEXT` o `FACT`

### Documental memory

- contratos
- evidencia
- worklogs
- docs indexados

Persistencia:

- corpus del proyecto
- documentos del dominio

### Canonical memory

- instrucciones del sistema
- reglas estables
- patrones validados

Persistencia:

- `AgentMemory` tipo `INSTRUCTION`

### Evolutionary memory

- feedback recurrente
- heuristicas que demostraron servir
- errores repetidos

Persistencia:

- `AgentMemory` tipo `FEEDBACK`

## Regla de oro

La memoria no debe mezclarse con cualquier evento auditado. Un evento registra que algo paso. La memoria registra algo que vale la pena volver a inyectar.

## Decision practica

Para el copiloto de proyecto:

- `thread` y `journal` sirven para continuidad
- `AgentMemory` debe servir para continuidad inteligente
- `corpus` sirve para grounding documental
