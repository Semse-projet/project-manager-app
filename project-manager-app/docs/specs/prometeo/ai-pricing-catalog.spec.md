---
id: "prometeo.ai-pricing-catalog"
title: "Catálogo de precios de modelos de IA versionado (C39)"
domain: "prometeo"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: ["AI_PRICING_CATALOG_MODE"]
production_evidence: []
related_files:
  - apps/api/src/modules/ai-models/logging/ai-cost.ts
  - apps/api/src/modules/ai-models/logging/ai-interaction-logger.service.ts
  - packages/db/prisma/schema.prisma
related_tests:
  - apps/api/test/ai-cost-and-actor-log.test.ts
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-10-01"
---

# Spec: Catálogo de precios de modelos de IA versionado (C39)

> **Estado: DRAFT. No se escribe código ni migración hasta que el dueño la apruebe.** Decisión del dueño ya tomada: el costo debe salir de un catálogo versionado por proveedor/modelo/vigencia; un precio desconocido **nunca** se trata como $0.

## 1. Problema y resultado
**Hoy (verificado en `main`):** `estimateCostUsd` lee `AI_MODEL_PRICING_JSON` (variable de entorno, sin historial) y devuelve `undefined` si el modelo no está. `AiInteractionLog.estimatedCostUsd` (`Decimal(10,6)`, nullable) guarda el resultado. En producción la variable no está configurada, así que el costo es siempre `null`.

**Problemas:** (a) un cambio de precio reescribe el pasado: no se puede reconstruir el costo de una interacción antigua; (b) el slug es la única clave (sin proveedor); (c) no hay vigencia ni auditoría de quién fijó un precio; (d) nada distingue «gratis» (modelo local) de «desconocido».

**Resultado esperado:** cada interacción registra el costo calculado con el precio **vigente en su fecha**, y la fila guarda qué entrada de catálogo se usó; si no hay precio vigente, el costo queda `null` con `costBasis = "unknown"` (nunca 0).

## 2. Alcance
**Incluido:** tabla aditiva `AiModelPrice` (provider, modelSlug, inputPer1K, outputPer1K, currency, effectiveFrom, effectiveTo?, source, createdBy, createdAt); resolución «vigente en `t`»; columnas aditivas en `AiInteractionLog` (`priceId?`, `costBasis`); semilla opcional desde `AI_MODEL_PRICING_JSON` (compatibilidad); flag de modo.
**Fuera de alcance:** facturar o cobrar a clientes; presupuestos/cuotas; precios por tier de volumen o caché de prompts (extensión futura); UI de edición del catálogo (primera entrega: script/endpoint interno de solo ops).

## 3. Reglas de dominio
1. **Unknown ≠ $0.** Sin entrada vigente ⇒ `estimatedCostUsd = null`, `costBasis = "unknown"`. Modelo local sin costo por token ⇒ entrada explícita con precios `0` y `source = "local"` ⇒ `costBasis = "catalog"` (el cero es un hecho registrado, no una ausencia).
2. **Inmutabilidad:** las entradas no se editan; un cambio de precio cierra la anterior (`effectiveTo`) y abre una nueva. Sin solapes para (provider, modelSlug).
3. **Reproducibilidad:** `priceId` en el log permite recalcular el costo; el log histórico no cambia si el catálogo cambia después.
4. **Solo USD** en la primera entrega (`currency` = `USD` validado); otra moneda se rechaza.
5. Alta de precios: solo `OPS_ADMIN`, con auditoría (`AuditLog`); no hay evento nuevo de dominio.

## 4. Escenarios y criterios de aceptación
1. Precio vigente hoy ⇒ costo = tokens × precio, redondeo a 6 decimales, `costBasis = "catalog"`, `priceId` poblado.
2. Interacción fechada antes del cambio de precio ⇒ usa el precio anterior.
3. Modelo sin entrada ⇒ `null` + `unknown` (test explícito de que no es 0).
4. Entrada solapada ⇒ rechazada.
5. Con `AI_PRICING_CATALOG_MODE=off` (default) el comportamiento actual (`AI_MODEL_PRICING_JSON`) no cambia; `shadow` calcula ambos y registra discrepancias sin cambiar lo guardado; `on` usa el catálogo.

## 5. Datos y migración (aditiva, con rollback)
- `CREATE TABLE "AiModelPrice"` + índice único parcial/exclusión lógica por (provider, modelSlug, effectiveFrom).
- `ALTER TABLE "AiInteractionLog" ADD COLUMN "priceId" TEXT NULL, ADD COLUMN "costBasis" TEXT NULL`.
- Sin backfill (los logs históricos quedan con `NULL`). Rollback: `DROP COLUMN` ×2 y `DROP TABLE`; no toca filas existentes.
- Migración planificada y validada en Postgres local antes de PR (patrón de C11).

## 6. Seguridad y privacidad
Sin PII. Los precios no son secretos. Escritura restringida a `OPS_ADMIN`; lectura interna. `tenantId`: el catálogo es global de plataforma (documentado como excepción explícita, no por tenant).

## 7. Plan de entrega (cuando se apruebe)
1. Tests primero (resolución por fecha, unknown≠0, no solapes).
2. Migración + modelo Prisma + `packages/schemas`.
3. Servicio de catálogo + integración en `ai-interaction-logger` detrás de `AI_PRICING_CATALOG_MODE=off`.
4. `shadow` en producción solo con orden del dueño; `on` es activación aparte.

## 8. Decisiones abiertas (necesitan al dueño)
- **D1.** ¿Catálogo global de plataforma (propuesto) o por tenant?
- **D2.** ¿Quién carga los precios iniciales y de qué fuente (documentación pública de cada proveedor, con fecha)? No se incluye lista por defecto en código.
- **D3.** ¿Aceptas la semilla desde `AI_MODEL_PRICING_JSON` como compatibilidad, o se retira la variable al activar el catálogo?
