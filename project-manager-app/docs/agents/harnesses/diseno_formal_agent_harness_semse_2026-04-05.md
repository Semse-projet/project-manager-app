# Diseño Formal de Agent Harness en SEMSE

## Objetivo

Definir el contrato formal de `AgentHarness` para `SEMSE` antes de seguir materializando más agentes o superficies de copiloto.

## Definicion

Un `AgentHarness` es la unidad de orquestación que fija cómo corre un agente dentro del sistema.

No contiene solo el prompt. Debe unir:

- input
- actor
- thread
- contexto
- memoria
- tools
- políticas de riesgo
- plan mode
- auditoría
- salidas

## Motivacion

Hoy `SEMSE` ya tiene piezas sueltas:

- `ToolExecutor`
- `MvsService`
- `ConversationStore`
- `AgentMemoryService`
- `ActionRiskClassifier`
- `AgentWorkPlan`
- `AgentDelegation`

Pero esas piezas todavía no están cerradas como contrato uniforme por superficie.

## Contrato recomendado

```ts
type AgentHarness<Input, Context, Output> = {
  id: string
  surface: string
  entityType: string
  agentRole: string

  resolveActor(input, request): AgentActor
  resolveThread(input, actor): Promise<ThreadContext>
  resolveContext(input, actor): Promise<Context>
  resolveMemory(input, actor, context): Promise<MemoryContext>
  resolveTools(input, actor, context): string[]
  resolvePolicies(input, actor, context): HarnessPolicySet
  resolvePlanMode(input, actor, context): HarnessPlanMode

  run(input, runtime): Promise<Output>
  audit(result, runtime): Promise<void>
  refresh(result, runtime): Promise<void>
}
```

## Componentes del harness

## 1. Identity contract

Define:

- `agentRole`
- `surface`
- `entityType`
- `powerLevel` esperado

Ejemplo:

- `project-copilot`
- `payments-review`
- `dispute-orchestrator`

## 2. Input contract

Define la forma permitida de entrada.

Ejemplos:

- chat prompt
- action request
- plan request
- review request
- event-triggered run

Regla:

- cada harness debe tener un input explícito y tipado
- nada de dependencia opaca en estado de UI

## 3. Context contract

Define el snapshot mínimo que el harness necesita.

Ejemplo `ProjectCopilotHarness`:

- `ProjectWorkspaceView`
- `ProjectAgentContextView`
- `ProjectCopilotJournalView`
- `CorpusStatusView`

Ejemplo `PaymentsHarness`:

- payment timeline
- escrow summary
- milestones relevantes
- disputas activas
- trust snapshot

## 4. Memory contract

Define:

- qué tipos de memoria puede leer
- qué tipos de memoria puede escribir
- qué entidad ancla la memoria

Regla:

- el harness decide memoria por política
- el agente no debe persistir cualquier cosa libremente

## 5. Tool contract

Define:

- tool allowlist
- tool denylist implícita
- tools no delegables
- tools que requieren pausa o approval

Esto debe apoyarse en:

- `/apps/api/src/modules/agents/tools/tool.interface.ts`

## 6. Risk and approval contract

Define:

- clasificación de riesgo
- transiciones a `review`
- acciones con `requiresApproval`
- acciones con `auditRequired`

Esto debe apoyarse en:

- `/apps/api/src/infrastructure/policy/action-risk-classifier.ts`

## 7. Plan contract

Define:

- si el harness soporta `plan mode`
- cuándo entra a `plan mode`
- si el plan requiere aprobación
- cómo se serializa en `AgentWorkPlan`

## 8. Output contract

Define:

- texto
- citas
- acciones sugeridas
- acciones ejecutadas
- plan generado
- eventos auditados
- refresh targets

## Runtime del harness

El runtime recomendado del harness es:

1. resolver actor
2. resolver thread
3. resolver contexto
4. resolver memoria
5. resolver tools
6. resolver políticas
7. decidir plan mode
8. correr loop o ejecución
9. auditar
10. refrescar superficies derivadas

## Harnesses concretos recomendados

## 1. `ProjectCopilotHarness`

Responsabilidad:

- copiloto general por proyecto
- búsqueda citada
- explicaciones operativas
- acciones aprobables de bajo/medio acoplamiento

Lee:

- contexto de proyecto
- journal
- corpus
- memoria contextual del proyecto

Escribe:

- thread
- eventos de journal
- memorias de feedback y contexto

No debe ejecutar:

- mutaciones financieras sin transición por approval policy

## 2. `PaymentsHarness`

Responsabilidad:

- explicar estado financiero
- preparar plan de aprobación/liberación
- ejecutar solo tras approval

Lee:

- pagos
- escrow
- milestones
- disputas
- contratos
- trust

Escribe:

- work plan financiero
- memorias de política/feedback
- eventos auditados

Regla:

- si detecta acción `HIGH`, entra en `plan` o `review`

## 3. `DisputeHarness`

Responsabilidad:

- intake
- síntesis de evidencia
- propuesta de resolución
- coordinación de sub-agentes

Lee:

- disputa
- pagos
- contrato
- evidencia
- worklogs
- timeline

Escribe:

- plan de caso
- memorias de caso
- delegaciones
- eventos auditados

## Policies del harness

```ts
type HarnessPolicySet = {
  readableMemoryTypes: Array<"instruction" | "context" | "feedback" | "fact">
  writableMemoryTypes: Array<"context" | "feedback" | "fact">
  maxLoopIterations: number
  requiresPlanModeFor: string[]
  approvalGates: string[]
  nonDelegableTools: string[]
}
```

## Decisiones para materializar despues

Antes de código, conviene fijar:

1. nombres oficiales de harnesses
2. inputs por harness
3. memory policy por harness
4. tools permitidos por harness
5. reglas de plan/review/execute

## Conclusión

`AgentHarness` debe ser la unidad de arquitectura principal del sistema agentico de `SEMSE`.

Sin esto, seguir agregando acciones, journal, memory o delegación va a producir piezas compatibles pero no un runtime consistente.
