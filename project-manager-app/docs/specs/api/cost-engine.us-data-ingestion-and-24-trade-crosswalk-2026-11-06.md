# T-005 nacional — fuentes, geografía y contrato de adquisición para 24 oficios

**Fecha de investigación:** 2026-11-06 · **PR:** #1075 · **Estado:** `SOURCE_CONTRACT_PROPOSED / NO_COMMERCIAL_CALIBRATION / NO_TAX_SIGNOFF`.  
**Objetivo:** preparar el Cost Engine para operar en 50 estados + DC **sin inventar tarifas, derechos de datos ni impuestos**. Documento de investigación y diseño, no implementación de endpoints, autorización fiscal ni edición de precios.

## 1. Tres clases de dato que no se deben confundir

| Evidencia | Pregunta que responde | Puede hacer en SEMSE | No puede hacer |
|---|---|---|---|
| [BLS OEWS May 2025](https://www.bls.gov/oes/tables.htm) | ¿Qué salario pagaron empleadores a cierta ocupación en un estado/área estadística? | Referencia de salarios y dispersión por SOC/área; released 2026-05-15 | Ser tarifa facturable, costo W-2/1099 o precio al cliente; no extrapolar para una ciudad con dato suprimido |
| [BLS ECEC June 2026](https://www.bls.gov/news.release/ecec.t04.htm) | ¿Cuál fue el costo medio de compensación patronal en construcción? | Contraste agregado del peso de beneficios y salario | Aplicar a cada ocupación la razón de beneficios como si fuera el costo exacto de una cuadrilla |
| [SAM.gov / DOL Davis-Bacon](https://sam.gov/wage-determinations) | ¿Qué salarios y fringes aplican a **determinadas obras federales** según condado, tipo de construcción, clasificación y modificación? | Compliance `prevailingWage` de proyectos cubiertos tras revisar contrato; [DOL FAQ](https://www.dol.gov/agencies/whd/government-contracts/construction/faq) | Fijar salarios privados universales; presumir que todos los proyectos están cubiertos |
| [BLS PPI](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm) | ¿Cómo varió un índice relativo desde un mes base? | Ajustar un precio **observado y autorizado** si serie, unidades, base/mes, versión y contrato coinciden | Crear un precio USD desde PPI/100; el BLS **no publica precios unitarios** en PPI |
| [FHWA NHCCI](https://www.fhwa.dot.gov/policy/otps/nhcci/methodology.cfm) y [WSDOT Unit Bid Analysis](https://apps.wsdot.wa.gov/engineering-standards/design-topics/engineering-applications/unit-bid-analysis) | ¿Cuánto se licitó por partidas de obra pública y cómo cambian los costos de producción? | Benchmark **solo** si la partida/condiciones se homologan, con fuente y alcance explícitos | Precios al por menor de pintura, drywall o tableros: una partida puede incluir labor/equipo/overhead/ganancia |
| [Census NAICS y CBP](https://www.census.gov/data/developers/data-sets/cbp-zbp/cbp-api.html) | ¿Qué estructura de especialidades, empleo y nómina tiene la zona? | Comparador de condiciones de mercado/representatividad y riesgo de pequeña muestra | Tarifas por oficio o precio comercial por SKU; CBP exige API key, no inferir acceso concedido |
| Cotizaciones y facturas con derechos | ¿Cuánto pagó **este** proveedor/contratista por **este** SKU y zona en una fecha? | Primera fuente para precio transaccional normalizado y calibración después de revisar permisos | Republicar automáticamente catálogos o datos personales de compras |
| Datos fiscales DOR estatales/locales | ¿Qué es gravable, a cargo de quién, dónde y cuándo? | `TaxPolicy` por transacción solo después de revisión profesional y fuente vigente | Universal `taxRate=0.07` o trasladar impuestos de compra directamente al cliente |

**Precisión BLS ECEC importante:** la tabla oficial ECEC June 2026, construcción, informa **total compensation $51.96/h**, `wages $36.13/h`, `benefits $15.84/h`. La suma de componentes presentados/redondeados es $51.97; **no** sustituir el total oficial por la suma, porque sus agregados se calcularon antes del redondeo. La fuente detallada es [BLS tabla 4](https://www.bls.gov/news.release/ecec.t04.htm).

**Control nacional de contexto:** [BLS OEWS tabla 1](https://www.bls.gov/news.release/ocwage.t01.htm) May 2025: pintores construcción $26.64/h media, $23.75/h mediana; drywall instaladores $30.58/$28.33; **tapers especializados** $34.96/$32.82; electricistas $34.37/$30.38. Estas son **mediciones salariales nacionales**, no valores de materiales ni tarifas de SEMSE. No se han importado 51 × 24 fichas; la base de carga será [OEWS May 2025 all data](https://www.bls.gov/oes/tables.htm), validando cada fila por SOC/área/edición y las celdas suprimidas.

## 2. Crosswalk de **24 motores** a ocupaciones SOC (propuesta a validar)

No todos los motores son un único oficio. Las listas de SOC siguientes son **candidatos de asociación funcional** derivados de las definiciones de tareas, no comprobación de cobertura de datos o cálculo autorizado de una tarifa. Antes de ejecutar, contrastar con el [catálogo ocupacional BLS](https://www.bls.gov/oes/tables.htm) y el alcance real de cada tarea. Los oficios multiocupación exigen una **composición de horas observadas**, no promedios de salarios de códigos.

| Motor del repositorio | SOC candidato (O*NET/BLS) | Riesgo de clasificación |
|---|---|---|
| `bathroom` | `47-2152, 47-2111, 47-2081, 47-2044` | Mixto: plomería, electricidad, drywall, azulejo |
| `carpentry` | `47-2031` | Carpintería; revisar labores de estructura especial |
| `cleaning` | `37-2011, 47-4041` | Limpieza ordinaria ≠ remediación de materiales peligrosos |
| `concrete` | `47-2051, 47-2061` | Acabado y ayudantes; bombeo/equipos aparte |
| `deck` | `47-2031, 47-2061` | Carpintería exterior y ayudantes |
| `demolition` | `47-2061, 47-4041` | Demolición general ≠ trabajos peligrosos/asbesto |
| `drywall` | `47-2081, 47-2082` | Instalación y taping separados; no media única |
| `electrical` | `47-2111, 47-3013` | Electricista y ayudante; supervisión adicional |
| `fencing` | `47-4031, 47-2061` | Instalación de cercas y trabajos auxiliares |
| `flooring` | `47-2042, 47-2044, 47-2031` | Resiliente, cerámica o madera tienen labores distintas |
| `hvac` | `49-9021, 47-2211` | Técnicos HVAC + conductos de chapa según alcance |
| `insulation` | `47-2131, 47-2132` | Aislamiento edificios vs instalaciones mecánicas |
| `kitchen` | `47-2031, 47-2152, 47-2111, 47-2044` | Mixto: muebles, plomería, electricidad, tile |
| `labor` | `47-2061, 47-1011` | Ayudantes, cuadrilla, supervisión |
| `landscaping` | `37-3011, 37-1012` | Paisajismo y supervisor; árbol/maquinaria por separado |
| `masonry` | `47-2021, 47-2022` | Ladrillo/bloque y piedra |
| `painting` | `47-2141, 47-3014` | Pintores y ayudantes; acabado exterior distinto |
| `plumbing` | `47-2152, 47-3015` | Plomería y ayudantes |
| `project-manager` | `11-9021, 47-1011` | Gerencia y supervisión de campo no equivalentes |
| `roofing` | `47-2181, 47-3016` | Tejadores y ayudantes |
| `siding` | `47-2031, 47-2061` | Montaje exterior y cuadrilla; oficio exacto por revisar |
| `solar` | `47-2231, 47-2111` | Instalación FV y electricidad |
| `tile` | `47-2044, 47-2022` | Tile y piedra según material |
| `windows-doors` | `47-2031, 47-2121` | Carpintería y vidriería |

**Propuesta de selección de salarios:** `trade + task + seniority + state + CBSA/nonmetro + referenceYear + SOC`. Si el contratista tiene una cuadrilla de especialistas, usar `hours[i] * burdenedCost[i]` por ocupación y revisar sustitución real. No confundir perfil de cliente "professional" de la app con el personal real que ejecuta el trabajo. No imputar `SOC 47-2061` para actividades sujetas a licencias de plomería, electricidad, HVAC, etc.

## 3. Tres escalas geográficas distintas que deben coexistir

1. **Lugar de ejecución:** dirección comprobada → lat/long → FIPS estado/condado y, cuando corresponda, municipio o distrito fiscal. El [Census Geocoding API](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html) permite localizar geográficamente direcciones estructuradas; no certifica por sí mismo la jurisdicción tributaria ni el lugar legal de suministro. ZIP y prefijos postales **no** sustituyen FIPS o jurisdicción.
2. **Mercado laboral estadístico:** `OEWS area` estatal, CBSA metro/no metro o `UNKNOWN`; el área laboral puede abarcar varios condados/estados y no determina impuestos.
3. **Jurisdicción fiscal de transacción:** `taxJurisdictionId` de la autoridad competente, tipo de transacción/destino y `effectiveDate`. Confirmar con lookup oficial o proveedor de cálculo tributario **legalmente contratado y revisado**.

Pruebas de necesidad de resolver **reglas locales**:
- [Colorado DOR Local Government Sales Tax](https://tax.colorado.gov/local-government-sales-tax): varias ciudades de autonomía local (**self-collected home-rule**) pueden definir y recaudar reglas diferentes; el estado no cubre la totalidad del tratamiento en esas ciudades.
- [Washington DOR Destination-based Sales Tax Tools](https://dor.wa.gov/destination-based-sales-tax-tools): lookup por calle, ZIP+4, lat/long y tasas disponibles mediante interfaz oficial; no usar ZIP 5 dígitos como identificación inequívoca.
- [Alaska Office of State Assessor](https://www.commerce.alaska.gov/web/dcra/OfficeoftheStateAssessor/AlaskaSalesTaxInformation): sin impuesto general estatal de venta, **pero** varias municipalidades imponen impuestos locales.
- [New York Department of Taxation Lookup](https://www.tax.ny.gov/bus/st/rates.htm): jurisdicción, código y tasa por dirección, además de clasificación de obra capital vs reparación.
- [Census API guía 2026](https://www.census.gov/data/developers/guidance/api-user-guide.html): códigos geográficos y vintage; usar referencias estables y versionadas.

**TaxStatus `UNDETERMINED` si**: solo hay estado, ZIP ambiguo, localidad autoadministrada sin regla, direcciones discrepantes, obra transfronteriza, falta tipo de contrato/property/fixture, compra por otro actor o cambio normativo posterior a fecha base. Mostrar subtotal preliminar y motivo, nunca `customerTaxAmount=0` por falta de dato.

## 4. Contrato fuente → snapshot de precio → cotización

```typescript
type EvidenceStatus =
  | "OBSERVED_AUTHORIZED" | "PUBLIC_STATISTICAL_REFERENCE"
  | "PUBLIC_INDEX_ONLY" | "PRELIMINARY_UNVERIFIED"
  | "LICENSE_RESTRICTED" | "EXPIRED" | "REVOKED" | "MISSING";

type LaborObservation = {
  socCode: string; oewsRelease: "2025-05"; geographyType: "NATIONAL"|"STATE"|"CBSA"|"NONMETRO";
  areaCode: string; areaDefinitionVintage: string;
  hourlyMean: string|null; hourlyMedian: string|null;
  hourlyP25: string|null; hourlyP75: string|null;
  estimateSuppressed: boolean; sourceUrl: string; retrievedAt: string;
  usage: "STATISTICAL_CONTEXT_ONLY";
};
type WageDetermination = {
  documentId: string; countyFips: string; constructionType: "BUILDING"|"RESIDENTIAL"|"HIGHWAY"|"HEAVY";
  classification: string; effectiveDate: string; modification: string;
  basicHourlyWage: string; fringeRate: string; contractApplicabilityReviewedBy: string|null;
  usage: "MANDATORY_MINIMUM_IF_APPLICABLE";
};
type MaterialObservation = {
  observationId: string; sku: string; canonicalMaterialKey: string;
  specificationVersion: string; normalizedUnit: string; sourceUnit: string;
  normalizationProof: string; quantityTier: string;
  observedUnitPriceNetOfSalesTax: string; freightPerUnit: string|null;
  inputTaxPaidPerUnit: string|null; supplierRegionFips: string|null;
  supplierQuoteReference: string; observedAt: string; validUntil: string|null;
  rightsEvidenceRef: string|null; rightsIncludeSaaS: boolean;
  rightsIncludeDerivedQuotes: boolean; tenantDataAccessScope: string;
  status: EvidenceStatus;
};
type CostQuoteAudit = {
  jobCountyFips: string; taxJurisdictionId: string|null;
  tradeTasksWithMeasuredUnitsAndHours: string[];
  materialsObservationRefs: string[];
  laborObservationRefs: string[];
  prevailingWageDeterminationRef: string|null;
  sourceSnapshotId: string; quantityAlgorithmVersion: string; costEngineVersion: string;
  indirectCostEvidenceRef: string|null; commissionPolicyRef: string|null;
  taxPolicyVersion: string|null; humanReviewerId: string|null;
  contractCurrency: "USD"; output: "PRELIMINARY"|"REVIEWED";
};
```

**Fuente comercial no certificada:** `rightsIncludeSaaS=false` o `rightsEvidenceRef=null` ⇒ solo referencia diagnóstica privada, nunca nueva propuesta comercial automática. Un precio con fuente protegida no se convierte en libre por calcular un promedio entre varios proveedores. No mostrar ni exportar identificadores de factura a otros tenants; separar acceso documental de los operandos autorizados.

**Descomposición de costo propuesta** (no fórmula de venta aprobada):
- Material neto observado + flete/entrega + waste realmente justificado + **sales/use tax de compra a cargo del contratista** registrado una sola vez.
- Mano de obra **por tarea**: horas pagadas, salarios reales, cargas y beneficios correspondientes, overtime aplicable, supervisión, preparación, carga/descarga, viajes y trabajo no facturable; costos de subcontrata contratados se registran como categoría separada para evitar doble conteo.
- Equipo/herramientas, renta, permits, disposal, pólizas, bonding y overhead documentados y asignados por driver consistente.
- Contingencia por riesgo validado, beneficio `profitMargin` vs `markup` explícito, comisión SEMSE conforme a quien la paga y su contrato, **impuesto al cliente por componente clasificado por CPA**.
- Cálculo con decimales y reglas de redondeo/versionado; guardar importes base y tasas efectivas pre-redondeo. **Inmutabilidad** tras aceptar contrato y aprobación humana para cambio de orden.

## 5. Estrategia nacional de adquisición sin licencias inventadas

| Etapa | Alcance ejecutable | Contrato de aceptación |
|---|---|---|
| A0 | Cargar *snapshot* íntegro BLS OEWS May 2025 por state/CBSA y SOC objetivo + definición de área | Filas reproducibles, checksums, release/ingest, supresión, fuente oficial y sin inferir tarifa |
| A1 | Unir país/estado/CBSA con FIPS de obra sin determinar taxability | Accuracy con geocodificaciones límite, ZIP ambiguo y municipios home-rule |
| A2 | Ingestar solo citas/quotes facturas originales de **proveedores autorizados** en pilotos painting/drywall | SKU, fecha, unidad, municipio/condado, rango, impuestos compra, flete y grant SaaS firmados |
| A3 | Importar wage determinations de SAM.gov **solo para proyecto cubierto** | Determinación vigente, número/modificación, tipo de construcción, condado, clasificación, fringes y aceptación jurídico-laboral |
| A4 | Comparar estimado *shadow* vs facturas + horas + gastos reales, en 2 oficios y varias localidades contrastantes | Errores de materiales, labor y total calculados contra costos reconciliados; umbrales definidos **antes** de validar |
| A5 | Comprobar 51 jurisdicciones + localidades conforme a prioridad de demanda | Cada `TaxPolicy` tiene fuente, firma fiscal, test y caducidad; **0/51 activas hasta sign-off** |
| A6 | Extender de 2 a los 24 motores sin reutilizar defaults comerciales no auditados | Comparación por oficio, región, tipo de proyecto, tipo de contrato y rol; rollback, alertas y gobierno por versión |

**Estrategia de señales:** [Census County Business Patterns](https://www.census.gov/data/developers/data-sets/cbp-zbp/cbp-api.html) puede aportar peso contextual de empleadores y mercado (requiere API key). [FHWA NHCCI](https://www.fhwa.dot.gov/policy/otps/nhcci/methodology.cfm) puede informar volatilidad **de obra pública de carreteras**; no transportar su escala a precios de remodelación residencial. El costo real final se reconcilia contra recibos y horas; una oferta comercial publicada no acredita margen real.

## 6. Pruebas negativas obligatorias antes de subir a APPROVED

1. `ZIP_5_ONLY` en Colorado home-rule o Washington ZIP compartido ⇒ `taxStatus=UNDETERMINED` y sin cobro automático.
2. Alaska sin sales tax estatal pero con impuesto municipal potencial ⇒ no establecer `customerTax=0` por estado.
3. Un salario OEWS con percentil suprimido o sin dato CBSA ⇒ no rellenar con valor inventado; queda nulo o rango explícitamente no representativo.
4. Davis-Bacon sin `contractCovered` + `county` + `type` + `determinationVersion` ⇒ no imponer a obra privada una tabla pública ni ignorar el mínimo en obra cubierta.
5. Documento de proveedor sin permiso SaaS ⇒ `LICENSE_RESTRICTED`, aunque sea público y el usuario haya comprado materiales.
6. `PPI` con basePrice sin observación o índices de base/inicio incompatibles ⇒ no generar precio USD certificado.
7. BLS ECEC `$51.96` vs `$36.13+$15.84` ⇒ preservar el total oficial publicado y las series atómicas con sus valores originales, no reclamar exactitud centesimal del informe agregado redondeado.
8. Material con impuesto de compra ya incluido ⇒ no volver a cobrarlo como impuesto al cliente; componente clasificado por CPA.
9. Cotización aceptada con revisión de índices/fuentes ⇒ replay del snapshot de aceptación sin modificar contratos ni escrow.
10. Ofertas a terceros: no exponer identificación de proveedores/clientes o datos de otro tenant.

## 7. Dependencias y condiciones sin cumplir

- Ningún precio por SKU y contrato de datos nacional ha sido adquirido; no crear 51×24 precios a partir de PPI/OEWS.
- No existen `TaxPolicy` firmadas para los 50 estados + DC, ni para todas las ciudades/condados/casos de contrato.
- La disponibilidad de un dataset público no certifica que sea representativo de cada trabajo, ni que se puedan revender datos de terceros.
- No hay reconciliación de costos reales suficiente para certificar margen, seguros, waste, labor burden, overhead o rentabilidad por oficio.
- No se altera #1101 (corrección técnica de integridad BLS con CI verde) ni el motor en producción. Este documento pertenece solo a la fase preparatoria T-005 de #1075.

**Fuentes principales:** BLS [OEWS 2025](https://www.bls.gov/oes/tables.htm), [ECEC junio de 2026](https://www.bls.gov/news.release/ecec.t04.htm), [PPI](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm), US DOL [Davis-Bacon](https://www.dol.gov/agencies/whd/government-contracts/construction/faq), [Census geocoding](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html), [CO DOR](https://tax.colorado.gov/local-government-sales-tax), [WA DOR](https://dor.wa.gov/destination-based-sales-tax-tools), [Alaska](https://www.commerce.alaska.gov/web/dcra/OfficeoftheStateAssessor/AlaskaSalesTaxInformation), [NY DTF](https://www.tax.ny.gov/bus/st/rates.htm), [FHWA](https://www.fhwa.dot.gov/policy/otps/nhcci/methodology.cfm).
