# Diseño Formal de AgentMemoryService en SEMSE

## Objetivo

Definir cómo debe usarse `AgentMemoryService` en `SEMSE` como memoria durable y no dejarlo como utilidad aislada.

## Base actual existente

Ya existe:

- `/home/yoni/app semse/project-manager-app/apps/api/src/modules/agents/memory/agent-memory.service.ts`

Capacidades actuales:

- `remember`
- `recallForContext`
- `forget`
- `forgetByEntity`
- `pruneExpired`
- `listForAgent`

Tipos existentes:

- `instruction`
- `context`
- `feedback`
- `fact`

## Objetivo arquitectonico

`AgentMemoryService` debe convertirse en la capa de memoria durable oficial para los harnesses.

No debe reemplazar:

- `AgentConversation`
- `AuditLog`
- corpus documental

Debe complementarlos.

## Separacion de capas

## 1. Session memory

Persistencia:

- `AgentConversation`

Uso:

- continuidad conversacional
- hilo activo

## 2. Event memory

Persistencia:

- `AuditLog`

Uso:

- trazabilidad
- evidencia de acción

## 3. Durable agent memory

Persistencia:

- `AgentMemory`

Uso:

- reglas
- feedback
- contexto condensado
- facts reutilizables

## 4. Documentary memory

Persistencia:

- contratos
- docs
- evidencia
- corpus e indexación

Uso:

- grounding y citas

## Politicas recomendadas

## Lectura

Orden de inyección recomendado:

1. `instruction`
2. `context` vinculado a entidad actual
3. `feedback` reciente y de alta importancia
4. `fact` relevante

## Escritura

Solo deben poder escribir memoria:

- harnesses
- servicios de consolidación
- flujos explícitos de feedback humano

No el frontend directo.

## Tipos de memoria por caso de uso

## `instruction`

Usar para:

- reglas durables del agente
- estilo de respuesta
- políticas internas

No usar para:

- estado efímero del proyecto

## `context`

Usar para:

- restricciones activas del proyecto
- síntesis operativa viva
- estado resumido de caso o disputa

Debe tener:

- `entityType`
- `entityId`
- `expiresAt` cuando corresponda

## `feedback`

Usar para:

- correcciones humanas
- preferencias de respuesta
- lecciones aprendidas de una revisión

Regla:

- debe ser moderadamente estable
- no toda interacción merece guardarse

## `fact`

Usar para:

- hechos de referencia validados
- relaciones estables
- información recuperable útil entre sesiones

## Memory policy por harness

## `ProjectCopilotHarness`

Lee:

- `instruction`
- `context`
- `feedback`
- `fact`

Escribe:

- `context`
- `feedback`

No debería escribir:

- `instruction` salvo flujo administrativo

## `PaymentsHarness`

Lee:

- `instruction`
- `context`
- `fact`

Escribe:

- `context`
- `feedback`

Regla:

- memoria financiera debe ser concisa y ligada a `Project` o `Milestone`

## `DisputeHarness`

Lee:

- `instruction`
- `context`
- `feedback`
- `fact`

Escribe:

- `context`
- `fact`
- `feedback`

Regla:

- la disputa necesita memoria de caso, no solo chat

## Memory quality gates

Antes de guardar memoria, el sistema debe decidir:

1. `stability`
2. `reuse value`
3. `scope`
4. `expiry`

### Preguntas de decisión

- ¿esto sigue siendo útil mañana?
- ¿esto aplica al caso, al proyecto o al agente?
- ¿esto es política, contexto, feedback o fact?
- ¿esto debe expirar?

## Consolidación recomendada

Falta una capa explícita de consolidación.

Servicio recomendado:

- `AgentMemoryConsolidator`

Funciones:

- resumir eventos del journal en memorias útiles
- promover feedback recurrente
- degradar o expirar contexto viejo
- consolidar facts de alta estabilidad

## Integracion con harness

Cada harness debe definir:

```ts
type MemoryPolicy = {
  readableTypes: MemoryType[]
  writableTypes: MemoryType[]
  entityAnchor: "Project" | "Payment" | "Dispute" | "Milestone"
  defaultExpiryDays?: number
  autoPromoteFeedback?: boolean
}
```

## Antipatrones

- usar `AuditLog` como memoria principal
- guardar cualquier búsqueda como memoria
- guardar prompts crudos como facts
- no expirar contexto efímero
- permitir escritura libre de instrucciones

## Conclusión

`AgentMemoryService` ya existe y está bien encaminado.

Lo que falta no es la tabla. Lo que falta es política:

- qué se lee
- qué se escribe
- quién lo decide
- cuándo expira
- cómo se consolida

Sin eso, habrá memoria persistente pero no memoria útil.
