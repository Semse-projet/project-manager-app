# Algoritmos Ecosistema — Items 1, 2, 3 completados

- Fecha: 2026-04-19
- Estado: completado
- Frente: `project-manager-app`

## Qué se hizo y por qué

### ITEM 3 — Idempotencia DB-backed (hecho primero por ser fundamento)

**Problema:** `idempotency.store.ts` era un `Map<string, unknown>` en memoria. Moría al reiniciar el proceso. Cualquier retry de evento post-restart creaba un run duplicado.

**Fix:**
- Nuevo modelo Prisma `AgentRunIdempotency` con unique constraint en `(tenantId, key)` + TTL de 24h.
- Tabla creada en DB y registrada como migración `20260419000000_agent_run_idempotency`.
- `idempotency.store.ts` reducido a solo `buildIdempotencyKey()` (función pura).
- Nuevo `IdempotencyService` (`apps/api/src/common/idempotency.service.ts`) injectable con Prisma.
- `AgentsService.createIdempotent()` ahora usa `IdempotencyService.get/set()` — persiste en DB.
- `IdempotencyService` registrado en `AgentsModule`.

**Archivos modificados:**
- `packages/db/prisma/schema.prisma` — nuevo modelo + relación en Tenant
- `packages/db/prisma/migrations/20260419000000_agent_run_idempotency/migration.sql`
- `apps/api/src/common/idempotency.store.ts` — solo buildIdempotencyKey
- `apps/api/src/common/idempotency.service.ts` — nuevo servicio DB-backed
- `apps/api/src/modules/agents/agents.service.ts` — usa IdempotencyService
- `apps/api/src/modules/agents/agents.module.ts` — registra IdempotencyService

### ITEM 3b — Fix dedup key en AgentTriggerRouter

**Problema:** `idempotencyKey: 'domain:${event.type}'` era idéntica para todos los eventos del mismo tipo. Dos jobs distintos con `job.created` compartían la misma key base, haciendo que el segundo se "deduplicara" incorrectamente si el correlationId no era suficiente.

**Fix:** Key cambiada a `domain:${event.type}:${event.meta.correlationId}:${agentType}` — única por evento + agente específico.

**Archivos modificados:**
- `apps/api/src/modules/domain-events/agent-trigger-router.service.ts`

### ITEM 1 — Handlers reales (trust-match, dispute, evidence-coach)

#### trust-match
**Problema:** `buildTrustMatch()` retornaba `pro:${category}:${location}:alpha` — IDs totalmente inventados.

**Fix:**
- `AgentTriggerRouter` ahora llama `MatchingRepository.loadCandidates()` + `rankCandidates()` (algoritmo Jaccard real) cuando el evento es `job.created` + trigger `trust-match`.
- Inyecta `realCandidates: MatchCandidateView[]` en el payload del run.
- `buildTrustMatch()` en `runtime.ts` consume candidatos reales si existen; si no hay candidatos, retorna `topMatch: null` + `requiresHumanReview: true` (ya no inventa IDs).
- Confidence calculada desde el score real del top candidato.

#### dispute
**Problema:** `buildDispute()` usaba regex `/quality|incomplete|no_show/i` sobre texto libre. Confidence hardcodeada 0.73/0.67.

**Fix:**
- `AgentTriggerRouter` enriquece el payload con `evidenceCount`, `milestoneStatus`, `contractExists`, `reasonCode` (campo estructurado del schema Dispute).
- `buildDispute()` usa scoring real:
  - base 0.40
  - +0.20 si hay evidencia (>0 items)
  - +0.15 si el milestone estaba APPROVED o SUBMITTED
  - +0.15 si hay contrato firmado
- Determinación del partido favorecido usa `reasonCode` estructurado (incomplete_work, quality_issue, no_show, payment_dispute) + regex de fallback si no hay reasonCode.

#### evidence-coach
**Problema:** `qualityScore = 0.45 + evidenceCount * 0.18 + 0.15` — scoring lineal que ignoraba tipo y calidad de archivos.

**Fix:**
- `AgentTriggerRouter` enriquece con datos reales del milestone: `photoCount`, `videoCount`, `totalCount`, `hasBeforeAfterPair` (heurística por timestamps), `checklistItemCount`, `requiredEvidenceTypes`.
- Scoring nuevo basado en tipos reales:
  - base 0.10
  - +0.20 si hay foto
  - +0.25 si hay video
  - +0.20 si hay par antes/después
  - +0.15 si checklist completo
  - +0.10 si count >= 3
- Aprobación si qualityScore >= 0.70 (antes era >= 0.72)
- Missing items específicos: "Agregar foto", "Incluir antes/después", "Video recomendado"

**Archivos modificados:**
- `apps/api/src/modules/domain-events/agent-trigger-router.service.ts` — enrichPayload completo
- `apps/api/src/modules/domain-events/domain-events.module.ts` — importa MatchingModule
- `packages/agents/src/runtime.ts` — buildTrustMatch, buildDispute, buildEvidenceCoach reescritos
- `apps/api/src/modules/matching/matching.service.ts` — fix type defaults
- `apps/api/src/modules/matching/matching.controller.ts` — fix type defaults

### ITEM 2 — FSM de Jobs

**Problema:** `JobsRepository.create()` siempre ponía `status: "POSTED"`. No había guards de transición. La DB tiene 10 estados pero el service no los protegía — cualquier mutación directa saltaba la máquina de estado.

**Fix:**
- `jobs.service.ts` — nueva función `transitionJob(jobId, targetStatus, actor)` con:
  - Matriz de transiciones `JOB_TRANSITIONS` (tabla completa 10 estados)
  - Guard que lanza `UnprocessableEntityException` si la transición no está permitida
  - Emite evento `job.status_changed` con `triggers: ["risk", "audit"]`
  - Registra audit trail con `from/to` status
- `jobs.repository.ts` — nuevo método `updateStatus()` que aplica el cambio en Prisma

**Matriz implementada:**
```
draft       → posted, cancelled
posted      → reserved, cancelled
published   → reserved, cancelled
reserved    → accepted, posted
accepted    → in_progress, cancelled
in_progress → review, dispute
review      → completed, in_progress
dispute     → completed, cancelled
awarded     → in_progress
completed   → [] (terminal)
cancelled   → [] (terminal)
```

**Archivos modificados:**
- `apps/api/src/modules/jobs/jobs.service.ts`
- `apps/api/src/modules/jobs/jobs.repository.ts`

## Validación

```bash
npm run build --workspace @semse/agents   # OK
npm run build --workspace @semse/api      # OK
npx tsc --noEmit --project apps/api/tsconfig.json  # OK (0 errores)
```

## Pendiente (próximos items)

4. Autonomía genera código real (LLM genera código fuente, no solo markdown en `generated/`)
5. Prioridad en worker + retry en event bus
6. Búsqueda semántica en knowledge
