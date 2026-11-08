---
type: checklist
feature: "Motor de costos unificado"
spec: "docs/specs/api/cost-engine.spec.md"
version: "2.0"
date: "2026-10-30"
---

# Checklist: Motor de costos unificado

## Requisitos

- [x] Cada escenario P1–P5 es verificable
- [x] Scope y no-objetivos evitan ambigüedad
- [ ] Q2, Q3, Q5, Q7, Q9, Q10 y Q11 resueltas; Q1, Q4, Q6 y Q8 confirmadas (bloquea `APPROVED`)
- [ ] Alineada con ADR-027
- [ ] API/UI contracts no se contradicen (revisar tras Q1, Q4 y Q6)

## Contrato de reproducibilidad (evidencia #1076)

- [x] T-004 documenta 72/72 cálculos reproducibles con argumentos instrumentados, y diferencia la aritmética de la corrección comercial
- [x] La spec prohíbe inferir tasas y `perUnitDivisor` de importes redondeados (42/72 exactos por ese método, 57/66 divisores distintos)
- [ ] El contrato interno define `costs.basis`, `effectiveRates`, `perUnitDivisor`, unidad, precisión, redondeo, ausencia de `perUnit` y filtrado de privacidad
- [ ] Existe un plan de golden tests independientes para 24 motores × 3 escenarios, con valores esperados revisados por separado del ejecutor
- [ ] La implementación aditiva reproduce 72/72 sin instrumentación, con 0 centavos de diferencia, y preserva 66/66 divisores reales y el JSON antiguo (**gate posterior a aprobación de spec**)
- [ ] Casos de sobreescritura por capas, invalidación, extremos, fallo y cotización/contrato/escrow inmutable definidos y probados según su fase
- [ ] Los defectos de unidad [#1085](https://github.com/Semse-projet/project-manager-app/issues/1085) y de cuadrillas [#1086](https://github.com/Semse-projet/project-manager-app/issues/1086) tienen pruebas independientes y no bloquean el diagnóstico T-004 (sí la activación de los flujos afectados)

- [ ] Overrides no predeterminados regeneran `priceBands`, explicaciones, programación de hitos y financiación desde el costo recalculado; un adaptador incompleto rechaza el override, sin totales divergentes
- [ ] El `costReplay` histórico persiste inputs normalizados, versiones, operandos/precios congelados, regla fiscal, redondeo y revisión inmutable; replay después de cambiar precios/mapeos reproduce todos los importes al centavo
- [ ] Casos de modificación concurrente `PUT`/`DELETE` validan `expectedVersion`/`If-Match` con 409 y precondición faltante con 428

## Expedientes de aceptación T-005 (datos, licencias y fiscalidad)

- [x] **Inventario técnico inicial**: 12 claves de `BLS_SERIES` más 24/24 motores por oficio auditados por modo de fuente y componentes fiscales. 22 declaran 7 %/5 % y 2 los heredan del módulo central; 9 usan `priceOf` con respaldo. Todos los importes siguen `UNVERIFIED`. [Registro de adquisiciones](./cost-engine.t005-pricing-evidence-register.md).
- [x] **Contrato nacional de datos**: [contrato nacional de datos y gates](./cost-engine.national-data-contract-2026-11-06.md): 24 oficios ↔ SOC candidatos, geocodificación y límites de jurisdicción, salarios obligatorios vs benchmarks, licencia/observaciones, margen y 16 casos negativos documentados (sin implementación).
- [ ] **Datos laborales nacionales descargados y comprobados**: OEWS 2025 por estado/metro/SOC; revisar supresiones, clasificación de trabajadores y carga real, sin rellenar con nacional/proxy.
- [ ] **Gates de seguridad/seguro/permiso**: definir obligaciones por ubicación y actividad (Davis–Bacon en obras cubiertas, EPA RRP en inmuebles aplicables, licencias profesionales locales, OSHA); revisión humana y fixtures de rechazo.
- [x] **T-005 crosswalk nacional por oficio**: [contrato de fuentes y adquisición con 24 motores → candidatos SOC](./cost-engine.us-data-ingestion-and-24-trade-crosswalk-2026-11-06.md). Incluye OEWS/ECEC, salarios de obras públicas Davis-Bacon como cumplimiento condicional, bases geográficas FIPS/CBSA separadas de jurisdicción fiscal, casos negativos, datos autorizados y control de redondeo ECEC ($51.96 publicado frente a $51.97 suma de componentes). Es **propuesta de ingestión**, no dataset cargado ni precio validado.
- [x] **T-005 cobertura nacional inicial**: [investigación nacional 51 jurisdicciones](./cost-engine.national-research-2026-11-05.md): 50 estados + DC indexados; **51/51 con al menos una referencia fiscal estatal oficial inicial**, incluidos varios portales generales o excepciones particulares que **NO validan** la doctrina completa de construcción; **0/51 políticas fiscales firmadas**. Falta verificación jurídico-fiscal por tipo de contrato, oficio, prime/sub, condado/distrito, fechas, exenciones, marketplace y base imponible. Incluye muestras BLS OEWS/ECEC y revisión visual del acuerdo público RSMeans de 16-mar-2026. Esto **NO** certifica costo de mercado ni taxability por estado.
- [x] **Contrato nacional de datos/evidencia redactado**: [T-005 fuente versionada, labor burden, licencias, resolvedor fiscal y gates 51 estados](./cost-engine.national-data-contract-v1-2026-11-06.md). Los requisitos de despliegue segmentado y fail-closed están especificados, **no implementados ni aprobados**.
- [ ] **ETL de labor y geografía**: captura reproducible de OEWS edición congelada por SOC/estado/metro, QCEW y wage determinations aplicables, con cobertura e intervalos; no convertir su estadística en tarifa de venta.
- [ ] **TaxPolicy nacional**: completar fuentes y clasificaciones, no solo rates, con análisis de municipios autónomos/condado/distrito, CPA local, fixture, time-and-materials y contratista principal/subcontrato; 0/51 firmadas.
- [x] **Matriz de licencias**: BLS para índice/estadística, RSMeans/Gordian `RESTRICTED_PENDING_LEGAL`, cotizaciones privadas `RIGHTS_UNKNOWN` hasta contrato. [Expediente Q11](./cost-engine.q11-license-clearance.md).
- [x] **Paquete fiscal de revisión**: matrices FL/GA con casos específicos, fuentes DOR y `UNDETERMINED` mientras no exista dictamen. [Expediente Q10](./cost-engine.q10-fiscal-professional-review.md).
- [x] **Correcciones de referencias**: PDF público RSMeans Online verificado visualmente como March 16, 2026 (la atribución a mayo 2025 era errónea); PDF accesible FL GT-800007 R.03/15 y guía actual de DOR (no declarar R.08/22 comprobada).
- [ ] **Datos comerciales verdaderos**: permisos, facturas/cotizaciones fechadas y comparables de proveedores para pilotos pintura y drywall; origen, SKU, unidad, condado, precio sin impuesto, flete, tax-paid, vigencia y responsable que revisó.
- [ ] **Dictamen de licencias**: asesor jurídico externo valida derechos efectivos de proveedor y origen de la tabla de multiplicadores atribuida a RSMeans; certifica o rechaza uso multi-tenant/SaaS por fuente y el tratamiento del histórico.
- [ ] **Dictamen fiscal**: profesional cualificado en FL/GA revisa versión normativa, clasificación de tipos de contrato, redondeo, surtax, sales/use tax, tratamiento de comisiones e impuestos de compras pagados; firma los casos y oráculos numéricos independientes.
- [ ] **Aprobación comercial**: margen, overhead, labor burden, tarifas y comisión por oficio/región y contrato sustentados por costos reales conciliados y finanzas.
- [ ] **Puerta de seguridad**: cualquier nueva cotización con precio `UNKNOWN`, `RESTRICTED` o sin clasificación fiscal vigente queda `PRELIMINARY_ONLY`; pruebas negativas y replay en staging, sin reescribir contratos/escrow.

## Validación comercial independiente

- [x] **Alternativas de DISEÑO seleccionadas:** [política comercial y fiscal 2026-11-05](./cost-engine.commercial-fiscal-policy-2026-11-05.md) (Q9/Q10/Q11 + Q2/Q3/Q5/Q7). Esta casilla no certifica precios ni impuestos.
- [ ] **Q9** pilotos pintura interior/drywall: rangos/medidas tipadas, `UNKNOWN` honesto y tablas aprobadas por especialista (sin dar total definitivo con entradas faltantes).
- [ ] **Q11** ninguna fuente `LEGACY_UNVERIFIED`/`RESTRICTED_LICENSE` pasa a cotización comercial; auditar multiplicadores atribuidos a RSMeans, permiso SaaS, SKU/precio observado y fecha; PPI es índice, OEWS es salario, ninguno precio unitario facturable.
- [ ] **Q10 clasificación obligatoria:** propertyTreatment, contractPricing, lugar/condado, dueño de materiales, título/riesgo, tax-paid y `TaxPolicy` fechada; no usar 7 % general, nunca cobrar al cliente impuestos de materiales ya incluidos en costo.
- [ ] **Q10 fail-closed:** sin política revisada, `taxStatus=UNDETERMINED`, `customerTaxAmount=null` (no cero), subtotal preliminar con advertencia; no total `tax included`.
- [ ] **Q10 casos fiscales profesionales:** 10 escenarios FL/GA firmados por CPA/asesor competente, incluyendo real property vs retail + instalación, use-tax, condados/surtax/redondeo, con bases e importes esperados.
- [ ] **Q2/Q3:** ninguna confianza `HIGH` por completar preguntas; defaults de márgenes/comisión `LEGACY_UNVERIFIED` sin evidencia de mercado, muestras o aprobación financiera.
- [ ] **Q5/Q7:** borradores `STALE` con motivo y regeneración explícita; modo sombra → pilotos → canary por gates evidenciados, sin recálculo de aceptados.

- [ ] T-005 respalda materiales, mano de obra facturable, rendimientos, multiplicadores, márgenes y vigencia de fuentes con validación por oficio/región
- [ ] Q9 revisada por especialistas, Q10 revisada por profesional fiscal y Q11 acredita procedencia, fecha y derechos de uso de precios
- [ ] La aceptación matemática no se usa para certificar precios ni legalidad fiscal; aprobación de spec, implementación y activación tienen gates distintos

- [ ] Una política fiscal que grava solo materiales aplica tasa y base por componente, excluye labor, overhead, ganancia y comisión cuando así lo dispone; comprobar fixture sintético USD 191 vs aplicación global indebida USD 196.10

## Seguridad

- [ ] Permisos por capa se validan en backend
- [ ] `platformFeeRate` y `TaxPolicy` no se pueden escribir desde capas inferiores
- [ ] Doble control: solicitante distinto del aprobador, reautenticación reciente, aprobación ligada a valores y versión
- [ ] `pricing:org:manage` exige `Membership` activa de esa organización
- [ ] Contratista y organización no leen ni escriben datos de otros tenants u organizaciones
- [ ] Los márgenes del contratista no se exponen al cliente (prueba negativa sobre el JSON)
- [ ] Límites, motivo ≥ 10 caracteres y auditoría en todo cambio
- [ ] No hay secretos ni PII en logs/evidencia

- [ ] Auditoría Q2/Q0: con `min_cell=5`, claves de contrato con 1–4 casos no se emiten; valores inválidos del umbral no devuelven datos; SQL y EXPLAIN validados en DB aislada, sin divulgar resultados

## Datos y eventos

- [ ] Migración aditiva y reproducible (fase 3)
- [ ] Rollback definido: apagar flags y borrar filas
- [ ] Sin eventos de dominio nuevos; `AuditLog` con before/after
- [ ] Los estimados guardados no cambian al leerse

## Evidencia y dinero

- [ ] Cambios de comisión e impuesto no alteran contratos, hitos ni escrow existentes
- [ ] Aprobación reforzada para parámetros con impacto en pagos
- [ ] El recalculo externo reproduce cada uno de los 24 motores y conserva sus márgenes propios (tests golden)
- [ ] `quote-engine` y `contractor-estimate` coinciden con el servicio
- [ ] Sin 7 % universal: política fiscal versionada y revisada
- [ ] Metodología PPI corregida (índice de la fecha del precio base)
- [ ] Costo interno, precio de venta y obligación de pago separados; estimados aceptados inmutables

## Entrega

- [ ] Tests, build, typecheck y lint pasan
- [ ] CI, merge, deploy y activación tienen evidencia separada
- [ ] Modo sombra con informe revisado antes de activar
- [ ] El healthcheck no sustituye el smoke funcional en Chrome
- [ ] `production_evidence` no contiene secretos

## Documentación

- [ ] Spec index regenerado (`pnpm spec:index`)
- [ ] API surface actualizada con `/v1/pricing/cost-parameters`
- [ ] ADR de las decisiones clave
- [ ] Investigación externa y decisiones registradas

## Extensión híbrida H1–H5 — requisitos de diseño sin activar

- [x] [Anexo H1–H5](./cost-engine.hybrid-market-execution-design-2026-11-06.md) documentado con propuesta de contratos, fases y 14 casos de aceptación; **no se han ejecutado las pruebas**.
- [ ] Licencia efectiva, derechos SaaS, consentimiento RFQ, control de conectores, revocación y aislamiento entre organizaciones validados antes de consultar/comercializar fuentes.
- [ ] La comparación distingue material, servicio, salario, costo interno y oferta; unidades, alcance, entrega, impuestos y exclusiones normalizados con abstención si no son comparables.
- [ ] `evidenceTrustScore` y `projectFitScore` por separado; gates legales/fiscales/seguridad no reemplazables por una puntuación, pesos sin calibrar no aprobados.
- [ ] Ejecución propia, subcontratada y mixta sin doble contabilidad; decisiones comerciales, contratación, escrow y precios aceptados protegidos por aprobación y replay.
- [ ] Aprendizaje solo con costos reales reconciliados, segregación temporal, evaluación independiente, auditoría y propuesta reversible; sin cambios autónomos a márgenes/fees/TaxPolicy.
- [ ] Piloto con oficio/área/proveedores consentidos, pruebas offline + staging + sombra, rollback y autorizaciones fiscal/legal/comercial antes de activación.

## Límite de alcance de #1075 ahora — fase documental DRAFT (6-nov-2026)

**Sí comprende en este PR (documentación, no software operando):**
- [x] Definir contratos de cálculo, `costTrace`, reproducción de tasas efectivas y divisores, cobertura nacional y estatus `PRELIMINARY`.
- [x] Registrar investigación y matrices de evidencia para precios por SKU, salarios, licencias y clasificación fiscal (sin certificarlos).
- [x] Documentar [H1–H5](./cost-engine.hybrid-market-execution-design-2026-11-06.md): mercado híbrido, comparador, evaluación dual, escenarios propia/subcontrata/mixta y aprendizaje supervisado.
- [x] Anotar pruebas **propuestas** (incluidas H-01 a H-14), responsables, dependencias, fases posteriores y gates de aprobación.

**No comprende ni autoriza ahora:**
- [x] Ningún cambio de código de producto, endpoint, esquema Prisma, migración, secretos, datos de producción, servicio nuevo, Railway, feature flag activado ni merge por CI documental.
- [x] Ninguna conexión real a proveedores, scraping/crawling, compra de bases de datos, RFQ enviado, reutilización SaaS/multitenant de catálogos o datos de otro tenant sin contratos y consentimiento.
- [x] Ningún cambio automático de materiales, salarios, márgenes, fee SEMSE, impuestos, importes de ofertas aceptadas, contratos, hitos, escrow o pagos.
- [x] No se atribuye a #1075 el código de protección PPI de [#1101](https://github.com/Semse-projet/project-manager-app/pull/1101), ni sus resultados CI; son PR independientes.

**Pendiente para aprobar la spec y activar fases posteriores:**
- [ ] Evidencia de cotizaciones y costos reales autorizados; revisión técnica de cantidad, rendimientos, unidades y datos por oficio/área.
- [ ] Dictamen jurídico de licencias y tratamiento de datos; derechos comerciales explícitos por fuente, privacidad, seguridad y consentimiento para cotizar a terceros.
- [ ] Revisión fiscal profesional y `TaxPolicy` versionada por jurisdicción/clase de trabajo/contrato; no sustituir `UNDETERMINED` por 0 % o 7 % fijo.
- [ ] Aprobación comercial de componentes y márgenes, evaluación estadística de ponderaciones, pruebas independientes de aceptación, revisión de seguridad y autorización separada de implementación/despliegue.

**Regla de gobernanza:** spec aprobada ≠ código implementado ≠ PR fusionado ≠ producción activa ≠ precios y fiscalidad certificados. Los 24 motores y los 51 territorios son objetivo arquitectónico, no cobertura comercial validada. Mantener `status: DRAFT`, `code_status: NOT_STARTED` y `activation_status: INACTIVE` hasta evidencia y aprobaciones pertinentes.

## Repaso de evidencia T-005 — 6-nov-2026

- [x] [Conciliación de investigación, fuentes y bloqueos P-01–P-07](./cost-engine.t005-repaso-verificacion-2026-11-06.md) documentada: índice PPI ≠ precio SKU; OEWS ≠ tarifa facturable; proveedor de datos con API ≠ licencia otorgada; alcance fiscal nacional ≠ 51 políticas firmadas.
- [ ] Adjuntar precios reales comparables, derechos SaaS, validación de horas/cargas/márgenes, CPA/Legal y resultados de pruebas piloto antes de cerrar los gates; la conciliación documental no los marca completados.

## Auditoría inicial de fuentes existentes — 6-nov-2026

- [x] [Registro de fuentes S01–S12 y 12 valores P01–P12](./cost-engine.t005-source-rights-inventory-2026-11-06.md) revisado contra los servicios de pricing, ProTools, el contrato económico central y el inventario previo de 24 motores. **No implica derechos comerciales aprobados ni precios reales verificados.**
- [x] Se clasificaron por separado: BLS público sujeto a términos, base de precios BLS no verificada, RSMeans de procedencia sin probar/restringido si procede, multiplicadores estáticos, tarifas privadas del contratista, constantes por oficio y futuros proveedores con licencia todavía no contratada.
- [ ] Acreditar la procedencia de multiplicadores RSMeans/valores de código y completar linaje **por cada partida** económica de los 24 motores.
- [ ] Obtener permisos específicos de reutilización SaaS/derivados/caché/visibilidad y precios de proveedor con SKU/unidad/fecha/ubicación antes de marcar filas comerciales como aprobadas.
- [ ] Realizar T-008c en modo solo lectura cuando se autorice; #1101 no debe sustituir la comprobación del snapshot actual.

## Modelo operativo nacional SOC/geo (6-nov-2026)

- [x] **Grupo `47-3010` excluido de OEWS detallado**: el [SOC 2018 oficial](https://www.bls.gov/soc/2018/major_groups.htm) clasifica `47-3010` como **broad**. Se quitó del candidato `labor` usado en cobertura referencial y quedó registrado en la [matriz de conciliación](./cost-engine.t005-soc-crosswalk-reconciliation-2026-11-07.md); no se aprobaron ayudantes por oficio ni nuevas tarifas. Test sintético asociado, pendiente de CI del HEAD.


- [x] **Brecha SOC detectada y documentada**: [conciliación de los dos crosswalks y script OEWS](./cost-engine.t005-soc-crosswalk-reconciliation-2026-11-07.md): 14/24 discrepancias, 10/24 coincidencias de borradores, 0/24 oficios aprobados; no se ha elegido arbitrariamente una clasificación final.
- [ ] **T-005x — cerrar mapeo con revisor de oficio**: clasificación detallada y roles, fuente BLS versionada, horas por tarea sin doble conteo y casos negativos. La documentación no equivale a aprobación de salarios, rentabilidad o activación.


- [x] [Crosswalk de 24 motores hacia códigos SOC y modelo nacional de geografía](./cost-engine.national-labor-geo-tax-operating-model-2026-11-06.md) documentados; hipótesis por tarea y jurisdicción, **no valores salariales comerciales aprobados**.
- [x] Fuentes públicas clasificadas: BLS OEWS (SOC/state/CBSA), QCEW (NAICS/county), ECEC (beneficios industriales), Davis-Bacon (mínimos de obra cubierta por contrato), FHWA (ítems de trabajo instalado), Census Geocoder (condado); ninguna usada como sustituto de cotización con licencia SaaS.
- [x] 18 criterios de aceptación **especificados** (NAT-01..NAT-18) para privacidad, salarios, fiscalidad local, licencias, materiales, subcontratas, concurrencia de worker-hours, replay e impuestos; **no marcados como pruebas ejecutadas**.
- [ ] Descargar OEWS May 2025 por estado/área y comprobar checksum, cobertura real, percentiles, celdas suprimidas y mapeos de los 24 motores; `null` donde falte dato.
- [ ] Validar horas/trabajo/productividad por especialidad y condiciones laborales (W-2 vs autónomos, prevailing wage y seguros) con registros propios reconciliados; no convertir estadísticas nacionales en tarifa.
- [ ] Ejecutar NAT-01..NAT-18 en implementación autorizada con oráculos independientes y revisión competente; comparar contra snapshots aceptados y costos reales.
- [ ] Sin fuente de material, licencia, revisión de obra o política fiscal por localidad, salida `PRELIMINARY_ONLY` con `taxAmount=null`, sin afirmación de cobertura aprobada 51/51.

## Ampliación fiscal y de calidad de datos — 6-nov-2026

- [x] [NAT-EDGE](./cost-engine.national-tax-edgecases-2026-11-06.md): 13 escenarios fiscales adversariales adicionales (NC, NJ, OH, WI, MN, VA, SC, MA, NH, DC y WA) con fuente oficial y campos obligatorios; **ningún oráculo CPA está firmado**.
- [x] Catálogo documental de fuentes BLS OEWS/QCEW, SAM.gov, Census BPS y DOT con esquema de trazabilidad, supresiones y diferencias entre salario, precio de material y precio de obra instalada.
- [x] Detectado conflicto de enlace BLS: el alias CURRENT de página estatal puede presentar May-2024 aunque la página de tablas publique May-2025. Exigir año/release del archivo real antes de importarlo, sin confiar en alias.
- [ ] Convertir TAX-NAT-19..31 en pruebas de aceptación con valores esperados por CPA independiente y comprobar cambios fiscales por fecha/localidad.
- [ ] Convertir DAT-NAT-01..10 en pruebas ejecutables y producir manifiestos de archivos BLS/SAM con checksum, datos suprimidos y cobertura real; **no se han descargado esos datasets en esta tarea**.

## Plan nacional de obtención de cotizaciones y licencias

- [x] [T-005p](./cost-engine.t005-vendor-quotes-rights-acquisition-2026-11-06.md): canales oficiales Home Depot Pro, Lowe's Pro, 84 Lumber, ABC Supply, Sherwin-Williams PRO+ y potencial proveedor OEM Craftsman **identificados**; no contactados ni contratados.
- [x] Plantillas de `VendorCandidate`, `QuoteEvidence` y `LicenseReview` preparadas como diseño, sin migración ni registros de precios nuevos.
- [ ] Cotizaciones reales por SKU/fecha/ubicación con derecho de uso acreditado, validación de unidad, cantidad, alcance, flete, tax de compra y vigencia.
- [ ] Términos escritos de SaaS, caching, derivados, exposición multitenant, retención/revocación, incluidos proveedores heredados y nueva fuente OEM; dictamen Legal.
- [ ] Validación independiente y pruebas negativas; cobertura por oficio y región demostrada antes de autorización comercial/fiscal.

## Datos salariales metropolitanos verificables — 6-nov-2026

- [x] **Tests T-005 del parser integrados en suite existente**: quince pruebas sintéticas en `test_oews_coverage.py` invocadas por `tests/unit/oews-research-contract.test.mjs` desde `pnpm test:unit`, sin workflow nuevo ni fuentes privadas. Controlan ZIP ambiguos, archivo XLSX ausente, supresión y referencia sin fecha comprobada; **la aprobación del CI para el HEAD es una evidencia aparte**.
- [x] **Aislamiento de dimensiones en parser de investigación**: filtros por `AREA_TYPE` estatal (2), metro/no metro (4/6), `NAICS=000000`, `I_GROUP=cross-industry`, `OWN_CODE=1235`, `O_GROUP=detailed` cuando los campos están presentes. Ocho tests sintéticos cubren rechazos; código/CI y datos oficiales son evidencias distintas.
- [ ] **Asegurar esquema oficial completo**: verificar los cinco campos de scope en los ZIP XLSX May 2025 y que `scope_fields_present=5`, además de edición, ruta interna, supresiones y cobertura real. Un CSV sintético sin scope no equivale a verificación del release.
- [ ] **Validación de archivos oficiales**: obtener state/metro May 2025 desde BLS, verificar contenido/edición externa y hash, comprobar cantidad real de áreas y salarios por SOC y documentar celdas sin datos; hasta entonces `release_verified=false` y **sin cobertura nacional acreditada**.


- [x] Seis benchmarks de salario medio **del grupo amplio** construcción/extracción OEWS May-2025 (Dallas, Miami, Atlanta, Los Ángeles, Chicago, Seattle), con cifras, fuentes BLS y segunda columna de instalación/mantenimiento/reparación, guardados en [sección 10 del modelo nacional](./cost-engine.national-labor-geo-tax-operating-model-2026-11-06.md). Son **referencias**, no cotizaciones ni tarifas de oficio.
- [x] Rutas BLS May-2025 de ZIP state/metro identificadas y ligadas al release exacto; no se confía en alias mutable `CURRENT`.
- [x] **Validador de investigación OEWS con 10 fixtures sintéticos definidos (validación CI del HEAD aparte):** [script offline](../../../scripts/research/oews_coverage.py), [tests](../../../scripts/research/test_oews_coverage.py) y [runbook](./cost-engine.oews-audit-execution-2026-11-06.md). Genera manifiesto y cobertura 51×24/metro; **NO se han descargado los ZIP oficiales ni calculado cobertura real de OEWS**.
- [ ] Descargar de verdad ZIP state/metro, calcular checksum, validar layout, celdas suprimidas y columnas; desglosar SOC del oficio y generar estadística de cobertura por estado/CBSA. No afirmar importación terminada por identificar URLs.
- [ ] Convertir pruebas `WAGE-NAT-01..08` en casos ejecutables con fixtures BLS y revisión humana.
- [ ] Contrastar salarios detallados SOC y tiempos reales autorizados contra costos empresariales reconciliados. No usar cociente Seattle/Dallas de grupos agregados como multiplicador comercial.

## Continuidad de agente interno de vigilancia de mercado (7-nov-2026)

- [x] [Diseño residente en SEMSE](./cost-engine.market-watch-agent-design-2026-11-07.md) registrado y [matriz MW-01..MW-24](./cost-engine.market-watch-acceptance-matrix-2026-11-07.md) preparada **solo como documentación**: no se creó agente, scheduler ni precio nuevo.
- [ ] Contrato worker/BullMQ, cadencias/locks/idempotencia, egress allowlist, secretos, límites, kill switch OFF y gastos operativos revisados/aceptados.
- [ ] T-008/T-008b/#1101 y auditoría T-008c prueban que BLS PPI no genera precios USD de la nada ni revalida fallbacks, y consumidores reciben estado de procedencia.
- [ ] Fuente con SKU/unidad/fecha/geo, licencia SaaS/consentimiento, revisión de oficio y aprobación humana verificable; datos sin derechos o vencidos nunca alteran tarifas comerciales.
- [ ] Seguridad tenant/org, privacyCritical, revocación, pruebas negativas MW-01..24 y `costReplay` aceptados; los importes existentes quedan inmutables.
- [ ] Activación por categoría con Q2/Q3/Q5/Q7/Q9/Q10/Q11, CPA/Legal/finanzas y canary separados; **#1075 sigue DRAFT** hasta gates de spec.
