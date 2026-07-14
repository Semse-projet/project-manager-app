---
id: "satellites.mobile-app"
title: "SAT-003 — semse-mobile-app como cliente satélite del BFF/API"
type: spec
domain: "ui"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/satellites/satellite-app.guard.ts
  - packages/sdk/src/resources/jobs.ts
  - packages/sdk/src/resources/milestones.ts
related_tests:
  - apps/api/test/satellite-app-guard.test.ts
  - tests/unit/sdk-client.test.ts
related_endpoints:
  - v1/jobs
  - v1/jobs/:jobId/milestones
related_events:
  - job.matched
  - rating.requested
related_agents: []
last_verified: "2026-07-07"
---

# Spec: semse-mobile-app como cliente satélite (satélite `~/labsemse/semse-mobile-app`)

## Problem Statement

Existe una app móvil (Vite + shadcn, con `canon/`, `infra/` y `docs/` propios) que no
habla con SEMSE. Los workers ya usan el web con bottom nav móvil, pero la app satélite
daría experiencia dedicada sin condicionar el deploy de Railway.

## Scope

- In scope: auth de usuario final desde la app vía API pública, consumo de jobs/milestones/ratings vía `@semse/sdk`, tiempo real vía SSE.
- Out of scope: publicación en stores, push notifications nativas, modo offline completo.

## Non-Goals

- No se mueve al monorepo (ya existe `apps/mobile` interno; este satélite es independiente y puede reemplazarlo o convivir — decisión al final de la fase, con datos).

## 1. Modelo de auth (diferencia clave con otros satélites)

La app actúa **en nombre de un usuario**, no como servicio:

- El satellite token `mobile` (scopes `jobs:read/write`, `milestones:read`, `events:subscribe`) identifica a la **app** (client credential).
- El usuario se autentica con el flujo SEMSE Signed Token existente; la app envía ambos: token de app + sesión de usuario.
- Autorización efectiva = intersección (scopes de la app ∩ permisos del usuario). Un token de app robado sin sesión de usuario no lee datos de nadie.

## 2. Superficie consumida (todo vía `@semse/sdk`)

| Pantalla | Recursos |
|---|---|
| Login / registro | auth |
| Mis trabajos (worker) | `jobs:read`, field-ops tracker (start/pause/stop) |
| Detalle de job + milestones | `jobs:read`, `milestones:read` |
| Rating (worker y client) | rate endpoints existentes |
| Feed en vivo | SSE `events:subscribe` |

Regla: si la pantalla necesita un endpoint que no existe en `/v1`, se agrega al
contrato congelado vía spec (no BFF privado del web — el BFF de `apps/web` no es
superficie satélite).

## 3. Lado satélite (documentado, fuera del repo)

- Instalar `@semse/sdk` como dependencia npm versionada.
- `.env`: `SEMSE_API_BASE_URL` + `SEMSE_APP_TOKEN` (nunca commiteado; patrón Service Variable de Railway si se hospeda).
- Reusar `canon/` y componentes shadcn existentes; el SDK reemplaza cualquier fetch manual.

## 4. Tasks lado SEMSE

1. ✅ Extender guard SAT-001 para modo dual token-de-app + sesión-de-usuario — `SatelliteAppGuard` (lee `x-semse-app-token`, corre junto a `AuthGuard`/`RbacGuard` sin reemplazarlos). **No está enganchado a ningún endpoint todavía** (ver §4.1).
2. ⏳ Audit jobs/milestones/rate/tracker en `/v1` — pendiente, ver §4.2.
3. Parcial: recursos `jobs` (list/get) y `milestones` (listByJob) en el SDK. **`fieldOps` y `events` (SSE) no implementados** — el catálogo de scopes de satélite (SAT-001) no incluye `field-ops:*` todavía; se agregará junto con el wiring real.
4. ⏳ Rate limit por app token independiente del rate limit por usuario — pendiente.

### 4.1 Por qué el guard no está enganchado a rutas todavía

`JobsController`/`MilestonesController` son compartidos con `apps/web` y `apps/worker` (vía BFF y llamadas internas). Agregar `@UseGuards(SatelliteAppGuard)` + `@SatelliteScopes(...)` directamente en esos controllers exigiría `x-semse-app-token` a **todos** los clientes existentes, rompiendo web/worker en producción. El guard se construyó y testeó como infraestructura reutilizable (anillo 1 completo); enganchar rutas reales requiere una decisión de producto: ¿nuevas rutas dedicadas `/v1/mobile/...`, o un mecanismo de bypass para llamadas internas del BFF? Se resuelve cuando se implemente el lado satélite real (app corriendo, no solo el SDK).

### 4.2 Audit rápido de la tabla §2 (2026-07-07)

| Pantalla | Estado en `/v1` |
|---|---|
| Jobs (list/detail) | ✅ `GET /v1/jobs`, `GET /v1/jobs/:jobId` |
| Milestones por job | ✅ `GET /v1/jobs/:jobId/milestones` |
| Field-ops tracker (start/pause/resume/stop) | ✅ existe en `/v1/field-ops/tracker/*`, pero usa permisos de usuario (`field-ops:read/write`), no scopes de satélite — falta decidir si se agrega `field-ops:*` al catálogo SAT-001 |
| Rating | No auditado en esta pasada |
| SSE / eventos en vivo | Existe infraestructura SSE interna; conexión de satélites es SAT-007 (Fase 3), no esta spec |

## 5. Acceptance Criteria (arnés SAT-000)

- [x] Anillo 1: `SatelliteAppGuard` — 401 sin app token, 401 app token vacío, 403 scope insuficiente con `missing`, 401 propagado del servicio (token revocado), intersección probada (scope de la app limita aunque falte modelar el lado RBAC del usuario en el mismo test). 6/6 tests.
- [x] Anillo 2 (parcial): SDK — `appToken` opcional en `SemseClientOptions` (header `x-semse-app-token`), recursos `jobs.list/get`, `milestones.listByJob`. **`fieldOps` y `events` pendientes.** 10/10 tests SDK, suite API completa 1737/1737 sin regresiones.
- [ ] Anillo 3: e2e headless — pendiente (requiere endpoints reales enganchados, ver §4.1).
- [ ] Anillo 4: smoke con la app real contra Railway — pendiente (requiere §4.1 resuelto + app desplegada).
- [ ] Kill switch `SATELLITE_MOBILE_ENABLED` — no creado todavía; no hay ninguna ruta que dependa de él aún.
