---
id: "satellites.mobile-app"
title: "SAT-003 — semse-mobile-app como cliente satélite del BFF/API"
type: spec
domain: "ui"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "high"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api
  - packages/auth
related_tests: []
related_endpoints:
  - v1/jobs
  - v1/milestones
related_events:
  - job.matched
  - rating.requested
related_agents: []
last_verified: ""
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

1. Extender guard SAT-001 para modo dual token-de-app + sesión-de-usuario.
2. Revisar que jobs/milestones/rate/tracker estén completos en `/v1` (audit rápido contra la tabla §2; crear specs puntuales para gaps).
3. Recurso `jobs`/`milestones`/`fieldOps` en el SDK.
4. Rate limit por app token independiente del rate limit por usuario.

## 5. Acceptance Criteria (arnés SAT-000)

- [ ] Anillo 1: token de app sin sesión de usuario → 401 en recursos de usuario; intersección de permisos testeada (worker no lee jobs de otro worker).
- [ ] Anillo 2: recursos `jobs`, `milestones`, `fieldOps`, `events` del SDK cubiertos.
- [ ] Anillo 3: e2e headless — login, listar jobs, start/stop tracker, recibir evento SSE.
- [ ] Anillo 4: smoke con la app real contra Railway; ciclo worker completo (ver job → track → rate) en dispositivo; evidencia en `docs/reportes/`.
- [ ] Kill switch `SATELLITE_MOBILE_ENABLED` verificado.
