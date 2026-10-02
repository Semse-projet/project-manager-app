---
type: tasks
feature: "C39 — Catálogo de precios de modelos de IA versionado"
domain: "prometeo"
plan: "docs/specs/prometeo/ai-pricing-catalog.plan.md"
version: "1.0"
status: "IN_PROGRESS"
branch: "feat/c39-ai-pricing-catalog"
date: "2026-10-01"
---

# Tareas: C39 — Catálogo de precios de modelos de IA versionado

> Orden obligatorio. No iniciar código hasta que spec y plan estén `APPROVED` y exista la rama de implementación desde `main` limpio.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad
- [x] **T-001** Spec `APPROVED` (tras gate #734 confirmado en producción) y plan `APPROVED`; `pnpm spec:index`.
- [x] **T-002** Crear `feat/c39-ai-pricing-catalog` desde `origin/main` limpio; `pnpm spec:validate:strict` baseline.
- [x] **T-003** Verificar `btree_gist` en Postgres local y consultar disponibilidad en Railway (solo lectura / documentación).

## Fase 1 — Tests primero (rojos)
- [x] **T-010** Dominio: resolución por fecha con intervalos `[from,to)`; precio anterior para interacciones previas al cambio.
- [x] **T-011** `unknown ≠ 0`: sin entrada ⇒ `null` + `unknown`; modelo local con precio explícito 0 ⇒ `catalog`.
- [x] **T-012** Identidad real: cambio de `providerModelName` sin vigencia ⇒ `unknown`.
- [x] **T-013** `pricingSchemaVersion`/`metadataJson`: inválido o unidad no soportada ⇒ rechazo/`unknown`; v1 solo input/output.
- [x] **T-014** Sin fallback legacy con `on` aun con `AI_MODEL_PRICING_JSON` presente.
- [x] **T-015** [P] Provenance obligatoria (`sourceUrl`, `sourceCheckedAt`) y solo `OPS_ADMIN`.
- [x] **T-016** Confirmar que los tests fallan por el gap esperado.

## Fase 2 — Dominio y schemas
- [x] **T-020** `ai-pricing-catalog.ts` (resolver, cálculo por versión, validación).
- [x] **T-021** [P] Schemas en `packages/schemas` (alta + `metadataJson` v1).

## Fase 3 — Datos (migración aditiva)
- [x] **T-030** Modelo Prisma + migración SQL (`btree_gist`, exclusión, triggers de inmutabilidad, columnas aditivas en `AiInteractionLog`).
- [x] **T-031** Validar en Postgres 16 local: aplicar, exclusión de solapes, concurrencia de altas (una gana), inmutabilidad, sin drift, rollback operativo.
- [x] **T-032** `pnpm db:generate`; `tsc` limpio.

## Fase 4 — Servicio e integración
- [x] **T-040** `AiPricingCatalogService` (alta/cierre transaccional, `OPS_ADMIN`, `AuditLog`).
- [x] **T-041** Integración en `ai-interaction-logger` con `AI_PRICING_CATALOG_MODE=off|shadow|on` (default `off`).
- [~] **T-042** [P] Importador de la variable legada — DIFERIDO: la variable no trae fuente oficial por entrada (D2 la exige); el puente D3 ya se cumple por los modos (`on` sin fallback).
- [x] **T-043** Logs `ai_cost_unknown` y `ai_pricing_catalog_mismatch`.

## Fase 5 — Verificación y entrega
- [x] **T-050** Suite API completa, `tsc`, `spec:validate:strict`, regresión de `ai-cost-and-actor-log`.
- [x] **T-051** Checklist `semse-checklist.md` y reporte en `docs/reportes/`.
- [ ] **T-052** PR de código aislado; actualizar registry (C39 PARTIAL: código en main, `off`).
- [ ] **T-053** Activación (`shadow`, luego `on`) **solo** con orden del dueño; fuera de este plan.
