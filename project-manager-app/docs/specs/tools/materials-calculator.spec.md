---
id: "tools.materials-calculator"
title: "Materials Calculator — calculadora de materiales de obra"
type: spec
domain: "tools"
version: "1.0"
status: "VERIFIED"
owner: "semse-core"
risk: "low"
date: "2026-07-17"
author: "Devin"
branch: "devin/materiales-obra-skill"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - packages/tools/src/materials/materials-calculator.ts
  - packages/tools/src/index.ts
  - apps/api/src/modules/tools/tools.controller.ts
  - apps/api/src/modules/tools/tools.service.ts
  - apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts
  - apps/api/src/modules/prometeo/prometeo-tool-registry.ts
  - apps/api/skills/materiales-obra/SKILL.md
related_tests:
  - tests/unit/materials-calculator.test.mjs
related_endpoints:
  - v1/tools/materials
related_events: []
related_agents:
  - prometeo
last_verified: "2026-07-19"
---

# Spec: materials-calculator

Calculadora de materiales de construcción (`materiales-obra`) para Prometeo y API de herramientas. Codifica las fórmulas del skill `apps/api/skills/materiales-obra/SKILL.md` en un módulo puro y reusable.

---

## 1. Qué resuelve

**Para quién:** contratistas, clientes y agentes Prometeo que necesitan estimar materiales de obra.
**Problema:** no existe un endpoint/API centralizado ni un módulo reusable para calcular materiales de construcción con las fórmulas del skill.
**Solución:** un módulo puro `@semse/tools` con `calculateMaterials(input)`, expuesto a través del endpoint `POST /v1/tools/materials` y como herramienta Prometeo `materials.calculate`.

---

## 2. Actores y Permisos

| Actor   | Permiso SEMSE | Puede hacer                     |
|---------|---------------|----------------------------------|
| CLIENT  | `tools:run`   | Calcular materiales para su proyecto |
| PRO     | `tools:run`   | Calcular materiales para cotización  |
| OPS_ADMIN | `tools:run` | Ejecutar como admin               |
| Prometeo | `tools:run` | Invocar `materials.calculate`     |

---

## 3. Escenarios de Usuario (P1/P2/P3)

### P1 — Calcular pintura para una habitación

**Criterio de aceptación:**
```
DADO   una habitación de 12' × 14' × 9' con 1 puerta y 2 ventanas
CUANDO el usuario solicita 2 capas de pintura
ENTONCES se retornan galones necesarios con 10% de desperdicio
  Y    el cálculo respeta las fórmulas del skill: (perímetro × altura) - aberturas, cobertura 350-400 sqft/gal por capa
```

**Casos borde:**
- [x] Sin aberturas: usa valores por defecto (puerta 21 sqft, ventana 7 sqft cada una)
- [x] Número de capas inválido o ausente: default a 2
- [x] Dimensiones negativas o faltantes: error `400`

### P2 — Calcular concreto para una losa

**Criterio de aceptación:**
```
DADO   una losa de 10' × 20' × 4" de profundidad
CUANDO el usuario solicita cálculo de concreto
ENTONCES se retornan 2.7 yd³ (incluyendo 10% extra sobre volumen real)
```

### P3 — Integración con Prometeo

**Criterio de aceptación:**
```
DADO   un agente Prometeo con permiso `tools:run`
CUANDO invoca la herramienta `materials.calculate`
ENTONCES recibe el mismo resultado JSON que el endpoint `POST /v1/tools/materials`
  Y    un input inválido devuelve `__blockedReason` con el mensaje de error
```

---

## 4. FSM

No aplica. El cálculo es una operación pura idempotente: input → output. No persiste estado ni realiza transiciones.

---

## 5. Contratos de API

### `POST /v1/tools/materials`

