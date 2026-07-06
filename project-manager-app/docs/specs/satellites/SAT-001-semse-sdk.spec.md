---
id: "satellites.semse-sdk"
title: "SAT-001 — @semse/sdk + semse_py + satellite tokens"
type: spec
domain: "api"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/satellites
  - packages/sdk
  - packages/auth/src/rbac.ts
  - packages/db/prisma/migrations/20260705000000_satellite_tokens
related_tests:
  - apps/api/test/satellites-service.test.ts
  - apps/api/test/satellite-scope-guard.test.ts
  - tests/unit/sdk-client.test.ts
related_endpoints:
  - v1/satellites/tokens
  - v1/satellites/me
related_events: []
related_agents: []
last_verified: "2026-07-05"
---

# Spec: `@semse/sdk` + `semse_py` + satellite tokens

## Problem Statement

Los satélites no tienen una forma estable y segura de hablar con SEMSE: cada uno
tendría que reinventar auth, base URL, reintentos y tipos. Sin un enchufe universal,
cada integración crea deuda y acopla los satélites a detalles internos de la API.

## Scope

- In scope: SDK TypeScript publicable, SDK Python mínimo, emisión/revocación de satellite tokens con scopes, congelamiento del contrato `/v1` para consumo externo.
- Out of scope: las integraciones concretas (SAT-002+), UI de administración más allá de lo mínimo en `/admin`.

## Non-Goals

- No es un cliente para terceros públicos (eso sería una fase comercial posterior).
- No reemplaza la web-session del BFF para `apps/web`.

## 1. `@semse/sdk` (TypeScript)

- **Semilla:** `~/labsemse/semse/node` (migrar al monorepo como `packages/sdk`; el satélite lo consume como paquete npm publicado o tarball versionado — nunca por path relativo).
- **Superficie v1 (mínima, orientada a los satélites vivos):**
  - `auth`: construcción/renovación de requests firmados con satellite token (modelo SEMSE Signed Token, Opción A documentada 2026-05-18).
  - `intake`: crear/continuar smart-intake (para Alexa).
  - `jobs`: listar/leer jobs, bids, milestones (para mobile).
  - `tools`: invocar los 27 endpoints de Pro Tools (para embeds).
  - `events`: suscripción SSE autenticada + registro de webhooks (SAT-007).
- **Diseño:** wrapper fino sobre `/v1` con tipos generados desde `packages/schemas` (Zod → tipos exportados). Cero lógica de negocio en el SDK.
- **Resiliencia:** timeout configurable, reintentos exponenciales solo en GET idempotentes, errores tipados (`SemseAuthError`, `SemseScopeError`, `SemseNetworkError`).

## 2. `semse_py` (Python)

- **Semilla:** `~/labsemse/semse/python` (`semse_py`).
- Espejo mínimo: auth + `intake` + `events` (lo que necesitan graphify y experimentos vision). Se amplía solo por demanda de un spec SAT.

## 3. Satellite tokens

### `POST /v1/satellites/tokens` (admin)
```yaml
auth: required
roles: [admin]
privacyCritical: true
input_schema: { name: string, scopes: string[], expiresAt?: ISO8601 }
output_schema: { id, name, token (solo una vez), scopes, createdAt, expiresAt }
```

### `DELETE /v1/satellites/tokens/:id` (admin) — revocación inmediata.
### `GET /v1/satellites/tokens` (admin) — listado sin secreto, con lastUsedAt.

**Scopes iniciales:**

| Satélite | Scopes |
|---|---|
| alexa | `intake:write`, `intake:read` |
| mobile | `jobs:read`, `jobs:write`, `milestones:read`, `events:subscribe` |
| graphify | `knowledge:read`, `events:subscribe` |
| storage | `uploads:driver` |
| protools-embed | `tools:invoke` |

**Reglas:** hash del token en DB (nunca en claro, mismo estándar que verifyPassword sin fallback), comparación `timingSafeEqual`, rate limit por token, `lastUsedAt` para heartbeat de Observer (SAT-008).

## 4. Contrato `/v1` congelado

- Los endpoints listados en la superficie del SDK quedan bajo política de no-breaking-change (aplicando el principio rector del audit de endpoints 2026-05-17).
- Cambio breaking ⇒ `/v2` del recurso + deprecación anunciada en `SATELLITES.md`.

## 5. Tasks (orden de implementación)

1. Modelo `SatelliteToken` (Prisma) + migración + servicio de emisión/verificación en `packages/auth`.
2. Guard `SatelliteScopeGuard` en la API + decorador `@SatelliteScopes(...)`.
3. Endpoints admin de tokens + panel mínimo en `/admin` (hub existente).
4. `packages/sdk` con auth + errores tipados + primer recurso (`intake`).
5. `semse_py` auth + `intake`.
6. `SATELLITES.md` inicial + entrada en SPEC_INDEX.

## 6. Acceptance Criteria (arnés SAT-000)

- [ ] Anillo 1: contrato + caso negativo de scope + revocación → 401.
- [ ] Anillo 2: SDK TS y Py testeados contra mocks del contrato.
- [ ] Anillo 3: e2e local — emitir token, llamar `intake` vía SDK, revocar, verificar 401.
- [ ] Anillo 4: smoke en Railway con token real; evidencia en `docs/reportes/`.
- [ ] Kill switch: `SATELLITE_TOKENS_ENABLED` (OFF ⇒ todo token satélite recibe 503 explícito).
