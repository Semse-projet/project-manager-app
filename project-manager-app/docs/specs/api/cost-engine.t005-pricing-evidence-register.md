# T-005 / Q11 — Inventario de precios y adquisición de evidencias

**Corte:** 2026-11-05 · **Estado:** `EVIDENCE_REGISTER_PREPARED / ZERO_VENDOR_QUOTES_VERIFIED`  
**PR:** #1075, documentación únicamente. Ningún precio queda habilitado para cotizar automáticamente; no se cambian importes ni bases de datos.

## 1. Diagnóstico del inventario vigente en el código

La tabla `BLS_SERIES` en `apps/api/src/modules/pricing/bls-ppi.service.ts` mezcla **un precio base USD sin evidencia** con una serie PPI, cuya finalidad es medir variaciones, **no** el precio en dólares. El comentario «2024 market averages» no aporta proveedor, factura, fecha del precio, estado de impuesto, SKU ni permiso de reutilización. Este inventario reproduce los literales de **main** para auditoría, **no** los confirma como precio de 2026. Cada fila permanece `LEGACY_UNVERIFIED`.

| ID | materialKey | Unidad declarada | basePrice USD en código | serie PPI asignada | Evidencia de precio / derechos |
|---|---|---|---:|---|---|
| P01 | lumber-framing | board-ft | 0.65 | WPU081 | `MISSING / UNVERIFIED` |
| P02 | lumber-plywood | sqft | 0.85 | WPU081 | `MISSING / UNVERIFIED` |
| P03 | steel-rebar | ton | 820 | WPU101901 | `MISSING / UNVERIFIED` |
| P04 | copper-wire | lb | 3.95 | WPU102501 | `MISSING / UNVERIFIED` |
| P05 | drywall-sheet | each | 18.50 | WPU133 | `MISSING / UNVERIFIED` |
| P06 | concrete-ready-mix | cubic-yd | 145 | WPU132 | `MISSING / UNVERIFIED` |
| P07 | concrete-block | each | 2.10 | WPU132 | `MISSING / UNVERIFIED` |
| P08 | asphalt-shingles | sq | 95 | WPU0561 | `MISSING / UNVERIFIED` |
| P09 | architectural-shingles | sq | 120 | WPU0561 | `MISSING / UNVERIFIED` |
| P10 | steel-framing | linear-ft | 1.85 | WPU101 | `MISSING / UNVERIFIED` |
| P11 | masonry-brick | each | 0.85 | WPU132 | `MISSING / UNVERIFIED` |
| P12 | roofing-underlayment | roll | 75 | WPU0561 | `MISSING / UNVERIFIED` |

**Riesgos detectados:** una misma serie se reutiliza para artículos y unidades distintos; la concordancia exacta `PPI-series → SKU` no está revisada por un especialista. El denominador `100` no corresponde al índice del mes en el que se observó el supuesto precio base. Para ese defecto independiente rige T-008 / #1087; #1101 solo protege procedencia de snapshots y no valida la fórmula comercial.

### Otras fuentes económicas que deben entrar al registro

| Grupo | Evidencia en repo | Estado y uso permitido |
|---|---|---|
| Multiplicadores por estado | `STATIC_MATERIAL_MULTIPLIERS` de `location-cost.service.ts`, atribuidos en comentario a «RSMeans 2023» | `SOURCE_UNKNOWN / RESTRICTED_PENDING_LEGAL`: no aptos para nuevas cotizaciones comerciales; la atribución **no prueba copia** |
| Multiplicadores laborales | `STATIC_LABOR_MULTIPLIERS` de `oews.service.ts` | `LEGACY_UNVERIFIED`: faltan serie, área, mes, revisión y cálculo de cargas; no equivalen a costo de personal |
| Promedio salario nacional | `NATIONAL_BASELINE_HOURLY_RATE` de `contractor-rate.service.ts` | `STATISTICAL_CONTEXT_ONLY`: media salarial no es tarifa de venta, costo W-2/1099 ni rentabilidad |
| Tarifas del contratista | `ContractorRateOverride` en `contractor-rate.service.ts` | `OWNER_DECLARED_NOT_MARKET_VALIDATED`: validación de derechos, impuestos y costos separada |
| Precios estáticos por oficio | `packages/tools/src/trades/*.engine.ts`, `protools.agent.ts` y `cost-engine.ts` | `LEGACY_UNVERIFIED`: valor fijo en repositorio no equivale a factura o negociación aprobada |
| Impuesto genérico 7 % | `buildCostSummary` | `FISCAL_UNVERIFIED`; prohibido generalizar a nuevas políticas; Q10 define `UNDETERMINED` |

### Auditoría adicional — los 24 motores y propagación de impuestos/fee

**Método:** inspección de `main`, rutas `packages/tools/src/trades/**/*.engine.ts` (24 archivos), `packages/tools/src/core/cost-engine.ts`; corte 2026-11-05. No se ejecutaron los motores ni se validaron importes comercialmente. `priceOf` significa *usa el helper con un valor de respaldo*, no que el precio externo sea auténtico o aceptado.

