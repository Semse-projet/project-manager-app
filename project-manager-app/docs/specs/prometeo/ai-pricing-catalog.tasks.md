---
type: tasks
feature: "C39 — Catálogo de precios de modelos de IA versionado"
domain: "prometeo"
plan: "docs/specs/prometeo/ai-pricing-catalog.plan.md"
version: "1.0"
status: "PENDING"
branch: "feat/c39-ai-pricing-catalog"
date: "2026-10-01"
---

# Tareas: C39 — Catálogo de precios de modelos de IA versionado

> Orden obligatorio. No iniciar código hasta que spec y plan estén `APPROVED` y exista la rama de implementación desde `main` limpio.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad
- [ ] **T-001** Spec `APPROVED` (tras gate #734 confirmado en producción) y plan `APPROVED`; `pnpm spec:index`.
- [ ] **T-002** Crear `feat/c39-ai-pricing-catalog` desde `origin/main` limpio; `pnpm spec:validate:strict` baseline.
- [ ] **T-003** Verificar `btree_gist` en Postgres local y consultar disponibilidad en Railway (solo lectura / documentación).

## Fase 1 — Tests primero (rojos)
- [ ] **T-010** Dominio: resolución por fecha con intervalos `[from,to)`; precio anterior para interacciones previas al cambio.
- [ ] **T-011** `unknown ≠ 0`: sin entrada ⇒ `null` + `unknown`; modelo local con precio explícito 0 ⇒ `catalog`.
- [ ] **T-012** Identidad real: cambio de `providerModelName` sin vigencia ⇒ `unknown`.
- [ ] **T-013** `pricingSchemaVersion`/`metadataJson`: inválido o unidad no soportada ⇒ rechazo/`unknown`; v1 solo input/output.
- [ ] **T-014** Sin fallback legacy con `on` aun con `AI_MODEL_PRICING_JSON` presente.
- [ ] **T-015** [P] Provenance obligatoria (`sourceUrl`, `sourceCheckedAt`) y solo `OPS_ADMIN`.
- [ ] **T-016** Confirmar que los tests fallan por el gap esperado.

## Fase 2 — Dominio y schemas
- [ ] **T-020** `ai-pricing-catalog.ts` (resolver, cálculo por versión, validación).
- [ ] **T-021** [P] Schemas en `packages/schemas` (alta + `metadataJson` v1).

## Fase 3 — Datos (migración aditiva)
- [ ] **T-030** Modelo Prisma + migración SQL (`btree_gist`, exclusión, triggers de inmutabilidad, columnas aditivas en `AiInteractionLog`).
- [ ] **T-031** Validar en Postgres 16 local: aplicar, exclusión de solapes, concurrencia de altas (una gana), inmutabilidad, sin drift, rollback operativo.
- [ ] **T-032** `pnpm db:generate`; `tsc` limpio.

## Fase 4 — Servicio e integración
- [ ] **T-040** `AiPricingCatalogService` (alta/cierre transaccional, `OPS_ADMIN`, `AuditLog`).
- [ ] **T-041** Integración en `ai-interaction-logger` con `AI_PRICING_CATALOG_MODE=off|shadow|on` (default `off`).
- [ ] **T-042** [P] Importador de la variable legada (solo `off`/`shadow`, con provenance).
- [ ] **T-043** Logs `ai_cost_unknown` y `ai_pricing_catalog_mismatch`.

## Fase 5 — Verificación y entrega
- [ ] **T-050** Suite API completa, `tsc`, `spec:validate:strict`, regresión de `ai-cost-and-actor-log`.
- [ ] **T-051** Checklist `semse-checklist.md` y reporte en `docs/reportes/`.
- [ ] **T-052** PR de código aislado; actualizar registry (C39 PARTIAL: código en main, `off`).
- [ ] **T-053** Activación (`shadow`, luego `on`) **solo** con orden del dueño; fuera de este plan.
