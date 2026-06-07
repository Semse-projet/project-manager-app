# SSE Real + systemHealth + logs por conversación

Fecha: 2026-04-28
Estado: **build:api EXIT:0 | WEB TS: 0 errores | tests: 133/133 | SSE smokes OK**

## Qué se hizo

### SSE real desde API (no más polling disfrazado)

- `SseInfraModule` (@Global) provee `SseEventBusService` y `HealthService` a toda la app.
- `SseModule` expone `SseController` con endpoints `@Sse()`:
  - `GET /v1/sse/health` — push cada 15s + keepalive 20s
  - `GET /v1/sse/plans/:planId` — push en cada mutación del plan
  - `GET /v1/sse/delegations?projectId=X` — push en cada nueva delegación
  - `GET /v1/sse/context` — canal abierto para futuras emisiones de contexto

### Eventos push reales en servicios

- `AgentWorkPlanService` emite `plan:${planId}` en: approve, reject, cancel, completeStep, blockStep, skipStep.
- `AgentDelegationService` emite `delegations:${projectId}` en: delegateTask.
- Ambos inyectan `SseEventBusService` con `@Optional()` — no rompen si el bus no está.

### systemHealth real

- `HealthService` conecta a Redis por ioredis, hace PING real cada 15s.
- Detecta worker vivo leyendo clave `semse:worker-lock:*` en Redis (la misma que el worker setea con TTL).
- Re-intenta conexión a Redis en cada ciclo si estaba caído — no queda en fail permanente.
- Reemplaza el hardcode `{ api:"ok", worker:"ok", redis:"ok" }` en `OperationalContextService`.

### BFF SSE proxy real

- `apps/web/app/api/semse/agents/plans/[planId]/stream/route.ts` — proxy al SSE API en lugar de polling REST.
- `apps/web/app/api/semse/agents/delegations/stream/route.ts` — ídem.
- `apps/web/app/api/semse/health/stream/route.ts` — nuevo, proxy del SSE health.
- `_server.ts` extendido con `getServerConfig()` y `buildSemseRequestHeaders()`.

### AI Mission Control — SSE live

- Consume `EventSource /api/semse/health/stream` en tiempo real.
- Muestra `● live` junto a los valores cuando hay conexión SSE activa.
- Polling REST reducido a 30s (era 15s) como fallback.

### threadId en AiInteractionLog

- `AiInteractionLog.threadId String?` — migración `20260428010000_ai_interaction_thread_id`.
- `AiGenerateRequest.threadId` — pasado desde el controller de Prometeo al logger.
- Logs de respuestas sintéticas (`context_only`, `report`) también registran `threadId`.
- Índice en `threadId` para queries eficientes por conversación.

## Smokes verificados

```txt
GET /v1/sse/health
-> event: health-update
-> data: {"api":"ok","redis":"ok","worker":"degraded","checkedAt":"..."}

(con Redis detenido)
-> data: {"api":"ok","redis":"degraded","worker":"degraded",...}

(con Redis vivo)
-> data: {"api":"ok","redis":"ok","worker":"degraded",...}

GET /v1/sse/delegations?projectId=proj_demo_001
-> event: delegations-update
-> data: [...3 delegaciones del seed demo]

SSE push en plan: approve → evento plan-update emitido vía SseEventBusService
SSE push en delegation: delegateTask → evento delegations-update emitido
```

## Archivos nuevos/editados clave

- `apps/api/src/infrastructure/sse/sse-event-bus.service.ts`
- `apps/api/src/infrastructure/sse/sse-infra.module.ts`
- `apps/api/src/infrastructure/sse/sse.module.ts`
- `apps/api/src/infrastructure/sse/sse.controller.ts`
- `apps/api/src/modules/health/health.service.ts`
- `apps/api/src/modules/agents/agent-work-plan.service.ts` — emisión SSE en mutaciones
- `apps/api/src/modules/agents/agent-delegation.service.ts` — emisión SSE en delegaciones
- `apps/api/src/modules/ai-models/context/operational-context.service.ts` — systemHealth real
- `apps/api/src/modules/ai-models/logging/ai-interaction-logger.service.ts` — threadId
- `apps/api/src/modules/ai-models/dto/ai-generate-request.dto.ts` — threadId
- `apps/web/app/api/semse/_server.ts` — getServerConfig, buildSemseRequestHeaders
- `apps/web/app/api/semse/agents/plans/[planId]/stream/route.ts` — proxy SSE real
- `apps/web/app/api/semse/agents/delegations/stream/route.ts` — proxy SSE real
- `apps/web/app/api/semse/health/stream/route.ts` — nuevo
- `apps/web/app/(app)/admin/ai-mission-control/page.tsx` — SSE live health

## Estado

- `build:api EXIT:0`
- `WEB TS: 0 errores`
- `tests: 133/133`
- `GET /v1/sse/health OK`
- `GET /v1/sse/delegations OK`
- `systemHealth: redis real, worker real, api siempre ok`

## Qué sigue (bloque B)

Finance & Document Tools:
- Facturas, recibos, gastos, plantillas
- Control financiero por proyecto
- IA financiera/documental
