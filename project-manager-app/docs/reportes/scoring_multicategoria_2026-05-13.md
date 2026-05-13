# Smart Intake — Scoring Multi-Categoría
**Fecha:** 2026-05-13  
**Rama:** `dev`

---

## Problema resuelto

`calculateAccuracyScore()` usaba `PAINTING_WEIGHTS` para todas las categorías. Baño, cocina, limpieza, drywall, carpintería — todas evaluadas con criterios de pintura. Esto causaba:

- Score siempre bajo para categorías no-pintura (nunca desbloqueaban el estimate)
- `missingFields` siempre reportaba `area`, `painting_condition` etc. aunque fueran irrelevantes
- `estimateUnlocked` hardcodeado a `>= 36` para todas las categorías

---

## Arquitectura implementada

### `config/scoring-profiles.ts`

Cada categoría tiene un `CategoryScoringProfile` con:

| Campo | Descripción |
|-------|-------------|
| `weights[]` | Lista de `{ questionId, label, exact, notSure, critical, recommended }` |
| `rawDescriptionScore` | Puntos por descripción presente (≥ 10 chars) |
| `imagesScore` | Puntos por al menos 1 imagen |
| `estimateReadyThreshold` | Mínimo para desbloquear estimate |
| `riskTriggers[]` | Respuestas que activan risk flags |

### Motor de scoring genérico

Para todas las categorías excepto `interior_painting`:
```typescript
score = rawDescriptionScore              // 15 pts si descripción presente
      + imagesScore                       // 5 pts si hay fotos
      + sum(weights[i].exact|notSure)    // según respuestas dadas
```

`interior_painting` mantiene su motor detallado original (área desde scope, condición desde scope, coats, etc.).

### `getAccuracyDetail(intake)` — nuevo output enriquecido

```typescript
{
  score: number,
  estimateReady: boolean,        // usa threshold por categoría
  confidence: "low" | "medium" | "high",
  category: string,
  missingCriticalFields: string[],   // campos críticos sin responder
  missingRecommendedFields: string[], // campos opcionales útiles
  riskFlags: string[]            // señales de complejidad oculta
}
```

---

## Thresholds por categoría

| Categoría | Threshold | Razón |
|-----------|-----------|-------|
| `interior_painting` | 36 | Igual que antes — trade maduro |
| `exterior_painting` | 36 | Comparable complejidad |
| `drywall_repair` | 36 | Relativamente predecible |
| `general_carpentry` | 36 | Varía pero predecible |
| `cleaning` | **30** | Servicio simple, pocos unknowns |
| `bathroom_remodel` | **45** | Plomería oculta — más info requerida |
| `kitchen_remodel` | **45** | Mayor riesgo — layout + appliances |

---

## Risk Flags por categoría

| Categoría | Flag | Trigger |
|-----------|------|---------|
| exterior_painting | `possible_structural_damage` | surface = structural_damage |
| exterior_painting | `elevated_access_required` | access = scaffolding |
| drywall_repair | `structural_crack_risk` | condition = structural |
| drywall_repair | `moisture_damage_present` | condition = water_damage |
| bathroom_remodel | `plumbing_relocation` | plumbing = relocate |
| kitchen_remodel | `plumbing_relocation` | plumbing = relocate |
| kitchen_remodel | `premium_appliances` | appliances = premium_appliances |

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `config/scoring-profiles.ts` | **Nuevo** — perfiles por categoría |
| `smart-intake.logic.ts` | `calculateAccuracyScore()`, `getMissingFields()`, `getRecommendedFields()` dispatch por categoría; nueva función `getAccuracyDetail()` |
| `smart-intake.service.ts` | `estimateUnlocked` y `estimate()` usan threshold por categoría |
| `smart-intake.controller.ts` | Respuesta de `analyze` incluye `missingCriticalFields`, `missingRecommendedFields`, `riskFlags` |
| `test/smart-intake-scoring.test.ts` | **Nuevo** — 27 tests |

---

## Resultados

```
Unit tests:          292/292 ✅
Scoring tests:       27/27   ✅
Smoke multi-cat:     28/28   ✅
Smoke BuildOps:      12/12   ✅ (no afectado)
```

---

## Criterios de aceptación

- [x] `calculateAccuracyScore()` ya no usa pesos de pintura para todas las categorías
- [x] Cada categoría mínima tiene scoring profile propio
- [x] Fallback es `generic`, no `painting`
- [x] Thresholds son por categoría
- [x] Output incluye `missingCriticalFields`, `riskFlags`
- [x] Tests nuevos pasan
- [x] Tests existentes siguen pasando
- [x] Smoke multi-categoría en PASS
- [x] Sin hardcodes nuevos de una categoría sobre otra

---

## Próximo paso

**Intake → Estimate confiable → BuildOpsProject pipeline:**

Con scoring multi-categoría cerrado, el siguiente bloque monetizable es verificar que el flujo completo funcione:

1. Intake (categoría = bathroom_remodel, score ≥ 45)
2. Estimate generado con rangos correctos del `generateGenericEstimate()`
3. Job publicado con `category = "Remodelación de baño"`
4. Bridge intake → BuildOpsProject con `trade = "remodeling"`, `projectType = "bathroom-remodel"`
5. Plan approval
6. Rerun si hay cambios
7. Promote a legacy ops

El smoke `multi-category-intake-smoke.mjs` cubre los pasos 1-3. El pipeline completo requiere un smoke que lleve una sesión de baño hasta BuildOps.
