# T-005 nacional — escenarios fiscales adversariales y control de calidad de datos

**Fecha:** 2026-11-06. **Estado:** INVESTIGACION_DOCUMENTAL / NO APROBADO / SIN TAXPOLICY ACTIVAS. **PR:** #1075 (DRAFT).

Complementa los documentos nacionales existentes de 51 jurisdicciones, el mapeo SOC de 24 motores y el plan de cotizaciones. No cambia cálculos productivos. Los casos representan reglas descritas por fuentes oficiales, pero NO dictámenes profesionales vigentes para una transacción concreta.

## 1. Escenarios fiscales donde un mismo oficio puede recibir tratamientos diferentes

| ID | Jurisdicción / distinción | Dato que debe exigirse al intake | Fuente primaria |
|---|---|---|---|
| N19 | NC: pintura como capital improvement frente a pintura incidental a reparación | propósito de la operación, alcance, E-589CI o soporte equivalente | [NCDOR real-property contracts](https://www.ncdor.gov/taxes-forms/sales-and-use-tax/real-property-contracts) |
| N20 | NC: reconstrucción y reparación/maintenance/installation dentro de un mismo contrato | clasificación fiscal por partida y evidencia de transacción mixta | [NCDOR RMIS](https://www.ncdor.gov/taxes-forms/sales-and-use-tax/taxable-items/repair-maintenance-and-installation-services-and-other-repair-information) |
| N21 | NJ: reparar parte de techo frente a reemplazo completo | partial repair vs capital improvement, certificado ST-8 | [NJ FAQ de recuperación de desastre](https://www.nj.gov/treasury/taxation/sales_use_tax_FAQ.shtml), [ST-8](https://www.nj.gov/treasury/taxation/pdf/other_forms/sales/st8.pdf) |
| N22 | NJ: extracción de agua, mantenimiento y reconstrucción posterior | clasificar mitigación y reconstrucción en líneas distintas | [NJ FAQ](https://www.nj.gov/treasury/taxation/sales_use_tax_FAQ.shtml) |
| N23 | OH: colocación de alfombra frente a elementos que pasan a inmueble | clase de producto instalado, no solo oficio flooring | [Ohio DOR taxability](https://tax.ohio.gov/business/sales-and-use-tax/taxability) |
| N24 | WI: remodelación e instalación de equipamiento comercial en factura mixta | asignación razonable materiales, labor, overhead por segmento | [WI Publication 207](https://www.revenue.wi.gov/DOR%20Publications/pb207.pdf); documento original 1/19, consultar modificaciones posteriores |
| N25 | MN: obra para entidad pública con/sin poder de agente de compras | contrato de agencia firmado, transferencia de título y riesgo | [Minnesota DOR contractors](https://www.revenue.state.mn.us/guide/general-contractors-and-subcontractors-applies-all-contractor-types), [compras públicas](https://www.revenue.state.mn.us/guide/purchases) |
| N26 | VA: compra de materiales fuera del estado y uso en obra dentro de VA | lugar de compra/uso, factura e impuesto previo verificable | [Virginia Tax contractor determination](https://www.tax.virginia.gov/laws-rules-decisions/rulings-tax-commissioner/10-4) |
| N27 | SC: materiales comprados fuera, posible impuesto de uso y crédito | referencia de tributo externo efectivamente pagado | [South Carolina DOR Sales & Use Tax Manual, cap. 16](https://dor.sc.gov/sites/dor/files/Documents/Policy%20Manuals/SC%20Sales%20Tax%20Manual.pdf) |
| N28 | MA: instalación de una unidad estándar frente a mejora de inmueble | si el producto sigue siendo tangible personal property | [Massachusetts DOR Sales and Use Tax](https://www.mass.gov/guides/sales-and-use-tax) |
| N29 | NH: estado sin impuesto general de venta, pero trabajo fuera de NH | ubicación de suministro/uso y tipo de impuesto aplicable, no solo dirección del proveedor | [NH DRA](https://www.revenue.nh.gov/faq/does-new-hampshire-have-sales-tax) |
| N30 | DC: aumento general a 7 % pospuesto y 6 % hasta 30-sep-2027 | fecha efectiva de norma y tipo de venta/servicio | [DC OTR aviso](https://otr.cfo.dc.gov/alert/otr-alert-0) |
| N31 | WA: custom construction prime frente a subcontrato wholesale | rol de contratista, reseller permit, B&O y lugar de consumo | [Washington DOR matriz](https://dor.wa.gov/education/industry-guides/construction/construction-tax-matrix) |

**Estado de los 13 casos:** PROPUESTOS, SIN PRUEBA EJECUTADA, SIN ORACULO MONETARIO INDEPENDIENTE y SIN CPA FIRMANTE. No incrementar con estos datos el conteo de estados aprobados. Variaciones por county/municipio, tipos de impuesto, fecha efectiva y contratos federales requieren revisión profesional.

## 2. Contrato fiscal adicional

Una factura puede incluir al mismo tiempo NEW_CONSTRUCTION, CAPITAL_REPLACEMENT, REPAIR_MAINTENANCE, REMEDIATION y RETAIL_PRODUCT_INSTALLATION. No inferir taxability del nombre del motor ni del porcentaje estatal.

Campos por partida: lineId, trade, siteAddress y countyFIPS verificables, autoridad fiscal local, contractorRole PRIME/SUB/UNKNOWN, scopeKind, propertyClass, contractModel, ownershipTransfer, evidenceRef (E-589CI, ST-8, reseller permit o equivalente si aplica), purchaseTaxPaidEvidence, contractorInputTax (estado e importe decimal o null), customerTransactionTax (estado e importe decimal o null), ruleId, effectiveFrom, effectiveTo, sourceUrl y reviewerSignedRef.

Bloqueos: null NO es cero; sin tax policy vigente y firmada, salida UNDETERMINED y PRELIMINARY_ONLY; si el cambio de alcance contiene líneas de diferentes tratamientos, la regla de la obra principal no se hereda automáticamente. No aplicar impuesto universal sobre materials + labor + profit + SEMSE fee. No modificar contratos aceptados: crear nueva revisión y conservar replay.

## 3. Contrato de importación reproducible de referencias públicas

El crosswalk SOC por motor está documentado en cost-engine.national-labor-geo-tax-operating-model-2026-11-06.md; este apéndice establece los datos que deben poder auditarse antes de usar fuentes públicas:

| Dataset | Claves mínimas y uso | Lo que NO debe representar |
|---|---|---|
| [BLS OEWS May 2025](https://www.bls.gov/oes/tables.htm) | release, estado/CBSA, SOC, hourly mean/median/percentiles, estado de supresión | tarifa facturable, costo total de cuadrilla |
| [BLS county↔metro](https://www.bls.gov/OES/current/county_links.htm) | release, county y CBSA; reconocer CBSA multiestado | autoridad fiscal local precisa |
| [BLS QCEW](https://www.bls.gov/cew/overview.htm) | NAICS, county, trimestre, empleo y salarios agregados | salario individual por SOC |
| [SAM.gov wage determinations](https://sam.gov/wage-determinations) | WD ID, modificación, county, construcción, clasificación, base wage y fringe | mínimo aplicable a cualquier trabajo privado |
| [Census BPS](https://www.census.gov/construction/bps/index.html) | estado/condado/CBSA, fecha, permisos de vivienda | precio retail, costo unitario, margen |
| [DOT bid tabs / FHWA](https://www.ecfr.gov/current/title-23/section-635.115) | contrato, fecha, localización, alcance y precio de trabajo instalado | precio de un saco de cemento, madera o una placa |

**Manifest obligatorio por lote:** provider, sourceOriginalUrl, releaseVersion, downloadedAtUTC, rawSha256, schemaVersion, rowCount, validCount, suppressedCount, rejectedCountByReason, geoCoverage, socCoverage, notice/rightsRef, qualityReviewer y status RESEARCH_ONLY/IMPORTED_NOT_APPROVED/APPROVED_REFERENCE.

**Validaciones técnicas exigibles (no implementadas):**
- Preservar supresiones BLS como NULL, nunca transformarlas a 0; distinguir missing vs not applicable vs not released.
- No unir releases diferentes sin un puente de versiones; SOC/NAICS pueden cambiar y CBSA puede cruzar estados.
- No derivar salario de un oficio dividiendo pagos QCEW entre 40 horas; no convertir ECEC en multiplicador fijo del salario OEWS.
- No usar resultados de licitaciones DOT como precio retail de materiales; incorporan trabajo instalado, equipo, riesgo y ganancia.
- No mezclar precio observado y datos de una cuenta privada con un catálogo SaaS multitenant sin permiso específico.
- Usar Decimal para cantidades monetarias, unidad validada, timestamp y edición de la fuente; reproducir sin red externa con snapshot autorizado.
- Registrar solo la cobertura de las celdas efectivamente disponibles. El nombre de un estado en el mapa NO significa tener datos salariales utilizables para cada SOC.

## 4. Nueva batería de aceptación propuesta (ninguna ejecutada)

TAX-NAT-19..31 cubre los 13 casos de la primera tabla. Requiere fixture legal firmado con tasa y taxableBase explícitos antes de test de producción. Si falta, la prueba debe exigir UNDETERMINED y prohibir emitir total contractual automático.

DAT-NAT-01: archivo OEWS de release oficial; DAT-NAT-02: supresiones; DAT-NAT-03: cambio de SOC/release; DAT-NAT-04: CBSA multiestado; DAT-NAT-05: Davis-Bacon solo en contrato cubierto; DAT-NAT-06: hash y trazabilidad; DAT-NAT-07: licencia de proveedor no concedida; DAT-NAT-08: bid tab no es material retail; DAT-NAT-09: dirección/jurisdicción desconocida; DAT-NAT-10: norma fiscal futura pospuesta.

## 5. Decisión de producto para una plataforma nacional

Habilitar SEMSE en modo **informativo** en los 51 territorios fiscales aunque la cotización comercial automática no esté aprobada. Para activar **COMMERCIAL_QUOTE_ALLOWED** deben superarse simultáneamente: (a) lista de materiales/horas tipada y revisada por oficio; (b) precio y términos de proveedor comprobados para SKU, volumen, localidad y fecha; (c) licencia de almacenamiento, derivados, exposición SaaS y privacidad; (d) evidencia laboral/producción y calibración; (e) TaxPolicy revisada por estado, localidad, tipo de transacción y rol; (f) replay y pruebas negativas.

Los estados sin cualquiera de estas condiciones siguen PRELIMINARY_ONLY; un reconocimiento nacional de localidades **no** se convierte en aprobación fiscal nacional. No fusionar ni activar cambios productivos por documentación o CI exitoso solamente. #1075 y #1101 permanecen separados.
