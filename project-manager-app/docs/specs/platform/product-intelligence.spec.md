---
id: "platform.product-intelligence"
title: "Product Intelligence — telemetría de producto gobernada"
type: spec
domain: "platform"
version: "0.3"
status: "APPROVED"
owner: "semse-core"
risk: "high"
date: "2026-07-13"
author: "Claude — PI-00, basado en spec SDD v0.1 externa auditada 2026-07-11"
branch: "docs/product-intelligence-pi00"
spec_index: "docs/SPEC_INDEX.md"
privacyCritical: true
auditLog: true
sse: false
fsmTransicion: "N/A — telemetría, sin FSM de negocio"
paymentGovernance: false
related_files:
  - packages/schemas/src/product-events.schema.ts
  - packages/product-events
  - apps/api/src/modules/product-intelligence
  - apps/web/lib/product-intelligence.ts
  - apps/api/src/modules/operational-intelligence/operational-signals.service.ts
  - apps/api/src/modules/ops
  - packages/db/prisma/schema.prisma
related_tests:
  - packages/product-events/test/product-events.test.ts
  - apps/api/test/product-intelligence-ingest.test.ts
related_endpoints:
  - v1/product-intelligence
related_events: []
related_agents: []
last_verified: "2026-07-17"
---

# Spec: Product Intelligence — telemetría de producto gobernada

## Problem Statement

SEMSE no puede ver la brecha entre "el servicio responde" y "el usuario logró su
objetivo": bugs de recorrido (BFF sin Bearer #285, modelo Prisma ausente #286,
register que perdía contexto #296, tool en 404 #298) llegaron a producción con
todos los tests verdes. Falta una capa de telemetría de producto que observe el
recorrido real del usuario y lo convierta en señales operacionales gobernadas.

## Scope

- In scope:
  - SDK web `@semse/product-events` (batch, redacción en cliente, consentimiento).
  - Ingesta batch idempotente `POST /v1/product-intelligence/ingest`.
  - Modelos `ProductEvent`, `ProductSession`, `FrictionSignal`, `ConsentRecord`.
  - Engines Funnel / Friction / Anomaly que emiten `OperationalSignal`.
  - Dimensión `experienceHealth` en Observer; recomendaciones en Mission Control.
- Out of scope:
  - Cualquier intervención automática sobre la UI o los flujos (solo SUGGEST).
  - Tocar `apps/api/src/modules/analytics/` (analítica de negocio existente).
  - Telemetría de backend (eso es `operational-intelligence` y ya existe).
  - Session replay / grabación de pantalla.

## Non-Goals

- This spec does not: reemplazar DomainEvents ni el outbox de F1; introducir
  un proveedor externo (PostHog/Amplitude); permitir eventos con PII cruda.

## API Contract

### `POST /v1/product-intelligence/ingest`

```yaml
auth: optional            # anónimo permitido con consentimiento essential
roles: []                 # público; rate-limited por IP + sessionId
privacyCritical: true
input_schema:
  batchId: string (uuid, idempotency key)
  sentAt: ISO8601
  consentClass: essential | standard | restricted
  session:
    sessionId: string (uuid v4 generado en cliente)
    anonymousId: string (hash, nunca email)
    userId: string | null   # solo si logueado y consentClass >= standard
  events:                   # máx 50 por batch
    - name: string (namespace.action, ej. auth.register_view)
      ts: ISO8601
      route: string (path sin query params sensibles)
      props: Record<string, scalar>  # allowlist por evento; NUNCA fieldValue/prompt
output_schema:
  accepted: number
  duplicated: boolean      # batchId ya procesado → no-op idempotente
errors:
  400: batch inválido o evento fuera de allowlist
  403: kill switch PRODUCT_INTELLIGENCE_ENABLED=false
  413: batch > 50 eventos
  429: rate limit
effects:
  audit_log: no            # volumen; se audita configuración, no cada evento
  event: ninguno en domain-events (bus separado)
  sse: no
```

### `GET /v1/product-intelligence/funnel` · `GET /v1/product-intelligence/funnel/economic` (v0.2)

```yaml
auth: required
roles: [ops:dashboard:read]
privacyCritical: false        # solo agregados, nunca eventos individuales
input_schema:
  days: int (1-90 funnel · 1-180 economic)
output_schema:
  funnel: { windowDays, since, sessions, events: [{name, count}] }
  economic: { windowDays, since, stages: [{stage, count, conversionPct, medianHoursFromJob}] }
errors:
  403: kill switch PRODUCT_INTELLIGENCE_ENABLED=false
notes: el funnel económico se DERIVA de las tablas de dominio (Job/Bid/
  Contract/PaymentEscrow) — fuente de verdad del servidor; no duplica
  eventos de UI. Evidence no es etapa (cuelga de Project, no de Job).
```

## Data Model

| Modelo | Campos clave | Retención |
|--------|--------------|-----------|
| ProductEvent | id, tenantId, sessionId, name, route, props(json redactado), ts | 30 días identificable, luego agregada |
| ProductSession | sessionId, anonymousId, userId?, firstSeen, lastSeen, device | 30 días |
| FrictionSignal | id, kind(rage_click/nav_loop/form_abandon/error_repeat), route, evidencia agregada, severity | 90 días |
| ConsentRecord | anonymousId, consentClass, grantedAt, revokedAt? | permanente (obligación legal) |
| ProductIngestBatch | batchId (pk), acceptedCount, consentClass, receivedAt | 30 días — ledger de idempotencia (agregado en PI-03) |

## Privacy Rules (bloqueantes)

1. El SDK redacta en cliente: nunca `fieldValue`, nunca texto de prompts, nunca
   direcciones/emails/teléfonos en `props` (reutiliza el criterio de
   `public-sanitizer`).
2. `props` por evento se valida contra allowlist explícita en el schema Zod;
   propiedad desconocida → evento rechazado (400), no silenciado.
3. `consentClass=restricted` → solo eventos `essential` (errores, disponibilidad).
4. Retención aplicada por job programado, no por confianza.

## Kill Switches

| Variable | Efecto en off |
|----------|---------------|
| PRODUCT_INTELLIGENCE_ENABLED | ingest devuelve 403; SDK no-op |
| PI_INGEST_ENABLED | ingest 403, engines siguen leyendo histórico |
| PI_ENGINES_ENABLED | no se generan FrictionSignal/OperationalSignal (engines/run responde 403) |

Defaults en producción: **off** hasta cerrar PI-05.

## Integration Points (existentes, no se duplican)

- `OperationalSignalsService` — los engines emiten aquí.
- Observer (`modules/ops`) — consume señales para `experienceHealth`.
- Mission Control — superficie de aprobación de recomendaciones.
- RBAC — paneles PI solo admin.

## Acceptance Criteria

- [ ] Batch duplicado (mismo batchId) → `duplicated: true`, 0 filas nuevas.
- [ ] Evento con prop fuera de allowlist → 400 y contador de rechazos visible.
- [ ] Con `PRODUCT_INTELLIGENCE_ENABLED=false` el sistema es indistinguible de no tener PI.
- [ ] Ningún payload persistido contiene email/teléfono/dirección (test de privacidad con fixtures adversarias).
- [ ] Funnel auth (PI-05) visible en admin con datos reales de staging.
