# Programa integral de costos e inteligencia de mercado — 16 fases

**SEMSEproject · 2026-11-07 · `DRAFT / PLANIFICACIÓN` · PR base:** [#1075](https://github.com/Semse-projet/project-manager-app/pull/1075) · **Último HEAD revisado antes de redactar:** `28e219004e472e42c82a3722357aaeb6b792a8b8`.

> **Propósito:** representar el alcance COMPLETO: 24 motores, datos y licencias, salarios y costos reales, fiscalidad regional/nacional, agente interno recurrente, motor determinista, ecosistema de consumidores, seguridad, QA, canary y operación sostenida. Este programa agrupa y ordena trabajo existente; NO declara implementaciones, firmas o activaciones inexistentes, no sustituye la especificación ni autoriza cambios comerciales. Los números de fase identifican áreas de entrega; las tareas independientes pueden investigarse en paralelo respetando gates.

## Evidencia que sí existe y lo que no prueba

- **T-004, [#1076](https://github.com/Semse-projet/project-manager-app/pull/1076), fusionado:** los 24 motores ofrecen 72 escenarios reproducibles usando argumentos instrumentados; rederivar tasas/divisor a partir de números redondeados no es equivalente (solo 42/72 reconstrucciones exactas; 57/66 divisores distintos). **NO** demuestra precios correctos ni oráculos independientes ni contrato interno expuesto.
- **[#1075](https://github.com/Semse-projet/project-manager-app/pull/1075):** spec SDD 2.0 y anexos en `DRAFT`. Hay investigación de fuentes nacionales, políticas propuestas Q2–Q11, plantillas fiscales y legales, agente residente en diseño y 24 casos MW-01..24 **no ejecutados**.
- **[#1101](https://github.com/Semse-projet/project-manager-app/pull/1101):** PR independiente DRAFT para proteger snapshots/fallback T-008b. No demuestra corrección de la metodología PPI T-008 ni activa nuevos precios.
- **Ausente para certificar:** cotizaciones reales SKU/área con derechos de uso, licencias SaaS concedidas, costo real conciliado de suficientes obras, firma fiscal por jurisdicción/contrato, aprobación financiera de márgenes, cobertura nacional validada y pruebas de implementación/canary.

## Bloque A — Contratos y riesgo heredado

| Fase | Entregable y cuestión | Estado observable / puerta de salida |
| --- | --- | --- |
| **F01 · Verdad técnica y gobernanza** | Conciliar código de `main`, HEAD PR, ADR-027, 24 motores, fuentes de verdad, Q1/Q4/Q6/Q8, orden de PRs y alcance de permisos. | **Parcial documental**; revisión formal sobre HEAD y decisiones pendientes. Evidencia: matriz SHA, revisión humana y contratos SDD coherentes. |
| **F02 · Cálculo exacto y oráculos independientes** | Contrato `basis`, `effectiveRates`, `perUnitDivisor`, unidades, redondeo, `perUnit=null`, preservación JSON y privacidad; plan golden 24×normal/complejo/límite con expectativas independientes. | **Diagnóstico T-004 completado; contrato/golden pendiente**. Gate de spec: contrato y plan revisados. Gate posterior de implementación: 72/72 exactos sin instrumentación, 66/66 divisores reales y compatibilidad. |
| **F03 · Datos de entrada y unidades por oficio (Q9)** | Mapeo Intake→cantidades/operaciones, rangos `UNKNOWN`, especialistas pintura/drywall; `wastePercent` y `crewSize` multi-oficio ([#1085](https://github.com/Semse-projet/project-manager-app/issues/1085), [#1086](https://github.com/Semse-projet/project-manager-app/issues/1086)). | **Diseño parcial, validación e implementación pendientes**; pruebas de dimensionalidad y cuadrillas antes de activar flujos afectados. |
| **F04 · Saneamiento de precios heredados (PPI)** | Diagnosticar `PriceRefreshJob`, separación PPI índice vs. precio SKU, fecha base y serie comparables; T-008/T-008b/T-008c, fallo BLS no revalida snapshot; consumidor debe ver procedencia. | **Defecto y especificación identificados**; #1101 separado DRAFT. Gate: corrección y tests de integración sin fallback engañoso, auditoría de DB autorizada; no tocar producción por este plan. |

## Bloque B — Evidencia económica real y permisos

| Fase | Entregable y cuestión | Estado observable / puerta de salida |
| --- | --- | --- |
| **F05 · Licencias y procedencia (Q11)** | Registro fuente→titular→términos→finalidad→tenant→vigencia→revocación. Distinguir BLS público, datos RSMeans restringidos, cotización privada y contrato OEM/API. | **Matrices y candidatos investigados**, **sin licencia SEMSE concedida ni dictamen Legal**. No incorporar al SaaS catálogo ajeno sin derecho escrito. |
| **F06 · Materiales y precios observados** | Obtener SKU/medida/cantidad/unidad/condado/fecha, flete, impuestos de compra, descuento, alcance, vigencia y fuentes autorizadas; piloto pintura/drywall FL/GA, expansión por celda `oficio×área×partida`. | **Canales oficiales identificados**, cotizaciones reales/benchmark comercial **pendientes**. No convertir web abierta en precio comercial. |
| **F07 · Mano de obra y obligaciones laborales** | OEWS May-2025 SOC/metro/state y archivos con checksum/supresiones; ECEC como contexto, QCEW/Davis–Bacon solo según cobertura; horas, supervisión, seguros, beneficios, viáticos y costos W-2/1099 reconciliados. | **Crosswalk 24 oficios y metodología propuestos**; datos nacionales completos y costos facturables reales **pendientes**. Un salario no es tarifa comercial. |
| **F08 · Histórico económico y calibración (Q2)** | Auditoría autorizada de `ProjectIntake`, `Job`, `ProjectExpense`, `TimeEntry`, contratos, órdenes de cambio y facturas; calidad, muestras, error retrospectivo por oficio/área/complejidad. | **SQL/criterios preparados, no ejecutados en DB**. `escrow RELEASE` no es costo; `HIGH` no puede derivarse de respuestas completadas. Requiere revisión seguridad/datos y costos. |

## Bloque C — Política, datos versionados y agente propio

| Fase | Entregable y cuestión | Estado observable / puerta de salida |
| --- | --- | --- |
| **F09 · Fiscalidad profesional (Q10)** | Clasificar tipo de obra/contrato, propiedad, condado y situación fiscal; `contractorInputSalesUseTax` distinto de `customerSalesTax`; FL/GA primero, después 50 estados + DC **por celda validada**. | **Fuentes y matrices revisadas; 0/51 políticas fiscales firmadas**. Hasta CPA: `UNDETERMINED`, impuesto cliente `null`, sin 7% universal. |
| **F10 · Parámetros y decisiones comerciales (Q3/Q5/Q7)** | Bases, márgenes, overhead, comisión y límites con finanzas; borrador `STALE` y regeneración explícita; sombra con umbrales aprobados por categoría, Q1 doble autorización. | **Dirección de diseño elegida, valores/umbrales no validados**. Prohibidos los ajustes autónomos y las alteraciones de importes aceptados. |
| **F11 · Registro de evidencia y ETL auditables** | `SourceRegistry`, `QuoteEvidence`, `LicenseReview`, observaciones por SKU/SOC/fecha/geo, versionado, checksums, políticas de uso, vencimiento, revocación, snapshots/costTrace y control de acceso. | **Contratos lógicos documentados, sin migraciones ni ingestión nacional completa**. Requiere aprobaciones de esquema/seguridad/licencias y PR independiente. |
| **F12 · Agente residente dentro de SEMSE** | Worker/BullMQ, horarios ajustables, fuentes allowlist, rate limits, locks, backoff, DLQ, alertas, revisión humana, métricas de frescura y costos, kill switch OFF; **sin tareas ChatGPT como runtime**. | [Diseño del agente](./cost-engine.market-watch-agent-design-2026-11-07.md) y [MW-01..24](./cost-engine.market-watch-acceptance-matrix-2026-11-07.md) **documentados; agente NO implementado**. Primero observador de solo lectura, luego promoción limitada tras autorización. |

## Bloque D — Motor, consumidores, seguridad y entrega

| Fase | Entregable y cuestión | Estado observable / puerta de salida |
| --- | --- | --- |
| **F13 · Motor/API y replay histórico** | `CostEngineService` canónico, override por capas, compositor fiscal por componentes, JSON aditivo, concurrencia/409, `costReplay` inmutable, `priceBands`/hitos consistentes, contratos y escrow congelados. | **Diseño DRAFT; implementación no iniciada en #1075**. Requiere spec APPROVED, adaptadores por oficio y pruebas de precisión independientes. |
| **F14 · Experiencia y consumidores de SEMSE** | Smart Intake, ProTools, Prometeo, quote-engine, contractor-estimate, BuildOps, evidencia/contratos y panel operativo de fuentes; escenarios propia/subcontrata/mixta sin doble conteo y revisión de ofertas. | **H1–H5 documentados, no implementados**. Cada consumidor conserva permisos, procedencia, modo preliminar y autoridad económica única; UX ES/EN cuando aplique. |
| **F15 · Seguridad y aceptación integral** | Tenant/org + ownership, RBAC, privacidad, ataques de entradas externas, licencias y revocación, QA matemático independiente 24×3, VAT/tax profesional, pruebas DB, integración, E2E, replay, fuentes caídas y revisión humana del HEAD. | **Requisitos documentados, pruebas del agente/servicio no ejecutadas**. CI de un documento o T-004 nunca sustituye revisión, staging ni certificación comercial. |
| **F16 · Pilotos, despliegue y operación continua** | Canary con flags por `oficio×jurisdicción×fuente`, piloto pintura/drywall FL/GA, monitoreo de desviación y frescura, rollback, registros de aprobación, incidentes, actualización continua de índices/quotes autorizados y expansión progresiva hasta las jurisdicciones validadas. | **No activo**. Gate por celda con evidencia legal, fiscal, costos reales y seguridad; después CI/merge/deploy/procedencia/health/canary verificables por separado. |

## Dos rutas de cierre que NO deben confundirse

**Ruta D — aprobar la especificación #1075:** F01–F03 en sus contratos y plan de pruebas; F04–F10 con *criterios, política de datos, decisiones y responsables* resueltos en lo exigible por la spec, incluidos Q2/Q3/Q5/Q7/Q9/Q10/Q11, revisión independiente y concordancia ADR-027. El diseño puede definir un despliegue **restringido** por fuentes/áreas, sin fingir que existen datos de todo Estados Unidos. Las 51 políticas fiscales **no quedan aprobadas** por aprobar un documento; la implementación nacional requiere validación por jurisdicción.

**Ruta I — implementar/activar:** F04 de código (en PR independiente cuando corresponda) y F11–F16 requieren aprobación previa, migraciones autorizadas, pruebas reales y gates de su alcance. Un observador sin escrituras comerciales podría tener un piloto técnico antes que el uso de cotizaciones comerciales; aun así necesita privacidad, licencias y seguridad verificadas. Una activación por mercado NO autoriza otras 50 jurisdicciones.

## Orden práctico y trabajos paralelos

1. **Primera entrega verificable:** cerrar contrato y oráculos F02, resolver mapeo/unidades F03, congelar riesgos PPI F04, y elaborar evidencia/licencias/fiscalidad F05–F09 sin usar precios inventados. No esperar a un proveedor para redactar pruebas.
2. **En paralelo autorizado:** recopilar permisos de fuentes F05, SKU/quotes F06, OEWS/beneficios y costos reales F07–F08, consultas fiscales profesionales F09. No se declara `DONE` por identificar una URL o plantilla.
3. **Al aprobar contratos:** construir primero el **observador de solo lectura** F11–F12 con gates; después integrar el cálculo F13, los consumidores F14 y ejecutar F15 antes de F16.
4. **Pilotar de forma segura:** pintura interior/drywall FL/GA si y solo si *las celdas concretas* cumplen fuentes/uso, fiscalidad, calibración, seguridad, tests y firma. Ampliar a otras regiones/oficios de manera incremental, no por presunción nacional.
5. **Operación viva:** revisión periódica de releases/fuentes y alertas, pero **propuestas de actualización**, no modificación autónoma de precios/márgenes/impuestos/contratos/pagos.

**Dependencias de seguimiento:** [spec](./cost-engine.spec.md) · [plan](./cost-engine.plan.md) · [tareas](./cost-engine.tasks.md) · [checklist](./cost-engine.checklist.md) · [decisiones](./cost-engine.decisions.md) · [T-005 adquisición](./cost-engine.t005-vendor-quotes-rights-acquisition-2026-11-06.md) · [Q2](./cost-engine.q2-data-audit.md) · [Q10](./cost-engine.q10-fiscal-professional-review.md) · [Q11](./cost-engine.q11-license-clearance.md) · [agente](./cost-engine.market-watch-agent-design-2026-11-07.md).
