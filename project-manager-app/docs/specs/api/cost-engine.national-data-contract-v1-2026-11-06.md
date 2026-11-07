# T-005 nacional — contrato de evidencia y arquitectura para estimar en EE. UU.

**Fecha de investigación:** 2026-11-06 · **Versión:** investigación v1.0 · **Alcance:** 50 estados y Distrito de Columbia, 24 motores SEMSE.  
**Estado:** `DESIGN_PROPOSED / NON_COMMERCIAL / NO_TAX_OR_LICENSE_SIGNOFF`.

**Decisión:** un despliegue técnicamente disponible para todas las jurisdicciones no equivale a poder publicar una **cotización comercial y fiscalmente aprobada** en las 51. El mismo motor puede ejecutar cálculos internos `PRELIMINARY` a nivel nacional y producir cotizaciones finales **solo para la intersección** `jurisdicción × clasificación de trabajo × oficio × evidencia de precios × política de impuestos` autorizada. Nunca convertir ausencia de evidencia en cero o en promedio nacional ficticio.

**Expedientes previos que se conservan sin repetir:** [matriz 51 jurisdicciones](./cost-engine.national-research-2026-11-05.md), [registro de 12 precios BLS + 24 motores](./cost-engine.t005-pricing-evidence-register.md), [Q10 FL/GA](./cost-engine.q10-fiscal-professional-review.md), [Q11 derechos](./cost-engine.q11-license-clearance.md), y [decisiones de arquitectura](./cost-engine.decisions.md). Los cambios de implementación de #1101 protegen fallback/procedencia, pero **no** son calibración comercial ni autorización fiscal.

## 1. Fuentes económicas verificadas y semántica que SEMSE DEBE conservar

