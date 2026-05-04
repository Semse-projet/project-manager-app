# Afinamiento Agent Action Contract — Todos los huecos cerrados

- Fecha: 2026-04-18
- Estado: completado
- Frente: `project-manager-app`
- Precondición: `agent_action_contract_2026-04-18.md` + `post_approval_execution_2026-04-18.md`

## Audit previo — 10 problemas identificados y resueltos

### E (CRÍTICO) — Guard de doble ejecución

**Archivo:** `apps/api/src/modules/agents/agent-approval.service.ts`

Problema: `decide()` sin guard — podía ejecutar la misma acción dos veces si se llamaba el endpoint dos veces.

Fix: Antes del update en `decide()`, se verifica `approval.status !== "pending"` y se lanza `ConflictException` si el approval ya fue decidido.

### D (ALTA) — corpusStatus.evidenceCount siempre 0

**Archivos:** `milestones.repository.ts` + `project-copilot.harness.ts`

Problema: `resolveCorpusStatus()` retornaba siempre `evidenceCount: 0`. Las acciones `PROPOSE_MILESTONE_APPROVAL` y `PROPOSE_ESCROW_RELEASE` nunca se sugerían porque dependen de `evidenceCount > 0`.

Fix:
- Nuevo método `MilestonesRepository.countProjectEvidence({ tenantId, projectId })` usando `prisma.evidence.count`.
- `resolveCorpusStatus()` ahora es `async`, recibe `actor` y hace la query real.
- `corpusStatus.status` ahora refleja `"ready"` si hay evidencia.

### C (ALTA) — PROPOSE_DISPUTE_OPEN era stub silencioso

**Archivo:** `project-copilot.harness.ts`

Problema: El handler retornaba un string de "éxito" sin hacer nada real. El audit trail quedaba corrompido.

Fix: Implementado `executeDisputeOpen()` que llama `disputesService.create()` con el `projectId` del runtime.

### M (ALTA) — Smoke test completamente roto

**Archivo:** `scripts/api-copilot-actions-smoke.mjs`

Problemas:
- Usaba `PAYMENT_APPROVE`, `PAYMENT_RELEASE`, `DISPUTE_RESOLVE` — tipos que ya no existen.
- Esperaba `approvalStatus: "approved"` en la respuesta inmediata — imposible con `approvalMode: "required"`.
- No testeaba el flujo de dos pasos.

Fix: Smoke completamente reescrito con:
- Tipos canónicos: `PROPOSE_MILESTONE_APPROVAL`, `PROPOSE_ESCROW_RELEASE`, `PROPOSE_DISPUTE_RESOLVE`
- Flujo correcto: `copilotAction()` → assert `pending` → `decideApproval()` → assert `executed: true`
- Test del guard de doble ejecución: segundo `decideApproval` debe lanzar error
- Assert de `corpusStatus.evidenceCount >= 1` para validar la query real

### G/H/I (MEDIA) — Frontend ciego a approvalMode

**Archivo:** `apps/web/app/(app)/client/projects/[projectId]/copilot/page.tsx`

Problemas:
- `actionFeedback` era un string plano, mismo estilo verde para todo.
- No distinguía entre "ejecutado" y "en espera de aprobación".

Fix:
- `actionFeedback` ahora es `{ message, kind: "executed" | "pending" | "error" }`.
- Colores diferenciados: verde (ejecutado), amarillo (pending), rojo (error).
- Etiquetas: "✓ Ejecutado:" / "⏳ Pendiente de aprobación:".
- El refresh post-acción solo se dispara si la acción fue ejecutada, no si está pending.

### L (MEDIA) — Sin UI para approvals pendientes

**Archivos:** `apps/web/app/semse-api.ts` + `apps/web/app/(app)/admin/ops/page.tsx`

Problema: El ops_admin no tenía superficie para ver y decidir approvals pendientes.

Fix:
- `semse-api.ts`: nuevas funciones `fetchPendingApprovals()` y `decideAgentApproval()`.
- `admin/ops/page.tsx`: panel "Aprobaciones Pendientes" con:
  - Lista de approvals pendientes con actionType, projectId, riskLevel, timestamp
  - Botones "Aprobar y ejecutar" / "Rechazar"
  - Feedback inline con resultado de ejecución post-aprobación
  - Badge contador de pendientes
  - Botón refresh

### B (BAJA) — resolveActionType con array hardcodeado

**Archivo:** `project-copilot.harness.ts`

Fix: Reemplazado por `agentActionTypeSchema.safeParse(raw)` — automáticamente sincronizado con el enum Zod.

### A/J (BAJA) — EXECUTABLE_ACTION_TYPES unused

**Archivo:** `project-copilot.harness.ts`

Fix: Variable eliminada.

## Validación final

```bash
npm run build --workspace @semse/schemas   # OK
npm run build --workspace @semse/agents    # OK
npx tsc --noEmit --project apps/api/tsconfig.json  # OK
npx tsc --noEmit --project apps/web/tsconfig.json  # OK
```

## Estado del módulo tras afinamiento

| Área | Estado |
|------|--------|
| Agent Action Contract (schema + policy) | Completo |
| Approval gate `required` | Bloquea ejecución correctamente |
| Guard doble ejecución | Lanza ConflictException |
| Post-approval execution | Encadenado en controller |
| Evidence count real | Query Prisma implementada |
| PROPOSE_DISPUTE_OPEN | Handler real |
| Admin ops UI — approvals | Panel funcional |
| Frontend feedback diferenciado | pending / executed / error |
| Smoke test | Flujo completo dos pasos + guard test |

## Listo para siguiente frente

El módulo de capa agentiva base está cerrado con criterios verificables.
Próxima área recomendada: extender `workspace_memory` a más módulos de negocio (jobs, milestones, disputes) para que los agentes tengan contexto persistente real.
