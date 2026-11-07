# Agente residente de vigilancia de precios — diseño de integración en SEMSE

**Fecha:** 2026-11-07 · **Estado:** `DRAFT / DESIGN_ONLY` · **PR contenedor:** [#1075](https://github.com/Semse-projet/project-manager-app/pull/1075) · **Dependencia:** `api-cost-engine` SDD 2.0, T-005/Q2/Q9/Q10/Q11, ADR-027 y [#1101](https://github.com/Semse-projet/project-manager-app/pull/1101).

> **Registro para retomar desde el repositorio.** Este documento NO implementa un agente, cron, API, tablas, acceso a proveedores, actualización de precios ni función de producción. No constituye `APPROVED` ni aprobación fiscal/jurídica/comercial. Las pruebas descritas son propuestas, no resultados ejecutados.

## 1. Decisión del producto

El usuario requiere un **agente de SEMSE** que examine periódicamente fuentes externas autorizadas y proponga mantener actualizadas las referencias económicas de los **24 motores por oficio**, inicialmente en un piloto de **pintura interior y drywall** en Florida y Georgia. Debe vivir en la infraestructura del proyecto (API/worker/PostgreSQL/BullMQ/Railway) y NO como un recordatorio/automatización de una conversación de ChatGPT.

**Separación de autoridad obligatoria:**

- **Agente observador:** detecta nuevas versiones de índices, señales de precios o cotizaciones entregadas/autorizadas; crea observaciones y alertas con procedencia, nunca cambios de tarifas.
- **Validador determinista:** comprueba esquema, unidad, moneda, fecha, ubicación, permiso de uso, vigencia, comparabilidad, integridad y scope.
- **Revisor humano competente:** decide si una observación concreta puede usarse para un propósito/tenant/obra. Legal revisa derechos; especialista de oficio verifica equivalencia y rendimientos; Finanzas revisa bases y márgenes; CPA/asesor fiscal revisa `TaxPolicy`.
- **Motor canónico:** `pricing/* / CostEngineService` de ADR-027 es la única autoridad del resultado económico; Prometeo/ProTools explican o consumen resultados, nunca escriben precios, estimados aceptados ni pagos.

## 2. Línea de base verificada en código (no verificación del runtime)

Lectura del árbol de `main` de `Semse-projet/project-manager-app` en SHA `1e48716838d1350ff152fd25a11523f9a42e3ec2`:

| Componente actual | Hallazgo | Riesgo/acción |
| --- | --- | --- |
| `apps/api/src/modules/pricing/price-refresh.job.ts` | `PriceRefreshJob` programa refresh externo cada 24 horas desde la API; bandera `SEMSE_PRICE_REFRESH_EXTERNAL_ENABLED` solo deshabilita con `false`. | No confundir la tarea existente con agente con gobernanza. Evaluar deshabilitación explícita en ambientes restringidos y migrar nueva orquestación a worker bajo control. No editar variables de producción desde esta spec. |
| `apps/api/src/modules/pricing/bls-ppi.service.ts` | Usa `basePrice × PPI/100` y si falla la API emite `basePrice` con `indexValue=100`. | PPI mide variación, no un precio unitario. No asumir que 100 es índice del mes del precio base. T-008 sigue separado de la protección de snapshots T-008b. |
| `apps/api/src/modules/pricing/material-pricing.service.ts` | `refreshPrices()` puede guardar ese fallback como snapshot `source=BLS_PPI`; `getCurrentPrices()` devuelve `Record<string, number>` y puede usar fallback sin estado de procedencia. | Riesgo de fuente falsamente verificada; [#1101](https://github.com/Semse-projet/project-manager-app/pull/1101) propone protección T-008b, pero está en DRAFT y no prueba compatibilidad, migración ni activación. |
| `apps/worker/src/main.mjs` | Ya ejecuta BullMQ y tareas periódicas con kill switches/locks. | Es el lugar candidato para el nuevo scheduler después de aprobar spec, sin añadir llamadas de red al intake público. |

Estos hechos son **lectura estática**; no acreditan el SHA que corre en Railway, datos reales de la DB, configuración activa ni seguridad de endpoints.

## 3. Arquitectura propuesta, desacoplada del precio comercial

```text
SEMSE Worker / BullMQ (flag OFF, jobs autorizados, lock/lease)
    -> SourceRegistry (allowlist, contrato, cuota y versión)
    -> Ingest (BLS PPI, OEWS, feed licenciado, evidencia aportada)
    -> EvidenceNormalizer (SKU/UOM/moneda/fecha/geografía/scope)
    -> Rights & Quality Gate (licencia/consentimiento/revocación/comparabilidad)
    -> MarketEvidenceCandidate + hash/estado + AuditLog
    -> Bandeja de revisión humana y notificación
    -> [solo tras autorización] observación aprobada para alcance explícito
    -> CostEngineService / CostTrace / CostReplay
    -> presupuestos NUEVOS o borradores regenerados expresamente
```

- BLS PPI: guardar `indexValue`, serie, referencia de período, edición y fecha; **`INDEX_ONLY`**. Usar índice para ajuste solo cuando exista precio base **observado, fechado, autorizado** e índice de la fecha base compatible. Un PPI no genera un precio USD por sí solo.
- BLS OEWS: `WAGE_BENCHMARK_ONLY`, SOC/área/año/supresiones; jamás tarifa facturable ni costo laboral W-2/1099 derivado automáticamente. ECEC es agregado de compensación, no multiplicador exacto de un oficio.
- Proveedores (Home Depot Pro, Lowe's Pro, 84 Lumber, ABC Supply, Sherwin-Williams PRO+): canales **candidatos** a cotización concreta de cuenta/obra. Una web visible o cotización privada **no otorga** derechos de API, scraping, reutilización SaaS, redistribución ni datos multitenant.
- Craftsman/OEM o fuentes comerciales: conectores solo tras contrato/licencia escrito que ampare lectura automatizada, caching, derivados, reventa/visualización, retención y revocación. RSMeans/Gordian: `RESTRICTED_PENDING_LEGAL` hasta acreditar procedencia y licencia propia.
- Costos históricos de SEMSE: `ProjectExpense`, `TimeEntry`, facturas y change orders solo con autorización, conciliación y segregación; un pago de `escrow` **no** es costo real. Q2 no se cierra por volumen de registros sin integridad económica.
- Sin datos o derechos suficientes: `UNVERIFIED`/`PRELIMINARY_ONLY`, **sin precio nuevo certificado**, `taxStatus=UNDETERMINED`, `customerTaxAmount=null` hasta `TaxPolicy` revisada.

### Contrato lógico de observación (propuesta, no tabla creada)

```typescript
type MarketEvidenceCandidate = {
  candidateId: string; sourceKind: "PPI_INDEX" | "OEWS_BENCHMARK" |
    "LICENSED_PRICE" | "PRIVATE_QUOTE" | "INTERNAL_ACTUAL";
  sourceRef: string; sourceVersion: string; contentHash: string;
  materialKey?: string; sku?: string; normalizedUom?: string;
  observedAt: string; validUntil?: string; regionRef?: string;
  currency?: "USD"; amountDecimal?: string; // solo si es precio permitido
  seriesId?: string; indexPeriod?: string; indexValue?: string;
  tenantId?: string; orgId?: string; privateScopeRef?: string;
  rightsGrantRef?: string; rightsExpiresAt?: string;
  intendedPurposes: string[]; scopeHash?: string;
  state: "DISCOVERED" | "NEEDS_EVIDENCE" | "REVIEW_PENDING" |
    "APPROVED_FOR_SCOPED_USE" | "REJECTED" | "EXPIRED" | "REVOKED";
  reviewerRef?: string; reviewedAt?: string;
};
```

**Restricciones:** importes decimales y reglas de redondeo explícitas, no floats para cálculo comercial; dato privado siempre vinculado a tenant/organización/propósito, sin permiso de consulta transversal por un `tenantId` aislado. El hash/versionado protege trazabilidad; **no** convierte una fuente en legítima. No guardar secretos o documentos personales en trazas públicas. Definir retención y borrado sujetos a derechos, conservación legal y revocación.

## 4. Scheduler interno y controles operativos propuestos

- **Lugar:** `apps/worker` (BullMQ + Redis), API NestJS para administración y vistas; PostgreSQL para candidatos/auditoría **solo tras spec de esquema aprobada**. No usar automaciones de ChatGPT ni `setInterval` como autoridad distribuida en cada réplica de API.
- **Bandera:** `SEMSE_MARKET_WATCH_ENABLED=false` por defecto, con allowlist de fuentes y pilotos; un flag independiente para *aplicar* observaciones aprobado también apagado por defecto. La creación de este documento **no crea** ni configura estas variables.
- **Cadencia piloto propuesta:** una inspección diaria de disponibilidad/cambios en datos oficiales con control de releases; feeds licenciados según contrato/cuota; cotizaciones privadas **solo** desde solicitudes autorizadas. No inventar precios diarios por consultar PPI mensual ni abrir conexiones recurrentes a tiendas sin permiso. Operador ajusta frecuencias después de observar costes/errores.
- **Concurrencia:** jobs idempotentes por `source + version/period + scope + SKU`, lock de ejecución, reintento con backoff y jitter, límite de tasa, timeout, DLQ y observabilidad; un fallo nunca renueva la vigencia de datos anteriores.
- **Seguridad e ingestión:** HTTPS/hostnames permitidos, bloquear SSRF/redirects inseguros, usar credenciales de proveedor solo desde backend y vault, sanitizar datos no confiables, límites de tamaño y cuotas; no ejecutar instrucciones de páginas web mediante un LLM.
- **Trazabilidad:** registrar `runId`, estado, último intento, versión de fuente, hash, motivo de rechazo, fecha de observación, gasto de consultas si hay proveedores de pago y aprobación humana. No guardar PII ni precios privados en logs globales.
- **Activación:** cada revisión produce candidato; **no** modifica `MaterialPriceSnapshot` verificado, estimados aceptados, órdenes de cambio, contratos, hitos, escrow, tasas de comisión ni `TaxPolicy`. Se necesita autorización explícita y prueba de `costReplay` antes de usar un precio en cotización futura.

## 5. Reconciliación con pendientes existentes

| Gate | Investigación / dependencia | Salida del agente y limitación |
| --- | --- | --- |
| T-004/T-004b/T-004e | #1076: 72/72 reproducibles con instrumentación; contrato interno de bases/tasas/divisor y oráculo independiente pendientes. | Guardar operandos/versiones suficientes para replay. El agente NO valida la aritmética ni márgenes del motor. |
| T-008/T-008b/T-008c | PPI `/100` no acreditado; #1101 corrige solo protección de fallback; auditoría de snapshots aislada pendiente. | No publicar precio base ni renovar vigencia al fallar fuente; no adjudicar a #1101 la corrección de T-008. |
| Q11/T-005 | Fuentes, SKU, fecha, licencias y precios unitarios observados por oficio/ubicación pendientes. | Sin derecho SaaS o comparabilidad, candidata en revisión y prohibición de uso comercial. |
| Q10 | Política fiscal profesional por contrato/jurisdicción y componentes. | El agente nunca propone impuesto universal, ni reemplaza revisión CPA. |
| Q2/Q3 | Costos reales conciliados, calibración, márgenes aprobados. | Captura evidencia con procedencia; **no** eleva confianza a `HIGH` ni cambia límites por inferencia. |
| Q9/Q5/Q7 | Cantidades revisadas, borradores obsoletos y piloto sombra. | Solo fuentes de comparación; shadow no altera respuesta; nuevas revisiones requieren aprobación por oficio. |
| #1085/#1086 | Unidades `wastePercent` y semántica `crewSize`. | Normalización y oráculos de unidades/capacidad obligatorios antes de activar flujos afectados. |

## 6. Etapas y decisiones separadas

1. **Ahora, #1075 DRAFT:** conservar este anexo y la [matriz MW-01..MW-24](./cost-engine.market-watch-acceptance-matrix-2026-11-07.md), comparar contrato con ADR-027 y Q1–Q11. No atribuir efectos de código.
2. **Antes de habilitar monitoreo:** revisar consentimiento, derechos SaaS, configuración de fuentes, presupuesto de egress, privacidad, responsables, API/worker contract, procedimiento de reversión. Resolver #1101 y el defecto de índices/fallback relevante en la ruta de observación.
3. **Fase futura independiente A — observador de solo lectura:** worker controlado por flag OFF, registro de runs, ingestión con prueba de *no write* en datos económicos, alertas y panel interno. PR propio, CI y smoke aislados.
4. **Fase futura independiente B — registro de evidencia:** migraciones aditivas revisadas, scopes tenant/org, contrato de derechos, revisión humana, retención y revocación; pruebas PostgreSQL, aislamiento y rollback; NO automático por tener job activo.
5. **Fase futura independiente C — piloto comercial por categoría:** pintura/drywall y región autorizada, SKU/costos reales/QA/finanzas/Legal/CPA, modo sombra; replay exacto y consumidores compatibles; aprobación explícita adicional antes de nuevas cotizaciones.
6. **Producción/canary:** CI del SHA integrado, revisión humana/automática, despliegue y procedencia GitHub→Railway, evidencia de comportamiento y kill switch. Cada estado se registra por separado; nunca se fusiona ni se activa por un checklist documental verde.

**Próxima decisión:** completar el contrato técnico del observador, revisar qué tarea de `PriceRefreshJob` debe dejar de escribir evidencia no validada, y obtener derechos de proveedor antes de escoger fuentes comerciales. El anexo no levanta el bloqueo de `APPROVED` del #1075.

## 7. Archivos y referencias para quien retome

- [Spec del motor](./cost-engine.spec.md), [plan](./cost-engine.plan.md), [tareas](./cost-engine.tasks.md), [checklist](./cost-engine.checklist.md), [decisiones](./cost-engine.decisions.md).
- [Fuentes y permisos T-005](./cost-engine.t005-source-rights-inventory-2026-11-06.md), [canales de cotización](./cost-engine.t005-vendor-quotes-rights-acquisition-2026-11-06.md), [Q11 Legal](./cost-engine.q11-license-clearance.md), [Q10 Fiscal](./cost-engine.q10-fiscal-professional-review.md), [Q2 histórico](./cost-engine.q2-data-audit.md).
- [H1–H5](./cost-engine.hybrid-market-execution-design-2026-11-06.md), [modelo nacional de labor](./cost-engine.national-labor-geo-tax-operating-model-2026-11-06.md), [fuentes BLS/SOC](./cost-engine.us-data-ingestion-and-24-trade-crosswalk-2026-11-06.md).
- [PR #1076](https://github.com/Semse-projet/project-manager-app/pull/1076) T-004 fusionado; [PR #1101](https://github.com/Semse-projet/project-manager-app/pull/1101) T-008b DRAFT independiente; [issues #1085](https://github.com/Semse-projet/project-manager-app/issues/1085), [#1086](https://github.com/Semse-projet/project-manager-app/issues/1086), [#1087](https://github.com/Semse-projet/project-manager-app/issues/1087) y [#1100](https://github.com/Semse-projet/project-manager-app/issues/1100).
