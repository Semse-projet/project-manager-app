# Agent Action Contract — Capa Agentiva Base

- Fecha: 2026-04-18
- Estado: completado
- Frente: `project-manager-app`

## Objetivo

Fijar el contrato único entre UI copiloto, agente, tools, approval flow y backend determinista.
Eliminar el auto-approve silencioso en acciones de alto riesgo.

## Cambios implementados

### packages/schemas — AgentAction como tipo canónico

Nuevo archivo:
- `packages/schemas/src/agent-action.schema.ts`

Tipos exportados:
- `AgentAction` — contrato completo de una acción propuesta por el copiloto
- `AgentActionType` — enum de 13 tipos con semántica clara por dominio
- `AgentApprovalMode` — `"none" | "recommended" | "required"`
- `AgentActionDomain` — `"jobs" | "milestones" | "evidence" | "escrow" | "disputes" | "scope" | "internal"`

Campos clave de `AgentAction`:
- `summary` — descripción operativa (reemplaza `label`)
- `rationale` — explica por qué se sugiere la acción
- `requiredInputs` — qué datos hacen falta para ejecutar
- `riskLevel` — derivado de la política, no hardcodeado
- `approvalMode` — reemplaza `requiresApproval: boolean` con semántica real
- `expectedOutcome` — qué pasa si se ejecuta
- `toolCall` — qué tool backend se invoca y con qué payload

### packages/agents — Policy matrix

Nuevo archivo:
- `packages/agents/src/action-policy.ts`

Funciones exportadas:
- `getActionPolicy(type)` — devuelve `{ approvalMode, riskLevel }` por tipo
- `resolveApprovalMode(type, riskOverride?)` — escala approvalMode si el riesgo contextual es mayor

Política canónica por tipo:

| Tipo | approvalMode | riskLevel |
|------|-------------|-----------|
| READ_CONTEXT, ANALYZE_EVIDENCE, ASSESS_RISK | none | low |
| REQUEST_MISSING_EVIDENCE, DRAFT_MESSAGE | none | low |
| DRAFT_SCOPE_CHANGE, PROPOSE_MILESTONE_UPDATE, PROPOSE_JOB_STATUS_CHANGE | recommended | medium |
| PROPOSE_MILESTONE_APPROVAL, PROPOSE_ESCROW_RELEASE | required | high |
| PROPOSE_DISPUTE_OPEN, PROPOSE_DISPUTE_RESOLVE | required | high |
| ESCALATE_TO_HUMAN | none | low |

### apps/api — Harness refactorizado

Archivos modificados:
- `apps/api/src/modules/agents/harnesses/project-copilot.types.ts`
- `apps/api/src/modules/agents/harnesses/project-copilot.harness.ts`

Cambios en types:
- `CopilotActionType` y `CopilotActionView` eliminados
- Re-exporta `AgentAction`, `AgentActionType`, `AgentApprovalMode` desde `@semse/schemas`
- Output `kind: "refresh"` ahora retorna `AgentAction[]`
- Output `kind: "action"` expone `approvalMode` en la respuesta

Cambios en harness:

**Approval gate real** — el cambio más importante:

Antes:
```
handleAction() → queueAndApproveAction() → auto-aprueba TODO → executeApprovedAction()
```

Ahora:
```
handleAction()
  → policy = getActionPolicy(type)
  → if approvalMode === "required":
      registerApprovalRequest()  ← status: PENDING
      return { approvalStatus: "pending" }  ← NO ejecuta
  → if approvalMode === "recommended":
      registerAndAutoApprove()   ← registra + auto-aprueba para audit trail
      executeApprovedAction()    ← ejecuta
  → if approvalMode === "none":
      executeApprovedAction()    ← ejecuta directo, sin registro
```

**Acciones sugeridas migradas** — `buildSuggestedActions` ahora retorna `AgentAction[]`:

| Antes | Ahora |
|-------|-------|
| PAYMENT_APPROVE | PROPOSE_MILESTONE_APPROVAL |
| PAYMENT_RELEASE | PROPOSE_ESCROW_RELEASE |
| DISPUTE_RESOLVE | PROPOSE_DISPUTE_RESOLVE |
| PAYMENT_APPROVE (evidencia ausente) | REQUEST_MISSING_EVIDENCE |
| PAYMENT_APPROVE (fallback) | ASSESS_RISK |

**Ejecución** — `executeApprovedAction` actualizado para los nuevos tipos.

### apps/web — Frontend actualizado

Archivo modificado:
- `apps/web/app/(app)/client/projects/[projectId]/copilot/page.tsx`

Cambios:
- Display usa `action.summary` (con fallback a `action.label` por compatibilidad)
- Indicador de aprobación usa `action.approvalMode` en lugar de `action.requiresApproval`
- Payload enviado al ejecutar incluye `approvalMode` en lugar de `requiresApproval`

## Validación

```bash
npm run build --workspace @semse/schemas   # OK
npm run build --workspace @semse/agents    # OK
npx tsc --noEmit --project apps/api/tsconfig.json  # OK
npx tsc --noEmit --project apps/web/tsconfig.json  # OK
```

## División de capas resultante

| Capa | Qué contiene ahora |
|------|-------------------|
| **Determinista** | milestones.policy.ts, payments.service.ts (guards), disputes.policy.ts, enums Prisma |
| **Agentiva** | governance.ts, runtime.ts, action-policy.ts, buildSuggestedActions() |
| **Tools** | executeApprovedAction(), handlers de milestone/escrow/dispute |
| **Approval boundary** | `approvalMode: "required"` bloquea ejecución hasta decisión humana explícita |

## Estado del approval flow

- `approvalMode: "required"` → crea `AgentApproval` en DB con `status: PENDING`. No ejecuta. Espera `POST /v1/agents/approvals/:approvalId/decision`.
- `approvalMode: "recommended"` → crea `AgentApproval` auto-aprobado para trazabilidad. Ejecuta inmediatamente.
- `approvalMode: "none"` → ejecuta sin registro. Solo acciones de análisis/lectura.

## Siguiente paso recomendado

1. Conectar endpoint `POST /v1/agents/approvals/:approvalId/decision` con ejecución real post-aprobación (actualmente el agente queda esperando pero la ejecución post-aprobación no está encadenada automáticamente).
2. Extender `buildSuggestedActions` con contexto de evidencia real (actualmente `evidenceCount` es 0 hardcodeado).
3. Replicar el patrón `AgentAction` a otros agentes especialistas.
