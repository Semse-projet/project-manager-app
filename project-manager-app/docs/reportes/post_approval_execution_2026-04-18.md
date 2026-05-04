# Post-Approval Execution — Encadenamiento Real

- Fecha: 2026-04-18
- Estado: completado
- Frente: `project-manager-app`
- Precondición: `agent_action_contract_2026-04-18.md` completado

## Problema

Cuando `approvalMode: "required"`, el harness registraba la acción como `PENDING` y retornaba sin ejecutar.
Al hacer `POST /v1/agents/approvals/:id/decision` con `decision: "approved"`, la DB se actualizaba pero la acción nunca se ejecutaba.

## Implementación

### ProjectCopilotHarness — nuevo método público

`apps/api/src/modules/agents/harnesses/project-copilot.harness.ts`

Nuevo método: `executeFromApproval(actor, requestId, approval)`

Flujo:
1. Lee `contextSummary` del approval (JSON: `{ projectId, actionType, payload }`)
2. Reconstruye el runtime del proyecto
3. Llama `executeApprovedAction(runtime, actionType, payload)`
4. Audita el resultado (`post_approval_executed` o `post_approval_failed`)
5. Retorna `{ executed: boolean, summary: string, error?: string }`

Método privado auxiliar: `parseContextSummary(raw)` — parsea el JSON con fallo seguro.

### AgentsController — encadenamiento en `decideApproval`

`apps/api/src/modules/agents/agents.controller.ts`

Después de llamar `agentsService.decideApproval()`:
- Si `decision === "approved"` Y `approval.correlationId.startsWith("copilot:")`:
  → llama `projectCopilotHarness.executeFromApproval(...)`
  → incluye `executionResult` en la respuesta

La detección de aprobaciones de copiloto usa el prefijo `"copilot:"` en `correlationId`.
Formato: `"copilot:{projectId}:{actionType}:{timestamp}"`

## Flujo completo ahora

```
1. POST /v1/agents/copilot  { kind: "action", actionType: "PROPOSE_ESCROW_RELEASE", ... }
   → approvalMode = "required"
   → registra AgentApproval { status: PENDING }
   → responde { approvalStatus: "pending", approvalId: "apr_copilot_..." }

2. POST /v1/agents/approvals/apr_copilot_.../decision  { decision: "approved" }
   → actualiza AgentApproval { status: APPROVED }
   → detecta correlationId.startsWith("copilot:")
   → parseContextSummary → { projectId, actionType: "PROPOSE_ESCROW_RELEASE", payload }
   → executeApprovedAction → executeEscrowRelease()
   → responde { ...approval, executionResult: { executed: true, summary: "Release ejecutado..." } }

3. Si decision: "rejected"
   → actualiza status: REJECTED
   → NO ejecuta (no hay correlationId check)
   → responde solo el approval actualizado
```

## Invariantes

- Solo se ejecuta si `decision === "approved"` (nunca en rejected)
- Solo se ejecuta si el correlationId tiene prefijo `"copilot:"` (seguro para otros tipos de approvals)
- Si el contextSummary es inválido o incompleto, retorna `{ executed: false }` sin lanzar excepción
- Si la ejecución falla, retorna `{ executed: false, error }` sin romper la respuesta del decide

## Validación

```bash
npx tsc --noEmit --project apps/api/tsconfig.json  # OK
```

## Estado del flujo de aprobación

| approvalMode | Comportamiento al llamar /copilot | Comportamiento al llamar /decision |
|---|---|---|
| `"none"` | Ejecuta directo, sin approval | N/A |
| `"recommended"` | Registra approval + auto-aprueba + ejecuta | N/A |
| `"required"` | Registra PENDING, no ejecuta, retorna approvalId | Si approved → ejecuta. Si rejected → no ejecuta. |
