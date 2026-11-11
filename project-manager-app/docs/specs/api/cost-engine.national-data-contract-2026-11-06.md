# T-005 nacional v2 — contrato de datos para precios, oficios, fiscalidad y estimados auditables

**Corte de fuentes:** 2026-11-06 · **Estado:** `ARCHITECTURE_PROPOSAL / NO_PRODUCTION_ENABLEMENT` · **Ámbito:** 50 estados + DC, 24 motores heredados.  
**Relacionado:** [investigación de 51 jurisdicciones](./cost-engine.national-research-2026-11-05.md), [registro de fuentes T-005](./cost-engine.t005-pricing-evidence-register.md), [revisión fiscal FL/GA Q10](./cost-engine.q10-fiscal-professional-review.md), [derechos Q11](./cost-engine.q11-license-clearance.md), [spec principal](./cost-engine.spec.md).  
Este documento es **una propuesta adicional** de contratos y pruebas, no un dictamen fiscal, jurídico, laboral o comercial; no contiene precios de proveedor autorizados ni certifica el uso nacional. No crea servicio Railway, no altera el 7% legado, no modifica margen ni comisiones productivas, no ejecuta SQL.

## 0. Decisión de arquitectura

**Un motor matemático nacional + adaptadores versionados de jurisdicción, oferta económica, licencia y trabajo.** La cobertura **de un estado como territorio no equivale a cobertura de cada condado ni oficio**. El resultado debe poder permanecer `PRELIMINARY_UNVERIFIED` mientras faltan evidencia o revisión, sin rellenar importes inexistentes con el valor estatal/nacional.

**Cuatro autoridades independientes:**
1. **Precio observado con derechos:** cotización/factura propia, contrato con proveedor o feed OEM explícitamente licenciado; SKU, fecha, unidad, condado/área y derechos de SaaS.
2. **Costo laboral y productividad:** horas y rendimientos reales conciliados; BLS OEWS para contexto estadístico, ECEC para contexto de beneficios y determinaciones de salario prevaleciente **únicamente cuando corresponda**.
3. **Fiscalidad por operación:** norma/guía oficial, fecha efectiva, ubicación y clasificación de contrato, **oráculo profesional firmado** antes de activar TaxPolicy; separar impuestos de compra del contratista de tributos cobrados al cliente, de impuestos al negocio y de comisión de marketplace.
4. **Gobernanza comercial:** overhead, profit, precio objetivo, descuento, fee SEMSE, seguro y riesgo, aprobados por dueño/finanzas y con evidencia, distintos de obligaciones legales.

Nunca inferir `LICENSED` de un acceso público, `COST_VERIFIED` de un índice de inflación, `TAX_APPROVED` de una tasa estatal, ni `HIGH_CONFIDENCE` de una prueba aritmética.

## 1. Geografía — contrato de jurisdicción y mercado

### 1.1 Resolución

```text
Intake.workSiteAddress + fecha del servicio + clase de inmueble
   → verificación direccional/geocodificación (NO solo ZIP)
   → stateFips, countyFips, place, lat/lon + precisión y vintage
   → servicio de identificación de jurisdicciones fiscales con derechos de uso
   → estado/condado/ciudad/distritos especiales + sourcing de entrega/uso
   → área laboral BLS OEWS (CBSA/no metropolitana) ≠ límites de impuestos
   → evaluación de permisos/licencias por actividad y autoridad competente
   → políticas versionadas; sin resolución segura ⇒ REVIEW_REQUIRED
```

