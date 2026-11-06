# Anexo de diseño — Inteligencia de mercado y ejecución híbridas para SEMSE

**Fecha:** 2026-11-06 · **Estado:** `DRAFT / DESIGN_ONLY` · **Dependencia:** [api-cost-engine](./cost-engine.spec.md), [contrato nacional T-005](./cost-engine.national-data-contract-v1-2026-11-06.md), [Q10 fiscal](./cost-engine.q10-fiscal-professional-review.md), [Q11 licencias](./cost-engine.q11-license-clearance.md).

> **No es una autorización de implementación, despliegue, compra de datos, scraping, publicación de cotizaciones ni automatización de pagos.** No modifica el alcance de #1101 (integridad y procedencia PPI). Su implementación requerirá fases/PR de código independientes después de aprobar contratos, seguridad y pilotos. Los 24 motores permanecen bajo la autoridad económica determinista de `pricing/*` conforme a ADR-027; Prometeo explica, ProTools consume resultados, nunca modifica dinero por sí solo.

## 1. Objetivo y las cinco capacidades propuestas

Construir una **capa de decisión sobre el motor de costos**, no otro motor que calcule totales en paralelo. Debe resolver qué evidencia puede utilizarse, qué ofertas son comparables, qué modalidad de ejecución es viable y qué desviaciones del estimado permiten proponer mejoras verificables.

| Clave | Capacidad | Resultado de diseño esperado | Límite |
|---|---|---|---|
| H1 | Fuentes híbridas | Combinar registros internos autorizados, feeds/cotizaciones externas y evidencias aportadas por usuarios | Sin licencia, permiso ni aislamiento: solo referencia restringida, no datos comerciales compartidos |
| H2 | Comparación de mercado | Comparar materiales por SKU/unidad y servicios por alcance, plazo y condiciones equivalentes | No equiparar precio de compra, salario, costo propio y precio de servicio terminado |
| H3 | Evaluación dual | Distinguir **confianza de la evidencia** y **adecuación a la obra**, con gates no negociables | Una puntuación alta nunca anula una restricción legal, fiscal o de privacidad |
| H4 | Ejecución híbrida | Comparar ejecución propia, subcontratada y mixta, sin duplicar insumos ni horas | Ningún escenario determina contratación o pago automáticamente |
| H5 | Aprendizaje supervisado | Contrastar presupuestos con costos reales conciliados y recomendar calibración | Sin ajuste autónomo de tasas, márgenes, impuestos o cotizaciones aceptadas |

**Alcance territorial:** 50 estados y Washington D. C. como objetivo de cobertura; cada celda `jurisdicción × oficio × clasificación del trabajo × contrato × fuente` requiere evidencia y validación propia. Un borrador nacional no equivale a autorización comercial nacional.

## 2. Flujo de diseño

1. `WorkScope`: intake estructurado, oficio(s), tareas, cantidades/unidades, ubicación verificada, modalidad contractual y ventana de entrega; campos no medidos conservan `UNKNOWN`.
2. `EvidenceIntake`: resolver datos internos de ese tenant; opcionalmente consultar catálogos/APIs con derechos, y aceptar cotizaciones subidas por personas; conservar origen, fecha, versión, permisos y documentos privados.
3. `EligibilityGate`: verificar derechos de acceso/retención/derivados/visualización SaaS, legitimidad de uso, vigencia, tipo de precio, conversión dimensional y tenant; rechazar como evidencia comercial si falta un requisito obligatorio.
4. `NormalizeAndCompare`: material `SKU + grado + UOM + cantidad + ZIP/marketArea`; servicio `scope + exclusiones + materiales incluidos + labor + plazo + garantías + transporte + riesgo`. Los impuestos no determinados se conservan como `null`, nunca como cero.
5. `EvidenceAssessment`: entregar dos puntuaciones separadas (H3) y motivos observables; permitir abstención `NOT_COMPARABLE`, `INSUFFICIENT_DATA` y `REVIEW_REQUIRED`.
6. `ExecutionScenarioBuilder`: construir partidas disjuntas para `SELF_PERFORM`, `SUBCONTRACT` y `HYBRID`; `CostEngineService` compone costos y reglas económicas autorizadas una sola vez.
7. `HumanReview`: mostrar supuestos, intervalos, obligaciones, licencia y diferencias entre escenarios; la decisión de contratar, enviar RFQ, publicar y cambiar parámetros exige la autorización correspondiente.
8. `OutcomeReconciliation`: después de concluir la obra, conciliar horas, gastos, devoluciones, change orders y facturas contra alcance y estimado; generar propuestas de calibración versionadas, nunca activar automáticamente.