| Motor | Helper `priceOf` | Impuesto 7 % / comisión 5 % |
|---|---|---|
| bathroom | no | explícitos |
| carpentry | sí | explícitos |
| cleaning | no | explícitos |
| concrete | sí | **heredados** del `buildCostSummary` central |
| deck | sí | explícitos |
| demolition | no | explícitos |
| drywall | sí | explícitos |
| electrical | sí | **heredados** del `buildCostSummary` central |
| fencing | sí | explícitos |
| flooring | no | explícitos |
| hvac | no | explícitos |
| insulation | no | explícitos |
| kitchen | no | explícitos |
| labor | no | explícitos |
| landscaping | no | explícitos |
| masonry | sí | explícitos |
| painting | no | explícitos |
| plumbing | sí | explícitos |
| project-manager | no | explícitos |
| roofing | sí | explícitos |
| siding | no | explícitos |
| solar | no | explícitos |
| tile | no | explícitos |
| windows-doors | no | explícitos |

**Resultado comprobado:** 24/24 llaman `buildCostSummary`; 22/24 fijan `taxRate: 0.07` y `semseFeeRate: 0.05` directamente; concreto y electricidad omiten esos parámetros y heredan `DEFAULT_TAX=0.07` y `SEMSE_FEE_RATE=0.05`. 9/24 usan `priceOf`, que en el motor central devuelve `map?.[key] ?? defaultPrice`: un precio de caché BLS o un respaldo numérico **no acreditan** origen, fecha, licencia ni impuesto. Los 24 construyen elementos mediante `material(...)`, por lo que requieren mapeo de insumos y unidades; **no** se concluye por un patrón de búsqueda que todos tengan exactamente los mismos riesgos ni que sea imposible otro mecanismo de precio.

**Bloqueo de aceptación ampliado T-005:** la revisión de solo 12 entradas `BLS_SERIES` es insuficiente. Cada motor debe tener una matriz de *línea de material → SKU/unidad, cotización autorizada o estado MISSING, fecha, localidad, impuestos de compra, política de desperdicio y permiso*, y *línea de mano de obra → tarea, horas, costo de carga y tarifa facturable*. Una futura `TaxPolicy` no puede heredar en silencio el 7 % de los motores; una futura `CommissionPolicy` no puede aprobar el 5 % por aparecer en el código. Mantener importes heredados para compatibilidad diagnóstica, no para cotizaciones finales nuevas.

## 2. Pilotos de adquisición de precios reales (pintura interior y drywall)

Los códigos P01–P12 no cubren por sí solos materiales de pintura y drywall: ProTools declara también **pintura, primer, rodillos, tornillos y compuesto de juntas**. La adquisición piloto necesita SKU, unidad comercial y rendimiento específico, no una conversión arbitraria desde PPI.

| ID | Oficio | Producto / tarea de referencia | Cotización autorizada | Especificación y unidad que falta |
|---|---|---|---|---|
| V01 | Pintura interior | pintura interior, 1 galón | PENDIENTE | marca/SKU, acabado, cobertura real, manos |
| V02 | Pintura interior | primer, 1 galón | PENDIENTE | marca/SKU, sustrato y cobertura |
| V03 | Pintura interior | rodillo/bandeja/cinta/consumibles | PENDIENTE | paquete/kit, unidad, caducidad |
| V04 | Drywall | panel 4×8, 1/2 pulgada | PENDIENTE | tipo de placa, espesor, SKU, unidad |
| V05 | Drywall | compound | PENDIENTE | volumen/peso, preparación, cobertura |
| V06 | Drywall | tornillos/cinta/consumibles | PENDIENTE | calibre, unidad de compra, rendimiento |
| V07 | Ambos | mano de obra por operación | PENDIENTE | horas por tarea, cuadrilla, transporte, cargas, seguros, modalidad contractual |
| V08 | Ambos | desperdicio, acceso y acarreo | PENDIENTE | valor y unidad por condición de obra |
| V09 | Ambos | overhead, ganancia, comisión SEMSE | PENDIENTE | costos reales y contrato; no copiar defaults del motor |

**Criterio de recolección elegido** (control interno, no exigencia legal): por SKU y región piloto, buscar **dos cotizaciones independientes, fechadas y legalmente utilizables**, o documentar por qué solo existe una y exigir revisión humana; evitar scraping y transcripción automática de catálogos de terceros. El caso piloto requiere **proveedor real, consentimiento/contrato y permiso específico de almacenamiento, transformación y mostrarse en SaaS**, no solo términos de uso de un sitio de comercio electrónico.

## 3. Registro de observación requerido (una fila por precio autorizado)

