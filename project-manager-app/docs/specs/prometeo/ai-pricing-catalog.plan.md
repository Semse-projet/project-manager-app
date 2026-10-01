---
type: plan
feature: "C39 — Catálogo de precios de modelos de IA versionado"
domain: "prometeo"
spec: "docs/specs/prometeo/ai-pricing-catalog.spec.md"
version: "1.0"
status: "APPROVED"
branch: "feat/c39-ai-pricing-catalog"
date: "2026-10-01"
---

# Plan técnico: C39 — Catálogo de precios de modelos de IA versionado

> Prerrequisito: spec `APPROVED` (D1–D3 resueltas el 2026-10-01; el paso a `APPROVED` se hace tras confirmar el gate de provenance #734 en producción). Este plan separa implementación, merge, despliegue y activación.

## 1. Snapshot de verdad (2026-10-01)
- `origin/main`: `f59d1b00`. Producción verificada en `f59d1b0` (API `73e1c27d`, web `04b5473a`); 106 migraciones aplicadas.
- Flags: `AI_PRICING_CATALOG_MODE` no existe aún; `AI_MODEL_PRICING_JSON` no configurada en la API (confirmado por el dueño).
- Deuda previa: `estimatedCostUsd` siempre `null` en producción.

## 2. Estrategia
Aditivo y detrás de `AI_PRICING_CATALOG_MODE=off` (default). Primero el dominio puro y sus tests, luego la migración validada en Postgres local, luego la integración en el logger. Ninguna activación forma parte de este plan.

## 3. Constitution check
- [x] Spec aprobado antes de código (al pasar a APPROVED).
- [x] Excepción a `tenantId` autorizada por el dueño solo para `AiModelPrice` (D1).
- [x] Migración aditiva con rollback operativo no destructivo (modo `off`).
- [x] Sin precios hardcodeados; fuentes oficiales con provenance (D2).
- [x] Sin fallback silencioso a `AI_MODEL_PRICING_JSON` en `on` (D3).
- [x] Sin dinero, pagos ni flags sensibles.

## 4. Diseño
1. **Dominio puro** `ai-pricing-catalog.ts`: `resolvePrice(entries, key, at)` (intervalos `[from,to)`), `computeCost(price, usage)` por `pricingSchemaVersion` (v1 = input/output; unidad no soportada ⇒ `unknown`), validación de `metadataJson` por versión.
2. **Datos** (migración `<ts>_c39_ai_model_price_catalog`): `btree_gist`; tabla `AiModelPrice` con exclusión por (`provider`,`modelSlug`,`providerModelName`,`tstzrange`); triggers de inmutabilidad; columnas aditivas en `AiInteractionLog` (`priceId`,`costBasis`,`providerModelName`).
3. **Servicio** `AiPricingCatalogService`: alta/cierre en una transacción, `OPS_ADMIN`, `AuditLog`; lectura vigente.
4. **Integración** en `ai-interaction-logger`: `off` = comportamiento actual; `shadow` = calcula ambos y registra `ai_pricing_catalog_mismatch`; `on` = catálogo, sin fallback.
5. **Importador** de la variable legada solo en `off`/`shadow` con provenance explícita.
6. **Schemas** en `packages/schemas` (contrato de alta y de `metadataJson` v1).

## 5. Riesgos
- `btree_gist` no disponible en el Postgres de Railway ⇒ alternativa `pg_advisory_xact_lock` por clave (verificar en local y consultar a Railway antes del PR de código).
- Prisma no modela exclusiones: SQL manual en la migración + revisión de drift.
- Providers con slug fijo y modelo configurable ⇒ exigir `providerModelName` real en el logging.

## 6. Entrega
PR de código aislado, `off` por defecto. `shadow`/`on` son activaciones separadas con orden del dueño. Rollback: `AI_PRICING_CATALOG_MODE=off` (no se elimina el esquema).