```yaml
método: POST
ruta: /v1/tools/materials
descripción: Calcula materiales de construcción según categoría y dimensiones

auth: requerida
roles: CLIENT | PRO | OPS_ADMIN
permissions: [tools:run]
privacyCritical: false

input:
  schema: MaterialsInput  # discriminated union en @semse/tools
  campos:
    - nombre: category
      tipo: enum
      requerido: true
      validación: ["painting", "drywall", "flooring", "concrete", "lumber", "mulch"]
    - nombre: lengthFt
      tipo: number
      requerido: true
      validación: > 0
    - nombre: widthFt
      tipo: number
      requerido: true para todo excepto lumber (studs-only)
      validación: > 0
    - nombre: heightFt
      tipo: number
      requerido: true para painting, drywall
      validación: > 0
    - nombre: depthInches
      tipo: number
      requerido: true para concrete, mulch
      validación: > 0; para mulch debe ser 2, 3 o 4
    - nombre: installation
      tipo: enum
      requerido: false
      validación: ["straight", "diagonal", "irregular"], default "straight"
    - nombre: doors / windows
      tipo: number
      requerido: false
      validación: >= 0
    - nombre: coats
      tipo: number
      requerido: false
      validación: >= 1, default 2
    - nombre: corners / openings
      tipo: number
      requerido: false
      validación: >= 0

output:
  schema: MaterialsEstimate
  campos:
    - nombre: category
      tipo: enum
    - nombre: summary
      tipo: object (areaSqFt, wallAreaSqFt, floorAreaSqFt, volumeCuFt, etc.)
    - nombre: items
      tipo: array de MaterialQuantity
    - nombre: notes
      tipo: array de string

errores:
  400: Input inválido o categoría no soportada
  403: Permiso `tools:run` ausente
```

### `materials.calculate` (Prometeo tool)

```yaml
namespace: materials
name: calculate
descripción: Calcula cantidades de materiales de construcción
permissions: [tools:run]
endpoint:
  método: POST
  path: /v1/tools/materials
inputSchema:
  type: object
  required: [category, lengthFt, widthFt]
  properties:
    category: { enum: ["painting", "drywall", "flooring", "concrete", "lumber", "mulch"] }
    lengthFt: { type: number }
    widthFt: { type: number }
    heightFt: { type: number }
    depthInches: { type: number }
    installation: { enum: ["straight", "diagonal", "irregular"] }
    doors: { type: number }
    windows: { type: number }
    coats: { type: number }
    corners: { type: number }
    openings: { type: number }

outputKind: MaterialsEstimate
blockedReason: mensaje de validación cuando el input es inválido
```

---

## 6. Criterios de Éxito

| Métrica            | Valor objetivo |
|--------------------|----------------|
| Latencia P95       | < 50 ms        |
| Tasa de error      | 0 % (validación estricta) |
| Cobertura de tests | fórmulas de todas las 6 categorías |
| Escenarios P1 cubiertos | 100 % |

---

## 7. Tests Requeridos (antes/durante implementación)

- [x] `painting` — habitación con aberturas y 2 capas
- [x] `drywall` — hojas, compound, tape y screws con 15% desperdicio
- [x] `flooring` — instalación straight, diagonal e irregular
- [x] `concrete` — volumen y yd³ con 10% extra
- [x] `lumber` — studs y plywood subfloor
- [x] `mulch` — cobertura según profundidad 2"/3"/4" con 10% extra
- [x] Rechaza input sin `category` o categoría inválida
- [x] Rechaza dimensiones negativas/faltantes
- [x] Integración Prometeo: `materials.calculate` retorna resultado válido y `__blockedReason` para input inválido

---

## 8. Impacto en otros dominios

| Dominio      | Impacto | Acción requerida |
|--------------|---------|------------------|
| Prometeo     | sí      | Registrar tool `materials.calculate` |
| Tools API    | sí      | Nuevo endpoint `POST /v1/tools/materials` |
| @semse/tools | sí      | Nuevo módulo `packages/tools/src/materials/` |
| Escrow/Payments | no   | - |
| SSE/Real-time | no   | - |
| Prisma/DB    | no      | No se toca schema |

---

## 9. Supuestos y Dependencias

- Las fórmulas son las publicadas en `apps/api/skills/materiales-obra/SKILL.md`.
- El módulo es puro: sin acceso a DB, red ni estado externo.
- Prometeo invoca herramientas bajo el namespace `materials`.

---

## Checklist de aprobación

- [x] Escenarios P1 con criterio Given/When/Then
- [x] Endpoints con input/output/errores/efectos
- [x] No viola `DOMAIN_INVARIANTS.md`
- [x] Tests requeridos listados y cubiertos
- [x] Spec agregado a `docs/SPEC_INDEX.md`
- [x] Status `APPROVED`
