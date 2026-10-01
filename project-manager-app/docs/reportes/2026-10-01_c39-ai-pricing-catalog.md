# C39 — Catálogo de precios de modelos de IA versionado (2026-10-01)

Spec `prometeo.ai-pricing-catalog` (APPROVED por el dueño, D1–D3), plan y tareas en `docs/specs/prometeo/`. **Entrega con `AI_PRICING_CATALOG_MODE` = `off` (default). No se activó `shadow` ni `on`.**

## Qué se implementó
| Pieza | Dónde |
|---|---|
| Dominio puro: resolución por fecha `[from,to)`, `computeCost` por `pricingSchemaVersion`, validación de `metadataJson`, `parsePricingCatalogMode` | `apps/api/src/modules/ai-models/pricing/ai-pricing-catalog.ts` |
| Servicio global (alta/cierre transaccional con `pg_advisory_xact_lock`, `AuditLog`, solo `OPS_ADMIN`) | `…/pricing/ai-pricing-catalog.service.ts` |
| Endpoints `GET/POST /v1/admin/ai-pricing/prices` (`ops:dashboard:read/write` + rol `OPS_ADMIN`) | `…/pricing/ai-pricing-catalog.controller.ts`, `SEMSE_API_SURFACE_V1.md` |
| Contrato de alta (zod) | `packages/schemas/src/ai-pricing.schema.ts` |
| Migración aditiva `20261001100000_c39_ai_model_price_catalog` | tabla `AiModelPrice` + `priceId`/`costBasis` en `AiInteractionLog` |
| Integración en el logger con 3 modos | `ai-interaction-logger.service.ts` |
| Variable `AI_PRICING_CATALOG_MODE` | `infra/railway/RAILWAY_ENV_VARS.md` |

## Reglas verificadas
- **Desconocido ≠ $0:** sin entrada vigente (o sin modelo/uso/versión soportada) ⇒ `estimatedCostUsd` NULL y `costBasis="unknown"`. El cero solo existe con una entrada explícita del catálogo.
- **Global de plataforma:** `AiModelPrice` sin `tenantId` (excepción autorizada solo para esta tabla); la auditoría se registra en el tenant del `OPS_ADMIN` actor.
- **Inmutable y versionado** por (`provider`,`modelSlug`,`providerModelName`) + vigencia: la base lo impone (exclusión de intervalos, CHECKs, triggers que rechazan `DELETE` y cualquier `UPDATE` salvo cerrar la vigencia abierta).
- **Provenance (D2):** `sourceUrl` https, `sourcePublishedAt?`, `sourceCheckedAt`, `createdBy`, `createdAt`; sin tabla por defecto en código.
- **Sin fallback silencioso (D3):** con `on` el JSON legado y el costo reportado por el proveedor se ignoran; ante error o ausencia del catálogo ⇒ `unknown`. Con `off`/`shadow` la variable sigue siendo el puente.
- **Evolución del esquema:** `pricingSchemaVersion` + `metadataJson` validado por versión (v1 = input/output, metadata vacía); una unidad no soportada o una versión desconocida ⇒ `unknown`, sin reinterpretar histórico.

## Validación (evidencia)
- **PostgreSQL 16 real (local):** las 107 migraciones aplican en una base nueva; `prisma migrate diff` contra el esquema ⇒ **sin drift**. `btree_gist` disponible (no se necesitó la alternativa `pg_advisory_xact_lock` para la exclusión; el lock se usa además para serializar altas).
- **Exclusión de intervalos y restricciones, probadas por SQL:** solape con inicio distinto ⇒ `23P01`; vigencias adyacentes `[from,to)` ⇒ válidas; clave con otro `providerModelName` ⇒ válida; `UPDATE` de precio, reabrir y `DELETE` ⇒ rechazados; CHECK de precio negativo, moneda, `http://`, intervalo invertido ⇒ rechazados.
- **Integración contra Postgres real (`ai-pricing-catalog.db.test.ts`, con `C39_TEST_DATABASE_URL`):** 7 escenarios en verde, incluida **concurrencia: 8 altas simultáneas de la misma clave y mismo inicio ⇒ exactamente 1 gana y 7 reciben 409**, y la FK de `priceId`.
- **Tests unitarios:** dominio (10) y modos del logger (7: `off` intacto, flag inválido ⇒ `off`, `shadow` guarda el legado y registra discrepancia, `on` solo catálogo, `on` sin fallback aun con `AI_MODEL_PRICING_JSON` y costo del proveedor, errores ⇒ unknown).
- **Suite API:** 2707 tests, 0 fallos, 38 omitidos (los 37 previos + la prueba con base real, que se omite sin `C39_TEST_DATABASE_URL`). `pnpm typecheck` limpio; lint 0 errores; `spec:validate:strict` 0 errores; `verify:workspace` exit 0; tests unitarios de la raíz 0 fallos.

## Cambios respecto al spec (documentados en él)
- La identidad real del modelo del log es la columna **existente** `modelName` (no se añadió `providerModelName` a `AiInteractionLog`).
- La exclusión usa `tsrange` (las columnas son `timestamp(3)` sin zona, convención Prisma/UTC).
- **T-042 (importador de la variable legada) DIFERIDO:** el JSON no trae fuente oficial por entrada y D2 la exige; el puente de D3 se cumple por los modos.

## No hecho / límites
- No se activó nada: `AI_PRICING_CATALOG_MODE` queda `off`; no hay precios cargados (los carga un `OPS_ADMIN` con fuente oficial). En producción esto no cambia ningún comportamiento.
- No se probó en producción: la migración se aplicará en el próximo deploy tras el merge (verificar `107 migrations found`, y `btree_gist` — `CREATE EXTENSION IF NOT EXISTS` requiere permiso en el Postgres de Railway; si fallara el deploy de la migración, no se despliega código con ella a medias porque `pre-migrate` aborta).
- Rollback operativo: `AI_PRICING_CATALOG_MODE=off`. Retirar el esquema NO es un rollback (SQL en el encabezado de la migración, solo con autorización).
