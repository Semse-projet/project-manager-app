---
id: "satellites.protools-embed"
title: "SAT-006 — Pro Tools v2 HTML como herramientas embebibles conectadas"
type: spec
domain: "tools"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "low"
date: "2026-07-05"
author: "Claude — sesión planificación satélites"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - packages/tools
related_tests: []
related_endpoints:
  - v1/tools
related_events: []
related_agents: []
last_verified: ""
---

# Spec: Pro Tools v2 HTML embebible (satélite `~/labsemse/SEMSE Pro Tools v2`)

**Clase: LATENTE** — se especifica el conector; se activa solo con demanda real
(distribución offline/compartible de calculadoras).

## Problem Statement

Las herramientas HTML standalone de Pro Tools v2 (concreto, carpintería, electricidad,
plomería, etc.) fueron el antecesor de los 27 tools ya nivelados en el monorepo, pero
siguen siendo valiosas como artefactos **compartibles por archivo** (un contractor las
abre sin cuenta ni conexión al panel). Hoy calculan en el navegador y el resultado muere ahí.

## Scope

- In scope: snippet JS embebible (`semse-embed.js`, build browser del `@semse/sdk`), botón "Enviar a SEMSE" en cada HTML, endpoint de recepción de cotizaciones externas.
- Out of scope: paridad con los 27 tools del monorepo (los HTML no se mantienen a la par; son snapshot), UI nueva.

## 1. Diseño

```
tool HTML standalone ──semse-embed.js──► POST /v1/tools/external-quotes
                                            (token protools-embed, scope tools:invoke)
```

- `semse-embed.js`: bundle browser del SDK (solo `auth` + `tools`), < 30 KB, sin dependencias, servible como archivo junto al HTML (funciona desde `file://`).
- El HTML sigue calculando 100% offline; el botón "Enviar a SEMSE" es opcional y falla suave sin red.
- La cotización recibida entra como lead/quote con canal `protools-embed`, visible en admin (mismo destino que smart-intake, categoría según herramienta).

## 2. Consideración de seguridad (crítica en este spec)

El token viaja **dentro del HTML distribuido** ⇒ se asume público:

- Scope único `tools:invoke` sobre un único endpoint de escritura de quotes.
- Rate limit agresivo + captcha-less throttling por IP.
- El endpoint no devuelve ningún dato de otros usuarios; solo `{ received: true, quoteId }`.
- Rotación de token sin re-distribuir HTMLs: el embed resuelve el token vigente contra un endpoint público de descubrimiento (`GET /v1/tools/embed-config`).

## 3. Tasks

1. Endpoint `POST /v1/tools/external-quotes` + schema Zod + canal en admin.
2. Build `semse-embed.js` desde `packages/sdk` (target browser, IIFE).
3. Inyección del snippet en 3 herramientas piloto (concreto, electricidad, plomería).
4. Guía de distribución en el README del satélite.

## 4. Acceptance Criteria (arnés SAT-000)

- [ ] Anillo 1: contrato del endpoint; token con scope `tools:invoke` no puede leer nada (todos los GET → 403); rate limit testeado.
- [ ] Anillo 2: build embed testeado en navegador headless.
- [ ] Anillo 3: abrir HTML piloto desde `file://`, calcular, enviar, ver quote en admin local.
- [ ] Anillo 4: smoke contra Railway desde un HTML enviado por WhatsApp/email a un dispositivo real; evidencia en `docs/reportes/`.
- [ ] Kill switch `SATELLITE_PROTOOLS_ENABLED` verificado (OFF ⇒ botón desaparece vía embed-config).
