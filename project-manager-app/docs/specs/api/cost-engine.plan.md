---
type: plan
feature: "Motor de costos unificado"
domain: "pricing"
spec: "docs/specs/api/cost-engine.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/cost-engine"
date: "2026-10-30"
---

# Plan técnico: Motor de costos unificado

> Prerrequisito: spec `APPROVED`. Hoy está en `DRAFT` v0.2 con preguntas abiertas (spec §11): este plan **no
> autoriza código**. Implementa el **ADR-027** (Accepted): `pricing/*` como autoridad determinista. Separa implementación, merge, despliegue y activación.

## 0. Programa integral y dependencias (16 fases)

El [programa completo F01–F16](./cost-engine.programa-integral-16-fases-2026-11-07.md) consolida **cuatro bloques**: (A) contratos/riesgos heredados, (B) materiales/licitación de fuentes, trabajo real y calibración Q2, (C) fiscalidad Q10, decisiones Q3/Q5/Q7, ingesta y agente residente, y (D) motor único, consumidores, seguridad, pruebas y despliegue gradual. Este plan técnico conserva su secuencia original de implementación 0–6; **las 16 fases son el mapa de programa completo**, no una declaración de fases ya implementadas o autorización para código/producción. Se exige evidencia por mercado/oficio/fuente, no supuesta cobertura nacional.

## 1. Snapshot de verdad

- `origin/main` SHA: registrar al iniciar cada fase.
- SHA desplegado API / Web: registrar al iniciar; no verificado al redactar.
- Estado de migraciones: la última en el repo era `20261020120000_geofence_policy` al redactar; no hay migración de esta feature.
- Flags: `COST_ENGINE_SHADOW` y `COST_ENGINE_SMART_INTAKE` no existen; alinear con el mecanismo de flags de la API (T-002).
- Deuda previa conocida: dos sistemas de costos paralelos; márgenes fijos en `cost-engine.ts`; `LocationCostIndex` sin ruta de escritura manual; el estado real de `LocationCostIndex` en producción no está verificado.

## 2. Constitution check

- [ ] Spec aprobado antes de código
- [x] Tenant/org/ownership y RBAC definidos por capa (spec §3); roles de organización por confirmar (Q4)
- [x] Payment Governance revisado: `platformFeeRate` y `taxRate` reservados a plataforma, con aprobación (Q1)
- [x] Audit definido (`AuditLog`); sin eventos de dominio nuevos
- [ ] Tests preceden implementación
- [x] No se expone secreto ni se crea backend paralelo: se envuelve `packages/tools` y `pricing/`
- [ ] Código, CI, merge, deploy y activación se medirán por separado

## 3. Arquitectura y autoridad

- Fuente de verdad de la fórmula: motores de `packages/tools`. Fuente de los parámetros: `PARAMETER_REGISTRY`
  (defaults) + `CostParameter` (excepciones por capa).
