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

| Alabama | El contratista consumidor de materiales incorporados paga sales tax en compra o use tax; la regulación especial de ingresos de ciertos contratos públicos no es regla para obras residenciales. | [fuente oficial](https://www.revenue.alabama.gov/faqs/who-is-a-contractor/) |
| Alaska | Sin sales tax estatal general, pero pueden existir tributos de ciudades o boroughs; fuente general, sin clasificación de obras. | [fuente oficial](https://www.commerce.alaska.gov/web/dcra/localgovernmentresourcedesk/taxationassessment/salestax.aspx) |
| Delaware | Sin sales tax estatal/local general, pero impuestos sobre ingresos brutos del proveedor; no confundir con impuesto al cliente. | [fuente oficial](https://revenue.delaware.gov/business-tax-forms/doing-business-in-delaware/step-4-gross-receipts-taxes/) |
| Indiana | Sales Tax Bulletin #60 (mar-2024): la diferencia entre lump-sum y time-and-materials puede cambiar quién cobra impuesto sobre materiales. | [fuente oficial](https://www.in.gov/dor/files/sib60.pdf) |
| Michigan | RAB 2025-18 aprobado dic-2025 y actualizado sep-2026: contratista consumidor de material y no cobra sales tax directamente por la mejora real property; supuestos retail y exenciones distintos. | [fuente oficial](https://www.michigan.gov/taxes/rep-legal/rab/2025-revenue-administrative-bulletins/revenue-administrative-bulletin-2025-18) |
| Montana | Sin sales tax general, pero hay resort taxes locales para ciertas operaciones; fuente general no valida construcciones. | [fuente oficial](https://revenue.mt.gov/taxes/general-sales-tax) |
| New Hampshire | Sin sales tax general sobre bienes; pueden existir otras obligaciones empresariales; solo fuente general. | [fuente oficial](https://www.revenue.nh.gov/faq/does-new-hampshire-have-sales-tax) |
| Oregon | Sin sales/use tax transaccional general; el CAT de negocios no es sales tax sobre materiales; solo fuente general. | [fuente oficial](https://www.oregon.gov/dor/programs/businesses/Pages/Sales-Tax.aspx) |
| Utah | Publication 42 (rev. julio 2026) clasifica fixtures/materiales que pasan a real property vs venta e instalación de tangible personal property. | [fuente oficial](https://tax.utah.gov/forms-pubs/pub-42/) |

| Arkansas | 26 CAR §30-1003: contratista consumidor de materiales; distinguir servicios no gravables de mecánicos y ventas de mercancía; comprobar código estatal y local. | [fuente estatal oficial](https://codeofarrules.arkansas.gov/Rules/Rule?chapterID=33&levelType=section&partID=971&sectionID=63002&subChapterID=241&subPartID=9368&titleID=26) |
| Connecticut | DRS exige Sales/Use Tax Permit a contratistas incluso si su servicio no grava; remite a guía 2018(2), que debe contrastarse con reglas actuales. | [fuente estatal oficial](https://portal.ct.gov/DRS/Sales-Tax/Tax-Information) |
| Idaho | Contratista que incorpora material a inmueble paga impuesto, incluso en contratos gubernamentales; materiales proporcionados sin impuesto pueden generar use tax. | [fuente estatal oficial](https://tax.idaho.gov/taxes/sales-use/stguides-for-certain-groups-2/sales-tax-governments/contractors/) |
| Iowa | Guía distingue remodel/new construction (generalmente contratista paga compra) de reparaciones/instalaciones gravables al cliente; posible crédito por impuesto pagado al proveedor. | [fuente estatal oficial](https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/iowa-contractors-guide) |
| Kansas | Pub KS-1525 diferencia remodelación comercial: mano de obra potencialmente gravada frente a residencial y construcción original exenta de labor; material e impuestos locales siguen reglas. | [fuente estatal oficial](https://www.ksrevenue.gov/pub1525.html) |
| Louisiana | Boletín 25-023 (2025, aclaración de mayo 2026): exención de compras específicas de materiales/alquileres en ciertos proyectos públicos desde julio-2025 exige certificación R-85012/R-85014; **no** prueba general de obra privada. | [fuente estatal oficial](https://dam.ldr.la.gov/lawspolicies/RIB%2025-023%20Exemption%20for%20Contractors%20and%20Subcontractors%20of%20Public%20Projects.pdf) |
| Maine | Boletín 4 revisado dic-2025: contractor consumidor de materiales en mejora inmueble; transferencia de título antes de instalación/retailer puede cambiar obligación de sales tax. | [fuente estatal oficial](https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/IB04%20FINAL%20Contractors%20and%20Subcontractors_2025_12_22.pdf) |
| Mississippi | Obra no residencial de más de $10k sujeta a contractor's tax 3.5% sobre monto contrato, con MPC y pre-pago/bond según umbrales; viviendas y oficios tienen reglas diferentes. | [fuente estatal oficial](https://www.dor.ms.gov/business/sales-use-tax/guide-construction-contractors) |
| Missouri | Carta ruling 24-nov-2025: en adición inmobiliaria lump sum, contratista paga tax materiales y no debe repercutirlo como sales tax sobre contrato; **vinculante solo al contribuyente destinatario**, no norma universal. | [fuente estatal oficial](https://dor.mo.gov/rulings/show/8374) |
| Nevada | Contratista consumidor de materiales; se considera impuesto de compra o use tax, créditos por impuesto de otro estado y supuestos de venta retail/fabricación. | [fuente estatal oficial](https://tax.nv.gov/education/construction/) |
| North Dakota | Consumidor de materiales incorporados a real property, impuestos locales y créditos por compras interestatales; costos pueden transferirse como materiales pero no itemizarse como sales tax al cliente. | [fuente estatal oficial](https://www.tax.nd.gov/tax-responsibilities-contractors) |
| Ohio | El contratista consume material incorporado; alfombras instaladas y landscaping pueden ser venta de tangible personal property gravada en lugar de construcción. | [fuente estatal oficial](https://tax.ohio.gov/business/sales-and-use-tax/taxability) |
| Oklahoma | Contratista consume material; obra de mejora inmueble no grava factura de mano de obra/contrato; no residentes exigen registro propio y posibles bonds. | [fuente estatal oficial](https://oklahoma.gov/tax/helpcenter/businesses.html) |
| Rhode Island | Reglamento 280-RICR-20-70-54: contratista consumidor de material en contrato general, T&M con tope, cost-plus; excepciones al vender material por precio pactado o operar retailer. | [fuente estatal oficial](https://rules.sos.ri.gov/regulations/part/280-20-70-54) |
| South Carolina | Manual DOR septiembre 2025 (cubre legislatura hasta 2024): contratista consumidor de materiales; compra interestatal y crédito estatal/local, distinguir venta retail e instalación. | [fuente estatal oficial](https://dor.sc.gov/sites/dor/files/Documents/Policy%20Manuals/SC%20Sales%20Tax%20Manual.pdf) |
| Tennessee | SUT-21: contratista de mejoras inmobiliarias normalmente consumidor de materiales y servicios imponibles adquiridos; distinguir impuesto de compra de impuesto al cliente. | [fuente estatal oficial](https://revenue.support.tn.gov/hc/en-us/articles/360058171112-SUT-21-Sales-and-Use-Tax-for-Contractors-Overview) |
| Vermont | Contratista paga impuesto de compra de materiales incorporados y no normalmente factura sales tax; hay elección especial para retailer/manufacturer ocasional y tributos locales. | [fuente estatal oficial](https://tax.vermont.gov/business/industry/contractors) |
| West Virginia | TSD 310 rev julio-2024: capital improvement no grava trabajo al cliente; repair/maintenance que no califica puede gravar labor y material; **nueva exención escolar julio-2026** debe contrastarse. | [fuente estatal oficial](https://tax.wv.gov/Documents/TSD/tsd310.pdf) |
| Wyoming | En general contratista consumidor de materiales incorporados; no suele requerir permiso retail, pero el no residente o subs de fuera tienen obligaciones específicas. | [fuente estatal oficial](https://excise-tax-div.wyo.gov/general-administrative/excise-tax-faqs) |
| Washington DC | Fuente general DC sobre sales/use tax e importes; **no establece tratamiento de construcción**; requiere regla específica de obra y contratista antes de habilitar. | [fuente estatal oficial](https://cfo.dc.gov/page/tax-rates-and-revenues-sales-and-use-taxes-alcoholic-beverage-taxes-and-tobacco-taxes) |

**Advertencia metodológica:** una fuente pública puede ser antigua o no cubrir todas las excepciones vigentes. El estado `PRIMERA_FUENTE_REVISADA` indica **solo** que se leyó una guía específica, **NO** que se revisó el estatuto completo, la tasa local, el tratamiento de marketplace ni que se aprobó usarla en producción. El resto de estados quedan sin fuente fiscal específica verificada en este trabajo. El [cuadro Tax Foundation, 1-jul-2026](https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/) sirve para control general de *tasas estatales y promedios locales*, nunca como oráculo de taxable base de una obra.

## 2. Registro de cobertura de las 51 jurisdicciones (NO implica certificación)

`UNDETERMINED` corresponde al **estado de salida requerido del nuevo motor** mientras no exista `TaxPolicy` aprobada por profesional competente. No es equivalente a `0.00` ni significa que el estado no tenga impuestos.

| Estado / DC | Evidencia de norma de construcción en esta fase | Enlace | Estado de `TaxPolicy` en diseño |
|---|---|---|---|
| AL | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.revenue.alabama.gov/faqs/who-is-a-contractor/) | **UNDETERMINED** |
| AK | PARCIAL_GENERAL_LOCAL | [fuente oficial](https://www.commerce.alaska.gov/web/dcra/localgovernmentresourcedesk/taxationassessment/salestax.aspx) | **UNDETERMINED** |
| AZ | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://azdor.gov/transaction-privilege-tax/contracting-guidelines) | **UNDETERMINED** |
| AR | PRIMERA_FUENTE_NORMATIVA | [fuente oficial](https://codeofarrules.arkansas.gov/Rules/Rule?chapterID=33&levelType=section&partID=971&sectionID=63002&subChapterID=241&subPartID=9368&titleID=26) | **UNDETERMINED** |
| CA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://cdtfa.ca.gov/industry/construction-contractors/industry-topics.htm) | **UNDETERMINED** |
| CO | PARCIAL_LOCAL | [fuente oficial](https://tax.colorado.gov/sales-tax-guide) | **UNDETERMINED** |
| CT | PARCIAL_REGISTRO | [fuente oficial](https://portal.ct.gov/DRS/Sales-Tax/Tax-Information) | **UNDETERMINED** |
| DE | PARCIAL_GENERAL | [fuente oficial](https://revenue.delaware.gov/business-tax-forms/doing-business-in-delaware/step-4-gross-receipts-taxes/) | **UNDETERMINED** |
| FL | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://floridarevenue.com/Forms_library/gt800007.pdf) | **UNDETERMINED** |
| GA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://dor.georgia.gov/contractor-faqs) | **UNDETERMINED** |
| HI | PARCIAL_GENERAL | [fuente oficial](https://tax.hawaii.gov/get/) | **UNDETERMINED** |
| ID | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://tax.idaho.gov/taxes/sales-use/stguides-for-certain-groups-2/sales-tax-governments/contractors/) | **UNDETERMINED** |
| IL | PARCIAL_CONSTRUCTOR | [fuente oficial](https://tax.illinois.gov/research/taxinformation/sales/rot/pio-101.html) | **UNDETERMINED** |
| IN | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.in.gov/dor/files/sib60.pdf) | **UNDETERMINED** |
| IA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://revenue.iowa.gov/taxes/tax-guidance/sales-use-excise-tax/iowa-contractors-guide) | **UNDETERMINED** |
| KS | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.ksrevenue.gov/pub1525.html) | **UNDETERMINED** |
| KY | PARCIAL_FUENTE_HISTORICA | [fuente oficial](https://revenue.ky.gov/DOR%20Training%20Materials/103%20KAR%2026.070.%20Construction%20contractors.pdf) | **UNDETERMINED** |
| LA | PARCIAL_PROYECTO_PUBLICO | [fuente oficial](https://dam.ldr.la.gov/lawspolicies/RIB%2025-023%20Exemption%20for%20Contractors%20and%20Subcontractors%20of%20Public%20Projects.pdf) | **UNDETERMINED** |
| ME | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/IB04%20FINAL%20Contractors%20and%20Subcontractors_2025_12_22.pdf) | **UNDETERMINED** |
| MD | PARCIAL_FUENTE_HISTORICA | [fuente oficial](https://www.marylandtaxes.gov/forms/Business_Tax_Tips/bustip18.pdf) | **UNDETERMINED** |
| MA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.mass.gov/guides/sales-and-use-tax) | **UNDETERMINED** |
| MI | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.michigan.gov/taxes/rep-legal/rab/2025-revenue-administrative-bulletins/revenue-administrative-bulletin-2025-18) | **UNDETERMINED** |
| MN | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.revenue.state.mn.us/guide/general-contractors-and-subcontractors-applies-all-contractor-types) | **UNDETERMINED** |
| MS | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.dor.ms.gov/business/sales-use-tax/guide-construction-contractors) | **UNDETERMINED** |
| MO | PARCIAL_CARTA_CONTRIBUYENTE | [fuente oficial](https://dor.mo.gov/rulings/show/8374) | **UNDETERMINED** |
| MT | PARCIAL_GENERAL | [fuente oficial](https://revenue.mt.gov/taxes/general-sales-tax) | **UNDETERMINED** |
| NE | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://revenue.nebraska.gov/about/frequently-asked-questions/nebraska-construction-contractors-faqs) | **UNDETERMINED** |
| NV | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://tax.nv.gov/education/construction/) | **UNDETERMINED** |
| NH | PARCIAL_GENERAL | [fuente oficial](https://www.revenue.nh.gov/faq/does-new-hampshire-have-sales-tax) | **UNDETERMINED** |
| NJ | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.nj.gov/treasury/taxation/sales_use_tax_FAQ.shtml) | **UNDETERMINED** |
| NM | PARCIAL_GRT_NTTC | [fuente oficial](https://www.tax.newmexico.gov/businesses/non-taxable-transaction-certificates-nttc/) | **UNDETERMINED** |
| NY | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.tax.ny.gov/pubs_and_bulls/publications/sales/contractors.htm) | **UNDETERMINED** |
| NC | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.ncdor.gov/taxes-forms/sales-and-use-tax/real-property-contracts) | **UNDETERMINED** |
| ND | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.tax.nd.gov/tax-responsibilities-contractors) | **UNDETERMINED** |
| OH | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://tax.ohio.gov/business/sales-and-use-tax/taxability) | **UNDETERMINED** |
| OK | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://oklahoma.gov/tax/helpcenter/businesses.html) | **UNDETERMINED** |
| OR | PARCIAL_GENERAL | [fuente oficial](https://www.oregon.gov/dor/programs/businesses/Pages/Sales-Tax.aspx) | **UNDETERMINED** |
| PA | PARCIAL_CONSTRUCTOR | [fuente oficial](https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/sales-use-and-hotel-occupancy-tax/building-machinery-and-equipment) | **UNDETERMINED** |
| RI | PRIMERA_FUENTE_NORMATIVA | [fuente oficial](https://rules.sos.ri.gov/regulations/part/280-20-70-54) | **UNDETERMINED** |
| SC | PRIMERA_FUENTE_MANUAL_2025 | [fuente oficial](https://dor.sc.gov/sites/dor/files/Documents/Policy%20Manuals/SC%20Sales%20Tax%20Manual.pdf) | **UNDETERMINED** |
| SD | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://dor.sd.gov/businesses/taxes/contractors-excise-tax/) | **UNDETERMINED** |
| TN | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://revenue.support.tn.gov/hc/en-us/articles/360058171112-SUT-21-Sales-and-Use-Tax-for-Contractors-Overview) | **UNDETERMINED** |
| TX | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://comptroller.texas.gov/taxes/publications/94-116.php) | **UNDETERMINED** |
| UT | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://tax.utah.gov/forms-pubs/pub-42/) | **UNDETERMINED** |
| VT | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://tax.vermont.gov/business/industry/contractors) | **UNDETERMINED** |
| VA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.tax.virginia.gov/laws-rules-decisions/tax-bulletins/24-3) | **UNDETERMINED** |
| WA | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://dor.wa.gov/education/industry-guides/construction/construction-tax-matrix) | **UNDETERMINED** |
| WV | PRIMERA_FUENTE_REV_2024 | [fuente oficial](https://tax.wv.gov/Documents/TSD/tsd310.pdf) | **UNDETERMINED** |
| WI | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://www.revenue.wi.gov/Pages/FAQS/pcs-topics.aspx) | **UNDETERMINED** |
| WY | PRIMERA_FUENTE_REVISADA | [fuente oficial](https://excise-tax-div.wyo.gov/general-administrative/excise-tax-faqs) | **UNDETERMINED** |
| DC | PARCIAL_GENERAL | [fuente oficial](https://cfo.dc.gov/page/tax-rates-and-revenues-sales-and-use-taxes-alcoholic-beverage-taxes-and-tobacco-taxes) | **UNDETERMINED** |

**Cobertura inicial de fuentes estatales: 51/51 jurisdicciones (50 estados y DC) con al menos una referencia oficial, NO 51 políticas fiscales verificadas.** 0/51 tiene revisión firmada ni reglas tributarias plenamente certificadas para SEMSE. Algunas fichas son **solo fuentes generales o parciales**: AK, DE, MT, NH, OR, DC, CT, LA y MO, entre otras. El material de Missouri se refiere a una carta para un contribuyente, y el de Louisiana a ciertas exenciones de obra pública, no normas completas de obra privada. Aun en estados con guías específicas, faltan condados/distritos locales, fecha vigente, clase de contrato, rol prime/sub, marketplace, excepciones, tasas y oráculos de CPA. **Una fuente oficial enlazada no habilita el cobro ni constituye dictamen.**

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
- **Cobertura tributaria nacional exhaustiva:** 51/51 con una primera fuente estatal oficial identificada; siguen sin verificarse exhaustivamente los aspectos fiscales relevantes por oficio, localidad, tipo de contrato, rol, marketplace, exenciones y vigencia en **51/51**; 0 políticas firmadas o activables. Estados con solo fuentes generales siguen en investigación.
