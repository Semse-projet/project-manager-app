---
type: tasks
feature: "Motor de costos unificado"
domain: "pricing"
plan: "docs/specs/api/cost-engine.plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/cost-engine"
date: "2026-10-30"
---

# Tareas: Motor de costos unificado

> Prerrequisito: spec `APPROVED` (hoy `DRAFT`) y análisis sin gaps, **salvo la excepción siguiente**.
>
> **Excepción autorizada por el owner (2026-10-30):** las tareas T-004 y T-005 son investigación y pruebas
> **diagnósticas previas a la aprobación**, porque su resultado es necesario para llegar a `APPROVED`. Se ejecutan
> en una rama separada, **no modifican lógica de producción**, no cambian precios y no activan nada. Esto no
> autoriza fusionar #1075, cambiar precios en producción ni activar el motor.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [ ] [T-001] Cerrar Q2, Q3, Q5, Q7, Q9, Q10 y Q11 (spec §11) y pasar a `APPROVED`; confirmar Q1, Q4, Q6 y Q8
- [ ] [T-002] Registrar SHA Git/producción, migraciones, mecanismo de flags y estado de `LocationCostIndex` en producción
- [ ] [T-003] Completar análisis spec↔plan↔constitución y ADR de las decisiones clave
- [x] [T-004] Pruebas diagnósticas de los 24 motores — **ejecutadas** como evidencia diagnóstica en el PR #1076 (72 escenarios, 76/76 tests, CI en verde; PR #1076 **fusionado en main** como `645ce3b8`) (excepción previa a `APPROVED`, solo pruebas):
  - al menos **tres escenarios por motor** (normal, complejo y límite): 72 iniciales, más los que los resultados justifiquen;
  - comparar cada salida contra su resultado original: ninguna discrepancia monetaria sin explicar y **sin tolerancias arbitrarias** que oculten diferencias;
  - capturar los argumentos reales que cada motor pasa a `buildCostSummary` (base, tasas efectivas, divisor) y compararlos con la reconstrucción por división de importes redondeados, que puede perder precisión (también `total / perUnit`);
  - si hay diferencias, evaluar que los motores **expongan directamente** tasas efectivas, bases y divisor, compatible con sus respuestas actuales;
  - informe que registre fallos, redondeos y motores incompatibles, con causas y modificaciones necesarias, y que **distinga errores de reconstrucción de errores de precios de mercado** (una prueba golden demuestra estabilidad matemática, no que un presupuesto sea comercialmente correcto)
