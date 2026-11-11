# T-005 — Modelo operativo nacional de precios, trabajo y territorio (fase de diseño)

**Corte:** 2026-11-06 · **Estado:** `DESIGN_ONLY / 0_VERIFIED_VENDOR_QUOTES / 0_SIGNED_TAXPOLICIES` · **PR existente:** #1075.  
Complementa [matriz 51 estados/DC](./cost-engine.national-research-2026-11-05.md), [inventario de insumos](./cost-engine.t005-pricing-evidence-register.md) y [plan para adquirir cotizaciones con derechos](./cost-engine.t005-vendor-quotes-rights-acquisition-2026-11-06.md). **No crea o activa código, impuestos, proveedores ni precios de producción.**

## 1. Nuevos criterios derivados de las fuentes oficiales

| Fuente | Permite | Prohíbe inferir |
|---|---|---|
| **BLS OEWS May 2025** | Salarios de asalariados por SOC / estado / área metropolitana y no metropolitana; percentiles publicados o supresión | No cubre al autoempleado, ni beneficios patronales, horas extra, rendimiento, tarifa de subcontratista o precio final |
| **BLS QCEW 2025** | Salarios y empleo **por industria NAICS y condado**; contraste de oferta local de industria, con supresión | No es tarifa de una ocupación ni ingreso por hora de trabajo facturable; no dividir semanal/40 sin horas |
| **BLS ECEC June 2026** | Composición agregada de compensación patronal por industria | No permite multiplicar automáticamente todas las medianas OEWS por una tasa fija de beneficios |
| **Davis-Bacon/SAM.gov** | Determinación de salarios/fringe legalmente aplicable a obra federal o financiada **cubierta**, por condado, clasificación y tipo de construcción | No es mínimo obligatorio en toda obra privada ni tarifa de venta |
| **FHWA NHCCI/bid tabs** | Referencia a adjudicaciones de **trabajo instalado** de carretera y variación de costos | No es precio de material a granel: incluye mano de obra, acarreo, equipo, overhead y ganancia |
| **Census Geocoder** | Geografía y county FIPS cuando una dirección estructurada se puede localizar | No determina automáticamente tasa, taxability, jurisdicción local exacta o permisos de obra |

