# T-005 / Q11 — Inventario de fuentes actuales y situación de derechos

**Corte:** 2026-11-06 · **Estado:** `CODE_SOURCE_AUDIT / RIGHTS_NOT_CLEARED / NO_NEW_PRICES`  
**Origen de la revisión:** archivos de pricing y ProTools en la rama `docs/cost-engine-spec`, auditoría de 24 motores del [registro T-005](./cost-engine.t005-pricing-evidence-register.md), [matriz Q11](./cost-engine.q11-license-clearance.md), términos originales públicos.  
**Alcance:** identificar **familias de fuentes y valores heredados que ya intervienen en estimaciones**, antes de buscar nuevos proveedores. Este paso no revisa exhaustivamente cada literal de los 24 motores ni un snapshot de producción; las líneas económicas por oficio deben desglosarse separadamente. No presupone derechos o contratos a nombre de SEMSE.

## 1. Matriz de fuentes: derecho de acceso vs. validez comercial

| ID | Familia y ruta en código | Procedencia / función observada | Derechos/permiso comprobables hoy | Tratamiento de precio/costo para nuevo motor | Evidencia y siguiente acción |
|---|---|---|---|---|---|
| S01 | BLS PPI, `apps/api/src/modules/pricing/bls-ppi.service.ts` | API federal, índices asociados a 12 `materialKey`; el servicio construye importes con precios base fijos. | `PUBLIC_DATA_TERMS`: API pública con cita de recuperación y aviso; **no es licencia de una cotización en USD**. | `INDEX_ONLY`; sin precio base observado, SKU y mes, no habilitar precio comercial. | [Guía PPI](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm); [términos API BLS](https://www.bls.gov/developers/termsOfService.htm). Inventariar serie/mes/edición/mapeo por producto. |
| S02 | `BLS_SERIES.basePrice` (12 entradas) | Comentario de promedios de mercado 2024, pero sin factura, proveedor, unidad comercial normalizada, región ni fecha de observación. | `ORIGIN_AND_RIGHTS_UNKNOWN`; la procedencia de los valores **no se demuestra** por utilizar una API BLS. | `LEGACY_UNVERIFIED`; diagnóstico/replay antiguo, no nuevo precio comercial certificado. | Obtener cotización/factura y derechos del precio base; reconciliar fecha e índice del mismo mes. |
| S03 | `MaterialPriceSnapshot` / `MaterialPricingService` | Caché PostgreSQL de resultados de refresco y valores de fallback; `priceOf(map,key,defaultPrice)` puede usar respaldo numérico. | Los registros no tienen aquí prueba individual de concesión de derechos de precio ni revisión de cotización. | `PROVENANCE_PENDING`; no inferir que `source=BLS_PPI` certifica un precio o su licencia. | Auditoría de caché solo lectura T-008c; PR [#1101](https://github.com/Semse-projet/project-manager-app/pull/1101) desarrolla protección PPI/procedencia por separado. |
| S04 | `STATIC_MATERIAL_MULTIPLIERS`, `location-cost.service.ts` | Comentario atribuye aproximaciones estatales a «RSMeans 2023 City Cost Index»; **no está probado que sean datos copiados**. | `ORIGIN_UNPROVEN / RESTRICTED_PENDING_LEGAL`. Acuerdo público RSMeans restringe integración SaaS sin derechos expresos; no se halló contrato de SEMSE en estos expedientes. | No promover los multiplicadores como fuente comercial autorizada. | Examinar la cadena de autoría original del código, registros y permisos; dictamen jurídico si hay derivación de RSMeans. |
| S05 | `OEWS_TRADES` y llamada OEWS, `oews.service.ts` | Referencias salariales por SOC y estado; uso estadístico y cálculo de multiplicadores, no tarifa de venta. | `PUBLIC_DATA_TERMS` BLS; guardar edición, recuperación, versión, clasificación, metadatos. | `WAGE_BENCHMARK_ONLY`; no confirma costo patronal ni tarifa facturable. | Cruce SOC/oficio, calendario de edición y costo real cargado independiente. |
| S06 | `STATIC_LABOR_MULTIPLIERS`, `oews.service.ts` | Fallback estatal por tablas numéricas y descripción «BLS OEWS 2023»; no hay reconstrucción observación a observación ni fecha pinneada en el registro. | `METHOD_AND_ORIGIN_UNVERIFIED`; atribución no equivale a cálculo auditado. | `LEGACY_UNVERIFIED`; no declarar costo total de mano de obra. | Reproducir desde release OEWS/versiones; comparar pesos por operación y horas reales. |
| S07 | `NATIONAL_BASELINE_HOURLY_RATE`, `contractor-rate.service.ts` | Promedio de 12 salarios medios OEWS, empleado para derivar multiplicador de override. | BLS como referencia pública, pero **sin certificado de precio comercial**. | `STATISTICAL_CONTEXT_ONLY`, no usar como tarifa facturable automáticamente. | Separar salario, cargas, productividad, tarifa e indirectos. |
| S08 | `ContractorRateOverride`, `contractor-rate.service.ts` | Tarifa y markup declarados por usuario y almacenados en DB. | `OWNER_DECLARED / TENANT_PRIVATE`; no hay evidencia de mercado ni licencia de tercero implícita. | Mostrar como `USER_DECLARED_NOT_VALIDATED`; solo dentro de organización y permisos adecuados. | Validar autor, alcance, costos, privacidad, margen y aprobación comercial. |
| S09 | Costos fijos de `packages/tools/src/trades/*.engine.ts` (24 motores) y `protools.agent.ts` | Literales de material, horas, producción, márgenes, precios alternativos de ProTools y reglas de oficio; 9/24 motores usan `priceOf`, 15/24 no. | `AUTHORSHIP_AND_COMMERCIAL_BASIS_TO_BE_PROVEN`: no deducir infracción ni derechos de terceros solo por ser código propio; procedencia económica no documentada. | `LEGACY_UNVERIFIED`; compatibilidad y golden tests, no precios de mercado certificados. | Matriz por línea económica/oficio: valor, unidad, justificación, fuente/dueño, evidencia de compra y derechos. |
| S10 | `buildCostSummary`, `packages/tools/src/core/cost-engine.ts` | Por defecto fee 5 %, overhead 15 %, ganancia 20 % e impuesto 7 % (a veces sobrescritos en motores). | Son políticas/fórmulas internas, **no licencias de datos externos**; bases económicas y fiscalidad no aprobadas. | `POLICY_UNVERIFIED`; no convertir 7 % en `TaxPolicy` nacional ni fee/margen heredados en contrato comercial aprobado. | Q3 finanzas, Q10 CPA e invariantes matemáticas de #1076. |
| S11 | Cotizaciones/facturas futuras de proveedores, clientes o contratistas | **No presentes** en los expedientes como fuentes comerciales certificadas. | `NOT_OBTAINED`; uso de factura de una obra no autoriza recrear catálogo multi-tenant. | No habilitar precios, hasta contrato/consentimiento específico. | Recolectar con `SKU`, unidad, ubicación, fecha, validez, alcance, flete, impuestos y permiso. |
| S12 | Craftsman, posible servicio de datos OEM/SaaS | **Candidato externo, no conector ni fuente actualmente integrado**. Publica APIs y datos para estimadores. | `PROSPECT_ONLY / AGREEMENT_NOT_SIGNED`. Una oferta de licenciamiento no concede derechos a SEMSE. | Sin insertar precios ni pruebas de red/producción. | [Portal de licencias](https://craftsman-book.com/data-licensing): solicitar muestra, contrato, alcance de SaaS multitenant, cache, derivados, export, revocación y costos. |

### Verificación textual y semántica importante

- En la rama inspeccionada, `MaterialPricingService.getCurrentPrices` recupera `BLS_SERIES.basePrice` al vaciarse/expirar el caché; `pricing.controller.ts` devuelve en esa ruta `source: "BLS_PPI_CACHE"`. Este es un **riesgo de etiquetado en el código base**, no una constatación de lo que hoy hay en la DB de producción ni atribución al código de #1101. #1101 contiene cambios propuestos y debe revisarse con su propio HEAD antes de fusionarlo.
- El comentario de `bls-ppi.service.ts` presenta precio base «2024 market averages», pero no aporta precio observado ni índice del mes de base. BLS afirma que no publica precios unitarios PPI: **la licencia del índice y la evidencia del precio son dos controles distintos**.
- `protools.agent.ts` tiene un fallback de `laborRatePerHr` de USD 35/h, así como importes fijos por material para drywall, pintura, plomería y electricidad. **No** convertir esas cifras en cotizaciones de proveedor.
- `painting.engine.ts` usa tablas de calidad de pintura/preparación; `drywall.engine.ts` usa precios base de panel y otros consumibles. Se requieren registros por valor y por insumo, aunque solo nueve motores utilicen `priceOf`.
- Los valores de `STATIC_MATERIAL_MULTIPLIERS` están **atribuidos** a RSMeans en un comentario; la atribución por sí sola **no prueba que el autor tuviera ni careciera de licencia**, ni que los valores sean copia. La investigación de origen permanece abierta.
- La [versión PDF de términos RSMeans](https://www.rsmeansonline.com/Content/RSMeansOnlineUserAgreement.pdf), inspeccionada visualmente en páginas del documento donde figura **Last Updated March 16, 2026**, restringe en Addendum 1 §2.2 el traslado de datos a software y su base consultable sin permiso aplicable. No significa que SEMSE esté sujeto a ese contrato concreto ni que haya copiado esos datos.
- Los [términos públicos BLS](https://www.bls.gov/developers/termsOfService.htm) permiten consultar el servicio bajo condiciones de citación de fecha, aviso de no aval del análisis derivado, límites de API y prohibición de presentar su logo como patrocinio. Por tanto, **no debe clasificarse BLS como proveedor privado sin licencia; tampoco permite afirmar un precio USD real**.
- [Craftsman](https://craftsman-book.com/data-licensing) dice que ofrece licencia API; se requiere contrato para el uso específico de SEMSE.

## 2. Detalle de los 12 precios base vinculados a PPI (código, NO precio de mercado)

Todos los registros siguientes tienen el mismo estatus `LEGACY_UNVERIFIED / SOURCE_RIGHTS_NOT_PROVEN`. Sus cifras son literales para seguimiento, **no cotizaciones ni precios de proveedor de noviembre de 2026**.

| Registro | materialKey | basePrice USD | Unidad código | Índice asociado |
|---|---|---:|---|---|
| P01 | lumber-framing | 0.65 | board-ft | WPU081 |
| P02 | lumber-plywood | 0.85 | sqft | WPU081 |
| P03 | steel-rebar | 820.00 | ton | WPU101901 |
| P04 | copper-wire | 3.95 | lb | WPU102501 |
| P05 | drywall-sheet | 18.50 | each | WPU133 |
| P06 | concrete-ready-mix | 145.00 | cubic-yd | WPU132 |
| P07 | concrete-block | 2.10 | each | WPU132 |
| P08 | asphalt-shingles | 95.00 | sq | WPU0561 |
| P09 | architectural-shingles | 120.00 | sq | WPU0561 |
| P10 | steel-framing | 1.85 | linear-ft | WPU101 |
| P11 | masonry-brick | 0.85 | each | WPU132 |
| P12 | roofing-underlayment | 75.00 | roll | WPU0561 |

## 3. Criterios independientes para cerrar Q11 y T-005

**No confundir**:

1. `SourceUsageRights`: ¿quién es titular, qué licencia pública o privada es aplicable, qué uso SaaS/caché/derivados/multitenant/visualización permite, cuál es su versión, cuál es la prueba contractual y cuándo se revoca?
2. `PriceCommercialEvidence`: ¿de qué proveedor/contrato, SKU, unidad, cantidad, fecha, región, impuestos, flete y vigencia sale la cifra? ¿Hay revisión de experto y costo real comparable?
3. `CalculationPolicy`: ¿cómo entran precio y costos a cada motor, qué tasas efectivas, precisión, bases y divisor se usan y qué `TaxPolicy` revisada resulta aplicable?

### Gates concretos, sin supuestos

- [x] Familias observadas en el código y fuentes externas candidatas clasificadas **sin inventar permisos ni cotizaciones**.
- [x] 12 valores `BLS_SERIES` registrados, con fuente, unidad, índice y estado no verificado.
- [x] Diferenciada API BLS pública y licencia SaaS privada; separada atribución RSMeans de prueba de procedencia del código.
- [ ] Verificar contrato de SEMSE si lo hubiera con Gordian/Trimble/Craftsman; comprobar autoría/derivación del índice material y valores heredados; Legal documenta uso permitido/restringido por fuente.
- [ ] Completar **matriz de todas las líneas económicas de los 24 motores**, no solo `BLS_SERIES`, y traza de orígenes/fuente/versiones.
- [ ] Cotizaciones/facturas por SKU/región con derechos de uso; observaciones expiradas o no autorizadas no se convierten en fuente comercial.
- [ ] Auditoría de snapshot actual T-008c (solo lectura con autorización) para establecer qué hay realmente en caché; no se infiere de código.
- [ ] Validar costos W-2/contratos, cargas reales, rendimiento por operación, márgenes y política fiscal según jurisdicción.
- [ ] Obtener revisión jurídica documentada para cada fuente restringida, revisión comercial independiente y aprobación del owner, sin sustituirlas por CI o por documentación.

**Prioridad recomendada:** aclarar primero S04 (origen de multiplicadores), S02/S03 (precios BLS base/snapshots), S09 (valores estáticos de los 24 motores) y S08 (tarifas privadas), mientras se tramita el plan de licencias de proveedores. Mantener #1075 documental en `DRAFT`; no fusionar #1101 automáticamente ni desplegar nada.
