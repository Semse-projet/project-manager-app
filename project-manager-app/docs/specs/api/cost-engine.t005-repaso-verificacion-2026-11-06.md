# T-005 — Repaso y conciliación de evidencia para el Cost Engine nacional

**Corte:** 2026-11-06 · **Estado:** `REVIEW_ONLY / NO_NEW_COMMERCIAL_VALIDATION` · **Referencia:** [PR #1075](https://github.com/Semse-projet/project-manager-app/pull/1075), `DRAFT`. **No modifica servicios, fuentes productivas, tarifas, datos, permisos, licencias ni infraestructura.** #1101 se mantiene como PR separado (protección de procedencia PPI).

## 1. Qué ya existe y qué NO se repite

| Expediente | Evidencia / valor ya obtenido | Límite de uso |
|---|---|---|
| [Diagnóstico de 24 motores y 12 precios de respaldo](./cost-engine.t005-pricing-evidence-register.md) | Inventario de `BLS_SERIES`, fallback y dependencia de `priceOf`; mapa técnico para pruebas por oficio | No certifica que esos 12 importes sean precios observados ni que los 24 rendimientos sean correctos |
| [Investigación de 51 jurisdicciones](./cost-engine.national-research-2026-11-05.md) | Contrastes preliminares de fiscalidad, salarios y licencias, fuentes para revisión | No son 51 políticas fiscales aprobadas; tampoco datos por condado ni por modalidad de obra |
| [Contrato nacional v2](./cost-engine.national-data-contract-2026-11-06.md) | Propuesta de datos normalizados por geografía, mano de obra, obligación fiscal y oferta económica | Contrato de diseño; no tablas, migraciones ni precios aprobados |
| [Contrato de evidencia nacional v1](./cost-engine.national-data-contract-v1-2026-11-06.md) | Reglas de evidencia, cobertura, replay, pruebas y gates por segmento | Complementa v2; no es activación ni dato comercial |
| [Q10](./cost-engine.q10-fiscal-professional-review.md) / [Q11](./cost-engine.q11-license-clearance.md) | Paquete para CPA y Legal; clasificación y derechos explícitos requeridos | Ninguna aprobación profesional o permiso OEM/SaaS de SEMSE demostrado |
| [Diseño H1–H5](./cost-engine.hybrid-market-execution-design-2026-11-06.md) | Fuentes internas/externas/humanas, comparador, doble evaluación, ejecución mixta y calibración | 14 casos de aceptación **propuestos**, no ejecutados |

**Convivencia documental para evitar deriva:** `cost-engine.spec.md` sigue siendo el contrato rector del motor/ADR-027. El documento nacional **v2** desarrolla entidades y jurisdicciones; el documento nacional **v1** registra pruebas, cobertura y evidencia; H1–H5 especifica la futura capa híbrida de decisión. Si hay una discrepancia sustantiva entre anexos, se abre decisión documentada; no convertir ninguna redacción aislada en código/producción por inferencia. No borrar un anexo sin revisión de referencias y gobernanza.

## 2. Contraste externo puntual con TinyFish y fuentes originales (6-nov-2026)

| Fuente consultada | Hallazgo confirmado | Aplicación a SEMSE / límite |
|---|---|---|
| [BLS PPI, guía oficial](https://www.bls.gov/ppi/publications/price-adjustment-guide-for-contracting-parties.htm) y [FAQ](https://www.bls.gov/ppi/faqs/questions-and-answers.htm) | El PPI es **índice de variación**, BLS no publica precios unitarios. Para ajuste contractual exige precio base, mes y serie identificados; los índices pueden revisarse. | El índice **no** valida los USD hardcoded de 12 materiales, ni genera cotización local por SKU |
| [BLS OEWS tablas May 2025](https://www.bls.gov/oes/tables.htm) | Hay referencia salarial nacional, estatal y de áreas metro/no-metro por ocupación. | Salario estadístico **no** equivale a costo completo de cuadrilla, labor burden ni precio facturable |
| [Craftsman Data Licensing](https://craftsman-book.com/data-licensing) | El proveedor publica oferta de licenciamiento y APIs de datos para herramientas de estimación, con sandbox/ajustes de área. | **Candidato** a due diligence comercial y prueba de integración; publicación de API **no** acredita contrato SEMSE, permiso SaaS multitenant, caché, derivados o exposición al usuario |
| [Georgia DOR Contractor FAQs](https://dor.georgia.gov/contractor-faqs) y [ejemplos Sales and Use Tax](https://dor.georgia.gov/sales-and-use-tax-contractors-examples) | La autoridad trata en general al contratista como consumidor de materiales incorporados y detalla escenarios de use tax según compra/uso local. | Impuestos no se resuelven multiplicando todo el presupuesto por una tasa fija; el caso exacto requiere clasificación y asesoría |
| [Colorado DOR, impuestos locales](https://tax.colorado.gov/local-government-sales-tax) | Determinadas ciudades recaudan impuestos locales autónomamente. | ZIP/estado no determinan por sí solos la política fiscal; jurisdicción y clasificación deben validarse |

**Fuentes y alcance:** este repaso inspeccionó documentación del PR y un conjunto **puntual** de fuentes oficiales/comerciales públicas, no un catálogo de cotizaciones en vivo ni un barrido de los 50 estados. Los precios actuales de tiendas, términos contractuales de SEMSE, impuestos vigentes por domicilio y rendimientos de obra **no** se certificaron. El expediente previo sobre RSMeans permanece sujeto a revisión legal; esta revisión **no** otorgó ni verificó una licencia contractual de SEMSE.

## 3. Brechas para un piloto y criterios de salida

| Gate | Evidencia necesaria | Situación tras repaso |
|---|---|---|
| P-01 Precio unitario | SKU, descripción dimensional, unidad, cantidad, proveedor, jurisdicción, fecha, precio, flete, impuestos de compra, vigencia y prueba de derecho SaaS | **Pendiente:** 0 cotizaciones comerciales autorizadas revisadas en los expedientes |
| P-02 Comparabilidad | Dos o más ofertas del mismo alcance, con exclusiones, logística, materiales incluidos, garantías y fecha | **Pendiente:** el anexo H define protocolo; no hay ofertas empresariales verificadas |
| P-03 Mano de obra | Horas y rendimientos reales, composición de cuadrilla, cargas patronales/contrato, condiciones y geografía | **Pendiente:** BLS solo benchmark; no datos SEMSE conciliados certificados |
| P-04 Derechos y consentimiento | Contrato explícito de API/OEM, derechos multitenant/derivados/caché/retención, revocación y permiso RFQ | **Pendiente:** no inferir derechos de un sitio público ni contactar proveedores sin autorización |
| P-05 Fiscalidad | Jurisdicción real, clasificación de inmueble/servicio, contrato, comprador de materiales, tax-paid y `TaxPolicy` firmada | **Pendiente:** sin aprobación profesional; `taxStatus=UNDETERMINED`, impuesto del cliente `null` en contrato nuevo |
| P-06 Reproducibilidad y pruebas | Fixtures sintéticos, 24 motores × escenarios, HTTP, PostgreSQL/tenancy, replay, antifraude y gates H-01–H-14 | **Pendiente para H:** especificadas, no ejecutadas; no trasladar automáticamente CI previo de #1101 |
| P-07 Calibración y márgenes | Muestras de obras terminadas con costos reales y aprobación comercial/estadística | **Pendiente:** sin muestra suficiente ni `CALIBRATED` |

**Separa siempre** prueba matemática de corrección comercial y de obligaciones fiscales. Que el sistema reproduzca 72/72 cálculos de #1076 no valida el precio de venta.

## 4. Orden de trabajo para no duplicar investigación

1. **T-005a / P-01 primero:** piloto drywall y pintura interior, una zona cada vez; seleccionar potenciales proveedores, solicitar evidencia **solo mediante proceso autorizado** y comprobar derecho de uso para cada observación. No tomar listados públicos como presupuestos vinculantes.
2. **Q11 + T-005i:** revisar contrato OEM/SaaS antes de incorporar datos al catálogo o servicio; evaluar Craftsman como candidato sin adquirir nada desde este PR.
3. **Q9, Q2 y T-005j/k:** diseñar fixtures comparables de materiales, cuadrillas propias y subcontratos y ejecutar suites offline **solo en fase técnica autorizada**; exigir igualdad de alcance y no doble conteo.
4. **Q10:** CPA fiscal por jurisdicción/tipo de contrato para liberar emisión comercial; no extrapolar de Florida/Georgia al resto de EE. UU.
5. **Q3 y T-005l:** conciliar costos reales y probar calibración por oficio/área fuera de muestra, sin aprendizaje automático de tasas comerciales.
6. Pasar a `APPROVED` solo con revisión independiente del contrato técnico y aprobación explícita, separadas de los gates comerciales, el merge, el despliegue y la activación.

**Cierre de este repaso:** aprovechada investigación previa, confirmado el uso legítimo de BLS como índice/salario de referencia, identificada una opción de proveedor licenciado y localizadas las brechas exactas. **No se descubrió ningún precio SKU autorizado ni se cerró Q10/Q11.** Ninguna consulta web autoriza reutilización comercial de datos privados.