### Límites de acceso y salidas

- Ninguna consulta de internet en la ruta síncrona pública de Smart Intake. Las llamadas externas futuras irán por jobs autorizados, con proveedores allowlisted, credenciales protegidas, cuotas, timeouts, caché y circuit breaker; respuestas web tratadas como datos **no confiables**, nunca instrucciones.
- El sistema no hará crawling/scraping indiscriminado ni eludirá términos de servicio; el hecho de que un precio sea público no acredita derechos OEM/SaaS.
- Buscar un proveedor no equivale a autorizar enviarle datos de obra. **Toda solicitud de cotización externa o comunicación con terceros necesita permiso explícito, minimización de datos y auditoría**.
- Cotizaciones privadas de un tenant no se utilizarán para entrenar ni comercializar un catálogo multitenant salvo base contractual y consentimiento específicos; las comparaciones agregadas deben satisfacer privacidad y tamaño de muestra.
- Los importes comerciales y márgenes privados se filtrarán según actor, en servidor; no exponer tokens, documentos completos, PII ni términos privados de otros proveedores.

## 3. Contratos lógicos propuestos (no endpoints ni tablas implementadas)

```typescript
type OfferSource = "INTERNAL_RECONCILED" | "SUPPLIER_QUOTE" |
  "CONTRACTOR_QUOTE" | "LICENSED_FEED" | "USER_EVIDENCE" |
  "PUBLIC_BENCHMARK"; // benchmark no es automáticamente precio de venta

type Eligibility = "ELIGIBLE" | "REVIEW_REQUIRED" |
  "RESTRICTED_RIGHTS" | "EXPIRED" | "REVOKED" |
  "NOT_COMPARABLE" | "MISSING";

type EvidenceOffer = {
  evidenceId: string; tenantId: string; orgId: string;
  source: OfferSource; vendorId: string | null; sourceDocumentRef: string;
  rightsGrantRef: string | null; permittedPurposes: string[];
  observedAt: string; expiresAt: string | null; sourceVersion: string;
  workScopeHash: string; geoRef: string; serviceTrade: string;
  normalizedItemOrOperationId: string; quantity: string;
  unit: string; currency: "USD"; baseAmount: string | null;
  freightAmount: string | null; salesTaxAmount: string | null;
  scopeInclusions: string[]; scopeExclusions: string[];
  warrantyTermsRef: string | null; deliveryWindowRef: string | null;
  eligibility: Eligibility; independentReviewRef: string | null;
};

type EvidenceAssessment = {
  evidenceId: string; evidenceTrustScore: string | null;
  projectFitScore: string | null; scoringPolicyVersion: string;
  reasons: string[]; missingFields: string[];
  comparableGroupId: string | null; status: Eligibility;
};

type ExecutionScenario = {
  scenarioId: string; mode: "SELF_PERFORM" | "SUBCONTRACT" | "HYBRID";
  workScopeHash: string; workPackages: {
    operationId: string; fulfillment: "OWN_CREW" | "SUBCONTRACT";
    laborHoursRef: string | null; materialsOwner: string;
    laborCostRef: string | null; subcontractOfferRef: string | null;
    explicitIncludedComponents: string[];
  }[];
  materialLinesRef: string[]; indirectAllocationRef: string | null;
  taxPolicyRef: string | null; costTraceRef: string;
  status: "PRELIMINARY" | "REVIEW_REQUIRED" | "COMMERCIAL_AUTHORIZED";
};

type CalibrationProposal = {
  proposalId: string; segment: { trade: string; area: string;
    complexity: string; operationId: string };
  actualCostDatasetRef: string; holdoutEvaluationRef: string;
  metricDefinitionsVersion: string; candidateChangeRef: string;
  humanApprovalRef: string | null;
  status: "DRAFT" | "REVIEW_REQUIRED" | "APPROVED_FOR_PILOT" | "REJECTED";
};
```

