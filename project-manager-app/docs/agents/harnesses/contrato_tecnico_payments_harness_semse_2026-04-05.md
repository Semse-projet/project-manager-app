# Contrato Técnico de PaymentsHarness en SEMSE

## Objetivo

Definir el `PaymentsHarness` como arnés especializado para operaciones de pagos, escrow y milestones antes de pasar a implementación.

## Responsabilidad

El `PaymentsHarness` no debe ser un chat genérico. Debe encargarse de:

- explicar estado financiero del proyecto
- consolidar contexto de pagos y escrow
- preparar planes previos a aprobación
- orquestar acciones de aprobación/liberación bajo riesgo controlado

## No responsabilidad

No debe:

- liberar dinero de forma autónoma fuera de policy
- resolver disputas complejas
- reemplazar el dominio de `milestones`, `payments` o `projects`

## Inputs

```ts
type PaymentsHarnessInput =
  | {
      kind: "explain"
      projectId: string
      milestoneId?: string
      question: string
    }
  | {
      kind: "plan"
      projectId: string
      milestoneId?: string
      goal: "approve_milestone" | "release_payment" | "refund" | "audit_readiness"
    }
  | {
      kind: "review_action"
      projectId: string
      actionType: "PAYMENT_APPROVE" | "PAYMENT_RELEASE"
      payload: Record<string, unknown>
    }
  | {
      kind: "execute"
      projectId: string
      actionType: "PAYMENT_APPROVE" | "PAYMENT_RELEASE"
      payload: Record<string, unknown>
      approvedByUserId: string
    }
```

## Contexto mínimo

Debe resolver:

- `ProjectWorkspaceView`
- `ProjectAgentContextView`
- `escrow summary`
- pagos del proyecto
- milestones relevantes
- disputas activas
- trust snapshot
- journal del proyecto
- memory durable de `Project` y `Milestone`

## Source of truth

- milestones: `MilestonesService`
- pagos y escrow: `ProjectsRepository.getEscrowSummary()` y `listPayments()`
- riesgo: `ActionRiskClassifier`
- plan persistido: `AgentWorkPlan`
- audit: `AuditLog`

## Modos

```ts
type PaymentsHarnessMode =
  | "assist"
  | "plan"
  | "review"
  | "execute"
  | "paused"
```

## Transiciones

- `explain` -> `assist`
- `plan` -> `plan`
- `review_action` -> `review`
- `execute` -> `execute`

Regla:

- toda acción `PAYMENT_RELEASE` pasa por `plan` y `review`
- `PAYMENT_APPROVE` puede saltar a `review` si el caso es simple y el riesgo no escala

## Salidas

```ts
type PaymentsHarnessOutput =
  | {
      kind: "explanation"
      summary: string
      warnings: string[]
      citations: CitationRef[]
    }
  | {
      kind: "plan"
      workPlanId: string
      status: "draft" | "active"
      summary: string
      steps: Array<{ id: string; title: string; status: string }>
      blockers: string[]
    }
  | {
      kind: "review"
      eligible: boolean
      riskLevel: "LOW" | "MEDIUM" | "HIGH"
      requiresApproval: boolean
      reasons: string[]
    }
  | {
      kind: "execution"
      success: boolean
      message: string
      refreshTargets: string[]
    }
```

## Policies

### Memory policy

Lee:

- `instruction`
- `context`
- `fact`

Escribe:

- `context`
- `feedback`

### Risk policy

- `PAYMENT_RELEASE` se trata como `HIGH`
- `PAYMENT_APPROVE` como `MEDIUM` o `HIGH` según condiciones del caso

### Refresh policy

Tras ejecución o review:

- `workspace`
- `context`
- `journal`
- `actions`
- `runs`
- `corpus`

## Work plan

`PaymentsHarness` debe persistir plan en `AgentWorkPlan`.

Campos recomendados:

- `agentRole = "payments-review"`
- `entityType = "Project"` o `"Milestone"`
- `entityId = projectId` o `milestoneId`

`stepsJson` mínimo:

1. validar milestone objetivo
2. validar evidencia
3. validar disputas
4. validar saldo de escrow
5. preparar recomendación
6. esperar aprobación

## Ubicación recomendada

- `apps/api/src/modules/agents/harnesses/payments.harness.ts`
- `apps/api/src/modules/agents/harnesses/payments.types.ts`

## Dependencias directas

- `ProjectsService`
- `ProjectsRepository`
- `MilestonesService`
- `AgentMemoryService`
- `ActionRiskClassifier`
- `AuditService`

## Checklist de aceptación futura

- puede explicar por qué un pago no puede liberarse
- puede producir plan persistido
- no ejecuta liberación sin review/approval
- refresca correctamente el estado del proyecto
- deja trazabilidad completa
