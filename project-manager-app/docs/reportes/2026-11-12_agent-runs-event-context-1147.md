# 2026-11-12 — #1147: runs `pricing/risk` sin contexto — clasificación y fix

Base: `main` @ `7e80dd0` (#1146). Rama: `claude/new-session-5y68i5`.

## Diagnóstico causal

| Etiqueta | Hallazgo | Evidencia |
|---|---|---|
| **DEMOSTRADO** | `job.created` emite `triggers: ["pricing","risk","audit"]`; `job.status_changed`, `dispute.opened/resolved` y `milestone.rejected` incluyen `risk`. | `apps/api/src/modules/jobs/jobs.service.ts:417,685`, `disputes.service.ts:85`, `disputes.events.ts:33`, `milestones.events.ts:76` |
| **DEMOSTRADO** | `AgentTriggerRouter` crea esos runs con `input = { eventType, eventMeta, eventPayload }`: el `jobId`/`projectId` vive en `input.eventPayload`, nunca en `input.context`. | `apps/api/src/modules/domain-events/agent-trigger-router.service.ts:41-57` |
| **DEMOSTRADO** | El Worker (`extractContext`) solo fusionaba `input` + `input.context`; nunca leía `eventPayload`. Todo run `pricing`/`risk` disparado por evento falla de forma determinista con `Delegated run requires at least projectId or jobId in its context.` | `apps/worker/src/agent-run-handlers.mjs` (antes del fix); test rojo → verde abajo |
| **DEMOSTRADO** | El fixture de tests existente ponía los IDs en `input.context` (forma que el productor real no usa), por eso el defecto no se detectó. | `tests/unit/worker-specialized-handlers.test.mjs` `makeRun` |
| **HIPÓTESIS fuerte** | Los dos runs de ejemplo del handoff (`cmp8in8vp…` pricing, `cmp8in907…` risk) se crearon con 162 ms de diferencia (timestamp cuid, 2026-05-16T15:43:35Z), en el orden `pricing → risk`, el mismo de `job.created`. Ningún script de smoke crea ese par (los smokes solo crean `risk` y la sonda de observabilidad solo `pricing`, aislados). | decodificación base36 del prefijo cuid |
| **PENDIENTE / REQUIERE APROBACIÓN** | Confirmar run a run `triggerType='event'` y `correlationId LIKE 'job:%:created'` para los 12. Hace falta una consulta de solo lectura en la BD de producción, que este agente no ejecutó. | — |

## Clasificación de los 12 runs

| Clase | Criterio (consulta de solo lectura propuesta) | Estado |
|---|---|---|
| `real-business-defect` | `triggerType='event'` y `correlationId` `job:*:created` / `job:*:*:*` / `dispute:*` / `milestone:*` | Esperado para la mayoría o todos. **Pendiente de confirmación en BD** |
| `synthetic-observability` | `triggerType='manual'`, `agentType='pricing'`, `input={}`, tenant `tnt_demo` (sonda de la skill `semse-local-observability-testing`) | Improbable en producción (la sonda usa `tnt_demo` y la pila local) |
| `synthetic-smoke` | `correlationId` `agents-smoke-*`, `corr-*` (scripts `api-agents-smoke`, `api-integration`) | Solo `risk`. Esos scripts completan o fallan el run ellos mismos |
| `unknown` | cualquier otro | — |

Consulta sugerida (solo lectura y sin PII; necesita autorización):
`SELECT id, "agentType", "triggerType", "correlationId", "createdAt", "tenantId" FROM "AgentRun" WHERE id IN (...12 ids...);`

## Fix (Worker, mínimo)

`extractContext` incorpora **solo** los identificadores string no vacíos (`projectId`, `jobId`, `milestoneId`, `disputeId`) de `input.eventPayload`, con la precedencia más baja: `context` explícito > campos de `input` > IDs del evento.

- No inventa IDs: si el evento no trae identificadores, el guard sigue fallando de forma cerrada y no se hacen lookups para adivinar el ownership.
- Los valores que no son string (p. ej. `{ "$ne": null }`) se ignoran.
- Cada lookup posterior sigue con el `tenantId` del run, y la API valida tenant/org como antes.
- No se toca el claim, el `claimToken`, el fencing, el RBAC ni `AGENT_RUNNER`.
- La sonda manual sin contexto sigue fallando a propósito (test incluido).

## Pruebas

`node --experimental-strip-types --test tests/unit/worker-specialized-handlers.test.mjs`
- Antes del fix: 8 pass / **3 fail** (pricing por evento, risk por evento, precedencia).
- Después del fix: **11/11 pass**.

Suite unitaria raíz completa: 14 fallos idénticos antes y después del cambio (requieren `apps/api/dist`, que no se compiló en este entorno). Ninguna regresión; +6 tests nuevos en verde.

## Fuera de alcance / pendiente

- AR-05…AR-08 (cross-tenant en la API, `WORKER` sin `AGENT_RUNNER`, fencing claim→complete, idempotencia): este cambio no los toca. Siguen cubiertos por los tests de fencing/claim existentes (`apps/api/test/agent-run-*`, `scripts/api-integration.mjs`). No se volvieron a demostrar aquí.
- No se reencolan ni se reintentan los 12 runs históricos.
- `trust-match` (`job.created`) y `evidence-coach` (`milestone.submitted`) usan el mismo `extractContext` y también se benefician. No se verificaron en runtime.

## Rollback

Revertir el commit. El comportamiento anterior vuelve a fallar los runs por evento, sin efectos colaterales en los datos.