- **Census Geocoder:** direcciones -> geografía de Census y county FIPS; útil para identificación, **no determina por sí solo los distritos fiscales ni la regla de sourcing**. Manual oficial [Census Geocoding API (02/2026)](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html).
- **USPS ZIP:** un ZIP es un instrumento postal, no prueba de límites municipales/tributarios; ni la primera terna de ZIP determina siempre el estado/conjunto de límites. [USPS ZIP basics](https://faq.usps.com/articles/Knowledge/ZIP-Code-The-Basics).
- **Jurisdicción fiscal:** verificar con DOR/localidad o proveedor licenciado de tax determination; distinguir dirección de **obra**, **compra**, **entrega**, **uso** y **factura**. Si solo se conoce ciudad o ZIP, NO inventar county o district.
- **Áreas salariales:** BLS OEWS May 2025 publica series por estado y aproximadamente 530 mercados metro/no metro, NO 1:1 con county; descargar release `2025-05` y definiciones geográficas en [OEWS tablas](https://www.bls.gov/oes/tables.htm) y [métodos](https://www.bls.gov/oes/oes_doc.htm).
- **Temporalidad:** `geocoderVintage`, `jurisdictionSnapshotAt`, `taxRuleEffectiveFrom/To`, `laborReleaseId`, `quoteValidThrough`. Un municipio puede cambiar reglas sin cambiar ZIP.

### 1.2 Tablas mínimas (contrato propuesto, no migración implementada)

```typescript
type SiteJurisdiction = {
  geocodeSource: "US_CENSUS" | "REVIEWED_LICENSED_PROVIDER" | "MANUAL_VERIFIED";
  addressEvidenceRef: string | null;
  stateFips: string | null; countyFips: string | null; censusPlaceCode: string | null;
  localTaxDistrictIds: string[]; taxProviderAndVersion: string | null;
  laborAreaId: string | null; laborAreaRelease: string | null;
  geocoderVintage: string | null; geocodePrecision: "ROOFTOP" | "INTERPOLATED" | "CITY_ONLY" | "UNKNOWN";
  workSiteVerified: boolean;
  reviewStatus: "VERIFIED_FOR_SCOPE" | "PARTIAL" | "UNKNOWN";
};
```

Una correspondencia de county correcta **no** basta para autorizar sales tax. Los códigos FIPS son identificadores de geografía, NO fuentes de tasa.

## 2. BLS por 24 oficios — cruce SOC **propuesto**, sujeto a verificación de tareas

Los códigos listados son de **ocupaciones** SOC 2018, no códigos de servicio SEMSE, NAICS del contratista ni licencias profesionales. El costo de una cuadrilla requiere pesos de rol (`roleHours`), tareas concretas y su fuente. En un trabajo multioficio se agregan horas por rol, no salarios medios de categorías mezcladas. Referencia primaria [BLS SOC 2018](https://www.bls.gov/soc/2018/major_groups.htm), [SOC definición HVAC](https://www.bls.gov/soc/2018/soc_2018_definitions.pdf).

| Motor SEMSE | SOC candidato(s) | Riesgo o decisión de mapeo |
|---|---|---|
| painting | `47-2141` | Pintura de obra; preparación especial/abate lead es otra obligación |
| drywall | `47-2081`, `47-2082` | Colocación de panel ≠ acabado/taping; medir por separado |
| concrete | `47-2051`, `47-2061`, `47-2073` | Acabado, ayudantes y equipos distintos |
| electrical | `47-2111` | Oficial/aprendiz/supervisor, inspección y licencia no se deducen del SOC |
| plumbing | `47-2152` | No equiparar plomería residencial con toda la categoría de pipefitting |
| hvac | `49-9021`, `47-2211` | Instalación HVAC vs fabricación/ductos metálicos |
| roofing | `47-2181`, `47-3016` | Roofer y helpers; inclinación/altura/seguridad |
| carpentry | `47-2031` | Instalación, framing y carpintería fina requieren rendimiento distinto |
| tile | `47-2044` | Tamaño/porcelanato/patrón y preparación del sustrato |
| flooring | `47-2041`, `47-2042`, `47-2043`, `47-2044` | Carpet, vinyl, sanding, tile no tienen tarifa única |
| masonry | `47-2021`, `47-2022` | Bloques/ladrillo vs piedra |
| insulation | `47-2131`, `47-2132` | Aislamiento envolvente vs mecánico |
| demolition | `47-2061`, `47-2073`, `47-4041` | Manejo de materiales peligrosos requiere reglas y precio independientes |
| cleaning | `37-2011`, `47-2061` | Janitorial y limpieza post-construcción son tareas diferentes |
| landscaping | `37-3011`, `37-3013` | Jardinería vs arboricultura/arbolado |
| fencing | `47-4031` | Fence erectors, subcontratas locales |
| deck | `47-2031`, `47-2051` | Deck/framing y cimentación/footings se miden por separado |
| siding | `47-2031`, `47-2211` | Depende de material wood/vinyl/metal; no usar wage medio global |
| solar | `47-2231`, `47-2111` | Montaje FV vs conexión eléctrica licenciada |
| kitchen | `47-2031`, `47-2111`, `47-2152`, `47-2044` | **Proyecto multioficio**, no una ocupación propia |
| bathroom | `47-2152`, `47-2044`, `47-2111`, `47-2031` | **Proyecto multioficio**, permisos/impermeabilización |
| windows-doors | `47-2031`, `47-2121` | Marcos/puertas frente a cristalería |
| project-manager | `11-9021`, `47-1011` | Gerencia vs supervisor de cuadrilla; no es costo directo automáticamente |
| labor | `47-2061` | Auxiliar general; no atribuir oficios licenciados sin evidencia |

**Regla de aceptación:** ninguna fila se usa como tarifa para clientes hasta que la tarea y el SOC correctos estén confirmados por un técnico/empleador local y el `laborRate` venga de recibos/contratos reales, con overtime y burdens auditados. Las ocupaciones poco representadas pueden carecer de cifras OEWS publicadas en ciertas áreas (suprimir como `DATA_UNAVAILABLE`, jamás poner `0`).

### 2.1 Obtención federal verificable

- [BLS OEWS Tables](https://www.bls.gov/oes/tables.htm): release **May 2025** con **State (XLSX)**, **Metro/nonmetro (XLSX)** y **All Data TXT/XLSX**. El enlace de datos de estados apuntaba al archivo oficial `https://www.bls.gov/oes/special-requests/oesm25st.zip` en la página revisada; **la descarga del ZIP no se completó en esta investigación**, por tanto NO se afirma haber construido un dataset completo 51×SOC.
- La tabla [BLS May 2025](https://www.bls.gov/news.release/ocwage.t01.htm), publicada el **15 de mayo de 2026**, permite validar algunos controles: electricistas `mean=34.37 USD/h`, `median=30.38`; drywall y ceiling tile `mean=30.58`, `median=28.33`; tapers `mean=34.96`, `median=32.82`; pintores `mean=26.64`, `median=23.75`. Estas son referencias nacionales, **no** tarifas de SEMSE.
- [BLS OEWS FAQ](https://www.bls.gov/oes/oes_ques.htm): la encuesta no incluye al trabajador autoempleado; valores salariales **no incluyen beneficios patronales**. No usar la media de OEWS como precio final.
- [BLS ECEC](https://www.bls.gov/news.release/ecec.toc.htm): costo de compensación general, con distinta población/unidad estadística; usar como control de plausibilidad, no como multiplicador universal de cada oficio.
- [BLS API términos](https://www.bls.gov/developers/termsOfService.htm): guardar fecha de descarga y aviso de que BLS no garantiza análisis derivados; no usar logotipo ni presentar resultados derivados como oficiales.

### 2.2 Ingesta reproducible recomendada

```text
Fuente (release y checksum inmutables)
 → validación de formato, SOC, geografía, nivel estadístico, periodo y notas de supresión
 → tabla LaborBenchmarkVersion(stateFips, areaType, areaCode, soc, release,
   employment, hourlyMean, hourlyMedian, p25, p75, source, asOf)
 → verificación de cobertura por 51 jurisdicciones y oficios; NO rellenar celdas ausentes
 → comparación con costes reales privados por empresa y proyecto
 → exclusivamente BENCHMARK, hasta aprobación financiera.
```

Validaciones: no interpolar salarios de un estado vecino; si faltan datos metro, presentar estado/nacional solo como **contexto** con `geoMatchLevel=STATE_OR_NATIONAL_PROXY`; bloquear `costVerified=true`. Cualquier valor con supresión BLS queda `null` y razón `SUPPRESSED`.

## 3. Salarios que son **obligaciones** ≠ sueldos promedio

**Davis–Bacon / proyectos financiados o asistidos por fondos federales:** DOL publica determinaciones por condado o grupo de condados, **tipo de construcción** (building/heavy/highway/residential), clasificación de trabajador, `basic hourly wage` y `fringe benefits`. Aplican a proyectos **cubiertos**; no a todas las obras privadas ni a todo contratista del país. [DOL FAQs](https://www.dol.gov/agencies/whd/government-contracts/construction/faq), [DOL wage determinations](https://www.dol.gov/agencies/whd/government-contracts/prevailing-wage-resource-book/db-wage-determinations), [SAM.gov](https://sam.gov/content/wage-determinations).

**Regla de diseño:** si el alcance contractual indica fondos federales y posible cobertura, introducir `prevailingWageAssessment=REVIEW_REQUIRED`; identificar `wageDeterminationId + modification + laborClass + constructionType + area + effectiveDate`. Bajo una determinación válida, el mínimo salarial y beneficios **no** se reemplaza con OEWS, tarifa del trabajador, o salario mínimo general. Otras normas estatales/locales de salarios prevalecientes pueden aplicar a determinados proyectos públicos; requieren su propio adaptador y evaluación.

**Categorías de costo propias, sin doble conteo:**
```text
LaborCost = Σ_por_rol (
  regularHours × regularHourlyPaid
  + overtimeHours × actualOvertimeHourlyPaid
  + employerPaidTaxesAndBenefits
  + approvedTravelAndLodging
  + requiredTrainingPPEAndEquipment
  + allocatedNonproductiveHours
  + subcontractorInvoicedCostWhenApplicable
)
```
Registrar base de reparto y evidencia; seguro de obra y administración pueden ser **directos o indirectos**, pero nunca ambos. Una factura 1099 no certifica por sí sola que una persona sea contratista independiente; clasificación laboral exige revisión separada.

## 4. Cotizaciones de materiales: protocolo nacional con derechos

**No se incorporó ningún precio comercial nuevo.** El material `unitPrice` solo podrá habilitarse si existe compra/cotización real o licencia contractual. El código actual conserva **12 precios de respaldo BLS** no verificados; el index PPI puede ser un factor de ajuste documentado de un **precio base observado**, pero no convertir una serie indexada en USD arbitrarios. [Guía PPI BLS](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm).

```typescript
type MaterialQuoteEvidence = {
  quoteId: string; sellerId: string; sellerSku: string; manufacturerSku?: string;
  productVariant: string; gradeAndDimensions: string; materialUnit: string;
  normalizedUnitsPerPack: string; conversionProofRef: string;
  quantity: string; priceBeforeTaxPerPurchaseUnit: string;
  currency: "USD"; freight: string | null; pickupOrDelivery: "PICKUP" | "DELIVERY";
  purchaseStateFips: string; purchaseCountyFips: string | null;
  workSiteStateFips: string; workSiteCountyFips: string | null;
  purchaseTaxAlreadyPaid: string | null;
  supplierQuoteDate: string; supplierValidityExpires: string | null;
  licenseGrantRef: string | null; canStore: boolean; canShowToCustomer: boolean;
  canDerive: boolean; canReplay: boolean; canRedistribute: boolean;
  materialStatus: "QUOTED_NOT_REVIEWED" | "OBSERVED_AUTHORIZED" | "EXPIRED" | "REVOKED" | "UNKNOWN";
};
```

**No hacer scraping de comercios ni reutilizar su catálogo basándose en que una URL es pública.** Solicitar contrato OEM/SaaS escrito para el uso previsto; conservar condiciones de revocación y acceso multitenant. Un precio observado en un ticket de un cliente puede autorizar un análisis privado de **esa obra** sin autorizar al usuario ni a SEMSE a vender un catálogo derivado de la tienda a otros clientes.

**Paquetes mínimos para pilotos:** pintura: galón de pintura por acabado/cobertura, primer, consumibles, preparación, número de manos; drywall: panel por tipo/grosor/área, compound, cinta, tornillos, esquineros, niveles de acabado; ambos: entrega, desperdicio, restricciones, sitio, impuestos pagados. Sin producto real/vigente ⇒ `MISSING`.

**PPI y versiones:** `P_adjusted = P_observed × PPI_targetMonth / PPI_baseObservedMonth`, solo con misma serie/base compatible, índices positivos y reglas de revisión publicadas; el *ajuste* es una estimación provisional, no nueva factura observada. BLS recomienda fijar mes, serie, revisión y política ante discontinuidad/rebase; [guía oficial](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm). Los precios de tienda no tienen automáticamente correlación 1:1 con PPI al nivel SKU.

## 5. Costo total, margen y comisión: contrato de aritmética

**Evitar errores de terminología:**
```text
directCost = materialesConFlete + laborBurdened + subcontratosDirectos + maquinaria + otrosDirectos
fullyLoadedCost = directCost + indirectAllocation  (sin doble conteo)
revenueExcludingCustomerSalesTax = precioAceptadoAntesDeImpuestoAlCliente
grossMargin = (revenue - directCost) / revenue
contributionMarginAfterFee = (revenue - directCost - feePlatform - gastosVariables) / revenue
netProjectMargin = (revenue - fullyLoadedCost - feePlatform - otrosCostosAsignados) / revenue
markupOnCost = (revenue - costBaseElegida) / costBaseElegida
```

**Ejemplo 100% sintético (NO margen aprobado de SEMSE):** directos $70, indirectos $15, comisión de plataforma 5% del ingreso neto de impuesto y margen objetivo neto del proyecto 15%. El precio antes del sales tax del cliente que satisface esos dos supuestos es `(70 + 15) / (1 - 0.05 - 0.15) = $106.25`. Fee $5.31, beneficio $15.94 (redondeo de céntimos). **Si cambia el pagador de la comisión, la base, los descuentos, el impuesto de compra incluido o el reparto de overhead, el resultado cambia.** No usar cifras sintetizadas como benchmark comercial.

Separar `taxOnMaterialsAsContractorCost` de `salesTaxCollectedFromCustomer`: un impuesto **pagado al comprar material** puede estar en el costo de compra, pero no agregarse otra vez al cliente por cost summary como `taxRate=0.07`. Una `TaxPolicy` activa requiere oráculo independiente con clasificación local/fecha y firma fiscal. Comisión 5% en el código es solo legado, no tarifa comercial aprobada.

### 5.1 Riesgos/circunstancias de obra sin porcentajes inventados

| Factor | Entrada verificable | Comportamiento de estimado |
|---|---|---|
| Interior/exterior, altura, pendiente y acceso | inspección, medidas, fotos, plano | horas y equipo extra; no inferir un multiplier universal |
| Asbesto, plomo, moho y contaminantes | evaluación/documento firmado, acreditaciones | `HAZMAT_REVIEW_REQUIRED`; servicios regulados fuera del alcance de oficios comunes |
| Vivienda anterior a 1978 / actividad que perturba pintura | año inmueble, tipo ocupación, alcance | evaluar regla EPA RRP y acreditación, no añadir recargo fijo sin presupuesto |
| Servicio por huracán/urgencia | orden, localización, fecha, logística/permiso | flete, vivienda y overtime reales, no multiplicar por desastre automáticamente |
| Obras federales o estatales | contrato y fondos, clasificación | salarios prevalecientes y documentación cuando legalmente proceda |
| Permisos, inspecciones y licencias | autoridad/oficio/localidad | tarifa real + tiempo, sin afirmar permiso concedido |
| Cambio de obra | CO firmado y alcance | nueva versión/replay, sin editar arbitrariamente contrato aceptado |

Fuentes: [OSHA construction standards 29 CFR 1926](https://www.osha.gov/laws-regs/regulations/standardnumber/1926), [EPA RRP pre-1978](https://www.epa.gov/lead/renovation-repair-and-painting-program-contractors), [GSA per diem](https://www.gsa.gov/travel/plan-book/per-diem-rates). **GSA per diem es referencia de viajes federales; no es automáticamente obligación de reembolso del contratista privado.**

## 6. Modelo de aprobación parcial — funcionalidad nacional sin fingir mercado validado

**Definir dos capacidades diferentes:**
1. `AVAILABLE_FOR_PRELIMINARY_ESTIMATE`: puede usarse en cualquier estado para **recoger cantidades, generar un alcance y un rango condicional** siempre que se muestre claramente que los precios, impuestos y márgenes no están certificados y no se aprueben pagos automáticos.
2. `AUTHORIZED_FOR_COMMERCIAL_QUOTE`: autorización específica para `state × taxJurisdiction × trade × contractClass × pricingSource × effectiveDate` con **datos observados autorizados, revisión comercial, impuestos clasificados, obligaciones laborales y permisos evaluados**. El permiso de una celda no se hereda a otra.

```typescript
type CostQuoteGate = {
  stateFips: string; taxJurisdictionSnapshotId: string;
  tradeKeys: string[]; contractClassification: string;
  sourceLicenseVersion: string | null;
  observedPriceEvidenceRefs: string[];
  laborCostReviewRef: string | null; productivityReviewRef: string | null;
  prevailingWageReviewRef: string | null;
  taxPolicyIdAndVersion: string | null; signedTaxReviewRef: string | null;
  commercialApprovalRef: string | null;
  effectiveFrom: string; effectiveTo: string | null;
  state: "INTERNAL_RESEARCH" | "PRELIMINARY_ONLY" | "COMMERCIAL_REVIEWED" | "SUSPENDED";
};
```

**No hay en #1075 evidencia de ninguna celda `COMMERCIAL_REVIEWED`.** El objetivo de ingeniería puede ser arquitectura nacional `READY_FOR_REVIEW` sin mentir sobre go-live nacional.

### 6.1 Paquete de pruebas negativas y replay antes de activación

| ID | Escenario | Oráculo exigido |
|---|---|---|
| N-01 | ZIP coincide con ciudad pero el lugar pertenece a otro condado | sin autorización de impuesto por ZIP; exigir jurisdicción revisada |
| N-02 | lugar de obra conocido pero condado/distrito fiscal de entrega desconocido | `taxStatus=UNDETERMINED`, monto `null` |
| N-03 | fuente PPI con índice pero precio base no observado | sin precio USD certificado ni cotización cliente |
| N-04 | licencia de precio revocada o vencida | futuras cotizaciones bloqueadas; replay histórico gobernado |
| N-05 | salarios OEWS publicados sin datos de carga del empleador | impedir estado `COST_VERIFIED`; salario se muestra como referencia |
| N-06 | proyecto cubierto por Davis–Bacon sin determinación o clasificación | retener cotización comercial hasta revisión salarial |
| N-07 | pintura de vivienda pre-1978 potencialmente cubierta por EPA RRP sin acreditación evaluada | gate de cumplimiento; no precio automático único |
| N-08 | costos materiales ya incluyen tax de compra y policy pretende cobrarlo otra vez | test contra doble conteo |
| N-09 | gasto asignado tanto a indirectos como a línea directa | rechazo o conciliación antes de aprobación |
| N-10 | dos SKU con mismo nombre y diferente paquete/medida | no mezclar ni normalizar sin conversión dimensional |
| N-11 | dato salarial de área metro y obra en área rural | prohibir falsa precisión local; solo contexto explícito |
| N-12 | impuesto B&O/TPT/GET/contractor excise confundido con sales tax del cliente | campos de tipo de impuesto separados y oráculos distintos |
| N-13 | actualización de política fiscal tras aceptación, plazo o revoke | nuevo presupuesto/diff explícito; no reescritura de escrow/contrato aceptado |
| N-14 | tarifa contractual 1099 vs empleado W-2 mezclada automáticamente | sin factor universal; revisión laboral/clasificación |
| N-15 | shock de precio por desastre sin observaciones locales | `STRESS_RISK_UNCALIBRATED`, rango, no multiplier inventado |
| N-16 | fuente comercial con derechos solo para uso interno | no mostrar en Marketplace ni crear dataset multitenant derivado |

### 6.2 Validación cuantitativa recomendada (por región/oficio)

- Registro de proyecto y factura: `estimatedAt, bidVersion, trade, stateFips, countyFips, scopeQuantity, unit, plannedHours, actualApprovedHours, materialPurchaseReceipts, changeOrders, acceptedRevenueBeforeCustomerTax, actualLaborBurden, freight, disposal, overheadBasis, feePayer, permissions`.
- `WAPE = sum(abs(estimatedCost - actualCost)) / sum(actualCost)`, solo comparables y costos `actualCost > 0`; por grupo de costo/región/oficio/tamaño. `bias = sum(estimated - actual)/sum(actual)`. También `median absolute error USD`, `coverage` y desviación de horas/unidad.
- No declarar `CALIBRATED` solo por el número de estimados; el conjunto debe reconciliarse con **facturas y horas reales** (ni bids ni PaymentEscrow liberados constituyen costo). Separar las obras cambiadas sustancialmente por CO y registrar el mix entre pequeños/grandes, comerciales/residenciales, urbano/rural, disaster/non-disaster.
- Conservar cohorts de entrenamiento y validación **separados en el tiempo y por cliente/tenant**, evaluar errores out-of-sample y variación por región. Prohibir fuga de una cotización aceptada o un costo de otro cliente hacia benchmarks públicos sin derechos y agregación autorizada.
- Recalibración reversible: snapshot de reglas, resultados y hashes; comparación *shadow* contra legado; criterios de reversión y autorización comercial independientes de CI.

## 7. Orden de ejecución recomendado y responsables

**Fase A — integridad documental, ya iniciada:** matrices 24 motores y 12 BLS, 51 estados con **cobertura fiscal incompleta**, derecho RSMeans en investigación; registrar este contrato de datos. Este estado es `DOCUMENTED`, no aprobado.

**Fase B — datasets públicos nacionales reproducibles:** adquirir, versionar y validar el extracto OEWS 2025 (state/metro/no metro, no imputación de ausentes); Crosswalk de 24 motores/tareas SOC y excepciones por cobertura; cargar benchmark en entorno aislado con fuente, checksum y atribución. No requiere activar ventas.

**Fase C — pilotos comerciales reales:** para pintura y drywall y comparaciones con electricidad/concreto (contrastes de regulación), obtener cotizaciones autorizadas para materiales y tiempos de obra propios realmente conciliados en ciudades/condados representativos; revisión de productividad, finance y Legal. Las cotizaciones se conservan privadas por tenant.

**Fase D — fiscal y laboral:** CPA/asesor competente firma la política de jurisdicción y clase de contrato y sus ejemplos; Legal firma licencia de precio y contratos; revisor de oficio firma mapeo y rendimiento; responsable de plataforma aprueba fee, tasa y riesgo. No se exige un mismo CPA para 51 jurisdicciones, sí evidencia suficiente por jurisdicción activada.

**Fase E — piloto reversible por celda:** `OFF → INTERNAL_SHADOW → PILOT_REVIEWED → CANARY_AUTHORIZED` por jurisdicción/oficio/contrato; validación de datos/fuentes y oráculos independientes; rollback seguro. No merge/deploy al habilitar ventas sin gates completos.

### Bloqueos vigentes al corte

- 0 datos comerciales nuevos con autorización SaaS verificada; 0 decisiones de CPA firmadas; 0 cobertura tributaria **completa** por jurisdicción; permisos de RSMeans y origen de multiplicadores no resueltos.
- Archivo BLS OEWS estados/metro se **identificó pero no pudo descargarse y analizarse aquí**. Por eso no se incluye una tabla inventada de 24×51 tarifas.
- No se hizo validación de las matrices contra base PostgreSQL de producción, ni audit real de margen/rendimiento, ni pruebas de integración nuevas; son gates propuestos.
- Un PR `DRAFT` puede tener CI verde y seguir sin `APPROVED` fiscal/comercial. Conservar #1101 como corrección técnica distinta del método de precio base T-008.

**Fuentes principales revisadas 2026-11-06:** BLS OEWS release May 2025 y métodos, BLS PPI guide y API ToS; DOL Davis–Bacon; Census Geocoder API; USPS; SST Taxability Matrix para estados participantes ([versiones y fechas](https://sst.streamlinedsalestax.org/otm)); EPA RRP; OSHA 1926; GSA per diem. Acuerdos comerciales y dictámenes requieren documentos propios de SEMSE.
