# T-005p — Plan nacional de adquisición de cotizaciones y derechos de datos

**Fecha:** 2026-11-06 · **PR:** [#1075](https://github.com/Semse-projet/project-manager-app/pull/1075) · **Estado:** `RESEARCH_AND_ACQUISITION_PROTOCOL_READY / NO_QUOTES_RECEIVED / NO_LICENSES_GRANTED`.

**Objetivo:** pasar del [inventario de fuentes S01–S12](./cost-engine.t005-source-rights-inventory-2026-11-06.md) a un procedimiento verificable para obtener **precios observados** y **derechos de uso**, sin confundirlos. Aplica a las partidas económicas de 24 motores SEMSE y al objetivo de 50 estados + Washington D. C., sin afirmar cobertura por defecto. Este archivo **no** encarga compras, no contacta terceros, no abre cuentas, no extrae catálogos, no integra APIs ni modifica producción.

## 1. Descubrimiento de vías auténticas de cotización (fuentes oficiales revisadas 2026-11-06)

| Registro candidato | Producto / cobertura posible | Procedimiento que el proveedor ofrece públicamente | Qué todavía NO se ha demostrado | Enlace original |
|---|---|---|---|---|
| VND-01 — **The Home Depot Pro** | Materiales de múltiples oficios; cotizaciones para cesta por cuenta/tienda/entrega | En Pro Xtra se crea una *quote* desde carrito, lista o producto. El sitio señala **siete días** de precio bloqueado en esa modalidad. | La cotización es operación de compra del titular; **no** acredita API, extracción recurrente, redistribución ni SaaS multitenant. Verificar precio, localización, alcance, límites y contrato. | [Cómo crear una cotización](https://www.homedepot.com/c/create-a-quote), [Pro Xtra](https://www.homedepot.com/c/pro-xtra) |
| VND-02 — **Lowe's Pro** | Materiales generales, estimados de compra y descuentos de volumen | Cotización desde cuenta empresarial; la página indica vencimiento usual **siete días**, sujeto a términos, y descuentos elegibles de volumen para cotizaciones de **USD 2,000+**. | No hay permiso acreditado de integración programática ni sublicencia para los datos de SEMSE. La comparabilidad necesita misma cesta, fecha y destino. | [Online Order Quoting](https://www.lowes.com/l/Pro/resources-for-pros/online-order-quoting) |
| VND-03 — **84 Lumber** | Madera, techos, aislantes, ventanas/puertas y materiales de obra | Solicita lista de materiales con cantidades para generar **estimación escrita**; admite descripción y archivos de proyecto. | No se ha enviado ninguna solicitud; condiciones de precios, cobertura, vigencia y reutilización todavía desconocidas. No enviar planos/PII sin consentimiento. | [Request a Quote](https://www.84lumber.com/request-a-quote/general/) |
| VND-04 — **ABC Supply** | Cubiertas, revestimientos y suministros de construcción por sucursal | El proveedor indica contactar la **sucursal local** para precios y disponibilidad precisos. | Sin cotización recibida ni permiso para redistribuir su catálogo. Validar alcance por sucursal, transportes y derechos contractuales. | [Contacto y consultas de producto/precio](https://www.abcsupply.com/contact-us/) |
| VND-05 — **Sherwin-Williams PRO+** | Pinturas, primers y consumibles; precios según cuenta profesional | La app PRO+ permite consultar **precios específicos de la cuenta**, inventario, facturas y pedidos. | La cuenta y sus tarifas privadas no equivalen a feed nacional ni licencia multitenant; se requiere autorización del titular y del proveedor para el uso solicitado. | [PRO+ App](https://www.sherwin-williams.com/painting-contractors/pro-plus/pro-app) |
| VND-06 — **Craftsman Construction Cost Data** | Base comercial de estimación; datos de referencia de múltiples oficios y modificadores geográficos | La página de licencias anuncia **National Estimator API**, sandbox y muestras bajo consulta; no es una orden de materiales ni cotización SKU de distribuidor. | **Candidato a contrato OEM/API**, no proveedor actualmente licenciado a SEMSE. Contrato, tarifas, límites, caché, derivados, visibilidad e integración SaaS requieren negociación/Legal. | [Licencias de datos y APIs](https://craftsman-book.com/data-licensing), [guía API](https://intercom.help/craftsman/en/articles/9791025-getting-started-national-estimator-cloud-nec-api) |

**Diferencia fundamental:** VND-01–05 son **canales de solicitud de presupuesto/compra de materiales**, no licencias de datos. VND-06 es **vía posible de licencia de dataset/API**, pero no representa una cotización de compra vinculante. Una tienda puede dar un precio válido para que el comprador lo use en su propio presupuesto y aun así restringir la ingestión programática o comercialización del catálogo. **No tratar precio mostrado públicamente como concesión de derechos SaaS.**

## 2. Dos carriles de obtención, con decisiones independientes

### Carril A — Precio de compra verificable (por obra, cesta, región y fecha)

1. Derivar de cada motor su `MaterialRequirement` normalizado: operación, materialKey, SKU o equivalencia técnica, grado, dimensión, unidad, cantidad y condición de suministro.
2. Preparar una cesta **equivalente** para empresas que sí suministran el mismo producto (no comparar precios de pintura con subcontrato de aplicación). Registrar fecha/hora, región de entrega, ofertas y cantidades idénticas.
3. Obtener, **mediante cuenta de titular autorizado o solicitud aprobada**, una cotización escrita o documento de compra con identificación del vendedor, productos, unidades, precio, volumen, impuestos de compra, flete, disponibilidad, plazos y expiración.
4. Guardar evidencia **privada**, hash, consentimiento y permisos. No emitir RFQ, subir planos ni revelar información de clientes a un tercero sin consentimiento y política de seguridad previamente autorizados.
5. Evaluar `rightsForPrivateJobEstimate` separado de `rightsForSaaSSharedCatalog`. Una cotización privada puede validar costo para una obra concreta, pero no aportar datos a otros tenants.
6. Revisar con un especialista por oficio la equivalencia y la normalización dimensional (roll vs sq, board-ft vs sqft, gal vs cobertura, etc.). Repetir por mercado cuando la evidencia lo justifique; no multiplicar un único precio nacional por 51 jurisdicciones.

### Carril B — Licencia de datos para uso SaaS (API, dataset, almacenamiento y derivados)

1. Identificar persona jurídica del proveedor y la entidad licenciataria de SEMSE; verificar términos aplicables al producto exacto.
2. Solicitar **propuesta escrita**, ejemplo de contrato, muestra/sandbox y **matriz de derechos negociables**: acceso API, importación, almacenamiento, caché, procesamiento, creación de derivados, exhibición en cotizaciones, marketplace multitenant, exportación, auditoría/replay histórico, duración, terminación y revocación.
3. Solicitar modelo de precios (suscripción, consulta, asientos, usuarios, territorio) y condiciones de seguridad, límites de API, disponibilidad, actualización, continuidad/versionado y eliminación después de cancelación.
4. Someter documentos a **Legal** y análisis de compatibilidad técnica/comercial. `APPROVED_LICENSE` requiere contrato realmente firmado, versión, alcance, firmantes y registro protegido, no página publicitaria.
5. Mantener `CONTRACT_UNKNOWN`/`RESTRICTED` para fuentes cuya licencia no puede probarse. No integrar datasets propietarias ni extrapolar derechos de cuentas personales.

## 3. Estructuras de registro propuestas (documentales, no Prisma)

### `VendorCandidate` (por compañía y canal)

```yaml
vendorId: VND-01
supplierLegalEntity: PENDING_CONFIRMATION
channel: PRIVATE_JOB_QUOTE | PRO_ACCOUNT | OEM_DATA_LICENSE
tradeCoverage: [REVIEW_REQUIRED]
serviceTerritories: UNVERIFIED_BY_BRANCH_OR_CONTRACT
quoteMechanism: DOCUMENTED_PUBLICLY
contactPermission: NOT_GRANTED
contactStatus: NOT_CONTACTED
apiPermission: UNKNOWN
saaSMultiTenantRights: UNKNOWN
termsVersion: PENDING
reviewer: UNASSIGNED
```

### `QuoteEvidence` (por SKU, cantidad, área y momento)

```yaml
quoteId: REQUIRED
supplierLegalEntity: REQUIRED
sourceDocumentPrivateRef: REQUIRED
skuAndManufacturer: REQUIRED
materialSpecAndGrade: REQUIRED
quantity: REQUIRED_DECIMAL
quotedUnit: REQUIRED
normalizedUnit: REQUIRED_WITH_VERSIONED_CONVERSION
currency: USD
unitPricePretax: REQUIRED_DECIMAL
lineExtensionPretax: REQUIRED_DECIMAL
freightAndHandling: DECIMAL_OR_EXPLICIT_UNKNOWN
taxAlreadyIncluded: TRUE_FALSE_UNKNOWN
deliveryArea: STATE_COUNTY_ZIP_OR_ADDRESS_VERIFIED
validFrom: REQUIRED_TIMESTAMP
validThrough: TIMESTAMP_OR_EXPLICIT_UNKNOWN
availabilityAndLeadTime: KNOWN_OR_UNKNOWN
priceVisibilityScope: PRIVATE_JOB | ORG_ONLY | SAAS_ALLOWED
permissionGrantRef: REQUIRED_FOR_SAAS_ALLOWED
sourceHash: REQUIRED
technicalReviewer: PENDING
legalReviewer: PENDING_IF_SAAS
status: COLLECTED_NOT_APPROVED
```

### `LicenseReview` (por fuente y producto, separado de precio)

```yaml
licenseId: REQUIRED
providerLegalEntity: REQUIRED
semseLegalEntity: PENDING_CONFIRMATION
contractRef: PRIVATE_DOCUMENT_OR_NULL
productAndDatasetScope: REQUIRED
permittedUseCase: INTERNAL | CUSTOMER_ESTIMATE | MULTITENANT_SAAS | MARKETPLACE
storeRaw: TRUE_FALSE_UNKNOWN
cache: TRUE_FALSE_UNKNOWN
derivedPricing: TRUE_FALSE_UNKNOWN
redistributeAndExpose: TRUE_FALSE_UNKNOWN
auditReplayRetention: TRUE_FALSE_UNKNOWN
terminationDeletion: PENDING
effectiveFrom: DATE_OR_NULL
expiresAt: DATE_OR_NULL
revocationProcess: PENDING
counselReviewerAndOpinionRef: PENDING
status: PROSPECT | REVIEW_REQUIRED | RESTRICTED | APPROVED
```

El registro puede almacenarse como plantilla revisable sin crear tablas hasta aprobación arquitectónica. **No mezclar** `QuoteEvidence`, `LicenseReview` ni `TaxPolicy`: un precio perfectamente válido como oferta de compra no demuestra automáticamente derecho de redistribución ni corrección fiscal.

## 4. Política de elegibilidad para #1075

| Evidencia y derecho | Uso de SEMSE propuesto | Estado |
|---|---|---|
| BLS PPI/OEWS oficial, edición y atribución documentadas | Índice de cambio / benchmark salarial, nunca precio unitario USD | `INDEX_ONLY` / `BENCHMARK_ONLY` |
| Precio de tienda visto en web, sin cotización ni condiciones | Descubrimiento preliminar; no poblar tabla de precios comercial | `PUBLIC_LISTING_UNVERIFIED` |
| Oferta emitida a un contratista y consentida, sin derecho multitenant | Estimación privada de esa obra, sujeta a política del titular y revisión; no catálogo compartido | `PRIVATE_SCOPE_REVIEW` |
| Precio de catálogo bajo contrato OEM con rights aprobados, SKU/fecha/área | Candidato a observación comercial para usos exactos concedidos; requiere fiscalidad y QA aparte | `LICENSED_SOURCE_REVIEWED` |
| Dato expirado/revocado/sin derechos | No usar en nuevas cotizaciones comerciales; historia restringida según política de conservación | `EXPIRED` / `REVOKED` / `RESTRICTED` |

**Fail-closed:** El motor seguirá `PRELIMINARY` cuando falten cotización adecuada, derechos aplicables, evidencia de labor o `TaxPolicy`. Evitar `tax=0` por defecto. No dar confianza calibrada a un score de origen no contrastado.

## 5. Entregables antes de cerrar precios y licencias para los 24 motores

- [x] Canales de cotización y candidato OEM identificados en fuentes originales.
- [x] Plantillas de candidatos, cotización y licencia separadas.
- [ ] Listado de **cada** partida de materiales y horas de los 24 motores; equivalencia SKU/categoría, precio fuente, unidad, operación, región y fecha.
- [ ] Obtener cotizaciones/facturas o feeds **que realmente concedan uso**; auditar la cobertura segmentada `trade × material × metro/county × scope × time`. No prometer 51/51 por identificar una red nacional.
- [ ] Due diligence de contratos de proveedor y examen independiente de RSMeans/multiplicadores heredados.
- [ ] Contrato OEM/API de ejemplo, precio económico para SEMSE y dictamen sobre los derechos que realmente obtendría; si no es viable, conservar `NO_LICENSE` y explorar alternativas.
- [ ] Validar comparabilidad, mano de obra cargada y rendimientos; firma comercial independiente; verificación fiscal profesional por jurisdicción/contrato antes de uso facturable.
- [ ] Pruebas negativas para precio vencido/revocado, cotización privada cruzada entre tenants, términos restrictivos, SKU incompatible y monto faltante.

**Estado terminal de esta tarea documental:** preparado **plan de adquisición**, no adquisición efectuada; **cero cotizaciones o licencias nuevas** atribuidas a SEMSE por esta investigación. No se debe enviar contacto ni usar cuentas comerciales del usuario sin nueva acción autorizada. #1075 sigue `DRAFT`, #1101 separado.