| Fuente / edición | Granularidad comprobable | Uso permitido como referencia técnica | No sirve para |
|---|---|---|---|
| [OEWS May 2025, tablas BLS](https://www.bls.gov/oes/tables.htm) y [estados May 2025](https://www.bls.gov/oes/2025/may/oessrcst.htm) | SOC, estado y área metro/no-metro; media, mediana y percentiles en descargas; publicación [15-may-2026](https://www.bls.gov/news.release/archives/ocwage_05152026.htm) | Cuantificar **salario de mercado de un oficio** y distribución por zona; guardar versión `2025-05` | Precio facturado, costo cargado real, gasto de subcontrato, salario Davis-Bacon, tiempo productivo |
| [ECEC, publicación 09-sep-2026 para Jun 2026](https://www.bls.gov/news.release/ecec.nr0.htm) | Sector/ocupación agregada, compensación patronal por hora trabajada y componentes | Evaluar razonabilidad de costo patronal agregado, no multiplicador universal | Reemplazar cargas W-2 por una proporción fija a cada SOC o calcular precio de venta |
| [QCEW — BLS](https://www.bls.gov/cew/overview.htm) | Estado/condado × NAICS, nómina y empleo de puestos cubiertos | Contexto de mercado, fuerza laboral y verificación independiente de agregados | Tarifa por oficio, empleados por hora facturable, precio de materiales; excluye autónomos sin cobertura |
| [Census County Business Patterns](https://www.census.gov/programs-surveys/cbp/data.html) | Localidad × NAICS, establecimientos y empleo | Densidad y estructura de mercado, no cotización | Costo de proveedores. **La web oficial disponible en la revisión señala 2023 como última referencia, y no garantiza publicar 2024**; no inferir datos de 2024 |
| [DOL / SAM.gov Wage Determinations](https://www.dol.gov/agencies/whd/government-contracts/prevailing-wage-resource-book/db-wage-determinations) | Condado × tipo `building/residential/heavy/highway` × oficio × modificación y vigencia | **Control obligatorio únicamente si la obra está cubierta por la normativa correspondiente**; tasa salarial + fringe aplicable | Tarifa nacional obligatoria para una obra privada cualquiera; por norma no es tarifa de venta |
| [BLS PPI price adjustment guide](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm) | Serie × mes × edición/revisión/base | Variación de un **precio base observado, fechado y autorizado**; bloquear series incompatibles, discontinuadas, rebases ambiguos | Precio de mercado USD por SKU. BLS afirma expresamente que **no publica precios unitarios PPI** |
| Factura o cotización de proveedor con permiso | SKU, producto, cantidad/unidad, fecha, destino, proveedor, transporte y derecho contractual | Precio observado; base preferida para estimación particular en vigencia, con revisión | Reventa de catálogo o divulgación multi-tenant sin permiso explícito |
| Base comercial/OEM bajo contrato firmado | Según contrato real de integración | Precios técnicos dentro de alcance `SaaS + caché + transformaciones + mostrar a usuario` firmado | Presumir derechos de uso por demo, abono individual o publicidad de API |

**Pinning obligatorio:** guardar `publisherReleaseDate`, `sourceObservationPeriod`, `retrievedAt`, `sourceEdition`, `contentHash`, `licenseGrantVersion`. No pedir datos de BLS usando enlaces `CURRENT` para un `costReplay` histórico. Usar rutas versionadas `/oes/2025/may/` o ficheros con edición congelada y SHA. La página de destino `/oes/CURRENT` puede apuntar a otra edición y la web muestra resultados inconsistentes al resolver páginas no versionadas. [Términos oficiales API BLS](https://www.bls.gov/developers/termsOfService.htm): guardar fecha de recuperación, aviso de que BLS no avala derivados y no usar logotipo como si patrocinara SEMSE.

### Comprobación ECEC independiente: no sumar importes publicados ya redondeados

BLS reporta para **construcción privada en junio de 2026** un **total de compensación patronal de USD 51.96/h** en la tabla completa [BLS ECEC, NAICS 23](https://www.bls.gov/iag/tgs/iag23.htm); publica por separado **salarios USD 36.13/h** y **beneficios USD 15.84/h**. Los dos componentes visualmente redondeados suman **USD 51.97**, por lo que difieren **USD 0.01 del total oficial**. Esto es un caso real, externo y reproducible de que redondear los operandos y reconstruir después **no** conserva la identidad del total publicado, lo mismo que diagnosticó T-004/#1076.

**Regla de ingesta y replay:** persistir `reportedTotal`, `reportedComponents`, `sourcePrecision`, `roundingPolicy` y fecha en campos diferentes. Dar autoridad al total **reportado por la fuente** para descripción del agregado (sin afirmar que es nuestro costo real); nunca sustituirlo silenciosamente por suma de dos importes ya redondeados. Calibrar costo real con nómina y costes del contratista; no usar `51.96` ni `51.97` como tarifa comercial de un trabajador.

## 2. Arquitectura de datos: separar estimación, mercado, obligación laboral y tributación

```text
Trabajo (ProjectIntake/Job) ──> WorkScope y cantidades tipadas
      │
      ├── JobLocation (dirección verificable, FIPS, condado, ciudad, district, fecha)
      │       └── TaxJurisdictionResolver (NO basta ZIP, GPS difuso o tasa del estado)
      │
      ├── MaterialRequirement (SKU/categoría, UOM, grado, volumen, desperdicio)
      │       └── AuthorizedPriceObservation (supplier quote/invoice/licensed API)
      │               ├── LicenseGrant (scope y revocación)
      │               └── MarketCondition (freight, stock, entrega, rebates, impuestos pagados)
      │
      ├── LaborOperation (SOC no necesariamente 1:1 con trade)
      │       ├── WageEvidence (OEWS / oferta real / contrato / DBRA si aplica)
      │       ├── LaborBurden (beneficios/cargas/seguro, no duplicación ECEC)
      │       ├── CrewProductivity (horas observadas, rework, prep, travel)
      │       └── CoverageRequirements (DBRA/estado/prevailing wage, licencias)
      │
      ├── JobOverhead, JobRisk, Logistics, Permits, ProfitPolicy, PlatformFeePolicy
      │
      └── TaxDetermination (local + estado + tipo de obra + contrato + entidad)
                    └── TaxPolicy reviewed/signed/versioned + independent fixtures
                               ↓
               PriceEvidence + CostReplaySnapshot
                               ↓
       PRELIMINARY / REVIEW_REQUIRED / COMMERCIAL_AUTHORIZED
```

### Contratos mínimos propuestos (sin afirmar implementación)

```typescript
type EvidenceStatus =
  | "OBSERVED_AUTHORIZED" | "COLLECTED_REVIEW_PENDING"
  | "STATISTICAL_BENCHMARK_ONLY" | "INDEX_ONLY"
  | "LEGACY_UNVERIFIED" | "LICENSE_RESTRICTED"
  | "EXPIRED" | "REVOKED" | "MISSING";

type JobGeo = {
  country: "US"; stateFips: string; countyFips: string | null;
  localJurisdictionIds: string[]; addressVerification: "VERIFIED" | "UNKNOWN";
  taxSourcingAddressId: string | null; marketAreaId: string | null;
  source: string; version: string; effectiveAt: string;
};

type MaterialPriceObservation = {
  materialKey: string; normalizedSpecId: string; supplierSku: string | null;
  area: JobGeo; quoteCurrency: "USD"; quotePrice: string;
  quoteQuantity: string; quoteUnit: string; normalizedPricePerUnit: string | null;
  canonicalUnit: string; unitsConversionRuleVersion: string;
  purchaseTaxIncluded: boolean | null; deliveryIncluded: boolean | null;
  freightAmount: string | null; restockingOrMinimumOrder: string | null;
  observedAt: string; validThrough: string | null;
  sourceType: "SIGNED_QUOTE" | "REAL_INVOICE" | "LICENSED_FEED";
  privateEvidenceRef: string; signedLicenseGrantRef: string | null;
  sourceEdition: string; reviewerRef: string | null; status: EvidenceStatus;
};

type LaborEvidence = {
  operationId: string; socCodes: string[]; wageGeo: JobGeo;
  wageSource: "OEWS_BENCHMARK" | "PAYROLL_REAL" | "CREW_SUBCONTRACT"
    | "DAVIS_BACON_APPLICABLE" | "STATE_PREVAILING_APPLICABLE";
  baseWagePerHour: string | null; burdenComponentsRef: string | null;
  paidHours: string | null; productiveHours: string | null;
  effectiveDate: string; sourceVersion: string; status: EvidenceStatus;
};

type TaxPolicyGate = {
  geo: JobGeo; workClassification: string; contractMode: string;
  primeOrSub: string; customerMaterialTitleAndRisk: string;
  salesUseExciseTaxRulesByComponent: string[];
  supplierTaxesAlreadyPaidRef: string | null;
  localOverridesRef: string | null;
  effectiveFrom: string; effectiveTo: string | null;
  officialSources: string[]; writtenCPAOpinionRef: string | null;
  approvedByHumanRef: string | null;
  status: "UNDETERMINED" | "REVIEW_REQUIRED" | "POLICY_APPROVED";
};

type QuoteResultGate = {
  status: "PRELIMINARY" | "REVIEW_REQUIRED" | "COMMERCIAL_AUTHORIZED";
  taxStatus: "UNDETERMINED" | "POLICY_APPLICABLE";
  customerSalesTaxAmount: string | null;
  sourceAndRightsCoverage: "COMPLETE" | "INCOMPLETE";
  priceObservationRefs: string[];
  laborObservationRefs: string[];
  taxPolicyRef: string | null;
  costReplayInputHash: string; calculationVersion: string;
  immutableRevisionId: string;
};
```

**Invariantes:** dinero decimal, no `float`; cantidades y unidades tipadas, no convertir ton/board-ft/sqft/sq sin catálogo dimensional; PII, cotizaciones privadas y condiciones de compra aisladas por organización/tenant; datos de un proveedor de un tenant **no** forman una base compartida de precios comercializables sin permiso separado. Se guardan referencias de documento protegido, no facturas con PII dentro de la respuesta de estimación.

## 3. Cobertura nacional debe medirse en dimensiones verificadas

- `TaxPolicyCoverage = # celdas state×jurisdiction×workClassification×contractMode×taxEvent con revisión válida / # celdas demandadas`. Celdas nunca vistas = `UNKNOWN`, **no** `tax=0`.
- `MaterialCoverage = líneas materiales ponderadas por costo que tienen observaciones elegibles / líneas cotizadas ponderadas por costo`. No contar una sola cita replicada en 51 estados como 51 evidencias.
- `LaborCoverage = operaciones/hora estimada con origen salarial y burden verificables / total operaciones/hora estimada`; separar `BLS_BENCHMARK_ONLY`.
- `EstimateCalibrationCoverage = proyectos finalizados con costos reales conciliados (expense, time, returns, CO) / proyectos terminados comparables`. Excluir escrow/contratos/bids sin costos reales como fuente de costo.
- `LegalRightsCoverage = precio y fuente mostrado cuya licencia permite almacenamiento, derivados, respuesta SaaS y uso customer-facing / precio y fuente mostrados`. Una revocación debe restar cobertura.
- `MarketAreaCoverage` debe registrar categoría **dentro de** metrópoli/condado; no extrapolar automáticamente a municipios adyacentes, zonas rurales o estados completos.
- Publicar el **denominador**, fecha, número de observaciones, edad mediana de cotización y cobertura por segmento. Un resultado estadístico favorable no demuestra obligación fiscal ni derecho de uso.

### Fuentes geográficas y el problema de ZIP

El [Census Geocoder API, edición 02/2026](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html) recibe una **dirección estructurada**, devuelve ubicación calculada y puede resolver geografías como estado/condado. No reemplaza verificación de límites fiscales municipales o distritales ni determina de por sí la jurisdicción de taxes. La fuente geográfica, fecha, confianza de emparejamiento y límites `home-rule/self-collected` deben versionarse. Una dirección incompleta solo permite borrador, no asumir el condado de su ZIP o geolocalizar por IP del cliente.

En [Colorado](https://tax.colorado.gov/local-government-sales-tax), ciudades `self-collected` pueden dictar reglas y administrar sus tributos aparte; el DOR indica contactar a la ciudad para saber su tratamiento. En [Alaska](https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/) no existe sales tax general estatal pero sí pueden existir **impuestos municipales**. Los cinco estados sin impuesto **estatal general** no equivalen a ausencia de toda obligación tributaria vinculada a construcción/actividad.

## 4. Estratos de estimación laboral que no deben confundirse

1. **Salario de referencia:** BLS OEWS (p. ej. media/mediana/percentiles, SOC, estado/metro y edición), descriptivo.
2. **Salario/contrato real:** nómina W-2 o contrato de subcontratista 1099 legítimamente clasificado, con horas, contratista y fecha. No convertir 1099 en W-2 por cálculo de tarifa; clasificación y obligaciones reales requieren asesoría competente.
3. **Carga patronal:** impuestos de nómina, seguros, trabajadores, beneficios, licencias, entrenamiento, herramientas, PPE, overtime, tiempo pagado no productivo. Si se utiliza valor `ECEC compensation`, no volver a sumar componentes ya incluidos en el agregado.
4. **Horas vendibles:** `paidHours != productiveHours != billableHours`. Visitas a proveedor, espera, pruebas, rework, supervisión, travel y descanso requieren política contractual/contable, no se ignoran.
5. **Prevailing wage:** Davis-Bacon si aplica por financiación/tipo/contrato, condado, tipo de construcción y modificación de wage determination; normas estatales aparte. [DOL](https://www.dol.gov/agencies/whd/government-contracts/prevailing-wage-resource-book/db-wage-determinations).
6. **Tarifa de venta:** se deriva del costo total de entrega, overhead y margen aprobado **según contrato**, nunca solo del promedio salarial.

**Ejemplo matemático estrictamente sintético**, no tarifa aprobada: suponga `directCosts=1000`, `allocatedOverhead=200`, `targetMargin=15%` del precio de venta pre-impuesto, y comisión plataforma `5%` *también* calculada sobre ese mismo precio de venta y asumida por contratista. Entonces `P = (1000+200)/(1-0.15-0.05) = 1500` USD, con costo y overhead 1200, margen 225, fee 75. Si fee se factura por fuera o el denominador cambia, **la fórmula también cambia**. Se necesita `ProfitPolicy` y `PlatformFeePolicy` firmados por la entidad, y el impuesto por componentes se calcula **después** de resolver clasificación fiscal; no aplicar el 7% al total. La palabra `margin` no significa `markup`.

## 5. Experimentos reversibles y evidencias por oficio

| Piloto | Qué comparar | Análisis y evidencia mínimos | Resultado que **NO** autoriza |
|---|---|---|---|
| Pintura interior | Paredes/techos, alturas, aberturas, capas, preparación | SKU gal/primer/consumible con consentimiento, cobertura real, m²/sqft medidos, horas por operación, factura, región | Afirmar que todo estado comparte mismo $/sqft |
| Drywall | Tipo/espesor 4×8/4×10/4×12, acabado 0–5, reparación, desperdicio | SKU/hoja, compuesto, screws/tape, cantidad y precio local, cuadrilla y rework medido | Convertir media BLS en tarifa facturable |
| Eléctrico/HVAC | Permisos, mano de obra licenciada, equipo especificado, inspecciones | Subtipo de equipo, marca, suministro/licencia, permisos, salario y seguro por lugar | Prometer precio residencial desde precio comercial |
| Restauración y siniestros | Secado, demolición y reconstrucción con diferencias por daño | Evidencia de moisture scope/coverage, acceso, póliza, pruebas, storage, logística, cadena de aprobaciones | Sustituir un acuerdo de aseguradora por índice PPI |
| Obra pública | Tipo de obra y financiación cubiertos por reglas prevailing | SAM wage determination ID + versión + condado, clasificaciones, fringe, obra concreta | Trasladar esa tasa obligatoria a obra privada indistintamente |

**Prueba pequeña inicial**: `INTERNAL_SHADOW` en FL y GA para pintura/drywall, **con autorización comercial real por SKU y sin publicar totales de cliente**, seguida de zonas con reglas fiscales contrastantes (TX, NY, WA, CA, AZ, CO, SD, NM). No llamar `PILOT_APPROVED` ni seleccionar valores sobre la base de promedios hasta que las pruebas de aceptación y revisiones existen.

## 6. Batería de pruebas de aceptación (oráculos independientes de los 24 motores)

### Ingesta de precios / datos
- [ ] Validación fuerte de unidad y dimensiones: `sq` de roofing no es `sqft` sin factor contractual, `panel` no es `each` sin especificación.
- [ ] Precio cero, negativo, `NaN`, infinito, divisas/precisiones inválidas, factura sin impuesto tax-paid, descuento condicionado, flete desconocido y suministro fuera de fecha ⇒ `REVIEW_REQUIRED`.
- [ ] `REVOKED`, `RESTRICTED`, `EXPIRED`, sin licencia SaaS ⇒ cotización no finalizable, pero replay histórico protegido según política aprobada.
- [ ] Serie PPI equivocada, rebase, provisional→final, índice ausente o meses incompatibles ⇒ no fabricar USD. `P = P_base * I_current/I_base` solo con base observada y sus índices comparables.
- [ ] Caída de proveedor/BLS y caché stale ⇒ no sobreescribir orígenes MANUAL ni alterar snapshot como si fuera observación actual. **No duplicar pruebas de #1101; reutilizar sus contratos.**

### Labor y contratos
- [ ] Cada `LaborOperation` tiene cantidad física, composición de cuadrilla, horas, localización, licencia y horas facturables; evitar mezclar salario OEWS y rate de venta.
- [ ] Determinación Davis-Bacon/prevailing por obra cubierta y versión; no usar una tasa `NATIONAL_BASELINE` si el contrato exige otra.
- [ ] Cálculo con overtime, worker comp, seguro, productividad, viaje y carga sin duplicaciones ni supuestos no etiquetados.

### Impuesto y reglas locales
- [ ] `TaxPolicy` debe resolver `state/county/city/local district × fecha × contrato × inmueble × contractor role × transaction`; si falta una dimensión decisiva, `UNDETERMINED`.
- [ ] Texas real property lump-sum vs separated/residential/commercial remodeling; WA retail labor vs wholesale; NY capital improvement vs repair; CA materials vs fixtures; CO self-collected; SD contractor excise; NM GRT; Alaska municipal; GA use-tax; FL surtax y retail installation.
- [ ] Impuesto sobre **compra** de materiales ya incorporado al costo no se duplica en impuesto **cobrado al cliente**; tampoco se considera `customerTax=0` por estar `UNKNOWN`.
- [ ] `PlatformFee` separada por entidad facturadora, sujeto tributario y política; no aplicar por defecto fee 5% y tax 7% simultáneamente en modelo nuevo.

### Calibración y QA estadístico
- [ ] Revisar `estimated vs actual` por `trade, state, marketArea, scope, contractMode, time, size`; usar errores firmados, error absoluto mediano y ponderado, intervalos, outliers y cobertura; incluir rework y CO, excluyendo escrow como costo.
- [ ] Fijar **antes** de ver resultados tamaños mínimos por segmento, reglas de muestreo, tolerancias de error y sesgo con especialistas/finanzas. No fijar umbrales arbitrarios como aprobación universal; para muestras pequeñas restringir a `REVIEW_REQUIRED`.
- [ ] Leakage: una misma factura o una obra repetida no constituye observaciones independientes; separar cohortes entrenamiento/calibración y test temporal fuera de muestra.
- [ ] Replay de snapshot inmutable en cambios de tarifa, licencia, impuesto, edición BLS, región y propiedad; no reescribir ofertas aceptadas, contratos o escrow.

## 7. Decisión de autorización escalable

```text
INTERNAL_PRELIMINARY (cualquier estado, con incertidumbre visible)
    ↓ evidencia comercial/legal/regional
INTERNAL_SHADOW (solo segmentos con datos suficientes)
    ↓ especialista oficio y QA out-of-sample, CPA, autorización de uso
PILOT_REVIEWED (segmentos explícitos, sin precio forzado en otros)
    ↓ sign-off comercial, Legal, fiscal, rollback, staging E2E
COMMERCIAL_AUTHORIZED (estado×localidad×contrato×oficio, versión/fecha)
    ↘ caducidad de cotización, norma, permiso o fuente -> REVIEW_REQUIRED
```

**El objetivo de #1075 no es declarar `approved` todo EE. UU. con 51 tasas**, sino aprobar primero un contrato arquitectónico que **siempre hace fail-closed** y posteriormente habilitar partes de su matriz conforme exista evidencia. Q10/Q11 siguen requiriendo dictamen profesional externo. Q2/Q3 esperan costes reales conciliados y márgenes autorizados. Q5 replay y Q7 rollout deben tratar cada autorización por segmento como revocable y auditable.

## 8. Hipótesis y lagunas explícitas (sin inventar precios)

- No se dispone en esta investigación de un dataset nacional público de facturas y cotizaciones comerciales **por SKU y localización** con permiso confirmado SaaS; por eso **no se autorizó ningún nuevo precio de material ni se rellenó la matriz 51×24 con promedios simulados**.
- Fuentes BLS, Census, DOL suministran salarios estadísticos, indicadores laborales, índices y wage determinations aplicables; **ninguna es una tabla nacional de tarifas de construcción facturables**.
- SST publica [matrices de taxability de estados participantes con versiones de 2026](https://sst.streamlinedsalestax.org/otm); no cubre todas las 51 jurisdicciones ni sirve por sí sola para determinar el impuesto de obras específicas; priorizar el departamento de ingresos correspondiente, normativa municipal y revisión de CPA.
- La guía del [Census Geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html) no es una API de tasas tributarias. Necesitamos resolvedor adicional de tax district y calendario de vigencia.
- El historial del repositorio no demuestra que SEMSE tenga licencia comercial de RSMeans. Acuerdo público de [RSMeans Online](https://www.rsmeansonline.com/Content/RSMeansOnlineUserAgreement.pdf) debe revisarse bajo la versión y contratación real de SEMSE; no asumir que una cláusula pública acredita la adquisición de derechos.

### Fuentes primarias contrastadas (2026-11-06)

- BLS OEWS: https://www.bls.gov/oes/tables.htm ; https://www.bls.gov/oes/2025/may/oessrcst.htm ; https://www.bls.gov/news.release/archives/ocwage_05152026.htm
- BLS ECEC: https://www.bls.gov/news.release/ecec.nr0.htm ; QCEW: https://www.bls.gov/cew/overview.htm
- BLS PPI y términos: https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm ; https://www.bls.gov/developers/termsOfService.htm
- Census CBP y geocoder: https://www.census.gov/programs-surveys/cbp/data.html ; https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
- DOL Davis-Bacon: https://www.dol.gov/agencies/whd/government-contracts/prevailing-wage-resource-book/db-wage-determinations
- SST matrices: https://sst.streamlinedsalestax.org/otm ; CO locales: https://tax.colorado.gov/local-government-sales-tax
- Tasas generales/Alaska como referencia **no jurídica**: https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/

**No se ha ejecutado un ETL, consulta a base de datos de producción, importación a Supabase/Postgres, instalación de dependencias, modificación de motor, aprobación comercial ni contratación de licencias.**