**Notas de fuente:** [OEWS metodología y exclusiones](https://www.bls.gov/oes/oes_ques.htm); [ficheros oficiales May 2025](https://www.bls.gov/oes/tables.htm); [QCEW overview](https://www.bls.gov/cew/overview.htm); [ECEC junio 2026](https://www.bls.gov/news.release/ecec.htm); [DOL Davis-Bacon](https://www.dol.gov/agencies/whd/government-contracts/construction/faq); [SAM.gov](https://sam.gov/wage-determinations); [FHWA](https://www.fhwa.dot.gov/policy/otps/nhcci/methodology.cfm); [Census geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html).

**Comprobación de aritmética ECEC:** en la fila privada `Construction industry` del boletín de junio de 2026, el total publicado es **$51.96/h**, y los dos componentes redondeados son **$36.13/h** salario y **$15.84/h** beneficios; estos últimos suman $51.97 por diferencias de redondeo. Conservar el total publicado y no inventar una corrección de 1 centavo. Las tres cifras son promedios industriales, no los costos por oficio o de SEMSE.

## 2. Crosswalk de 24 motores a SOC: candidatos, NO tarifas aprobadas

> **Aviso T-005 (7-nov-2026):** esta tabla es un borrador histórico, **no** una lista canónica de SOC para generar tarifas. Se detectaron **14/24 diferencias** con el otro contrato de ingestión; ver la [matriz de conciliación por motor](./cost-engine.t005-soc-crosswalk-reconciliation-2026-11-07.md). La coincidencia del script de investigación con esta tabla no acredita validación laboral, cobertura OEWS ni permiso de cotización.


Los oficios de SEMSE son **categorías de servicios/proyectos**, y los SOC son **ocupaciones de empleados**. Una obra combinada necesita cantidades de trabajo por ocupación y subcontratas; varias filas comparten SOC y **no se deben sumar dos veces**. Este mapeo es hipótesis de trabajo para revisión de especialistas, no cobertura salarial validada de las 51 jurisdicciones.

| Motor | SOC candidato | Distinción técnica |
|---|---|---|
| `bathroom` | 47-2152 / 47-2044 / 47-2031 / 47-2111 | plomería, tile, carpintería, electricidad |
| `carpentry` | 47-2031 | acabados, estructura y ayudantes separados |
| `cleaning` | 37-2011 / 37-2012 | limpieza general ≠ remediación peligrosa |
| `concrete` | 47-2051 / 47-2073 / 47-2171 | acabado, operadores, refuerzo |
| `deck` | 47-2031 / 47-2061 | carpintería y mano de obra general |
| `demolition` | 47-2061 / 47-4041 | demolición general vs hazmat regulado |
| `drywall` | 47-2081 / 47-2082 | instalador ≠ acabador/taper |
| `electrical` | 47-2111 | sistemas, licencias y permisos específicos |
| `fencing` | 47-4031 / 47-2031 | cercas y bases |
| `flooring` | 47-2041 / 47-2042 / 47-2043 / 47-2044 | carpet, vinyl, wood, tile con distinta productividad |
| `hvac` | 49-9021 / 47-2211 / 47-2111 | HVAC, ductería, electricidad |
| `insulation` | 47-2131 / 47-2132 | arquitectónica vs mecánica |
| `kitchen` | 47-2031 / 47-2152 / 47-2111 / 47-2044 | proyecto multi-oficio |
| `labor` | 47-2061 | obrero de construcción; `47-3010` es grupo SOC amplio y queda fuera de cobertura detallada |
| `landscaping` | 37-3011 / 37-3013 | mantenimiento y árboles |
| `masonry` | 47-2021 / 47-2022 | bloque/ladrillo y piedra |
| `painting` | 47-2141 | sustrato, preparación, manos, altura |
| `plumbing` | 47-2152 / 47-2151 | edificación vs tuberías |
| `project-manager` | 11-9021 / 47-1011 | gestión y supervisión, no trabajo directo |
| `roofing` | 47-2181 | pendiente, sistema, retiro, seguro |
| `siding` | 47-2031 / 47-2211 | siding madera/vinilo/metal |
| `solar` | 47-2231 / 47-2111 | PV e interconexión |
| `tile` | 47-2044 | piedra/cerámica, impermeabilización |
| `windows-doors` | 47-2121 / 47-2031 | vidrio, marcos y sellos |

Los cruces son para **consulta**; la elegibilidad, habilidades, productividad, licencias, códigos laborales aplicables y uso por contrato se revisan con una persona competente. Fuentes: [BLS SOC/ocupaciones](https://www.bls.gov/oes/current/oes_stru.htm), [Occupational Employment May 2025](https://www.bls.gov/oes/tables.htm). Un SOC no equivale automáticamente a códigos de workers' compensation, NAICS, clase Davis-Bacon ni licencia de oficio.

## 3. Taxonomía nacional de geografía y contrato

```typescript
type MarketLocation = {
  stateUSPS: string;                      // 50 estados + DC
  countyFIPS: string | null;              // no deducirlo por ZIP de tres dígitos
  metroCBSA: string | null;               // área BLS puede cruzar estados
  localTaxDistrictIds: string[];          // municipio, home-rule, distrito si corresponde
  workLocationRef: string | null;         // dirección privada / verificada
  purchaseLocationRef: string | null;
  deliveryLocationRef: string | null;
  geocodePrecision: "PARCEL"|"STREET_APPROX"|"COUNTY_ONLY"|"UNKNOWN";
  propertyType: "REAL_PROPERTY"|"PERSONAL_PROPERTY"|"UNKNOWN";
  contractClass: "LUMP_SUM"|"COST_PLUS"|"T_AND_M"|"RETAIL_INSTALL"|"UNKNOWN";
  constructionClass: "RESIDENTIAL"|"COMMERCIAL"|"PUBLIC_WORKS"|"UNKNOWN";
  eventDate: string | null;               // imprescindible para versión fiscal vigente
};
```

Una dirección parcial puede activar **estimación preliminar** pero no completar una política fiscal o precio de entrega exactos. Un CBSA de BLS que cruza frontera estatal no equivale a jurisdicción tributaria. La fecha del hecho imponible y el destino de entrega no siempre coinciden con la fecha del presupuesto. No asumir que la tarifa y la propiedad de materiales se deciden igual en todos los estados.

## 4. Cinco fuentes monetarias incombinables sin normalización

| Tipo de valor | Registro mínimo | Control de procedencia |
|---|---|---|
| `MaterialQuote` | SKU/grade, cantidad, UOM, vendedor, destino, fecha, vigencia, precio pre-tax, freight, discount, impuesto pagado, propietario | Consentimiento/licencia SaaS, proveedor e identidad, no extrapolar de otra área |
| `LaborCost` | trabajador o contrato sub, actividad/SOC aproximado, horas **pagadas**, horas productivas, overtime, burden, travel, seguros y ubicación | Si es subcontrata lump sum no añadir wage+burden de empleado propio otra vez |
| `InstalledWorkPrice` | work item + alcance + UOM + fecha + fuente/pliego y condiciones | No volver a sumar materiales + labor encima de total instalado |
| `TaxDecision` | state+locality+fecha, contrato, propiedad, rol prime/sub, materiales, cliente, tipos de impuestos, fuente normativa versionada | CPA/revisor real; `UNDETERMINED` mientras no exista firma/coverage |
| `CommercialQuote` | version, trace, líneas y fuentes, tasas efectivas, margen, fee payer/base, aprobación, snapshot | Aceptada = inmutable; cambio = nueva versión o Change Order |

**Regla de orígenes de precio:** 
(1) cotización del proveedor vigente y autorizada, local y con condiciones;
(2) una segunda fuente independiente como contraste cuando sea posible;
(3) factura del propio tenant con permisos y retención clara, para referencia privada;
(4) índices/estadísticas federales como **contexto**, sin convertirse en precio SKU;
(5) si falta fuente o permiso ⇒ `PRELIMINARY_ONLY`. Los valores del código o de una web sin derechos no pasan a `VERIFIED`.

## 5. Composición del coste sin doble conteo

```text
materialDirectExTax = SUM(quantities × observedAuthorizedUnitPriceExTax)
contractorPurchaseTax = tax de compra/uso real a cargo del contratista,
                        UNA sola vez; no estimar como tasa de venta al cliente
laborLoaded = SUM(paidHoursByTask × verifiedLoadedHourlyCost)
direct = materialDirectExTax + contractorPurchaseTax + freight + handling
         + equipment + permits + waste + disposal + siteProtection
         + laborLoaded + approvedSubcontracts + mobility/travel/lodging
indirect = allocatedOverhead(direct, finance-approved basis and rule)
projectCost = direct + indirect
customerPriceBeforeTax = commercialPolicy(projectCost, margin, risk, feePayer)
customerTax = approvedTaxPolicy(customerPriceByTaxableComponent, jurisdiction)
```

**No mezclar:** salarios BLS, costo cargado, tarifa de venta, precio instalado y pagos escrow. La comisión SEMSE necesita identificar quién paga, base y tratamiento fiscal; el 5 % heredado no equivale a margen aprobado. Margen `(P-C)/P` y markup `(P-C)/C` no son lo mismo: con **C=$100** y **P=$125**, el markup es 25 % y margen 20 % (ejemplo sintético). 

**Unidades de mano de obra:** proyecto de baño ilustrativo con 5 h plomería + 4 h tile + 3 h electricidad + 2 h ayudante = **14 worker-hours**, que pueden representar menos horas de calendario con ejecución paralela. No sumar `workerHours` y `crewClockHours` como dos costos.

## 6. TaxPolicy y permisos: activación selectiva para todo EE. UU.

La arquitectura puede **reconocer los 50 estados + DC desde el primer día**, pero una política comercial se autoriza solo para la combinación **jurisdicción × oficio/tarea × inmueble × contrato × fecha × tenant × rol prime/sub** con:
- norma vigente específica y clasificación fiscal firmada (o `UNDETERMINED/null`);
- precio observado y licencia/consentimiento efectivamente compatibles con SaaS;
- coste real por cuadrilla o subcontrata y rendimiento validado;
- revisión de permisos/licencia profesional/seguros y obligaciones de prevailing wage **cuando correspondan**;
- revisión de riesgos, unidades, margen/fee, y replay exacto en snapshots aceptados.

La cantidad de enlaces oficiales de estados **no mide** número de políticas aprobadas. El estado de marketing, cliente y contrato debe distinguir `RESEARCH_REFERENCE`, `PRELIMINARY_ESTIMATE`, `HUMAN_REVIEWED_QUOTE`, `ACCEPTED_LOCKED`.

## 7. Matriz NAT-01 a NAT-18: nuevos criterios de aceptación (propuestas, NO tests ejecutados)

| ID | Escenario de prueba | Debe pasar |
|---|---|---|
| NAT-01 | Un municipio desconocido con estado conocido | `taxStatus=UNDETERMINED`, total preliminar |
| NAT-02 | CBSA multiestado y county FIPS de obra desconocido | No usar CBSA para tasa ni licenciamiento |
| NAT-03 | BLS SOC regional suprimido | Valor nulo, no salario cero ni cifra nacional etiquetada local |
| NAT-04 | OEWS mediana y ECEC promedio industrial | No multiplicar por factor de burden arbitrario |
| NAT-05 | Obra federal cubierta sin WD/versión contractual | `PREVAILING_WAGE_REVIEW_REQUIRED` |
| NAT-06 | Precio pintura USD/gal contra USD/cubeta de 5 gal | Conversiones UOM tipadas, cantidades mínimas y paquete |
| NAT-07 | Licencia proveedor vencida y fallback hardcoded | Rechazar `VERIFIED_PRICE`; no contaminar snapshots |
| NAT-08 | Ítem FHWA installed work + precio material SKU | No combinar ítem de obra instalada como si fuera compra |
| NAT-09 | Subcontrato lump sum con mano de obra incluida | No cargar salario/burden propia doblemente |
| NAT-10 | Impuesto sobre compra ya incluido en factura | No duplicar como impuesto del presupuesto |
| NAT-11 | Precio factura tenant A consultado por tenant B | Acceso denegado, no filtrar ni explotar datos ajenos |
| NAT-12 | Quote aceptada seguida por nueva fuente/TaxPolicy | Preservar operandos congelados; nueva versión explícita |
| NAT-13 | Huracán/obra fuera de ciudad con hospedaje y movilidad | Partidas de viaje, equipos y demora explícitas; no recargo universal |
| NAT-14 | Precio base sin mes e índice base PPI válido | No calcular USD verificado; T-008 sigue pendiente |
| NAT-15 | Worker-hours ≠ clock-hours en equipo | No duplicar horas/costo ni estimar jornada con suma de personas |
| NAT-16 | Drywall espesor/grade incompatibles, sustitución SKU | Bloquear equivalencia y pedir revisión de oficio |
| NAT-17 | Procedencia de RSMeans sin licencia/contrato de SEMSE | Mantener `RESTRICTED_PENDING_LEGAL` |
| NAT-18 | QCEW promedio semanal por industria sin horas por ocupación | Prohibir convertir a salario facturable del SOC |

**Todos son casos propuestos para futura implementación; ninguno ha pasado CI ni se ejecutó aquí.** Se requieren fixtures y oráculos independientes, revisión comercial/fiscal/legal por jurisdicción y autorización explícita antes de activación.

## 8. Adquisición reproducible de datos OEWS (sin importación efectuada)

- Descarga: [BLS tablas OEWS May 2025](https://www.bls.gov/oes/tables.htm) State XLSX y Metropolitan XLSX; fuente fechada, URL, checksum SHA-256, release, updatedAt, unit, formato y procedencia. URL de BLS para state ZIP: `https://www.bls.gov/oes/special-requests/oesm25st.zip`. **El archivo no pudo descargarse en esta sesión; no se copiaron filas ni se simularon tablas estatales.**
- Mapear `SOC × state × CBSA × statistic(mean, median, p25, p75)` de las tablas publicadas; conservar nulos/supresiones y no recalcular un promedio salarial a partir de agregados discordantes.
- QCEW es un insumo **independiente** para industria por NAICS/condado; no forzar `QCEW county wage = OEWS SOC wage`. Las definiciones de horas, fecha de referencia y cobertura son diferentes.
- El DOL/SAM.gov WD se adjunta a la **obra cubierta** (condado, tipo de proyecto, labor classification, modificación y fecha) y puede requerir revisión de la agencia contratante.
- Precio de compra verdaderamente local depende de SKU, proveedor, descuentos, cantidad, flete, impuestos, entrega y vigencia. El contrato de uso de un feed no se deduce de que su documentación sea pública.

## 9. Métricas y siguiente orden de ingeniería

1. `vendorQuoteCoverage`: líneas con quote compatible y autorizada / líneas comercialmente requeridas; denominador por estado/oficio/SKU, **no** número bruto de filas.
2. `taxPolicyCoverage`: escenarios de contrato revisados y firmados / escenarios reales de activación; 0 hasta dictamen.
3. `unitConversionPassRate`: conversiones tipadas verificadas / intentos, con abstenciones separadas.
4. `estimateVsActual`: MAE, sesgo y error por estado/oficio/tamaño contra costos **reales** conciliados, nunca escrow ni pagos liberados.
5. `laborMixError`: horas pagadas/trabajadas/productivas por rol, comparadas contra tiempos reales sin doble conteo.
6. `replayIntegrity`: coincidencia al centavo para propuestas aceptadas, aun con actualizaciones fiscales o precios.
7. `negativeGatePass`: pruebas de fuente restringida, precio vencido, licencia revocada, impuestos desconocidos, tenant ajeno, tipo de obra cubierto sin WD.

**Pilotos propuestos:** pintura + drywall en FL/GA para observaciones y conciliación; contraste jurídico separado en TX/CA/NY/WA/AZ, y después mercados/regiones adicionales. La cobertura de uso informativo puede abarcar 51/51 mucho antes de que exista autorización contractual fiscal por estado.

**Pendiente real:** obtener datos OEWS estatales y metro, cotizaciones de proveedor con derechos SaaS, registros conciliados, revisión fiscal por jurisdicción y dictamen de licencias. #1101 preserva snapshots BLS, pero no valida precios base PPI ni tasas comerciales. #1075 sigue `DRAFT`.


## 10. Benchmarks metropolitanos OEWS contrastados — investigación 2026-11-06

**Corte de fuente:** estimaciones OEWS **May 2025**, publicados en comunicados regionales BLS de 2026. La tabla muestra **salario medio horario del grupo amplio SOC 47-0000, Construction and extraction**, NO salarios detallados por oficio, NO costos patronales completos, NO tarifas de subcontratación ni precio de SEMSE.

| Área metropolitana | Grupo construcción/extracción USD/h media | Grupo instalación/mantenimiento/reparación USD/h media | Comunicado BLS de 2026 |
|---|---:|---:|---|
| Dallas–Fort Worth–Arlington, TX | 27.03 | 29.86 | [BLS Southwest, May 2025](https://www.bls.gov/regions/southwest/news-release/occupationalemploymentandwages_dallasfortworth.htm) |
| Miami–Fort Lauderdale–West Palm Beach, FL | 27.95 | 28.83 | [BLS Southeast, May 2025](https://www.bls.gov/regions/southeast/news-release/occupationalemploymentandwages_miami.htm) |
| Atlanta–Sandy Springs–Roswell, GA | 28.26 | 30.44 | [BLS Southeast, Jul-07-2026](https://www.bls.gov/regions/southeast/news-release/2026/occupationalemploymentandwages_atlanta_20260707.htm) |
| Los Ángeles–Long Beach–Anaheim, CA | 37.07 | 33.96 | [BLS West, Jul-09-2026](https://www.bls.gov/regions/west/news-release/2026/occupationalemploymentandwages_losangeles_20260709.htm) |
| Chicago–Naperville–Elgin, IL–IN | 40.87 | 31.89 | [BLS Midwest, May 2025](https://www.bls.gov/regions/midwest/news-release/occupationalemploymentandwages_chicago.htm) |
| Seattle–Tacoma–Bellevue, WA | 42.11 | 37.80 | [BLS West, Jun-30-2026](https://www.bls.gov/regions/west/news-release/occupationalemploymentandwages_seattle.htm) |
| **Estados Unidos (grupo SOC 47)** | **31.42** | **30.44** | BLS, tabla A repetida en los seis comunicados |

**Observación, no factor autorizado:** la diferencia Chicago vs Dallas o Seattle vs Atlanta puede reflejar composición del trabajo, acuerdos colectivos, tamaño de obra, diferencias de muestreo y mercados. Seattle/Dallas = 42.11/27.03 = 1.558 (= 55.8 % más), **pero no es un multiplicador de precio**. Tampoco se debe mezclar el grupo amplio de construcción con HVAC si el motor corresponde a otra familia SOC. CBSA de Chicago contiene IL e IN: la misma media no es política salarial o fiscal única de ambos estados.

### Archivos exactos identificados para el importador (NO descargados ni validados)

La [página oficial de tablas BLS](https://www.bls.gov/oes/tables.htm) indica **May 2025**, con enlaces a los siguientes ZIP; son **referencias de adquisición**, no prueba de que un importador ya funciona:
- **State XLSX:** [oesm25st.zip](https://www.bls.gov/oes/special-requests/oesm25st.zip).
- **Metropolitan/nonmetropolitan XLSX:** [oesm25ma.zip](https://www.bls.gov/oes/special-requests/oesm25ma.zip).
- **All data:** enlace XLSX/TXT desde la página BLS de May 2025. Evitar inventar la ruta sin comprobarla.
- **QCEW CSV:** [QCEW data slices](https://www.bls.gov/cew/additional-resources/open-data/csv-data-slices.htm), cuya clave es `area_fips × NAICS × year/quarter`, no `SOC`.
- **Meta de geografía:** [May 2025 state page fechada](https://www.bls.gov/oes/2025/may/oessrcst.htm). El alias `CURRENT` es mutable y no debe usarse como identidad de versión. El 2026-11-06, la página fechada y el alias `CURRENT` mostraban ambos May 2025 en su cabecera; una comprobación previa encontró una edición distinta. Por eso se valida el archivo, no se acepta la etiqueta de la URL como prueba.

**Regla de QA para ETL:** comprobar contenido XLSX después de descomprimir, SHA-256 del ZIP fuente, nombres de columnas y valores del release; mapear `AREA`/código ocupacional `OCC_CODE` y medidas `H_MEAN, H_MEDIAN, H_PCT25, H_PCT75` solamente si existen realmente en el archivo; celdas publicadas como `*`/`#`/not available deben quedar NULL. Preservar `AREA_TYPE, PRIM_STATE, NAICS` cuando corresponda y validar su significado frente al layout real. No dar 51/51 de cobertura para todos los SOC porque todos los estados estén presentes en un ZIP.

**Nueva batería propuesta (NO ejecutada):**
- `WAGE-NAT-01`: descargar ZIP mediante dominio y certificado esperados, registrar checksum y fecha, asegurar release May-2025.
- `WAGE-NAT-02`: parsear columnas efectivas y detectar schema drift, rechazar conversión silenciosa de `*` a cero.
- `WAGE-NAT-03`: comparar al menos seis grupos regionales de muestra con los comunicados anteriores; comparar solo la misma unidad, año y categoría.
- `WAGE-NAT-04`: exigir salario por SOC detallado específico del oficio antes de valorar trabajo; no usar automáticamente 47-0000 para pintor/electricista/HVAC.
- `WAGE-NAT-05`: un CBSA que cruza estado no determina jurisdicción fiscal ni reglas de workers' compensation.
- `WAGE-NAT-06`: fuente laboral insuficiente → `REFERENCE_ONLY`, nunca `COMMERCIAL_RATE_APPROVED`.
- `WAGE-NAT-07`: congelar release histórico y no recalcular un estimate aceptado con datos nuevos.
- `WAGE-NAT-08`: validar costos reales de la organización (horas y cargas) antes de calibrar el margen; estadísticas BLS no sustituyen contabilidad.

**Orden ejecutable recomendado:** primero descargar y validar un release estadual + uno metro, cruzarlos con los SOC ya enumerados de los 24 motores y medir `valid(state,trade,metro,period)` contra un denominador explícito; después comparar datos salariales por oficio/área con costos reales consentidos y correctamente clasificados. **No** promediar estos seis mercados, ni simular cobertura nacional de tarifas si todavía faltan datasets o contratos.