```yaml
observationId: REQUIRED_UUID_OR_ULID
materialKey: REQUIRED_CANONICAL_KEY
supplierLegalName: REQUIRED
supplierQuoteOrInvoiceRef: REQUIRED_RESTRICTED_REFERENCE
skuManufacturerDescription: REQUIRED
specificationAndGrade: REQUIRED
quantity: REQUIRED_POSITIVE_DECIMAL
purchaseUnit: REQUIRED
normalizedUnit: REQUIRED
unitConversionMethod: REQUIRED_VERSIONED
currency: USD
unitPriceBeforeTax: REQUIRED_DECIMAL
deliveryHandlingAmount: DECIMAL_OR_EXPLICIT_UNKNOWN
salesOrUseTaxAlreadyIncluded: TRUE_FALSE_OR_UNKNOWN
salesOrUseTaxAmountKnown: DECIMAL_OR_NULL
purchaseOrDeliveryCounty: REQUIRED
state: FL_OR_GA_FOR_PILOT
observedAt: REQUIRED_ISO_DATE
validThrough: REQUIRED_OR_EXPLICITLY_UNKNOWN
supplierRights: EXPLICIT_SAAS_PERMISSION | OWNER_ORIGINAL_AUTHORIZED | RESTRICTED | UNKNOWN
permissionEvidenceRef: REQUIRED_IF_AUTHORIZED
consentScopeAndRevocation: REQUIRED
reviewedBy: NAMED_HUMAN_NOT_YET_ASSIGNED
reviewedAt: DATE_OR_NULL
status: COLLECTED_NOT_APPROVED | OBSERVED_AUTHORIZED | EXPIRED | REVOKED
```

**Política fail-closed:**
- `OBSERVED_AUTHORIZED` solo si hay evidencia íntegra, derechos de uso compatibles con SaaS, unidad y jurisdicción claras, vigencia y revisión real. Un usuario que sube una factura propia no necesariamente tiene derechos para distribuir públicamente la lista de precios del proveedor.
- `COLLECTED_NOT_APPROVED` se permite en un repositorio privado con control de acceso y retención; **no** en resultados de marketplace; ocultar proveedores/PII del cliente.
- `UNKNOWN`, `RESTRICTED`, `EXPIRED` o `REVOKED` bloquean uso comercial automático. Una observación puede quedar disponible para auditoría histórica sin reaparecer en una nueva cotización.
- USD/ton, board-ft, sqft, each, sq, gal y otros requieren conversión dimensional y criterios de unidad no ambiguos. **No** usar `Number` flotante ni redondeos implícitos en dinero de producción.
- Un precio observado en un condado no es representativo de otro por defecto; sin `zip/county` y condiciones del proveedor, mostrar insuficiencia de datos.

## 4. Método permitido con BLS: índices, nunca precios inventados

[BLS PPI Guide for Price Adjustment](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm): precio base observado en fecha/mes `B`, índice de **esa serie** y **ese mes** `I_B`, índice objetivo `I_T` (versión y fecha de publicación), `P_T = roundCurrency(P_B × I_T / I_B)`, únicamente si ambos índices comparables existen, son positivos, están en base compatible y no son datos vetados por la política de revisión. Un precio base sin cotización autorizada no se rescata con esta fórmula. No almacenar una cadena `basePrice × I_T / 100` como precio verificado.

**Límites y cautelas adicionales:** la política de selección de dato provisional/final y de rebase debe quedar fijada por versión, con licencia y mes; los índices de BLS miden precio de venta del productor, no necesariamente costo de adquisición del contratista. [Condiciones de API BLS](https://www.bls.gov/developers/termsOfService.htm): citar **fecha de recuperación**, conservar atribución y advertencia de que BLS no certifica análisis derivados; nunca usar el logo como si avalara SEMSE.

## 5. Pruebas de aceptación / gate T-005a

- [x] Inventariados los **12** `BLS_SERIES` y grupos de multiplicadores / valores económicos existentes en main como **NO VERIFICADOS**; no se insertó ningún precio de proveedor.
- [ ] Evidencia autorizada de V01–V09 por FL y GA (o falta de cobertura declarada por zona; no afirmar cobertura donde no exista).
- [ ] Al menos un piloto con SKU, unidad, jurisdicción, fecha, factura/cotización y licencia legalmente aceptable, revisado por finanzas y especialista; no usar valores del código como sustitutos.
- [ ] QA independiente de discrepancias unidad/volumen, impuestos de compra, flete, reposición, desperdicio, seguros, IVA/sales/use y tasa de ganancia sin duplicaciones.
- [ ] Dictamen legal sobre multiplicadores atribuidos a RSMeans y derechos de cada proveedor (ver expediente Q11).
- [ ] Pruebas negativas de cotización automática con `RESTRICTED`, `UNKNOWN`, `EXPIRED`, `REVOKED` y precio base PPI no observado.
- [ ] Después, **solo** elevar las regiones/oficios con datos firmados a autorización comercial por separado.

**Fuentes del inventario:** rutas de main citadas y [guía oficial BLS PPI](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm). **Ningún proveedor ha emitido cotización en este expediente y no se ha consultado ninguna base de Railway.**
