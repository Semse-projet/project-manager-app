# Q10 — Expediente para revisión fiscal profesional: construcción Florida y Georgia

**Fecha de preparación:** 2026-11-05  
**Estado:** `DESIGN_RESEARCH_READY / TAX_PROFESSIONAL_NOT_ASSIGNED / NO_ACTIVE_TAX_POLICY`  
**Ámbito:** sales/use tax sobre materiales y facturación de obras de construcción (no asesoría sobre income tax, 1099, clasificación W-2/1099, impuesto corporativo, ni remisión de declaraciones). **No se ha contratado ni recibido dictamen de contador/CPA.**

## 1. Base oficial comprobada y límites

| Estado | Fuente primaria | Hecho aplicable a clasificación | Límite / pendiente |
|---|---|---|---|
| **FL** | [Florida DOR — GT-800007 R.03/15, pp.1–3](https://floridarevenue.com/Forms_library/gt800007.pdf) | En mejora de inmueble: `lump sum`, `cost-plus/fixed fee`, `guaranteed` y `time-and-materials` hacen generalmente al contratista consumidor de materiales, sin sales tax cobrado al dueño por ese contrato. La modalidad `retail sale plus installation` depende de materiales especificados/preciados y traspaso de título/riesgo; la instalación de propiedad personal tangible puede recibir otro tratamiento. | **La edición PDF accesible dice R.03/15 (2015)**. Una nota anterior citó **R.08/22** en URL `/Forms_library/current/gt800007.pdf`, pero esa URL no se pudo recuperar en esta revisión. Confirmar versión vigente y excepciones con DOR/CPA antes de policy productiva. |
| **FL** | [Florida DOR Sales and Use Tax (página actual)](https://www.floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx) | Tasa estatal general, surtax discrecional por condado, jurisdicción de entrega, posibles límites por partida y método de redondeo. También distingue la obligación del marketplace provider por ventas minoristas gravadas. | No trasladar una tasa general a todo importe de construcción. Resolver condado, destino, producto, exención, fecha, surtax, precios tax-inclusive y condiciones específicas; **sin tasa hardcoded**. |
| **GA** | [GA DOR Contractor FAQs](https://dor.georgia.gov/contractor-faqs) y [Tax Guide for Contractors](https://dor.georgia.gov/tax-guide-contractors) | Contratista de mejora inmobiliaria es consumidor de bienes incorporados; requiere cuenta/registro para sales/use tax según DOR; obligaciones para no residentes según tipo y cuantía de contrato. La mano de obra de reparación/instalación separada de una **venta de bienes** se trata bajo reglas distintas de una obra inmobiliaria. | No inferir que todo trabajo tiene impuesto de venta a cliente igual a cero, ni que todos los contratistas están exentos de registrar. |
| **GA** | [GA DOR Sales and Use Tax for Contractors Examples](https://dor.georgia.gov/sales-and-use-tax-contractors-examples) | Si no se pagó sales tax de compra puede devengarse use tax; una diferencia de tasas entre compra y lugar de uso puede provocar impuesto adicional; créditos entre jurisdicciones tienen reglas y límites propios. | Los ejemplos de tasas 6 % y 8 % son **ejemplos explicativos**, no la tasa en vigor para un condado; deducciones/créditos requieren comprobantes. |

**Regla de fuente:** páginas de DOR oficiales son evidencia metodológica, no sustituyen un dictamen de taxability del producto de SEMSE o la decisión sobre una transacción concreta. Registrar fecha de consulta y versiones aplicables.

## 2. Campos que el intake debe capturar antes de decidir impuesto

```yaml
TaxReviewInput:
  dateOfSupplyOrTaxEvent: YYYY-MM-DD
  jobCountry: US
  jobState: FL_OR_GA
  jobCounty: REQUIRED_OFFICIAL_GEOCODE_OR_UNKNOWN
  deliveryOrUseLocation: REQUIRED_OR_UNKNOWN
  entityThatContracts: REQUIRED_ENTITY_ID
  entityThatBillsCustomer: REQUIRED_ENTITY_ID
  propertyClassification: REAL_PROPERTY_IMPROVEMENT | FIXTURE | TANGIBLE_PERSONAL_PROPERTY | SERVICE | UNKNOWN
  contractPricingModel: LUMP_SUM | COST_PLUS | GUARANTEED | TIME_AND_MATERIALS | RETAIL_PLUS_INSTALL | OTHER | UNKNOWN
  materialOwnerAndRiskTransfer: CONTRACTOR | CUSTOMER | UNKNOWN
  separateMaterialItemizationBeforeWork: TRUE_FALSE_UNKNOWN
  supplierInvoiceTax: PAID | NOT_PAID | UNKNOWN
  supplierInvoiceTaxEvidenceRef: RESTRICTED_DOCUMENT_REF_OR_NULL
  supplierPurchaseLocation: REQUIRED_OR_UNKNOWN
  contractorRegistrationOrNonresidentStatus: ASSESSED_BY_PROFESSIONAL_OR_UNKNOWN
  customerExemptionEvidence: VALIDATED_REFERENCE_OR_NULL
  serviceTypeAndFixtureDetermination: REQUIRED_OR_UNKNOWN
  materialTaxableBase: DECIMAL_OR_NULL
  laborTaxableBase: DECIMAL_OR_NULL
  markupTaxableBase: DECIMAL_OR_NULL
  marketplaceFeeTaxTreatment: SEPARATELY_REVIEWED_OR_UNKNOWN
  policyId: REVIEWED_VERSION_OR_NULL
  reviewedBy: NAMED_EXTERNAL_TAX_PROFESSIONAL_OR_NULL
```

**Salida fail-closed por defecto (diseño, no implementada):**
- `taxStatus=UNDETERMINED`; `customerSalesTax.amount=null`; `contractorInputUseTax.amount=null` cuando faltan elementos; mostrar **subtotal preliminar** y advertencia. `null` NO equivale a `0` y la app no muestra `tax included`.
- Si la obligación de impuesto de compra del contratista aparece en la factura y ya está en `materialCost`, no se agrega una segunda vez como tax sobre subtotal ni se duplica en margen. El costo de uso devengado no pagado debe tratarse según método y revisión del CPA.
- `customerSalesTax.status=NOT_COLLECTED_UNDER_REVIEWED_POLICY` solo con política fiscal vigente **firmada** por estado/contrato/clasificación y evidencia de condiciones; un código genérico por estado no basta.
- La comisión de SEMSE/marketplace no se presume gravable o exenta por herencia de materiales; estudiar entidad y servicio/factura del facilitador **por separado**.
- Fallos de jurisdicción, compras, clasificación, `effectiveDate`, derechos de exención o fuente ⇒ `REVIEW_REQUIRED`; no mostrar total contractual.

## 3. Matriz para que un CPA/asesor fiscal emita oráculos independientes

| Caso | Jurisdicción y contrato sintético | Factores que debe revisar el especialista | Resultado esperado hasta contar con firma |
|---|---|---|---|
| FL-01 | FL real property / lump sum, materiales con sales tax ya pagado | consumidor final, impuesto incluido una sola vez en costo, quién factura | `UNDETERMINED` |
| FL-02 | FL real property / cost-plus o guaranteed price | tratamiento de reembolso de materiales y fee, documentación contractual | `UNDETERMINED` |
| FL-03 | FL real property / time-and-materials | contrato completo frente a venta por piezas, coste y desglose | `UNDETERMINED` |
| FL-04 | FL retail sale plus installation con materiales detallados antes de obra y transferencia de título/riesgo al comprador | base gravable de los materiales, surtax del condado de entrega, instalación | `UNDETERMINED` |
| FL-05 | FL fixture que se incorpora a inmueble vs artículo que permanece tangible personal property | naturaleza del bien, fijación, permisos, base de transacción | `UNDETERMINED` |
| FL-06 | FL material comprado fuera del estado o compra para entidad exenta | use tax, surtax condal, exención directa y soportes obligatorios | `UNDETERMINED` |
| GA-01 | GA real property / materiales con sales tax de compra ya pagado | consumidor de materiales, lugar de uso, crédito y registro | `UNDETERMINED` |
| GA-02 | GA real property / materiales sin sales tax pagado | devengo use tax y quien lo declara | `UNDETERMINED` |
| GA-03 | GA compra en jurisdicción y uso en otra | crédito por impuesto estatal/local realmente pagado, diferencias, evidencia | `UNDETERMINED` |
| GA-04 | GA retail reparación e instalación en factura de bienes separada | tratamiento de venta de propiedad personal, mano de obra detallada y fabricación | `UNDETERMINED` |
| GA-05 | GA contratista no residente y contrato potencialmente sujeto a registro, bond o retención | residencia empresarial, cuantía contractual, requisitos de registro/bond y posible withholding **distinto de sales/use tax** | `REVIEW_REQUIRED` |
| X-01 | FL o GA; se desconoce condado, tipo de inmueble, datos de impuestos o fecha | ninguna inferencia ni tasa por defecto; valores `null` | **`UNDETERMINED` (contrato de software)** |
| X-02 | cambio de tasa, política, jurisdicción o contrato luego de aceptación | replay de costo/impuestos por versión anterior, inmutabilidad y nueva revisión | **no mutar contrato/escrow** |
| X-03 | una parte trae impuesto de compra incluido y otra no; material/labor/overhead/fee separados | evitar doble imposición y cálculo universal sobre subtotal | **sin regla monetaria hasta firma** |
| X-04 | proveedor de marketplace cobra comisión/servicio distinto del contratista | sujeto pasivo, transacción facilitada vs servicio de SEMSE, obligaciones de marketplace facilitator | `REVIEW_REQUIRED` |

**El CPA debe completar por cada escenario:** dictamen de clasificación; `contractorInputSalesUseTax`, `customerSalesTax`, bases por componente, exclusiones, lugar y fecha de vigencia, tasas y reglas de redondeo, fuente de DOR/estatuto/regla vinculada, ejemplos numéricos independientes, supuestos y excepciones. Los oráculos **no** se generan tomando como base el cálculo actual de SEMSE.

## 4. Modelo de documento de aprobación profesional

```yaml
FiscalReviewReceipt:
  status: PENDING # nunca aprobado por plantilla
  reviewerFullName: null
  firmAndProfessionalCredentials: null
  jurisdictionCompetence: [FL, GA] # ajustar a alcance realmente autorizado
  signedAt: null
  versionOfTaxMatrixReviewed: null
  explicitScopeAndExcludedTransactions: null
  legalCitationsAndEffectiveDates: []
  approvedPolicyIdsAndVersions: []
  reviewedCasesWithExpectedValues: []
  reviewOfMarketFacilitatorObligations: null
  disclaimerAndExceptions: null
  signedEvidenceReference: null
  ownerFinalApprovalReference: null
```

**Condiciones para elevar Q10:**
1. Profesional competente para cada jurisdicción emite dictamen **escrito, fechado y firmado**; se conserva referencia de documento y versión de la matriz revisada.
2. Para cada caso autorizado, existen fixtures independientes (bases/tasas/resultado correcto) revisados y verificados; reglas por componente, redondeo y county/delivery.
3. Los casos no cubiertos quedan `UNDETERMINED`, sin cobro ni total fiscal automático; expiración o revocación de la `TaxPolicy` desactiva emisión automática.
4. Revisión de marketplace, comisiones y tratamiento especial de equipos/fixtures/personal property; ningún 7 % genérico en el contrato nuevo.
5. No se confunden sales/use tax de materiales, impuesto sobre ingresos o withholding de contratistas no residentes; estos últimos requieren expedientes separados.

## 5. Corrección de referencias anteriores

El PR #1075 anteriormente calificó como edición «GT-800007 R.08/22» un PDF enlazado a `/Forms_library/current/gt800007.pdf`. Esa URL no respondió en la revisión de 2026-11-05. El PDF oficial **recuperable y visualmente inspeccionado** fue [GT-800007 R.03/15](https://floridarevenue.com/Forms_library/gt800007.pdf). **No se descarta que exista una edición posterior**, pero no se la da por verificada en este expediente. Para práctica fiscal vigente se debe contrastar el [portal actual del DOR](https://www.floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx), reglas vigentes y el dictamen profesional antes de establecer `effectiveFrom`.

**No hay tasas fiscales adoptadas, facturas reales examinadas ni profesional externo asignado.** Este documento es un paquete de revisión y no cambia los servicios productivos.