- [ ] [T-004b] **Contrato aditivo (implementación posterior a `APPROVED`):** exponer en los 24 motores `costs.basis` antes del redondeo (USD), `effectiveRates` decimales y `perUnitDivisor` tipado y con unidad; sin inferir de importes finales. Comparar 72/72 casos con campos públicos, 0 centavos de diferencia y 66/66 divisores exactos, sin instrumentación; compatibilidad del JSON previo y privacidad por modo.
- [ ] [T-004c] **Defecto separado [#1085](https://github.com/Semse-projet/project-manager-app/issues/1085):** fijar unidad canónica y conversión versionada de `wastePercent` (`concrete` puntos porcentuales / `masonry` fracción) antes de activar categorías afectadas; pruebas de 10 %, límites y compatibilidad.
- [ ] [T-004d] **Defecto separado [#1086](https://github.com/Semse-projet/project-manager-app/issues/1086):** definir semántica de `crewSize` y cálculo multi-oficio; probar 1, 20, 21 y cuadrillas solapadas, sin subir el límite arbitrariamente.
- [ ] [T-004e] **Golden independiente (posterior a `APPROVED`):** 24 × normal/complejo/límite con expectativas congeladas y oráculo independiente; cambios de redondeo declarados, tasas por oficio conservadas, overrides, errores, integración ADR-027, inmutabilidad y regresión de `perUnit`.
- [ ] [T-005] **Políticas comerciales/fiscales de DISEÑO seleccionadas** ([matriz fuente y gates](./cost-engine.commercial-fiscal-policy-2026-11-05.md)): Q9 cantidad tipada (pilotos pintura/drywall), Q11 proveedores autorizados/BLS estadístico/RSMeans restringido, Q10 sin 7 % universal y subtotal con `UNDETERMINED` si falta política; Q2/Q3/Q5/Q7 políticas de producto elegidas. **No está completa la validación T-005:** faltan precios reales, permisos de licencia, especialistas y CPA/asesor fiscal; auditoría Q2 no ejecutada y nota jurídica Q11 sin enviar. La selección de arquitectura NO pone la spec en `APPROVED`.
- [x] [T-005-national-data] **Contrato nacional de DISEÑO / no producción**: [contrato nacional de datos y gates](./cost-engine.national-data-contract-2026-11-06.md), cobertura geográfica state/county/distritos, 24 SOC-maps propuestos, OEWS ≠ Davis–Bacon, precios con licencia, modelos de margen, 16 tests negativos, y gate por celda de oficio/jurisdicción/contrato. **No** indica precios reales, impuestos revisados ni `APPROVED`.
- [x] [T-005-preflight] **Preparación documental completada**, no aceptación comercial: [12 precios base e insumos piloto](./cost-engine.t005-pricing-evidence-register.md), [Q11 matriz de derechos y revisores](./cost-engine.q11-license-clearance.md) y [Q10 matriz CPA FL/GA](./cost-engine.q10-fiscal-professional-review.md); se corrigieron ediciones de fuentes oficiales. Ningún precio ni licencia de proveedor ni impuesto a cliente fue verificado o activado.
- [x] [T-005d-discovery] **Marco nacional adicional investigado (NO activado):** [contrato de evidencia para 51 jurisdicciones](./cost-engine.national-data-contract-v1-2026-11-06.md); fuentes BLS OEWS versionadas, ECEC (redondeo de $51.96 total vs $51.97 componentes), QCEW/Census, Davis-Bacon por obra cubierta, taxabilidad por distrito, permisos de proveedores y rollout segmentado. No sustituye T-005a/b/c.
- [ ] [T-005e] **ETL de fuentes públicas + diccionario de 24 oficios:** obtener OEWS por release/estado/metro/SOC, QCEW por NAICS, DOL por condado/tipo de obra y snapshot reproducible con ediciones, hash, cobertura y ausencia documentada. Nada de tarifas facturables derivadas directamente.
- [ ] [T-005x] **Conciliar mapeos SOC 14/24**: usar la [matriz documentada](./cost-engine.t005-soc-crosswalk-reconciliation-2026-11-07.md) para resolver divergencias por tarea y oficio con especialista, confirmar grupos agregados vs ocupaciones detalladas, fijar registro versionado y diseñar pruebas de no doble conteo. Investigación documental ahora; cambios al motor solo tras la aprobación del SDD.
- [ ] [T-005f] **Tax policy 51 jurisdicciones:** crear fichas normativas estatales/locales, resolver home-rule, contrato/fixture/capital improvement/repair, reglas de fecha y CPA por segmento; matriz SST como referencia parcial. Ninguna tax policy se aprueba sin fuentes y revisor competente.
- [ ] [T-005g] **Modelo financiero del precio final:** distinguir margen bruto, markup, overhead, tarifa cargada, viáticos y comisión (quién paga y sobre qué base); contrastar márgenes vs costos reales reconciliados por segmento y permitir UNKNOWN.
- [ ] [T-005a] **Mercado y licencias:** recolectar precios unitarios observados con fecha, proveedor, SKU, región, impuestos de compra, licencia de integración y rendimientos por oficio. Revisar `STATIC_MATERIAL_MULTIPLIERS` atribuida a RSMeans y retirar del conjunto elegible si no hay autorización contractual para SaaS; BLS OEWS no es tarifa facturable. Validación técnica + Legal/finanzas externa.
- [ ] [T-005b] **Casos fiscales independientes:** antes de cualquier `TaxPolicy` activa, obtener decisiones por escrito de fiscalidad FL/GA (real property lump sum/cost-plus/T&M; retail sale plus installation; GA use-tax y reparación retail), condado/fecha; contrastar `contractorInputSalesUseTax` vs `customerSalesTax` para evitar doble cargo. Ninguna cifra legal de fixture inventada.
- [ ] [T-005c] **Pilotos de cantidad:** pintura interior y drywall con entradas tipadas, unidades/rangos y revisión de especialistas; sin fuente o duda, estado `UNKNOWN` y estimado preliminar.
- [x] [T-006] #1074 cerrado como `SUPERSEDED` con comentario de trazabilidad hacia #1075 (autorizado por el owner el 2026-10-30; rama e historial conservados)
- [ ] [T-007] Alinear con ADR-027: plan de adaptación de `contractor-estimate.service.ts`

## Fase 0b — Correcciones P0

**Decisión técnica de orden (sin aprobación de spec):** [T-008b primero, T-008 después; consumidores y activación por gates](../../reportes/COST_ENGINE_T008_TECH_DECISION_2026-11-05.md). El diagnóstico #1099 **cerró sin fusionar** tras trasladar su oráculo sintético al PR existente #1101; ni esos tests ni el CI autorizan reemplazar precios o fusionar código productivo.



- [ ] [T-008] **Corregir metodología PPI — posterior a `APPROVED`:** precio observado con fecha/mes, unidad, fuente, derechos y serie compatible; dividir índice actual entre índice de **esa fecha** (no `/100`). Gate de estado tipado si índice ≤ 0, no finito, ausente, sin vigencia, incompatible o sin base verificable. No usar índice ficticio 100 ni publicar `basePrice` hardcoded como precio confirmado. Tests sintéticos subida/igualdad/bajada y fallback, más revisión de Q11. **Diagnóstico reproducible, no corrección:** PR [#1099 cerrado sin merge](https://github.com/Semse-projet/project-manager-app/pull/1099), oráculo sintético ahora en [#1101](https://github.com/Semse-projet/project-manager-app/pull/1101) e issue [#1087](https://github.com/Semse-projet/project-manager-app/issues/1087).
- [ ] [T-009] `TaxPolicy` versionada con estado `UNDETERMINED` y `customerTaxAmount=null` por defecto, **sin sustituir el 7 % por otra tasa**. Separar impuesto de compra/uso sobre materiales (costo contratista) del impuesto aplicable a venta al cliente; clasificación por inmueble vs propiedad personal y tipo de contrato; FL y GA solo pilotos fiscales sujetos a CPA y fuentes por condado. [Matriz y casos](./cost-engine.commercial-fiscal-policy-2026-11-05.md).

- [ ] [T-008b] **Integridad del snapshot PPI [#1100](https://github.com/Semse-projet/project-manager-app/issues/1100):** fallos de BLS y fallback hardcoded no crean ni renuevan observaciones con `source=BLS_PPI` verificada; índices ausentes/no válidos no producen precios ni expiraciones aparentes. **Implementación propuesta en [#1101 DRAFT](https://github.com/Semse-projet/project-manager-app/pull/1101)**: bloqueo de upserts de fallback, índices inválidos, procedencia `UNVERIFIED` para consumidores y tests con Prisma simulado; no corrige fórmula T-008. Merge/activación solo tras `APPROVED`, revisión independiente, compatibilidad de API, prueba DB aislada, smoke de consumidores y rollback.

- [ ] [T-008c] **Auditoría de caché PPI actual (solo lectura; PENDIENTE):** ejecutar con rol PostgreSQL de solo lectura el [SQL agregado](../../reportes/COST_ENGINE_T008_SNAPSHOT_READONLY_AUDIT.sql) siguiendo el [protocolo](../../reportes/COST_ENGINE_T008_SNAPSHOT_READONLY_AUDIT.md). Distinguir indicios de fallback de evidencia de corrupción; no inferir historial por `MaterialPriceSnapshot` actual, ni cambiar datos/servicios. Q11 y revisión de datos siguen OPEN.

## Fase 1 — Servicio y registro

- [ ] [T-010] Tests rojos del resolvedor por capas, límites y capas reservadas
- [ ] [T-011] [P] Schemas Zod de `CostParameter` y `costTrace`
- [ ] [T-012] `PARAMETER_REGISTRY` y `CostEngineService.compute` con recalculo que deriva y conserva los márgenes propios del oficio
- [ ] [T-013] `costTrace` (versión del motor, fecha de precios, parámetros y origen)
- [ ] [T-014] Pasar tests; confirmar que no cambia ningún resultado con defaults
- [ ] [T-015] Unificar `quote-engine` en el servicio con prueba de igualdad de totales

## Fase 2 — Smart Intake en modo sombra

- [ ] [T-020] Tests de tabla respuesta → entrada del motor por categoría mapeada (con revisión de oficio, Q9)
- [ ] [T-021] Adaptador y rango por escenarios bajo/alto
- [ ] [T-022] `COST_ENGINE_SHADOW`: servir la fórmula plana y registrar la diferencia sin texto libre
- [ ] [T-023] Pruebas de que un fallo del motor no rompe ni retrasa `analyze`/`estimate`
- [ ] [T-024] Informe de la comparación sombra y decisión de activación por categoría

## Fase 3 — Parámetros por capa (migración)

- [ ] [T-030] Migración aditiva `CostParameter` (con aprobación explícita del owner)
- [ ] [T-031] Verificar SQL, checksum, drift y compatibilidad hacia atrás
- [ ] [T-032] Servicio de parámetros con límites, versión y reversión
- [ ] [T-033] Permisos por capa en `rbac.ts` y endpoints `/v1/pricing/cost-parameters`
- [ ] [T-034] `AuditLog` con before/after y pruebas de aislamiento entre tenants y organizaciones
- [ ] [T-035] Flujo de doble control para `platformFeeRate` y `TaxPolicy`: solicitante distinto del aprobador, reautenticación reciente, aprobación ligada a valores y versión, caducidad
- [ ] [T-036] Permiso `pricing:org:manage` por `Membership` activa, con pruebas de otra organización y membresía inactiva
- [ ] [T-037] Serializador por modo y pruebas negativas de privacidad sobre el JSON del cliente
- [ ] [T-038] Control optimista de versión (`409`)

## Fase 4 — Pantallas

- [ ] [T-040] Pantalla admin (plataforma y región)
- [ ] [T-041] Pantalla de organización
- [ ] [T-042] Pantalla de contratista
- [ ] [T-043] Tarjeta de estimado con región, fuente y "cómo se calculó" según modo
- [ ] [T-044] Estados loading/empty/forbidden/degraded/error y es/en

## Fase 5 — Activación y migración de consumidores

- [ ] [T-050] Activar `COST_ENGINE_SMART_INTAKE` por categoría con smoke en Chrome
- [ ] [T-051] Migrar ProTools y Prometeo al servicio
- [ ] [T-052] Migrar cotizaciones, órdenes de cambio y `contractor-estimate` al servicio (ADR-027)
- [ ] [T-053] Retirar la fórmula plana con evidencia

## Fase 6 — PR, CI, deploy y verificación (por cada fase anterior)

- [ ] [T-060] Revisar diff y secretos; abrir PR con migración, rollback y evidencia
- [ ] [T-061] CI terminal; fusionar y registrar SHA
- [ ] [T-062] Deployment terminal API/Web; health y logs
- [ ] [T-063] Canary gradual con flags; smoke autenticado; métricas y señal de rollback
- [ ] [T-064] Registrar `production_evidence`, `last_verified` y `status: VERIFIED`

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Deploy `DEPLOYED`
- [ ] Activación `CANARY` o `ACTIVE` según el gate aprobado
- [ ] Migración `VERIFIED`
- [ ] Evidencia de producción enlazada
- [ ] Índice, matriz y roadmap actualizados

## Fase H — Extensión híbrida (solo diseño, posterior a aprobación)

**Fuente:** [anexo H1–H5](./cost-engine.hybrid-market-execution-design-2026-11-06.md). Estas tareas son de investigación/contratos, **no** habilitan implementación, nuevas APIs, compras de datos ni consultas web de producción. No sustituyen T-005a–g, Q2/Q3/Q9/Q10/Q11 ni las fases 1–6.

- [x] [T-005h] Documentar propuesta de cinco capacidades, límites de autoridad, contratos lógicos y matriz inicial de 14 pruebas sintéticas (`DRAFT / DESIGN_ONLY`; sin validación técnica de implementación).
- [ ] [T-005i] Revisar legalmente el catálogo de proveedores/APIs y permisos de SaaS, retención, reutilización y revocación; diseñar consentimiento explícito para RFQ y reglas de red segura.
- [ ] [T-005j] Definir normalización comercial por `SKU/UOM/alcance`, tax/entrega/garantía y scores **separados** de confianza y adecuación; calibrar pesos con datos reales, sin aprobar los ilustrativos 35/30/20/15.
- [ ] [T-005k] Diseñar escenarios por paquetes disjuntos `SELF_PERFORM / SUBCONTRACT / HYBRID` con pruebas anti-doble-conteo, revisión fiscal, licencias y reproducción de costTrace.
- [ ] [T-005l] Preparar dataset consentido de costos reales reconciliados, evaluación temporal fuera de muestra, revisión humana y plan de sombra/rollback por oficio y región.

## T-005 — trazabilidad de fuentes preexistentes (fase documental)

- [x] [T-005m] [Inventario S01–S12, con 12 claves BLS y estatus de permisos](./cost-engine.t005-source-rights-inventory-2026-11-06.md) completado **como auditoría de fuentes del código**, no como aprobación comercial.
- [ ] [T-005n] Ampliar el inventario de familias a todas las partidas económicas y productividades de 24 motores, ProTools y rutas alternas de presupuestación, con origen, permiso y costo verificado por SKU y región.
- [ ] [T-005o] Conciliar estado real del caché con T-008c autorizado (solo lectura) y resultados de #1101; obtener dictamen legal de fuentes restringidas y contrato de datos SaaS por proveedor antes de habilitar integración.

## T-005 — adquisición de cotizaciones y derechos SaaS

- [x] [T-005p] [Plan de canales de cotización y licenciamiento, con matrices de evidencia](./cost-engine.t005-vendor-quotes-rights-acquisition-2026-11-06.md) redactado como documentación. VND-01–06 son **candidatos sin contacto, quotes, contrato ni integración**.
- [ ] [T-005q] Completar el conjunto de todas las partidas económicas de 24 motores y seleccionar SKU/unit/área para obtención de evidencia real; conservar `UNKNOWN` sin sustitución.
- [ ] [T-005r] Obtener en proceso autorizado cotizaciones privadas comparables y/o licencias OEM/SaaS efectivas, documento de derechos, precio por región/fecha, Legal y aprobación comercial; nunca inferir autorización de páginas públicas.
- [ ] [T-005s] Ejecutar oráculos independientes de precio, equivalencia, revocación, privacidad entre tenants y cobertura por oficio/mercado, sin alterar Q10 ni Q11 hasta sus firmas.

## T-005 — modelo operativo nacional y salarios por ocupación (2026-11-06)

- [x] [T-005t] **Diseño documental nacional:** [crosswalk de 24 motores a SOC, contexto de condados/CBSA, reglas de costeo y NAT-01..NAT-18](./cost-engine.national-labor-geo-tax-operating-model-2026-11-06.md). Solo hipótesis de crosswalk, pruebas propuestas y datos oficiales de contexto, **sin política comercial aprobada**.
- [ ] [T-005u] **Importación real de salarios:** obtener ficheros oficiales OEWS May-2025 de estado y metro, validar release/checksum, parsear por SOC/geografía/percentil, conservar celdas suprimidas como NULL y publicar informe de cobertura. No se descargaron datos por localidad en esta revisión.
- [ ] [T-005v] **Labor burden y obligaciones especiales:** revisar costos cargados W-2/1099 solo con libros de empresa y clasificación adecuada; Davis-Bacon contract-specific para obra cubierta; no hacer multiplicador universal de ECEC ni usar salario de empleado para autónomo.
- [ ] [T-005w] **Oráculos nacionales:** implementar y ejecutar NAT-01 a NAT-18 con QA independiente en la fase autorizada, sin cambiar rangos ni impuestos del sistema heredado. Todos los casos actualmente documentales.

## Fase M — Agente residente de vigilancia de precios (DRAFT, no implementación)

**Documento de continuidad:** [diseño dentro de SEMSE](./cost-engine.market-watch-agent-design-2026-11-07.md) · [MW-01..MW-24](./cost-engine.market-watch-acceptance-matrix-2026-11-07.md). **No autoriza** endpoints, scraping, scheduler, bases nuevas, licencias ni cambios productivos; etapas posteriores requieren SDD aprobado y PR(s) propios.

- [x] [M-000] Registrar diseño de arquitectura worker/BullMQ, flujos de fuentes y seguridad, auditoría de `PriceRefreshJob`, matriz MW-01..24 y relación con #1101 (solo documentación).
- [ ] [M-001] Resolver contrato fuente/rights/UOM/SKU/fecha/geo, permisos, observaciones/revocación, costes de egress y revisión de privacidad/Legal. No tratar precio público como licencia SaaS.
- [ ] [M-002] Separar PPI `INDEX_ONLY` de precio comercial; verificar T-008/T-008b/#1101 con tests de fallos BLS y auditoría T-008c de solo lectura, sin atribuir datos verificados a fallback.
- [ ] [M-003] Aprobar spec propia y construir por PR autorizado scheduler en worker, lock, idempotencia, límite de tasa, colas de rechazo, métricas y flag OFF; sin escribir a tarifas productivas.
- [ ] [M-004] Diseñar y aceptar almacenamiento aditivo/versionado y bandeja de revisión humana con scopes tenant/org, derechos de uso y aislamiento; pruebas PostgreSQL y seguridad.
- [ ] [M-005] Pilotar pintura/drywall con precios y licencias observados, especialista del oficio, finanzas, Q2/Q3/Q9/Q10/Q11, modo sombra y replay; verificar MW-01..24 antes de aprobar cotizaciones comerciales nuevas.
- [ ] [M-006] Evidenciar por separado CI, revisiones, merge, despliegue, canary, procedencia Railway y rollback/kill switch. Prohibido alterar cotizaciones aceptadas, contratos, hitos o escrow.
