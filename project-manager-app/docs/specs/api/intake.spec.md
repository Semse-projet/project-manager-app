---
id: api-smart-intake
title: "Smart Intake API"
type: spec
feature: "Smart Intake — Wizard Anónimo"
domain: "smart-intake"
version: "1.0"
status: "APPROVED"
owner: semse-core
risk: medium
date: "2026-05-20"
author: "Claude Sonnet — sesión SDD governance"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/smart-intake
  - apps/api/src/modules/intake-operations-bridge
  - apps/web/lib/smart-intake.ts
related_tests:
  - apps/api/test/smart-intake-category-detection.test.ts
  - apps/api/test/smart-intake-estimate.test.ts
  - apps/api/test/intake-operations-bridge.service.test.ts
related_endpoints:
  - v1/intake
related_events:
  - buildops.bridge.completed
related_agents:
  - intake-interpreter
last_verified: 2026-05-25
---

# Spec: Smart Intake

> Wizard conversacional público que captura requerimientos de obra sin login.
> El intake analiza la categoría, genera un estimado y puede publicar un job real.
> Basado en `apps/api/src/modules/smart-intake/` y `intake-operations-bridge/`.

---

## 1. Qué resuelve

Un cliente sin cuenta puede describir su proyecto de construcción paso a paso.
El sistema detecta la categoría (painting, drywall, bathroom…), hace preguntas
adaptativas, genera un estimado de costo/tiempo y — si el cliente acepta —
publica un job real en el marketplace.

**Para quién:** Visitante anónimo que necesita un servicio · CLIENT autenticado que quiere asistencia
**privacyCritical:** `false` — datos de obra no son PII sensible

---

## 2. Actores y Permisos

| Actor | Endpoint | Auth |
|-------|---------|------|
| Anónimo / visitante | analyze, get, images, estimate | `@Public()` — sin JWT |
| CLIENT autenticado | claim, publish | JWT requerido |
| OPS_ADMIN | cleanup-expired | `ops:dashboard:write` |

---

## 3. FSM — Intake

```
DRAFT ──► NEEDS_MORE_INFO ──► READY_FOR_ESTIMATE ──► ESTIMATE_GENERATED ──► PUBLISHED
  ▲              │
  └──────────────┘ (más preguntas)
```

| Estado | Significado |
|--------|-------------|
| `draft` | Recién creado, primer análisis |
| `needs_more_info` | Sistema requiere más respuestas |
| `ready_for_estimate` | Suficiente info para estimar |
| `estimate_generated` | Estimado calculado y listo |
| `published` | Job publicado en marketplace |

---

## 4. Categorías Soportadas

```typescript
type SmartIntakeCategory =
  | "interior_painting" | "exterior_painting"
  | "drywall_repair" | "bathroom_remodel"
  | "kitchen_remodel" | "cleaning" | "general_carpentry"
```

---

## 5. Escenarios P1

### P1-A — Anónimo describe su proyecto y obtiene estimado

```
DADO   visitante sin cuenta en la landing
CUANDO POST /v1/smart-intake/analyze { text: "Quiero pintar 3 habitaciones" }
ENTONCES sistema detecta categoría "interior_painting"
  Y     genera preguntas adaptativas por categoría
  Y     retorna { intakeId, status: "draft"|"needs_more_info", questions[] }
CUANDO POST /v1/smart-intake/:id/estimate (respuestas completas)
ENTONCES sistema genera estimado con { priceMin, priceMax, etaDays, confidence }
  Y     status pasa a "estimate_generated"
```

### P1-B — Cliente reclama intake y publica job

```
DADO   intake en "estimate_generated"
       Y CLIENT autenticado con JWT
CUANDO POST /v1/smart-intake/:id/claim
ENTONCES intake vinculado al userId del CLIENT
CUANDO POST /v1/smart-intake/:id/publish
ENTONCES job creado en el marketplace en estado POSTED
  Y     intake pasa a "published"
  Y     intake-operations-bridge ejecuta el flujo
```

---

## 6. Contratos de API

### `POST /v1/smart-intake/analyze` — `@Public()`

```yaml
input: { text: string — descripción libre del proyecto }
output:
  - intakeId: string
  - status: IntakeStatus
  - detectedCategory: SmartIntakeCategory
  - questions: IntakeQuestion[]
  - accuracyLevel: low | medium | good | high
errores: 400 si text vacío
efectos: auditLog: false (público)
```

### `GET /v1/smart-intake/:id` — `@Public()`

```yaml
input: intakeId en path
output: IntakeRecord completo con preguntas, respuestas, status
errores: 404 intake no existe o expirado
```

### `POST /v1/smart-intake/:id/images` — `@Public()`

```yaml
input: imágenes del proyecto para mejorar el análisis
output: intake actualizado con análisis de imágenes
```

### `POST /v1/smart-intake/:id/estimate` — `@Public()`

```yaml
input: respuestas finales al cuestionario
output:
  - priceMin: number
  - priceMax: number
  - etaDays: number
  - confidence: low | medium | high
  - breakdown: líneas de estimado por categoría
errores:
  400: respuestas insuficientes para calcular
  404: intake no existe
efectos:
  fsmTransicion: ready_for_estimate → estimate_generated
```

### `POST /v1/smart-intake/:id/claim` — JWT requerido

```yaml
input: ninguno (userId del JWT)
output: intake vinculado al usuario
errores:
  401: sin JWT
  404: intake no existe
  409: intake ya reclamado por otro usuario
```

### `POST /v1/smart-intake/:id/publish` — JWT requerido

```yaml
input: ninguno
output: { jobId, intakeId, status: "published" }
errores:
  401: sin JWT
  403: intake no pertenece al usuario autenticado
  409: intake ya publicado
  422: intake no está en estimate_generated
efectos:
  fsmTransicion: estimate_generated → published
  downstream: intake-operations-bridge crea job en marketplace
  evento: job.created en marketplace
```

### `POST /v1/smart-intake/cleanup-expired` — `ops:dashboard:write`

```yaml
input: ninguno
output: { deletedCount: number }
efectos: elimina intakes en DRAFT sin actividad > 24h
```

---

## 7. Tests Requeridos

```typescript
describe("POST /v1/smart-intake/analyze") {
  it("detecta 'interior_painting' para texto sobre pintura de habitaciones")
  it("retorna questions[] no vacío con preguntas adaptativas")
  it("funciona sin JWT (endpoint público)")
  it("rechaza con 400 si text está vacío")
}
describe("POST /v1/smart-intake/:id/publish") {
  it("publica job en marketplace cuando intake está en estimate_generated")
  it("rechaza con 422 si intake no está en estimate_generated")
  it("rechaza con 403 si intake pertenece a otro usuario")
  it("rechaza con 401 sin JWT")
}
```

---

## 8. Gaps identificados

| Gap | Severidad |
|-----|-----------|
| Intakes expirados no se limpian automáticamente — requiere llamada manual a cleanup-expired | 🟡 Media |
| No hay rate limiting en `/analyze` — endpoint público puede ser abusado | 🟡 Media |
| `claim` no valida que el intake esté en un estado reclamable | 🟢 Baja |
