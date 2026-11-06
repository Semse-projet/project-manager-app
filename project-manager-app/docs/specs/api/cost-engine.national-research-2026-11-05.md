# T-005 nacional v1 — contraste inter-estatal de precios y fiscalidad (NO aprobación)

**Fecha inicial de consulta:** 2026-11-05 · **Ampliación:** 2026-11-06. **Alcance:** 50 estados de EE. UU. + Washington DC, 24 motores de SEMSE; referencias federales y una primera muestra de normas fiscales estatales. **Estado:** `RESEARCH_ONLY / INCOMPLETE_51_STATE_VERIFICATION / DRAFT`. Ningún proveedor de precios autorizó extracción ni hubo revisión de CPA, Legal, o firma comercial.

Este documento amplía [el expediente inicial de precios](./cost-engine.t005-pricing-evidence-register.md), [el expediente Q10 FL/GA](./cost-engine.q10-fiscal-professional-review.md) y [la matriz Q11 de derechos](./cost-engine.q11-license-clearance.md). No sustituye `cost-engine.spec.md`. **No cambia importes del Cost Engine, ni variables, clientes, contratos ni producción.**

## 1. Descubrimiento de riesgo fiscal nacional: la tasa NO define taxability

**Fuentes oficiales de construcción inspeccionadas en esta fase** (solo diagnóstico, no política fiscal firmada):

