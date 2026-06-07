# Contrato Técnico de DisputeHarness en SEMSE

## Objetivo

Definir el `DisputeHarness` como arnés especializado para intake, análisis y resolución asistida de disputas.

## Responsabilidad

Debe encargarse de:

- resumir y ordenar el caso
- consolidar evidencia, pagos y contrato
- preparar work plans de revisión
- coordinar futuros subagentes cuando la disputa sea compleja
- proponer resolución o siguiente paso

## No responsabilidad

No debe:

- resolver automáticamente casos `HIGH` sin review humana
- reemplazar el módulo de disputas del dominio
- mutar contratos o pagos fuera de policy

## Inputs

```ts
type DisputeHarnessInput =
  | {
      kind: "intake"
      projectId: string
      reason: string
    }
  | {
      kind: "analyze"
      projectId: string
      disputeId: string
      question?: string
    }
  | {
      kind: "plan"
      projectId: string
      disputeId: string
      goal: "investigate" | "prepare_resolution" | "triage"
    }
  | {
      kind: "review_action"
      projectId: string
      disputeId: string
      actionType: "DISPUTE_CREATE" | "DISPUTE_RESOLVE"
      payload: Record<string, unknown>
    }
  | {
      kind: "execute"
      projectId: string
      disputeId?: string
      actionType: "DISPUTE_CREATE" | "DISPUTE_RESOLVE"
      payload: Record<string, unknown>
      approvedByUserId: string
    }
```

## Contexto mínimo

Debe resolver:

- detalle de la disputa
- timeline del caso
- documentos
- evidence
- activity
- pagos asociados
- milestones afectados
- trust snapshot
- journal del proyecto
- memory durable de `Project` y `Dispute`

## Source of truth

- disputa: `DisputesService`
- docs/evidence/payments/contexto: `ProjectsRepository`
- riesgo: `ActionRiskClassifier`
- planes: `AgentWorkPlan`
- delegación: `AgentDelegation`
- auditoría: `AuditLog`

## Modos

```ts
type DisputeHarnessMode =
  | "assist"
  | "plan"
  | "review"
  | "execute"
  | "paused"
```

## Transiciones

- `intake` -> `plan` o `review` según claridad del caso
- `analyze` -> `assist`
- `plan` -> `plan`
- `review_action` -> `review`
- `execute` -> `execute`

Regla:

- `DISPUTE_RESOLVE` siempre entra por `plan` antes de `execute`
- `DISPUTE_CREATE` puede ser directa si el caso es evidente, pero debe quedar auditada

## Salidas

```ts
type DisputeHarnessOutput =
  | {
      kind: "analysis"
      summary: string
      contradictions: string[]
      citations: CitationRef[]
      nextActions: string[]
    }
  | {
      kind: "plan"
      workPlanId: string
      summary: string
      blockers: string[]
      steps: Array<{ id: string; title: string; status: string }>
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
- `feedback`
- `fact`

Escribe:

- `context`
- `feedback`
- `fact`

### Delegation policy

Casos que habilitan delegación futura:

- evidencia extensa
- contradicciones entre varias fuentes
- impacto financiero relevante
- múltiples hitos afectados

### Risk policy

- `DISPUTE_RESOLVE` es `HIGH`
- `DISPUTE_CREATE` es `MEDIUM` o `HIGH` según impacto

## Work plan

Debe persistir plan en `AgentWorkPlan`.

Campos recomendados:

- `agentRole = "dispute-orchestrator"`
- `entityType = "Dispute"`
- `entityId = disputeId`

`stepsJson` mínimo:

1. resumir timeline
2. mapear evidencia
3. revisar contrato y pagos
4. identificar contradicciones
5. preparar recomendación
6. enviar a review humana

## Delegación futura

Cuando `AgentDelegation` entre en uso real, este harness debería poder delegar a:

- `evidence-coach`
- `risk`
- `payments-review`

Regla:

- consolidación final siempre vuelve al `DisputeHarness`

## Ubicación recomendada

- `apps/api/src/modules/agents/harnesses/dispute.harness.ts`
- `apps/api/src/modules/agents/harnesses/dispute.types.ts`

## Dependencias directas

- `DisputesService`
- `ProjectsService`
- `ProjectsRepository`
- `AgentMemoryService`
- `ActionRiskClassifier`
- `AuditService`

## Checklist de aceptación futura

- puede sintetizar un caso con citas reales
- puede producir plan persistido de resolución
- no ejecuta resolución `HIGH` sin review
- queda listo para delegación controlada