- Estrategia clave: **recalcular `buildCostSummary` fuera de los motores**, partiendo de lo que cada motor **expone**
  (`costs.basis`, `effectiveRates`, `perUnitDivisor`) y no de una derivación por división (varios tienen márgenes propios y
  dependientes de la entrada: HVAC 17/22, baño 15/22, limpieza 10/18…), y sobrescribiendo solo lo que una capa define.
  **T-004 (PR #1076)** mostró que la derivación solo acierta en 42/72 escenarios; añadir esos campos es un cambio aditivo
  en los 24 motores (T-004b, posterior a `APPROVED`).
- Impuestos: `TaxPolicy` versionada reemplaza el 7 % universal; sin política vigente el estimado dice "impuestos no determinados".
- `quote-engine` y `contractor-estimate` pasan por el servicio (ADR-027); `ContractorRateOverride` es la capa contratista.
- Servicio único `CostEngineService`; los consumidores no importan motores directamente.
- Región: se reutiliza `LocationCostService` y la resolución de región de la spec regional.
- Smart Intake: adaptador respuesta → entradas del motor; el rango sale de ejecutar el motor con escenarios bajo y alto.
- Contratos Zod en `packages/schemas`; BFF según `semse-bff-pattern`.
- ADR requerido: sí, para la decisión "recalcular márgenes fuera del motor" y la jerarquía de capas.

## 4. Datos y migración

- Solo la fase 3 toca el esquema: tabla `CostParameter` (spec §7), aditiva y sin FK.
- `costTrace` vive en `generatedEstimateJson` (JSON existente), sin migración.
- Compatibilidad durante deploy: sin filas, todo se comporta como el registro en código.
- Rollback o forward-fix: apagar flags; borrar filas; `DROP TABLE` en migración nueva solo como último recurso.
- Prueba de migración: base local limpia y copia con el esquema actual. Se crea con `prisma migrate dev` y
  **con aprobación explícita del owner** (AGENTS.md).

## 5. Seguridad y política

- Permisos por capa, en `rbac.ts`; plataforma/región solo `OPS_ADMIN`.
- Aislamiento: contratista solo su fila; organización solo su `orgId`; sin filtrar existencia entre tenants.
- Riesgos de pagos: cambios de fee o impuesto afectan cotizaciones y escrow; aprobación reforzada y sin efecto
  retroactivo sobre contratos existentes.
- Abuse cases: un parámetro hostil que mueva todos los precios (límites, motivo y auditoría); lectura de márgenes
  de un contratista por un cliente (modos y traza); consultas en vivo a BLS desde rutas públicas (prohibidas).

## 6. Eventos, idempotencia y reconstrucción

- Sin eventos de dominio nuevos. PUT por `scope+scopeId+key` idempotente con versión (409 en conflicto).
- Reproducibilidad por `costTrace`.

## 7. Estrategia de implementación

### Fase 0 — Verdad y red de seguridad (sin código de producto)

- Inventario de consumidores de los motores y de estimados guardados.
- **Tests de contrato de los 24 motores** (golden): componentes base, resultado actual, reconstrucción con `buildCostSummary` y márgenes propios, unidades, redondeos y escenarios límite.
- Validación externa de datos (plan §9) y revisión fiscal (Q10).

### Fase 0b — Correcciones P0 que ya afectan a producción

- Metodología PPI: precio de referencia con fecha e índice de esa fecha (hoy `basePrice × índice/100`).
- Impuesto: dejar de presentar el 7 % como universal; `TaxPolicy` versionada y estado "impuestos no determinados".
- Cada una con su propia spec/PR si el alcance lo pide; no esperan al servicio completo.

### Fase 1 — Servicio y registro (sin migración, sin efecto visible)

- `CostEngineService`, `PARAMETER_REGISTRY`, resolvedor por capas con solo `platform` y `engine_default`, `costTrace`.

### Fase 2 — Smart Intake en modo sombra (sin migración)

- Adaptador por categoría con motor equivalente; rango por escenarios.
- `COST_ENGINE_SHADOW`: se sirve la fórmula plana y se registra la diferencia.
- Revisar la comparación con producto antes de activar.

### Fase 3 — Parámetros por capa (migración, API admin)

- `CostParameter`, permisos, endpoints, auditoría, límites, versión y reversión.
- Capas región, organización y contratista.

### Fase 4 — Pantallas

- Admin, organización, contratista y tarjeta de estimado con región y fuente.

### Fase 5 — Activación y migración de consumidores

- Activar `COST_ENGINE_SMART_INTAKE` por categoría; después ProTools, Prometeo, cotizaciones y órdenes de cambio, cada uno con su verificación.
- Retirar la fórmula plana solo con evidencia suficiente.

### Verificación (cada fase)

- Tests dirigidos y regresión `smart-intake-*`/`intake-*`/ProTools; build, typecheck y lint.
- `pnpm spec:validate:strict`, `pnpm spec:coverage`, `pnpm spec:index`.
- PR, CI terminal, merge con SHA, despliegue terminal, smoke en Chrome y registro de evidencia.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| El recalculo externo no reproduce algún motor | Media | Alto | Tests de contrato por motor antes de seguir (Fase 0) | Cualquier diferencia vs. golden |
| Datos de precios/tarifas desactualizados | Alta | Alto | Validación externa; mostrar fuente y fecha; modo sombra | Desviación frente a cotizaciones reales |
| Parámetros mal configurados mueven precios | Media | Alto | Límites, motivo, auditoría, reversión y aprobación para fee/tax | Cambio brusco del estimado medio |
| Mapeo respuesta → cantidades incorrecto | Alta | Alto | Revisión de oficio (Q9), sombra y activación por categoría | Ratio motor/plana fuera de lo aprobado |
| Latencia del servicio en rutas públicas | Media | Medio | Lectura sin red, caché y fallback a la fórmula plana | Regresión de p95 |
| Márgenes del contratista expuestos al cliente | Baja | Alto | Serializador por modo en el servidor y pruebas negativas sobre el JSON | Cualquier hallazgo |
| Impuesto mal aplicado (7 % universal o política errónea) | Alta | Alto | `TaxPolicy` versionada con revisión fiscal profesional; "impuestos no determinados" si no hay política | Reclamo fiscal o cobro incorrecto |
| Conversión PPI errónea sigue activa | Alta | Alto | Fase 0b; marcar precios como no confiables hasta corregir | Desviación frente a precios observados |
| Dos fórmulas de total (`quote-engine` vs. `buildCostSummary`) | Alta | Alto | Unificar en el servicio y prueba de igualdad | Totales distintos para el mismo caso |
| Un cambio de parámetro altera importes aceptados | Baja | Alto | Inmutabilidad, vigencia y trazas | Cualquier importe aceptado que cambie |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| Vigencia y metodología de BLS OEWS por estado y oficio | BLS (a consultar) | Pendiente |
| Índices de costo de construcción por estado | RSMeans o equivalente (a consultar) | Pendiente |
| Márgenes típicos de overhead y ganancia por oficio | Fuentes del sector (a consultar) | Pendiente |
| Tratamiento fiscal de servicios de construcción por jurisdicción y tipo de contrato | Autoridades tributarias + profesional fiscal | Pendiente (Q10) |
| Metodología PPI y conversión índice → precio con fecha base | BLS PPI | Pendiente de verificar y aplicar (Fase 0b) |
| Clasificación de estimados y calibración de confianza | AACE International | Pendiente (Q2) |
| Separación de funciones y doble autorización | NIST AC-5 / AC-3(2), OWASP | Adoptado como criterio de diseño (spec §3) |
| Rendimientos y precios base de los motores por oficio | Cotizaciones reales, revisión de expertos de oficio | Pendiente |

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (spec §10)
- [x] Migración y rollback definidos
- [ ] Tests ordenados antes del código (la Fase 0 son tests)
- [ ] Canary y flags definidos (mecanismo por verificar en T-002)
- [ ] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en PR reversibles (una PR por fase)

## 11. H1–H5 — extensión documental y límites

El [anexo híbrido H1–H5](./cost-engine.hybrid-market-execution-design-2026-11-06.md) registra opciones futuras de inteligencia de mercado y ejecución mixta. **No forma parte de las fases de implementación aprobadas**; cada conector, fuente de datos, modalidad de ejecución y aprendizaje requerirá contrato, pruebas y autorización aparte. El [checklist de alcance actual](./cost-engine.checklist.md#límite-de-alcance-de-1075-ahora--fase-documental-draft-6-nov-2026) es el gate de esta fase. Ninguna acción productiva se autoriza al actualizar los documentos.

## 12. Etapa M — Vigilancia periódica de mercado dentro de SEMSE (diseño)

**Origen:** [anexo de agente residente](./cost-engine.market-watch-agent-design-2026-11-07.md) y [matriz MW-01..MW-24](./cost-engine.market-watch-acceptance-matrix-2026-11-07.md). La ejecución futura vive en `apps/worker` con BullMQ, un flag apagado por defecto, aprobaciones humanas y observaciones versionadas; `pricing/*` conserva la única autoridad económica según ADR-027. La etapa inicial no cambia `PriceRefreshJob`, snapshots, tarifas, pagos ni producción. Antes de escribir código, aprobar contrato, roles/aislamiento, seguridad de egress, derechos de fuente, pruebas y PR separado; respetar #1101 y las decisiones T-008/Q10/Q11.