| Jurisdicción | Regla o distinción material | Fuente primaria |
|---|---|---|
| Florida | Real property / contrato según precio global, cost-plus, guaranteed o T&M vs venta minorista + instalación; impuesto de compra puede recaer en contratista y no en cliente. Condado de entrega y surtax importan. | [FL DOR guía construcción](https://floridarevenue.com/Forms_library/gt800007.pdf) (PDF accesible R.03/15; NO presumir texto 2015 como validación integral 2026), [FL DOR sales/use y surtax](https://www.floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx) |
| Georgia | Contratista que mejora inmueble = consumidor de bienes incorporados; posibles diferencias de use-tax por lugar de compra y uso; contratar desde fuera activa registros/bond y, en supuestos específicos, retención legal distinta del sales tax. | [GA DOR FAQ](https://dor.georgia.gov/contractor-faqs), [ejemplos GA](https://dor.georgia.gov/sales-and-use-tax-contractors-examples) |
| Texas | Obra residencial/nueva y contrato `lump sum` vs `separated` cambian impuesto del material; **repair/remodel de propiedad no residencial puede gravar el precio total, incluida mano de obra**. No generalizar `no labor tax`. | [Texas Comptroller](https://comptroller.texas.gov/taxes/publications/94-116.php), [resolución 2026](https://star.comptroller.texas.gov/view/202602022H) |
| Washington | Contratista principal en `custom construction` para consumidor: impuesto retail puede gravar el **total**; subcontrato con permiso de reventa puede pasar a wholesale, y también existe B&O. | [WA DOR construcción](https://dor.wa.gov/education/industry-guides/construction/construction-tax-matrix) |
| Nueva York | Capital improvement versus repair/maintenance/installation determina si se cobra sales tax al cliente. Requiere evidencia de naturaleza y permanencia. | [NY Tax Department](https://www.tax.ny.gov/pubs_and_bulls/publications/sales/contractors.htm) |
| California | Distingue materials, fixtures y machinery, e `lump sum`, `time and materials` y `cost plus fee`; la base imponible de fixtures no sigue la del material ordinario. | [CDTFA guía oficial](https://cdtfa.ca.gov/industry/construction-contractors/industry-topics.htm) |
| Arizona | `prime contracting/modification` vs MRRA; la modalidad prime contracting TPT puede tener base del **65% de ingresos brutos** después de deducciones pertinentes; MRRA en general paga impuesto sobre materiales y no tax de contratación prime. | [AZ DOR guidelines](https://azdor.gov/transaction-privilege-tax/contracting-guidelines), [FAQ](https://azdor.gov/transaction-privilege-tax/contracting-guidelines/contracting-faqs) |
| South Dakota | Existe **contractor's excise tax 2% sobre gross receipts de prime contractors**, independiente de sales/use tax y sujeto a reglas propias. | [SD DOR contractor excise](https://dor.sd.gov/businesses/taxes/contractors-excise-tax/) |
| Nebraska | Existen opciones fiscales de contractor; la mano de obra de construcción se trata distinta del material y la factura separada importa. No inferir que **toda** obra grava material + labor. | [Nebraska DOR construction FAQ](https://revenue.nebraska.gov/about/frequently-asked-questions/nebraska-construction-contractors-faqs) |
| Colorado | Reglamentación state-administered y de impuestos locales sobre materiales de construcción depende de permiso de obra/uso, además de jurisdicciones locales. Investigar ciudades autónomas antes de emitir regla. | [Colorado DOR](https://tax.colorado.gov/sales-tax-guide) |
| Illinois | Regla general de contratista consumidor de materiales incorporados, con excepciones por certificados de exención y sectores elegibles; verificar tratamiento de mejoras y bienes específicos. | [IL DOR BMEC FAQ](https://tax.illinois.gov/businesses/incentives/exemptionfaqs.html) |
| Nuevo México | `Gross Receipts Tax` sobre actividad/servicios y deducciones `NTTC` condicionadas; no convertirlo en impuesto tradicional universal al material. | [NM Taxation & Revenue NTTC](https://www.tax.newmexico.gov/businesses/non-taxable-transaction-certificates-nttc/) |
| Pennsylvania | Contratistas y estructuras inmobiliarias; hay exención especial Building Machinery and Equipment para determinados proyectos/entidades elegibles, sin generalizar. | [PA Revenue BME](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/building-machinery-and-equipment) |
| Hawaii | El impuesto general de actividad es GET, no idéntico al sales tax. El portal GET fue revisado, pero NO se autorizó ninguna fórmula por contratista. | [HI DTax GET](https://tax.hawaii.gov/get/) |
| Massachusetts | El contratista en mejoras de inmueble generalmente paga impuesto al comprar materiales; venta/instalación de una unidad estándar de propiedad personal puede seguir otro régimen. Guía oficial DOR actualizada **7-may-2026**. | [Massachusetts DOR](https://www.mass.gov/guides/sales-and-use-tax) |
| Minnesota | Consumidor de materiales en contratos de mejora inmobiliaria; impuesto pagado al comprar o use tax, distinto de ventas retail. La retención/surety del contratista no residente se revisa por separado. | [Minnesota DOR](https://www.revenue.state.mn.us/guide/general-contractors-and-subcontractors-applies-all-contractor-types) |
| Carolina del Norte | Contratos de `capital improvement` exigen evidencia `E-589CI` y del impuesto pagado `E-589P`; compra de materiales gravada al contratista, frente a repair/maintenance/installation sujeto a otra clasificación. | [NCDOR contratos inmobiliarios](https://www.ncdor.gov/taxes-forms/sales-and-use-tax/real-property-contracts) |
| Nueva Jersey | Reemplazo/obra de capital y pintura inicial pueden ser `capital improvement` exento con formulario `ST-8`; **repintado y limpieza a presión** pueden ser servicios gravables. | [NJ DOR FAQ con casos](https://www.nj.gov/treasury/taxation/sales_use_tax_FAQ.shtml) |
| Wisconsin | Contratista como consumidor en instalación de inmueble paga impuesto de compra; cuando actúa como retailer de propiedad personal o servicio gravable se aplican reglas distintas. | [Wisconsin DOR](https://www.revenue.wi.gov/Pages/FAQS/pcs-topics.aspx) |
| Virginia | El art. 58.1-610 caracteriza al contratista de real estate como consumidor de materiales; el boletín `24-3` aclara un *safe harbor* acotado para impuesto indebidamente cobrado, NO una licencia para cobrarlo al cliente. | [Virginia Tax 24-3 (2024)](https://www.tax.virginia.gov/laws-rules-decisions/tax-bulletins/24-3) |
| Maryland | La guía DOR diferencia materiales incorporados, instalación de propiedad personal, alfombra de pared a pared y labor de fabricación. **Fuente informativa de fecha/version vigente por comprobar** antes de policy activa. | [Comptroller Business Tax Tip #18 (PDF)](https://www.marylandtaxes.gov/forms/Business_Tax_Tips/bustip18.pdf) |
| Kentucky | `103 KAR 26:070` distingue real property de equipo que queda personal property; sus materiales suelen gravarse a la compra del contratista aun en contratos distintos. **Confirmar texto normativo vigente** frente al PDF de archivo antes de cálculo fiscal. | [KY DOR regulación (PDF)](https://revenue.ky.gov/DOR%20Training%20Materials/103%20KAR%2026.070.%20Construction%20contractors.pdf) |

**Advertencia metodológica:** una fuente pública puede ser antigua o no cubrir todas las excepciones vigentes. El estado `PRIMERA_FUENTE_REVISADA` indica **solo** que se leyó una guía específica, **NO** que se revisó el estatuto completo, la tasa local, el tratamiento de marketplace ni que se aprobó usarla en producción. El resto de estados quedan sin fuente fiscal específica verificada en este trabajo. El [cuadro Tax Foundation, 1-jul-2026](https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/) sirve para control general de *tasas estatales y promedios locales*, nunca como oráculo de taxable base de una obra.

## 2. Registro de cobertura de las 51 jurisdicciones (NO implica certificación)

`UNDETERMINED` corresponde al **estado de salida requerido del nuevo motor** mientras no exista `TaxPolicy` aprobada por profesional competente. No es equivalente a `0.00` ni significa que el estado no tenga impuestos.

| Estado / DC | Evidencia de norma de construcción en esta fase | Enlace | Estado de `TaxPolicy` en diseño |
|---|---|---|---|
| AL | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| AK | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| AZ | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://azdor.gov/transaction-privilege-tax/contracting-guidelines) | **UNDETERMINED** |
| AR | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| CA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://cdtfa.ca.gov/industry/construction-contractors/industry-topics.htm) | **UNDETERMINED** |
| CO | PARCIAL_LOCAL | [fuente oficial](https://tax.colorado.gov/sales-tax-guide) | **UNDETERMINED** |
| CT | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| DE | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| FL | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://floridarevenue.com/Forms_library/gt800007.pdf) | **UNDETERMINED** |
| GA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://dor.georgia.gov/contractor-faqs) | **UNDETERMINED** |
| HI | PARCIAL_GENERAL | [fuente oficial](https://tax.hawaii.gov/get/) | **UNDETERMINED** |
| ID | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| IL | PARCIAL_CONSTRUCTOR | [fuente oficial](https://tax.illinois.gov/research/taxinformation/sales/rot/pio-101.html) | **UNDETERMINED** |
| IN | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| IA | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| KS | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| KY | PARCIAL_FUENTE_HISTORICA | [fuente oficial](https://revenue.ky.gov/DOR%20Training%20Materials/103%20KAR%2026.070.%20Construction%20contractors.pdf) | **UNDETERMINED** |
| LA | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| ME | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| MD | PARCIAL_FUENTE_HISTORICA | [fuente oficial](https://www.marylandtaxes.gov/forms/Business_Tax_Tips/bustip18.pdf) | **UNDETERMINED** |
| MA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.mass.gov/guides/sales-and-use-tax) | **UNDETERMINED** |
| MI | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| MN | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.revenue.state.mn.us/guide/general-contractors-and-subcontractors-applies-all-contractor-types) | **UNDETERMINED** |
| MS | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| MO | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| MT | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| NE | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://revenue.nebraska.gov/about/frequently-asked-questions/nebraska-construction-contractors-faqs) | **UNDETERMINED** |
| NV | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| NH | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| NJ | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.nj.gov/treasury/taxation/sales_use_tax_FAQ.shtml) | **UNDETERMINED** |
| NM | PARCIAL_GRT_NTTC | [fuente oficial](https://www.tax.newmexico.gov/businesses/non-taxable-transaction-certificates-nttc/) | **UNDETERMINED** |
| NY | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.tax.ny.gov/pubs_and_bulls/publications/sales/contractors.htm) | **UNDETERMINED** |
| NC | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.ncdor.gov/taxes-forms/sales-and-use-tax/real-property-contracts) | **UNDETERMINED** |
| ND | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| OH | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| OK | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| OR | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| PA | PARCIAL_CONSTRUCTOR | [fuente oficial](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/building-machinery-and-equipment) | **UNDETERMINED** |
| RI | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| SC | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| SD | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://dor.sd.gov/businesses/taxes/contractors-excise-tax/) | **UNDETERMINED** |
| TN | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| TX | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://comptroller.texas.gov/taxes/publications/94-116.php) | **UNDETERMINED** |
| UT | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| VT | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| VA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.tax.virginia.gov/laws-rules-decisions/tax-bulletins/24-3) | **UNDETERMINED** |
| WA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://dor.wa.gov/education/industry-guides/construction/construction-tax-matrix) | **UNDETERMINED** |
| WV | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| WI | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.revenue.wi.gov/Pages/FAQS/pcs-topics.aspx) | **UNDETERMINED** |
| WY | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |
| DC | PENDIENTE_DOR_ESTATAL | SIN FUENTE ESPECÍFICA DE CONSTRUCCIÓN REVISADA | **UNDETERMINED** |

**Conteo verificado por este registro:** 22/51 jurisdicciones con alguna fuente oficial identificada; 29/51 **sin** revisión específica de norma de construcción; **0/51 con sign-off fiscal real**. Las 22 fuentes identificadas no equivalen a 14 políticas completas.

## 3. Línea base salarial nacional verificable (NO tarifa de contratista)

Tabla BLS **OEWS May 2025**, publicada **15-may-2026**. Valores USD por hora publicados como **media** y **mediana**. La serie nacional es útil para *screening* de rangos, pero faltan los datos de estado/metro/percentil y costo pagado real por SEMSE. Fuente: [BLS ocupaciones y salarios May 2025, tabla 1](https://www.bls.gov/news.release/ocwage.htm).

| Ocupación | Media USD/h | Mediana USD/h | Uso en SEMSE |
|---|---:|---:|---|
| Pintores, construcción y mantenimiento | 26.64 | 23.75 | painting |
| Drywall y ceiling-tile installers | 30.58 | 28.33 | drywall (excluye los tapers especializados) |
| Electricistas | 34.37 | 30.38 | electrical |
| Plumbers / pipefitters / steamfitters | 34.70 | 30.67 | plumbing (no un único SOC para todas las tareas) |
| Carpinteros | 31.55 | 29.12 | carpentry/deck/framing |
| Techadores | 27.95 | 26.65 | roofing |
| Cement masons / concrete finishers | 28.87 | 27.41 | concrete |
| HVAC mechanics/installers | 31.14 | 29.33 | hvac |
| Construction laborers | 25.02 | 22.66 | general/labor |

En [BLS ECEC construcción junio de 2026](https://www.bls.gov/charts/employer-costs-for-employee-compensation/costs-by-industry.htm) el **total agregado oficial es $51.96/h**, mientras los componentes publicados son salario $36.13/h y beneficios $15.84/h (**su suma aritmética de componentes redondeados da $51.97/h**). La diferencia de $0.01 es efecto de redondeo; conservar el **total publicado y la precisión de origen**, no reconstruir el total de dos componentes ya redondeados. El cociente aproximado beneficios/salario es 43.8 %, pero **no** es un multiplicador obligatorio para cada SOC. **No** multiplicar automáticamente cada salario OEWS por 1.438: provienen de poblaciones/definiciones diferentes y todavía faltan seguro de obra, productividad real, tiempo no cobrable, transporte, herramienta, overhead, ingresos y riesgo.

Próxima adquisición pública verificable: tabla BLS [OEWS por estado/área](https://www.bls.gov/oes/CURRENT/oessrcst.htm) + mapeo `SOC × trade × state × CBSA × release`; **no hay en este documento 51×24 tarifas cobrables**.

## 4. Licencias y verificación de documento contradictorio

**RSMeans:** se inspeccionó visualmente el PDF oficial [RSMeans Online User Agreement](https://www.rsmeansonline.com/Content/RSMeansOnlineUserAgreement.pdf) (19 páginas), **página 13 de PDF (índice cero: 12)**: cierre de SaaS Terms, texto `Last Updated: March 16, 2026`. **Página 14 de PDF (índice cero: 13)**: Addendum 1 §2.2, que restringe fusionar datos de estimación en software, su almacenaje en base searchable y distribución sin autorización expresa. La fecha **May 1, 2025** atribuida a esta URL en una investigación previa NO corresponde al PDF revisado actualmente. Esto no prueba qué contrato firmó SEMSE ni el origen de los multiplicadores `STATIC_MATERIAL_MULTIPLIERS`.

**Alternativa comercial de licencia:** [Craftsman Construction Cost Data Licensing](https://craftsman-book.com/data-licensing) ofrece APIs y datasets para integradores; se debe solicitar contrato **OEM/SaaS multitenant** con derechos específicos de pricing-by-SKU, uso customer-facing, caché, derivados, revocación, export y conservación. **Oferta de licencia no es permiso ya obtenido.**

**BLS PPI:** índice de variación, no precio absoluto por SKU. El motor debe tener `observedPrice + observedDate + compatibleSeries + indexAtObservedDate + indexCurrent`, con `P_new = P_observed × I_new / I_observed` si los índices son compatibles, válidos y se permite ese ajuste; sin referencia original el dato es `LEGACY_UNVERIFIED`. [BLS guía PPI](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm).

## 5. Contrato nacional propuesto, sin activación

```typescript
type UsTaxAndPriceEvidence = {
  contractId: string;
  state: string; countyOrJurisdictionCode: string | null;
  workSiteAddressVerified: boolean;
  propertyClass: "REAL_PROPERTY" | "TANGIBLE_PERSONAL_PROPERTY" | "UNKNOWN";
  contractModel: "LUMP_SUM" | "COST_PLUS" | "TIME_AND_MATERIALS" | "RETAIL_PLUS_INSTALL" | "OTHER" | "UNKNOWN";
  projectClassification: "NEW_CONSTRUCTION" | "CAPITAL_IMPROVEMENT" | "REPAIR_MAINTENANCE" | "REMODELING" | "MRRA" | "MODIFICATION" | "UNKNOWN";
  contractorRole: "PRIME" | "SUB" | "OWNER_BUILDER" | "UNKNOWN";
  materialInputTax: { amount: string | null; alreadyPaid: boolean | null };
  customerSalesUseOrExciseTax: { taxType: "SALES" | "USE" | "GET" | "TPT" | "CONTRACTOR_EXCISE" | "NONE_REVIEWED" | "UNKNOWN"; amount: string | null };
  ownerOfMaterialAtPurchase: "CONTRACTOR" | "CUSTOMER" | "UNKNOWN";
  priceOrigin: "SIGNED_QUOTE" | "PAID_INVOICE" | "LICENSED_API" | "PUBLIC_INDEX_ONLY" | "LEGACY_UNVERIFIED" | "UNKNOWN";
  sourceVersionAndRightsRef: string | null;
  taxRuleVersionAndOfficialSource: string | null;
  humanTaxReviewerSignedRef: string | null;
  humanCommercialReviewerSignedRef: string | null;
  status: "PRELIMINARY_UNVERIFIED" | "SIGNED_POLICY_APPLICABLE";
};
```

**Criterios de aceptación para un futuro gate del #1075, no ejecutados**:
1. Al menos un precio observado con SKU, proveedor, unidad, región, fecha, impuestos/cargo de entrega, fuente y derecho de uso conforme a licencia; pruebas negativas de precios sin permiso.
2. `TaxPolicy` versionada para el estado específico **y** clasificación de contrato, impuestos cobrados por separado y tratamiento de entrada, con oráculos de un CPA; la regla debe cubrir prima/subcontrato y casos de repair vs capital/new.
3. Ningún estado puede activar `SIGNED_POLICY_APPLICABLE` solo porque el promedio estatal de sales tax sea conocido.
4. Ningún motor nuevo debe heredar `DEFAULT_TAX=0.07` ni comisión 5 % sin política económica aprobada, mientras el legado se conserva para diagnóstico.
5. Mostrar al cliente **subtotal preliminar** cuando haya cualquier campo `UNKNOWN` que afecte costo/impuesto; preservar replay y no reescribir contratos/escrow.
6. Validar por *state × county × trade × contractModel × permit* en vez de un solo rollout nacional. El sistema nacional puede tener `0/51` estados activados hasta validación sin invalidar la spec arquitectónica del motor.

### Fuera de alcance de esta investigación y aún bloqueado

- **Precios reales de proveedores:** no se recibieron facturas/quotes autorizadas ni derechos de catálogo retail nacional. No se obtuvieron ni se recrearon 51×24 precios por fórmula.
- **Contabilidad real de SEMSE:** no se consultaron cuentas personales/Finances, ni libros y costos reales reconciliados de SEMSE; márgenes comerciales no calibrados.
- **Firma legal/fiscal:** ningún profesional validó Q10/Q11; no cambiar `DRAFT → APPROVED` por disponer de guías oficiales.
- **Cobertura tributaria nacional exhaustiva:** solo primer contacto documental de 22 estados; faltan 29, y reglas locales/efectividad/contratos faltan aun en los 14.
