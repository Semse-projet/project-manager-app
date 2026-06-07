# Prometeo Context Layer + AI Mission Control

Fecha: 2026-04-28
Estado: **build:api EXIT:0 | WEB TS: 0 errores | API/BFF smoke OK**

## Qué se hizo

- Prometeo ahora usa `OperationalContextService` para contexto real de jobs, hitos, pagos, evidencias y disputas.
- La selección de agente en panel (`marta`, `felix`, `pulse`, `justus`, `planner`) afecta la ruta real.
- Se agregaron logs sintéticos para:
  - `prometeo-context-guard`
  - `prometeo-operational-report`
- Se creó `/admin/ai-mission-control`.
- Se alineó el runtime local web al seed demo operativo.
- Se corrigió el etiquetado `demo/local/live`.
- Se evitó el bootstrap innecesario de `/v1/auth/token` en local.
- Se incluyeron `AssistantSettings` del usuario dentro del contexto de Prometeo.

## Smokes verificados

### API directa

```txt
POST /v1/ai-models/prometeo/chat agentId=marta no project
-> mode=context_only
-> responde "No tengo proyecto seleccionado..."

POST /v1/ai-models/prometeo/chat agentId=assistant projectId=proj_demo_001
-> mode=report
-> genera reporte operativo

POST /v1/ai-models/prometeo/chat agentId=marta projectId=proj_demo_001
-> mode=runtime
-> provider=anthropic
-> modelSlug=claude-sonnet
```

### Logs AI

```txt
GET /v1/ai-models/logs/stats
-> total=4
-> byModel: claude-sonnet=2, prometeo-context-guard=1, prometeo-operational-report=1
```

### BFF web

```txt
GET /api/semse/cortex/context?projectId=proj_demo_001
-> mode=local
-> project=proj_demo_001
-> escrowFunded=3100
-> pendingRelease=1033
-> disputes.open=1
```

```txt
GET /api/semse/cortex/context?projectId=proj_demo_001
+ headers x-semse-user-id/usr_client_001
-> assistantTone=friendly
-> assistantLanguage=es
-> assistantVerbosity=balanced
```

## Archivos tocados en este bloque

- `apps/api/src/modules/ai-models/ai-models.controller.ts`
- `apps/api/src/modules/ai-models/context/operational-context.service.ts`
- `apps/api/src/modules/ai-models/logging/ai-interaction-logger.service.ts`
- `apps/web/.env.local`
- `apps/web/app/api/semse/_server.ts`
- `apps/web/app/(app)/admin/ai-mission-control/page.tsx`

## Qué falta

- SSE real
- `systemHealth` real
- unificar vista administrativa de agentes con sesión autenticada y datos live
- supervisor coordinado multi-agente real
