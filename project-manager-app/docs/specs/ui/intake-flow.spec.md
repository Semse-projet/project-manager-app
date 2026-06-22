---
id: ui-smart-intake-flow
title: "Smart Intake UI Flow"
type: spec
feature: "Smart Intake UI Flow — Wizard Anónimo"
domain: "ui"
version: "1.0"
status: "VERIFIED"
owner: semse-core
risk: medium
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
depends_on: "docs/specs/api/intake.spec.md"
related_files:
  - apps/web/components/project-intake
  - apps/web/lib/smart-intake.ts
  - apps/api/src/modules/smart-intake
related_tests:
  - apps/api/test/smart-intake-category-detection.test.ts
  - apps/api/test/smart-intake-estimate.test.ts
  - scripts/smart-intake-e2e-smoke.mjs
related_endpoints:
  - v1/intake
related_events:
  - buildops.bridge.completed
related_agents:
  - intake-interpreter
last_verified: 2026-06-09
---

# Spec: Smart Intake UI Flow

> Wizard público (sin login) para capturar requerimientos de obra.
> Es el punto de entrada principal de clientes nuevos a SEMSE.

---

## Flujo completo

**Páginas:** `/` (landing) → `/intake` → `/intake/:id` → `/intake/:id/estimate` → login/register → `/jobs/:id`

---

## Paso 1: Landing — Descripción libre

**URL:** `/` o `/intake/start`

| Estado | Descripción |
|--------|-------------|
| Textarea grande | "Describe tu proyecto..." (placeholder bilingüe) |
| Botón "Analizar" | Submit del primer análisis |
| Loading skeleton | Durante `POST /v1/smart-intake/analyze` |
| Error | Si API falla |

**Sin login requerido.**

---

## Paso 2: Cuestionario adaptativo

**URL:** `/intake/:intakeId`
**API:** `GET /v1/smart-intake/:id`

| Estado | Descripción |
|--------|-------------|
| Categoría detectada | Badge: "Pintura Interior", "Drywall", etc. |
| Preguntas por tipo | single_choice / multi_choice / number / text / image / area_selector |
| Progress bar | Porcentaje completado |
| Upload de imágenes | Para preguntas tipo "image" |
| Botón "Continuar" | Activo cuando pregunta requerida respondida |
| Botón "Volver" | Para corregir respuestas anteriores |

**Tipos de respuesta:**
- `single_choice` → radio buttons
- `multi_choice` → checkboxes
- `number` → input numérico con unidad
- `area_selector` → selector visual de área en m²
- `image` → upload con preview

---

## Paso 3: Estimado generado

**URL:** `/intake/:intakeId/estimate`
**API:** `POST /v1/smart-intake/:id/estimate`

| Estado | Descripción |
|--------|-------------|
| Rango de precio | "$1,200 — $1,800 USD" (priceMin - priceMax) |
| Tiempo estimado | "8-12 días" (etaDays) |
| Breakdown | Líneas por fase/material |
| Confidence badge | low / medium / high |
| CTA "Publicar y recibir ofertas" | Botón principal |
| CTA "Guardar para después" | Secundario |

---

## Paso 4: Login/Register para publicar

**URL:** redirect a `/login` o `/register` con `?intakeId=:id`

| Estado | Descripción |
|--------|-------------|
| Mensaje "Crea tu cuenta para publicar" | Contexto del intake |
| Form login/register | Email + password |
| OAuth Google | Botón alternativo |
| Tras auth → claim automático | `POST /v1/smart-intake/:id/claim` |

---

## Paso 5: Job publicado

**URL:** `/jobs/:jobId` (redirect automático)
**API:** `POST /v1/smart-intake/:id/publish`

| Estado | Descripción |
|--------|-------------|
| Confirmación | "Tu proyecto fue publicado" |
| Job detail | Título, scope, budget detectados |
| "Verás ofertas pronto" | Estado POSTED esperando bids |

---

## Estados de error

| Error | Pantalla |
|-------|---------|
| Intake expirado (>24h) | "Este enlace expiró — comienza de nuevo" + botón |
| Intake ya publicado | Redirect al job existente |
| Sin conexión | Toast de error con retry |

---

## Invariantes UX

- El wizard es 100% público — ningún paso requiere login hasta "Publicar"
- El `intakeId` se persiste en `localStorage` para recuperar el wizard si el usuario cierra y vuelve
- La categoría detectada se muestra siempre — el usuario puede corregirla
- El estimado se recalcula automáticamente si el usuario vuelve a cambiar respuestas
