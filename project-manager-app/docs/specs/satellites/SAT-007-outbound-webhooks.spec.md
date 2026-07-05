---
id: "satellites.outbound-webhooks"
title: "SAT-007 — Webhooks salientes + SSE autenticado para satélites"
type: spec
domain: "api"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "high"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/worker
  - apps/api
related_tests: []
related_endpoints:
  - v1/satellites/webhooks
related_events:
  - job.matched
  - rating.requested
  - evidence.approved
  - milestone.*
related_agents: []
last_verified: ""
---

# Spec: Flujo inverso — SEMSE empuja hacia los satélites

## Problem Statement

Las fases anteriores hacen que los satélites llamen a SEMSE (pull). Falta el sentido
contrario: cuando pasa algo relevante (`job.matched`, `rating.requested`,
`evidence.approved`), el satélite debe enterarse sin polling. El fan-out interno de
eventos ya existe (worker); falta la salida controlada hacia consumidores externos.

## Scope

- In scope: registro de webhooks por satélite, entrega firmada con reintentos, SSE autenticado con satellite token, catálogo de eventos exportables.
- Out de scope: garantía exactly-once (se garantiza at-least-once + idempotency key), eventos con payload completo (se envía referencia, el satélite hace fetch con su scope).

## 1. Registro y entrega

### `POST /v1/satellites/webhooks` (token del satélite)
```yaml
auth: satellite-token
input_schema: { url: https URL, events: string[], secret?: string }
output_schema: { id, url, events, createdAt }
```

- Eventos suscribibles limitados por los scopes del token (un token `intake:*` no puede suscribirse a `payments.*`).
- **Entrega:** POST firmado `x-semse-signature` (HMAC-SHA256 del body con el secret; mismo patrón de verificación que el webhook de WhatsApp/Meta ya validado).
- **Payload mínimo:** `{ event, occurredAt, idempotencyKey, resource: { type, id, url } }` — datos sensibles nunca en el payload; el satélite hace GET con su token.
- **Reintentos:** exponencial 1m/5m/30m/2h/6h; tras 5 fallos el webhook pasa a `SUSPENDED` y se refleja en Observer.
- **SSRF:** la URL registrada pasa la validación SSRF multi-nivel existente (PRs #112-#115); solo https, sin IPs privadas.

## 2. SSE para satélites

- El stream SSE existente acepta satellite token con scope `events:subscribe`, filtrado por los mismos scopes.
- Uso: mobile app (SAT-003) y graphify (trigger de re-ingesta, SAT-004).

## 3. Catálogo de eventos exportables v1

| Evento | Scope requerido | Consumidores previstos |
|---|---|---|
| `job.matched` | `jobs:read` | mobile |
| `job.completed` | `jobs:read` | mobile |
| `rating.requested` | `jobs:read` | mobile |
| `milestone.approved` / `milestone.rejected` | `milestones:read` | mobile |
| `evidence.approved` | `jobs:read` | mobile |
| `intake.completed` | `intake:read` | alexa (resumen post-sesión) |
| `docs.merged` (interno) | `knowledge:read` | graphify (re-ingesta) |

Todo evento nuevo exportable requiere fila en esta tabla vía PR al spec.

## 4. Tasks

1. Modelo `SatelliteWebhook` + endpoints CRUD (auth por satellite token).
2. Dispatcher en worker colgado del fan-out existente + firma HMAC + reintentos (patrón permanent-loops para la cola de reintentos).
3. Extensión del SSE guard para satellite tokens.
4. Recurso `events` en el SDK (registro de webhook + verificación de firma helper).

## 5. Acceptance Criteria (arnés SAT-000)

- [ ] Anillo 1: firma HMAC verificable; suscripción fuera de scope → 403; URL privada/HTTP → 400 (SSRF).
- [ ] Anillo 2: `sdk.events` con helper de verificación de firma testeado.
- [ ] Anillo 3: e2e — registrar webhook local, disparar `job.matched`, recibir POST firmado, verificar idempotencyKey en re-entrega.
- [ ] Anillo 4: webhook real desde Railway hacia un receptor externo; suspensión tras fallos verificada en Observer; evidencia en `docs/reportes/`.
- [ ] Kill switch `SATELLITE_WEBHOOKS_ENABLED` verificado (OFF ⇒ cola pausada, no perdida).