Reglas invariantes: dinero decimal y base/precisión explícitas; nunca `float`; proveedor y licencia revocables; cantidades y unidades tipadas; evidencia aislada por tenant/org; snapshots inmutables para contratos y ofertas aceptadas; `TaxPolicy` profesional aprobada para publicar; derivaciones reproducibles y enlazadas a sus originales sin copiar PII al `costTrace` público. El `costReplay` debe reproducir la selección de evidencia, las tasas efectivas, `perUnitDivisor` y el cálculo sin inferirlos de importes redondeados (#1076).

## 4. H3 — Reglas antes de puntuaciones

**Gates deterministas obligatorios:** acceso y licencia; integridad del documento; unidad y especificación; vigencia; cobertura geográfica; aislamiento; clasificación fiscal para salida comercial; ausencia de datos esenciales. Si hay incumplimiento, el sistema se abstiene o genera borrador marcado, sin elevarlo por su score.

**Dos scores propuestos, configurables y sin calibrar:**

- `evidenceTrustScore`: autenticidad, trazabilidad, verificación de origen y actualidad. La licencia es un gate independiente.
- `projectFitScore`: coincidencia del SKU/operación, alcance y exclusiones, región, cantidad, disponibilidad y plazo.

Los pesos discutidos previamente (**fuente 35 %, geografía 30 %, vigencia 20 %, coincidencia 15 %**) eran **ilustrativos**, no deben fijarse ni fusionarse en una puntuación de confianza comercial. La primera versión solo expone componentes y reglas transparentes; una política de ponderación requiere datos históricos, análisis de sensibilidad y aprobación versionada. Tampoco se promedian precios no comparables: se reportan dispersiones, exclusiones, costos ajustados y abstención justificada. `HIGH/CALIBRATED` permanece prohibido sin calibración retrospectiva por segmento.

## 5. H4 — Modalidades de ejecución y comparabilidad

- Descomponer la obra en `workPackages` sin superposición: por ejemplo, demolición, materiales, instalación, acabado, retiro y supervisión.
- `SELF_PERFORM`: costo real cargado de cuadrilla (horas, salarios, cargas, equipos, viajes) + materiales y indirectos asignados **sin duplicaciones**.
- `SUBCONTRACT`: cotización de alcance completo, separando lo incluido de lo excluido; si la oferta incluye materiales/seguro/retirada no sumarlos otra vez.
- `HYBRID`: asignar cada operación a cuadrilla propia o subcontrato; compatibilidad de calendario, responsables, coordinación, permisos, licencias profesionales, garantías y riesgos.
- Las ofertas deben compararse con el mismo `scopeHash`, fecha y unidad. Mostrar escenarios como `PRELIMINARY` si faltan base fiscal, precio autorizado o evidencias, y no recomendar ganador definitivo por menor precio aparente.
- Separar *costo de ejecutar*, *precio de vender*, *margen/markup*, *comisión SEMSE* y *impuestos* con políticas de cálculo aprobadas. No emitir contratos, órdenes a proveedores ni liberar escrow por decisión de IA.

## 6. H5 — Ciclo de aprendizaje reversible

Fuente de costo real: `TimeEntry` conciliado, compras/facturas reales, gastos, devoluciones, órdenes de cambio y pérdidas/retrabajos clasificados; contrato, bid, escrow o pago **no sustituyen** el costo real. Descontar duplicados, etiquetar alcance original vs ampliaciones y separar horas pagadas, productivas y facturables.

Segmentar por oficio, operación, región, tipo de inmueble y complejidad; registrar periodo, tamaño efectivo de muestra, error absoluto y sesgo, cobertura, datos faltantes e intervalos. Mantener un conjunto temporal fuera de muestra, evitar leakage entre versiones de la misma obra y revisar sesgo por empresa/mercado.

La salida es **propuesta de cambio** (supuesto, evidencia, delta y rollback), revisada por especialista, responsable comercial y, si afecta fiscalidad/licencia, los profesionales correspondientes. Nunca autoeditar márgenes, precios de proveedores, fuentes jurídicas ni presupuestos aceptados.

## 7. Pruebas de aceptación propuestas (fixtures sintéticos antes de usar datos reales)

| Caso | Preparación | Resultado esperado |
|---|---|---|
| H-01 | Precio público sin concesión SaaS | `RESTRICTED_RIGHTS`; no incluido como precio comercial |
| H-02 | Factura de tenant A consultada desde tenant B | Sin lectura ni inferencia de existencia; auditoría |
| H-03 | Oferta de drywall solo instalación vs oferta material+instalación | `NOT_COMPARABLE` hasta normalizar alcance y exclusiones; sin media engañosa |
| H-04 | Precio autorizado pero vencido/revocado | Excluir de nuevas cotizaciones; preservar replay histórico gobernado |
| H-05 | Dos scores altos pero `TaxPolicy` ausente | `PRELIMINARY`, `customerTaxAmount=null`; no cotización comercial |
| H-06 | Proveedor incluye flete, retiro y materiales | No duplicar esas partidas al comparar ni al calcular ejecución mixta |
| H-07 | Cuadrilla propia + subcontrato para paquetes disjuntos | Recuento exacto de horas/materiales y trazabilidad por operación |
| H-08 | Caída de feed/timeout/caché obsoleta | Sin bloqueo del intake; datos históricos señalados como no actuales; sin afirmación de precio en tiempo real |
| H-09 | Página/quote contiene instrucciones hostiles | No ejecutar instrucciones de la fuente; analizar solo datos permitidos |
| H-10 | Cambio aprobado de parámetros después de contrato aceptado | Replay reproducible; contrato/escrow inmutables |
| H-11 | Diferencia estimado-real causada por change order | No imputarla al error original de productividad; propuesta explicable |
| H-12 | Calibración sin suficiente muestra o sin holdout | `REVIEW_REQUIRED`; no `CALIBRATED` ni activación automática |
| H-13 | RFQ hacia proveedor sin consentimiento | No enviar datos ni contactar tercero; evento rechazado y auditado |
| H-14 | Datos agregados de otra empresa de muestra reducida | No publicar inferencia identificable ni catálogo derivado no autorizado |

**Gate de pruebas:** suites de unidades y contrato sobre fixtures, DB aislada para permisos/tenancy, HTTP autenticado para consumidores, modo sombra sin tráfico externo desde rutas públicas; E2E y reversión por flag antes de rollout. Criterios de latencia, precisión, tamaño de muestra y límites de peso se definirán con datos piloto; no inventar umbrales.

## 8. Implementación por etapas, separada de aprobación de la spec

| Etapa | Entregable | Gate |
|---|---|---|
| D0 — Contrato documental (ahora) | Este anexo, pruebas propuestas, responsabilidades y tareas | Documentación validada; permanece `DRAFT` |
| D1 — Fixtures y comparador offline | Normalización, abstención, scores separados, escenarios económicos sintéticos | Tests reproducibles, compatibilidad ADR-027, privacidad y seguridad |
| D2 — Piloto de evidencias | Drywall en un área piloto con 3–5 proveedores **solo si aceptan** y con permisos de datos | Revisión Legal de cada fuente, información vigente, consentimiento, seguridad y Q10 según operación |
| D3 — Sombra y aprendizaje | Comparación frente a estimados actuales y costos reales conciliados | Evaluación de especialista/finanzas, análisis de error y rollback |
| D4 — Ampliación controlada | Oficios/regiones con matriz de cobertura, flags y aprobaciones propias | Cobertura fiscal/licencia/comercial probada en cada celda; decisión humana de activación |

No crear proveedores ficticios, endpoints productivos, nuevos servicios Railway, migraciones o red pública desde este anexo. El piloto inicial no certifica los 24 oficios ni 51 jurisdicciones.

## 9. Cuestiones pendientes para pasar de diseño a implementación

- [ ] Definir catálogo de operaciones/alcances y reglas de normalización por oficio, incluyendo clasificación de partidas mixtas y ownership de materiales.
- [ ] Obtener autorizaciones SaaS por proveedor, límites de caché/retención, RFQ, revocación y usos derivados; revisión jurídica externa.
- [ ] Definir roles para solicitar RFQ, publicar comparaciones y aprobar escenarios, aislamiento entre tenants y política de privacidad.
- [ ] Acordar protocolo de evidencia, scorecard y selección de políticas de ponderación, basado en estudios piloto y no en porcentajes arbitrarios.
- [ ] Definir esquema de conciliación de obras completadas, estrategia de evaluación estadística y revisión independiente.
- [ ] Completar reglas fiscales profesionales por cada jurisdicción/clase de contrato involucrada, y reglas comerciales de márgenes por oficio.
- [ ] Validar plan de implementación, interfaces, migración, seguridad, limitaciones de proveedor, presupuesto de llamadas y reversión.

**Estado final de este documento:** propuesta de arquitectura y especificación de pruebas; **NO** aprobación comercial, fiscal, jurídica ni autorización de usar datos de terceros.