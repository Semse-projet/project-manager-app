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

> **Estado: DRAFT con D1–D3 RESUELTAS por el dueño (2026-10-01).** Pasa a `APPROVED` por orden del dueño tras confirmar el gate bloqueante de provenance (#734) en producción; hasta entonces no se escribe código ni migración. Decisión original: el costo sale de un catálogo versionado por proveedor/modelo/vigencia; un precio desconocido **nunca** se trata como $0.

## 1. Problema y resultado
**Hoy (verificado en `main`):** `estimateCostUsd` lee `AI_MODEL_PRICING_JSON` (variable de entorno, sin historial) y devuelve `undefined` si el modelo no está. `AiInteractionLog.estimatedCostUsd` (`Decimal(10,6)`, nullable) guarda el resultado. Evidencia: el dueño confirmó el 2026-10-01 (revisión de variables de la API tras el deploy `7c9df29`) que `AI_MODEL_PRICING_JSON` no está configurada en producción; por tanto las filas nuevas guardan `null` (no se ha verificado el contenido histórico de la tabla, solo el código y esa configuración).

**Problemas:** (a) un cambio de precio reescribe el pasado: no se puede reconstruir el costo de una interacción antigua; (b) el slug es la única clave (sin proveedor); (c) no hay vigencia ni auditoría de quién fijó un precio; (d) nada distingue «gratis» (modelo local) de «desconocido».

**Resultado esperado:** cada interacción registra el costo calculado con el precio **vigente en su fecha**, y la fila guarda qué entrada de catálogo se usó; si no hay precio vigente, el costo queda `null` con `costBasis = "unknown"` (nunca 0).

## 2. Alcance
**Incluido:** tabla aditiva `AiModelPrice` (provider, modelSlug, **providerModelName**, inputPer1K, outputPer1K, currency, effectiveFrom, effectiveTo?, **pricingSchemaVersion**, **metadataJson** validado, **sourceUrl**, **sourcePublishedAt?**, **sourceCheckedAt**, createdBy, createdAt); resolución «vigente en `t`»; columnas aditivas en `AiInteractionLog` (`priceId?`, `costBasis`); semilla opcional desde `AI_MODEL_PRICING_JSON` (compatibilidad); flag de modo.
**Fuera de alcance:** facturar o cobrar a clientes; presupuestos/cuotas; precios por tier de volumen o caché de prompts (extensión futura); UI de edición del catálogo (primera entrega: script/endpoint interno de solo ops).

## 3. Reglas de dominio
1. **Unknown ≠ $0.** Sin entrada vigente ⇒ `estimatedCostUsd = null`, `costBasis = "unknown"`. Modelo local sin costo por token ⇒ entrada explícita con precios `0` y `source = "local"` ⇒ `costBasis = "catalog"` (el cero es un hecho registrado, no una ausencia).
2. **Inmutabilidad:** las entradas no se editan; un cambio de precio cierra la anterior (`effectiveTo`) y abre una nueva.
   - **Intervalos semicerrados `[effectiveFrom, effectiveTo)`**, `effectiveTo` nulo = abierto. Para una misma clave tarifaria no puede haber dos intervalos que se intersequen (no basta la unicidad de `effectiveFrom`).
   - Se impone en la base con una **restricción de exclusión PostgreSQL** (`EXCLUDE USING gist (provider WITH =, modelSlug WITH =, providerModelName WITH =, tstzrange(effectiveFrom, effectiveTo, '[)') WITH &&)`, extensión `btree_gist`), de modo que dos altas concurrentes no puedan ambas insertar; cierre de la vigencia anterior y alta de la nueva ocurren en una sola transacción.
3. **Identidad real del modelo (no solo el alias).** La clave tarifaria es (`provider`, `modelSlug`, `providerModelName`), donde `providerModelName` es el nombre real que reporta el proveedor (los providers de Kimi/GLM devuelven siempre el mismo slug aunque su modelo es configurable por variable de entorno). Si cambia el modelo físico detrás de un slug, no hay vigencia para la nueva identidad ⇒ el costo queda `unknown` hasta que un `OPS_ADMIN` cargue la nueva entrada; el log guarda `providerModelName` junto a `priceId`.
4. **Reproducibilidad:** `priceId` en el log permite recalcular el costo; el log histórico no cambia si el catálogo cambia después.
5. **Solo USD** en la primera entrega (`currency` = `USD` validado); otra moneda se rechaza.
6. **Carga (D2, aprobada):** el alta inicial y cada nueva vigencia las realiza un `OPS_ADMIN` mediante una operación auditable (`AuditLog`). La **fuente debe ser la documentación/página oficial de precios del proveedor**; se guardan al menos `sourceUrl`, `sourcePublishedAt` (si la página lo indica), `sourceCheckedAt`, actor (`createdBy`) y `createdAt`. **Prohibido** hardcodear una tabla «de fábrica» en el código o inferir precios; sin precio verificable ⇒ `costBasis = "unknown"` y costo `null`. No hay evento nuevo de dominio.
7. **Evolución del esquema de precios sin romper el histórico.** Los precios modernos no son solo input/output: pueden incluir lectura/escritura de caché, batch, tokens de razonamiento u otras unidades. La v1 calcula con `inputPer1K`/`outputPer1K`; el resto se admite en `metadataJson`, **validado contra el esquema de su `pricingSchemaVersion`** (versión `1` = solo input/output, `metadataJson` vacío o `{}`; una versión superior define sus campos y su fórmula de costo). Una entrada **histórica es inmutable**: nunca se reinterpreta con una versión de esquema nueva; el cálculo de cada log usa la `pricingSchemaVersion` de la fila a la que apunta `priceId`. Una unidad no soportada por esa versión ⇒ costo `unknown`, no se ignora silenciosamente.
8. **Alcance del catálogo (D1, aprobada): global de plataforma.** Es lo que Semse paga a cada proveedor (infraestructura), no se duplica por cliente. Markup, presupuestos o precios cobrados al cliente pertenecen a otro dominio y **no** se modelan aquí.

## 4. Escenarios y criterios de aceptación
1. Precio vigente hoy ⇒ costo = tokens × precio, redondeo a 6 decimales, `costBasis = "catalog"`, `priceId` poblado.
2. Interacción fechada antes del cambio de precio ⇒ usa el precio anterior.
3. Modelo sin entrada ⇒ `null` + `unknown` (test explícito de que no es 0).
4. Entrada solapada (intervalos que se intersecan, incluido inicio distinto) ⇒ rechazada por la base; dos altas concurrentes del mismo rango ⇒ una sola gana (test de concurrencia contra Postgres real, patrón de C11).
5. Cambio del modelo físico detrás de un slug sin nueva vigencia ⇒ `unknown`, nunca la tarifa del modelo anterior.
6. Con `AI_PRICING_CATALOG_MODE=off` (default) el comportamiento actual (`AI_MODEL_PRICING_JSON`) no cambia; `shadow` calcula ambos y registra discrepancias sin cambiar lo guardado; `on` usa el catálogo.
7. **Sin fallback silencioso (D3):** con `on` y sin entrada vigente ⇒ `null` + `unknown` aunque `AI_MODEL_PRICING_JSON` contenga ese modelo (test explícito).
8. Entrada con `metadataJson` inválido para su `pricingSchemaVersion`, sin `sourceUrl`/`sourceCheckedAt`, o con unidades no soportadas ⇒ rechazada al cargar. `UPDATE`/`DELETE` de una entrada existente ⇒ rechazados (inmutabilidad).

## 5. Datos y migración (aditiva, con rollback)
- `CREATE EXTENSION IF NOT EXISTS btree_gist` (verificar disponibilidad en el Postgres de Railway antes del PR de código; si no estuviera, alternativa: serializar altas con `pg_advisory_xact_lock` por clave tarifaria + test de concurrencia).
- `CREATE TABLE "AiModelPrice"` con la restricción de exclusión de §3.2.
- `ALTER TABLE "AiInteractionLog" ADD COLUMN "priceId" TEXT NULL, ADD COLUMN "costBasis" TEXT NULL, ADD COLUMN "providerModelName" TEXT NULL`. Triggers (o equivalente) que rechazan `UPDATE`/`DELETE` sobre `AiModelPrice` salvo el cierre de `effectiveTo` de la vigencia abierta.
- Sin backfill (los logs históricos quedan con `NULL`).
- **Rollback operativo = `AI_PRICING_CATALOG_MODE=off`** conservando tabla y columnas: no destruye el historial que permite reconstruir costos (`priceId`). Retirar el esquema NO es un rollback: solo se haría con una migración posterior, con respaldo/exportación del historial y decisión explícita del dueño sobre la pérdida de procedencia.
- Migración planificada y validada en Postgres local antes de PR (patrón de C11).

## 6. Permisos, seguridad y privacidad

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| OPS_ADMIN | `ops:dashboard:write` (o permiso dedicado a definir en `packages/auth/src/rbac.ts`) | plataforma | alta/cierre de vigencias de precio | editar o borrar entradas existentes |
| Servicio de logging | interno | tenant del log | leer precio vigente, escribir `priceId`/`costBasis` | escribir precios |
| Resto de roles | ninguno | — | — | leer ni escribir el catálogo |

- **Sin PII.** Los precios no son secretos.
- **Tenant boundary — EXCEPCIÓN AUTORIZADA (D1, dueño, 2026-10-01).** `AiModelPrice` es un catálogo **global de plataforma, sin `tenantId`**. La constitución exige `tenantId` en los modelos de datos; el dueño autorizó explícitamente esta excepción **solo para `AiModelPrice`** (precio que la plataforma paga, infraestructura compartida). Escritura restringida a `OPS_ADMIN`; ningún dato de tenant se guarda en la tabla. `AiInteractionLog` sigue siendo por tenant.
- **Auditoría:** cada alta/cierre genera `AuditLog` (actor, antes/después). Sin eventos nuevos en `EVENT_CATALOG.md`.
- `privacyCritical`: no aplica (no se envía contenido de usuario).

## 6.1 Observabilidad
- Contador/log estructurado `ai_cost_unknown` (modelo, providerModelName) para detectar modelos sin tarifa vigente.
- En `shadow`: log `ai_pricing_catalog_mismatch` con costo legado vs catálogo (sin cambiar lo guardado).
- Alerta operativa si `ai_cost_unknown` > 0 tras activar `on`.

## 6.2 Gates de entrega (checklist `semse-checklist.md` al aprobar)
- Spec APPROVED (D1–D3 resueltas) → plan y tareas (`ai-pricing-catalog.plan.md`/`.tasks.md`) antes de código.
- Tests escritos primero; `pnpm spec:validate:strict` en verde.
- Migración probada en Postgres local (aplicar, rollback operativo, sin drift) y concurrencia de altas.
- `AI_PRICING_CATALOG_MODE` default `off`; `shadow`/`on` son activaciones separadas con orden del dueño.

## 7. Plan de entrega (cuando se apruebe)
1. Tests primero (resolución por fecha, unknown≠0, no solapes).
2. Migración + modelo Prisma + `packages/schemas`.
3. Servicio de catálogo + integración en `ai-interaction-logger` detrás de `AI_PRICING_CATALOG_MODE=off`.
4. `shadow` en producción solo con orden del dueño; `on` es activación aparte.

## 8. Decisiones del dueño
- **D1 — RESUELTA (aprobada):** catálogo global de plataforma; excepción a `tenantId` autorizada solo para `AiModelPrice`.
- **D2 — RESUELTA (aprobada):** carga por `OPS_ADMIN` con fuentes oficiales del proveedor, auditable, con `sourceUrl`/`sourcePublishedAt`/`sourceCheckedAt`/actor/`createdAt`; sin tabla por defecto en código; sin precio verificable ⇒ `unknown`.
- **D3 — RESUELTA (aprobada):** `AI_MODEL_PRICING_JSON` se conserva **solo como puente de migración**: puede sembrar/importar (con provenance explícita) en `off`/`shadow`. **Con `AI_PRICING_CATALOG_MODE=on` no hay fallback silencioso a la variable**: catálogo ausente ⇒ costo `unknown`, nunca precio legacy. La variable se retira en una limpieza posterior cuando el catálogo esté estable.
