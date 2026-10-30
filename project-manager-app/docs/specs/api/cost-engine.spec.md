---
id: "api-cost-engine"
title: "Motor de costos unificado"
domain: "pricing"
sdd_version: "2.0"
version: "0.3"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - "COST_ENGINE_SHADOW"
  - "COST_ENGINE_SMART_INTAKE"
production_evidence: []
related_files:
  - "docs/architecture/ADR-027-economic-evaluator-consolidation.md"
  - "docs/architecture/ADR-040-ws01c-identity-organization-context.md"
  - "packages/tools/src/core/cost-engine.ts"
  - "packages/tools/src/core/types.ts"
  - "packages/tools/src/business/quote-engine.ts"
  - "apps/api/src/modules/tools/tools.service.ts"
  - "apps/api/src/modules/pricing/location-cost.service.ts"
  - "apps/api/src/modules/pricing/contractor-rate.service.ts"
  - "apps/api/src/modules/pricing/bls-ppi.service.ts"
  - "apps/api/src/modules/pricing/oews.service.ts"
  - "apps/api/src/modules/pricing/pricing.controller.ts"
  - "apps/api/src/modules/contractor/contractor-estimate.service.ts"
  - "apps/api/src/modules/semse-agents/protools.agent.ts"
  - "apps/api/src/modules/smart-intake/smart-intake.logic.ts"
  - "apps/api/src/modules/intake-operations-bridge/intake-operations-bridge.service.ts"
  - "packages/db/prisma/schema.prisma"
  - "packages/auth/src/rbac.ts"
related_tests:
  - "apps/api/test/tools-adapter.test.ts"
  - "apps/api/test/pricing.controller.test.ts"
  - "apps/api/test/smart-intake-estimate.test.ts"
related_endpoints: []
related_events: []
related_agents:
  - "protools"
last_verified: "NOT_VERIFIED"
---

# Spec: Motor de costos unificado

> Spec SDD 2.0 **DRAFT v0.2**. No autoriza implementación hasta pasar a `APPROVED`.
> Riesgo **alto**: los parámetros del motor (comisión SEMSE, impuestos, márgenes) afectan lo que se cotiza,
> se contrata y se paga en escrow.
>
> **Revisión v0.3 (2026-10-30):** incorpora la evidencia de T-004 (PR #1076, informe `docs/reportes/COST_ENGINE_T004_DIAGNOSTICS_2026-10-30.md`):
> la reconstrucción de tasas por división de importes redondeados **no** es exacta (42/72 escenarios), así que los motores
> deberán exponer sus tasas efectivas, base y divisor (§5).
>
> **Revisión v0.2 (2026-10-30):** incorpora una auditoría externa de la v0.1. Los hallazgos de código se
> verificaron contra `main` y se marcan *(verificado)*. Los datos externos (impuestos de Florida, cifras BLS,
> guías AACE/RSMeans) vienen de esa auditoría y **no los verifiqué**: se marcan *(reportado)* y no pueden
> sustentar valores económicos sin validación (§11). Las decisiones Q1, Q4, Q6 y Q8 son **recomendaciones
> adoptadas para este borrador**; no equivalen a aprobar valores económicos, desplegar ni activar precios. La
> aprobación de la spec, la implementación y la activación de precios son tres autorizaciones distintas.

## 1. Problema y resultado

**Para quién:** clientes que reciben estimados, contratistas que cotizan, organizaciones/empresas y el equipo de
operaciones que responde por la calidad y la rentabilidad de los precios.

**Problema (leyendo el repo el 2026-10-30):**

1. **Hay varios sistemas de costos paralelos** *(verificado)*: (a) los 24 motores por oficio de `packages/tools`;
   (b) la fórmula plana de Smart Intake (`rates.baseMin/baseMax`); (c) `quote-engine.ts`, que recalcula overhead,
   ganancia, comisión, contingencia e impuestos con **su propia composición** (agrega contingencia y cambia el
   orden de los factores respecto a `buildCostSummary`); (d) `contractor-estimate.service.ts`, que llama a IA y a
   finanzas sin usar `pricing/*`. El **ADR-027** (Accepted, 2026-09-14) ya decidió que `pricing/*` es la autoridad
   determinista de los valores económicos y que `contractor-estimate` debe adaptarse: esta spec lo implementa y no
   abre una tercera arquitectura.
2. **Impuesto universal incorrecto (P0)** *(verificado en código; la regla fiscal es reportada)*:
   `buildCostSummary` aplica `taxRate = 7 %` fijo sobre el subtotal con márgenes y comisión. Un impuesto único no
   representa el tratamiento fiscal de servicios de construcción, que según la auditoría varía por jurisdicción, tipo
   de contrato y componentes gravables (Florida lo distingue). Requiere una política fiscal versionada y revisada por
   un profesional fiscal, no un porcentaje editable.
3. **Conversión PPI incorrecta (P0)** *(verificado en código; la metodología es reportada)*: `bls-ppi.service.ts`
   calcula `precio = basePrice × índice / 100`, con precios base descritos como promedios de 2024 y un comentario
   que asume base 2012 = 100. Un índice PPI mide variación, no es un precio, y el factor correcto compara el índice
   actual con el índice **de la fecha del precio base**, respetando unidad y clasificación del material.
4. **Márgenes fijos y márgenes por oficio** *(verificado)*: `cost-engine.ts` define fee 5 %, overhead 15 %, ganancia
   20 % e impuesto 7 %, pero **los motores pasan sus propios márgenes** a `buildCostSummary` (por ejemplo HVAC
   17 %/22 %, baño 15 %/22 %, limpieza 10 %/18 %, y varios cambian el overhead según complejidad o terreno).
   Sustituirlos por valores globales borraría decisiones técnicas del oficio.
5. **Salarios estadísticos como tarifas** *(parcialmente verificado)*: la base nacional de `contractor-rate.service`
   promedia 12 oficios de OEWS. Un salario medio no es el costo facturable de una cuadrilla (seguros, cargas,
   traslado, gastos generales).
6. **Ya existe configuración por contratista** *(verificado)*: `ContractorRateService`/`ContractorRateOverride`
   (tarifa por hora y markup). Crear otra configuración paralela produciría reglas contradictorias.
7. **Sin trazabilidad:** un estimado no guarda qué parámetros, precios ni versión del motor usó, así que no se
   puede explicar ni reproducir cuando hay una disputa.
8. **Rangos engañosos:** el estimador plano de Smart Intake produjo $109 – $1,638 con "high confidence" para una
   reparación de fuga (máximo = 15× el mínimo sin importar las respuestas) *(verificado en producción)*.

**Resultado esperado:** un único servicio de costos, conforme al ADR-027, que cualquier módulo invoque, que:

- calcule con los motores existentes y los parámetros **efectivos** de cada contexto, sin perder los márgenes propios del oficio;
- gobierne **todos** los importes: Smart Intake, ProTools, `quote-engine` y `contractor-estimate`, migrados por etapas;
- configure los parámetros por capas con límites, motivo, auditoría y, para comisión e impuestos, doble aprobación;
- aplique una `TaxPolicy` versionada en lugar de un porcentaje universal;
- devuelva y guarde una **traza reproducible**, y nunca recalcule en silencio un estimado aceptado;
- exprese la incertidumbre según las condiciones y riesgos del proyecto, y asigne confianza por evidencia retrospectiva.

## 2. Alcance

### Incluido

- Servicio `CostEngineService` en `apps/api/src/modules/pricing/` que envuelve los motores de `packages/tools`.
- Registro de parámetros (`PARAMETER_REGISTRY`) con valor por defecto, límites y capas permitidas.
- Resolución por capas con procedencia: contratista > organización > región > plataforma > default efectivo del motor.
- Reuso de `ContractorRateOverride` como la capa contratista (no se duplica).
- Recalculo del resumen de costos fuera de los motores, **preservando los márgenes propios de cada oficio** (§5).
- `TaxPolicy` versionada por jurisdicción, tipo de contrato y componentes gravables.
- Corrección de la metodología PPI (precio de referencia con fecha, índice de esa fecha y unidad).
- Unificación de la composición final: `quote-engine` y `contractor-estimate` pasan por el servicio (por etapas).
- Traza de cálculo persistida; estimados aceptados inmutables.
- Adaptador de Smart Intake con rango por escenarios y modo sombra.
- API admin, flujo de doble aprobación y pantallas para plataforma, región, organización y contratista.
- Matriz de visibilidad por actor (§3, Q6).

### Fuera de alcance

- Editar el catálogo de materiales o los rendimientos por oficio dentro de cada motor (siguen en código y se validan en §11).
- Precios de proveedores en vivo distintos de BLS; monedas distintas de USD; mercados fuera de EE. UU.
- Reemplazar el motor de escrow/pagos (`escrow-engine`) o cambiar cómo se libera dinero. La IA nunca mueve fondos.
- Reescribir los motores por oficio.
- Asesoría fiscal: la `TaxPolicy` requiere revisión de un profesional fiscal; esta spec solo define el mecanismo.

### Relación con otras specs (Q8)

- Esta spec es la **especificación rectora**. `api-smart-intake-regional-rates` (PR #1074, `DRAFT`) se integra aquí
  y se documentará como `SUPERSEDED`, enlazando esta spec. **No se cierra ni se modifica el #1074 sin tu
  confirmación.** Trazabilidad de lo que se conserva:

| Requisito del #1074 | Dónde queda aquí |
|---|---|
| Resolver región desde `city` (ZIP, "Ciudad, ST", nombre de estado) | §5 `resolveRegion` |
| Reuso de `LocationCostIndex`/`LocationCostService` sin red en el intake público | §5 y §4 casos borde |
| Procedencia y fuente (`oews`/`static`/`manual`/`national`) y `regionalAdjustment` | §5 `costTrace.region` |
| Anulaciones por estado con motivo, `AuditLog` y reversión | §5 capa `region`, §7 `CostParameter` |
| Permiso admin de plataforma y rango [0.5, 2.0] | §3 y registro §5 |
| Un refresh de OEWS no pisa una anulación | §4 casos borde |
| Supuestos es/en y tip "añade estado o ZIP" | §5 UI |
| Flag de activación gradual y reversión | §8 |
| Ancho de rango: **no** se conserva como objetivo fijo (ver P3 y §11) | — |

## 3. Actores, permisos y límites

| Actor | Capa que puede escribir | Parámetros | Condición |
|---|---|---|---|
| Admin de operaciones (`OPS_ADMIN`) | plataforma y región | los de su capa | motivo obligatorio; comisión e impuestos con doble aprobación |
| Administrador de precios de una organización | su organización | `overheadRate`, `profitRate`, `contingencyRate`, `laborRatePerHour`, `materialMarkup` | permiso `pricing:org:manage` (ver abajo) |
| Contratista | solo la suya | `laborRatePerHour`, `materialMarkup`, `overheadRate`, `profitRate` | vía `ContractorRateOverride` y su extensión |
| Cliente (anónimo o autenticado) | ninguna | — | solo recibe el resultado según su modo |

- **Q4 — administrador de organización:** `rbac.ts` no define un rol `ORG_ADMIN` *(verificado)*, pero Prisma ya
  tiene `Membership` (`userId`, `orgId`, `roleId`, `status`; solo `ACTIVE` autoriza) y `Role`/`Permission`/`RolePermission`
  (ADR-040). Se crea el permiso **`pricing:org:manage`**, concedido por una membresía **activa** de esa organización.
  Un nombre de rol no basta. Cada escritura verifica `tenantId`, `orgId`, usuario y permiso en el servidor. Un
  supervisor de campo no lo recibe por defecto.
- **Parámetros reservados a plataforma** (ninguna capa inferior los cambia): `platformFeeRate` y la `TaxPolicy`.
- **Q1 — doble control para comisión e impuestos:** quien propone no puede aprobar su propio cambio; se requieren
  **dos identidades administrativas distintas** (solicitante y aprobador) y **reautenticación reciente del
  ejecutor**. La aprobación se liga a valores concretos, versión, justificación y fecha de vigencia, y **caduca** si
  la propuesta cambia. Las modificaciones se auditan en un registro que el mismo administrador no pueda alterar.
  La comisión SEMSE es política comercial centralizada; la **fiscalidad es una política jurídica distinta** de los
  márgenes y exige revisión fiscal profesional (la aprobación administrativa no la sustituye).
- **Tenant boundary:** la configuración de organización y contratista nunca se lee ni escribe entre tenants ni entre
  organizaciones (un usuario con acceso a varias empresas no puede alterar la equivocada). Plataforma y región son globales.
- **Step-up:** además de lo anterior, cualquier cambio exige motivo ≥ 10 caracteres.
- **Datos `privacyCritical`:** no; la ciudad ya pertenece al intake y no sale a servicios externos.
- **Auditoría:** `AuditLog` con `entityType: "CostParameter"`/`"TaxPolicy"`, `before`/`after`, actor, aprobador, IP y user agent.

### Q6 — Visibilidad (también en las respuestas JSON, no solo en la UI)

| Información | Cliente | Contratista | Operaciones autorizadas |
|---|---|---|---|
| Precio total y alcance | Sí | Sí | Sí |
| Materiales y mano de obra presupuestados | Desglose comercial | Desglose interno | Según autorización |
| Ganancia, overhead y markup privados | No | Los propios | Según autorización |
| Comisión SEMSE facturada al cliente | Sí, cuando proceda | Según contrato | Sí |
| Impuestos y cargos exigibles | Sí | Sí | Sí |
| Traza técnica completa | No | La propia, limitada | Acceso auditado |

Ocultar márgenes no significa ocultar cargos que el cliente debe pagar. El serializador por modo recorta los
campos en el servidor; hay pruebas que verifican que `client` no recibe `overhead`, `profit`, `markup` ni la traza.

## 4. Escenarios y criterios de aceptación

### P1 — Costo con parámetros efectivos y traza

```gherkin
DADO un contratista con overhead 12 % en su capa, una organización con profit 18 % y la plataforma con fee 5 %
CUANDO se calcula el costo de un trabajo de HVAC en CA
ENTONCES overhead = 12 % (contratista), profit = 18 % (organización), fee = 5 % (plataforma)
Y los parámetros que ninguna capa define conservan el valor propio del oficio (HVAC) y no un global
Y los multiplicadores de mano de obra y material son los de CA con su fuente
Y la respuesta incluye costTrace: parámetros con valor, capa de origen y versión, versión del motor, fecha de precios y jurisdicción fiscal
```

### P2 — Un nivel inferior no puede tocar lo reservado

```gherkin
DADO un contratista con sesión válida
CUANDO intenta guardar platformFeeRate o una TaxPolicy en su capa
ENTONCES recibe 403 y no se escribe nada
```

### P3 — Incertidumbre por condiciones, no por un ancho fijo

```gherkin
DADO un intake con respuestas aproximadas ("2–4 accesorios", "no estoy seguro")
CUANDO se genera el estimado con COST_ENGINE_SMART_INTAKE activo
ENTONCES el rango sale de ejecutar el motor con los escenarios bajo y alto de cada respuesta aproximada
Y los supuestos listan qué respuestas generaron incertidumbre
Y la etiqueta de confianza NO depende solo de cuántas preguntas se respondieron
Y la confianza "alta" solo puede asignarse cuando existe calibración retrospectiva (estimado vs. costo observado) para ese oficio, región y complejidad
```

El ancho máximo del rango (6×/4×/2.5× propuesto en la v0.1) **ya no es un criterio de aceptación**: una auditoría
*(reportada, AACE)* distingue madurez del alcance de precisión del presupuesto y desaconseja forzar un ancho
predeterminado. Mientras no haya calibración, la etiqueta es "Preliminar" y se muestra el rango tal como sale del motor.

### P4 — Reproducibilidad e inmutabilidad

```gherkin
DADO un estimado guardado con costTrace
CUANDO un admin cambia un parámetro o una TaxPolicy después
ENTONCES el estimado guardado no cambia al leerse
Y un estimado aceptado, un contrato, un hito o un escrow nunca se recalculan en silencio
Y regenerar produce un estimado nuevo con su propia traza
```

### P5 — Modo sombra

```gherkin
DADO COST_ENGINE_SHADOW activo y COST_ENGINE_SMART_INTAKE apagado
CUANDO se genera un estimado en Smart Intake
ENTONCES se sirve el cálculo plano actual sin cambios
Y se registra la diferencia contra el motor (oficio, estado, ratio) sin guardar texto libre
Y un fallo del motor nunca rompe ni retrasa la respuesta
```

### P6 — Doble aprobación de comisión e impuestos

```gherkin
DADO un admin A que propone platformFeeRate = 6 % con motivo y vigencia
CUANDO A intenta aprobar su propia propuesta
ENTONCES recibe 403
Y un admin B distinto, con reautenticación reciente, puede aprobarla
Y la aprobación queda ligada a esos valores y esa versión; si A edita la propuesta, la aprobación caduca
Y el cambio solo aplica desde su fecha de vigencia y no altera montos ya aceptados
```

### P7 — Política fiscal versionada

```gherkin
DADO una TaxPolicy vigente para una jurisdicción y un tipo de contrato
CUANDO se calcula un costo en esa jurisdicción
ENTONCES los impuestos se calculan sobre los componentes que la política declara gravables
Y costTrace registra la política, su versión y su fecha efectiva
Y sin política vigente para esa jurisdicción el estimado se marca "impuestos no determinados" y no usa un 7 % por defecto
```

### P8 — Tres autoridades separadas

```gherkin
DADO un costo interno, un precio de venta y una obligación de pago
CUANDO cambia la tarifa de un oficio
ENTONCES no cambia ningún importe ya aceptado
Y un cálculo de IA nunca es autoridad para mover fondos
```

Casos borde:

- [ ] Parámetro fuera de límites, NaN, negativo, `null` o sin motivo → 400.
- [ ] Contratista u organización intentan escribir en otra → 403/404 sin filtrar existencia.
- [ ] Dos escrituras concurrentes al mismo parámetro: control optimista por versión, respuesta `409`, sin sobrescrituras silenciosas.
- [ ] Capa borrada (reversión): vuelve al valor de la capa siguiente.
- [ ] Respuesta "no estoy seguro": usa el rango completo del campo y lo declara en supuestos.
- [ ] Categoría de Smart Intake sin motor equivalente: usa la fórmula plana y lo registra.
- [ ] Un motor lanza excepción: error tipado; Smart Intake cae a la fórmula plana.
- [ ] `perUnit` de `CostSummary` se conserva al recalcular.
- [ ] Precios PPI vencidos: último valor conocido con su fecha en la traza.
- [ ] El intake público no hace llamadas de red a BLS; el refresh de OEWS no pisa una anulación manual.
- [ ] Un estimado guardado no cambia hasta regenerarse; nunca se recalcula en lectura.
- [ ] El serializador `client` nunca expone márgenes, markup ni traza (prueba negativa sobre el JSON).

## 5. Contratos

### Servicio

```yaml
CostEngineService.compute(request):
  request:
    trade: TradeId
    inputs: object              # específico del motor
    context:
      tenantId: string
      orgId?: string
      contractorUserId?: string
      stateCode?: string        # de resolveRegion
      jurisdiction?: string     # para la TaxPolicy
      mode: client | professional | admin
    options: { traceLevel: "summary" | "full" }
  response:
    result: SemseToolResult     # contrato existente de packages/tools, recortado por modo
    costTrace:
      engineVersion: string
      pricesAsOf: ISO date
      parameters: [ { key, value, source: contractor|org|region|platform|engine_default, version } ]
      region: { stateCode, laborMultiplier, materialMultiplier, source }
      taxPolicy: { id, version, effectiveFrom, jurisdiction } | null
    errors: tipados (INVALID_INPUT, ENGINE_FAILURE, UNKNOWN_TRADE, TAX_POLICY_MISSING)
```

### Recalculo preservando los márgenes del oficio

Los motores devuelven `costs.materials` y `costs.labor` (base) y llaman a `buildCostSummary(materials, labor, options)`
con **márgenes propios** (14 de 24 los varían según la entrada: T-004). Por eso el servicio **no** parte de valores globales:

1. **Los motores exponen directamente lo que usaron** (cambio aditivo y compatible con la respuesta actual):
   `costs.basis = { materials, labor }` sin redondear, `effectiveRates = { overhead, profit, semseFeeRate, taxRate }` y
   `perUnitDivisor`. Es la única fuente: **no se re-derivan por división** (T-004: solo 42/72 reconstrucciones exactas y
   57/66 divisores `total / perUnit` distintos del real).
2. El servicio sobrescribe solo los parámetros que una capa **define explícitamente**; el resto queda como el motor lo calculó.
3. Vuelve a llamar a `buildCostSummary` con ese conjunto y con el impuesto de la `TaxPolicy` (no `DEFAULT_TAX`).

La derivación por división puede usarse únicamente como comprobación cruzada en pruebas, nunca en producción.

**Evidencia T-004 (PR #1076, 72 escenarios, tolerancia cero):** los 24 motores llaman a `buildCostSummary` una vez y
`costs` es exactamente esa salida; reejecutarla con los argumentos capturados reproduce el resultado 72/72. En cambio,
reconstruir por división de importes redondeados da diferencias de ±1 centavo en 30/72 escenarios y recupera mal el
divisor de `perUnit` en 57/66. Por eso el punto 1 exige que los motores expongan base, tasas y divisor. Esos campos se
añaden a los 24 motores (cambio de `packages/tools` aditivo, con pruebas de compatibilidad de la respuesta existente).
Que la reconstrucción sea matemáticamente exacta **no** prueba que ningún precio o margen sea comercialmente correcto. La composición de `quote-engine` (que agrega
contingencia y otro orden de factores) pasa a ser una variante explícita del servicio, no una fórmula paralela.

### Registro de parámetros (en código, valores por defecto = propuesta sin aprobar)

```yaml
PARAMETER_REGISTRY:
  overheadRate:        { default: "efectivo del motor", min: 0.00, max: 0.40, layers: [platform, org, contractor] }
  profitRate:          { default: "efectivo del motor", min: 0.00, max: 0.50, layers: [platform, org, contractor] }
  contingencyRate:     { default: "por riesgo/precisión", min: 0.00, max: 0.30, layers: [platform, org] }
  laborRatePerHour:    { default: "referencia BLS, no facturable", min: 10, max: 250, layers: [platform, org, contractor] }
  materialMarkup:      { default: 0.00, min: 0.00, max: 1.00, layers: [platform, org, contractor] }
  platformFeeRate:     { default: 0.05, min: 0.00, max: 0.15, layers: [platform], approval: dual }   # reservado
  laborMultiplier:     { default: 1.0,  min: 0.5,  max: 2.0,  layers: [region] }
  materialMultiplier:  { default: 1.0,  min: 0.5,  max: 2.0,  layers: [region] }
TaxPolicy: ya no es un parámetro; ver §7.
```

### Precios de materiales (corrección PPI)

```yaml
MaterialPriceObservation: { materialKey, unit, unitPrice, observedAt, supplier?, location?, source, validUntil }
priceNow: unitPrice * (ppiIndex(now, series) / ppiIndex(observedAt, series))
rules: la serie debe ser compatible con el material y la unidad; sin observación verificable, no se presenta como precio unitario confirmado
```

### API — `/v1/pricing/cost-parameters` y `/v1/pricing/tax-policies` (nuevos)

```yaml
GET    /v1/pricing/cost-parameters?scope=platform|region|org|contractor&scopeId=
PUT    /v1/pricing/cost-parameters/:scope/:scopeId/:key     # body: { value, reason, expectedVersion }
DELETE /v1/pricing/cost-parameters/:scope/:scopeId/:key     # revierte a la capa siguiente
POST   /v1/pricing/cost-parameter-changes                   # propuesta con doble control (fee, tax)
POST   /v1/pricing/cost-parameter-changes/:id/approve       # aprobador distinto + reautenticación reciente
auth: required
permissions: plataforma/región → OPS_ADMIN; organización → pricing:org:manage; contratista → propia fila
errors: { 400, 401, 403, 404, 409: versión en conflicto }
effects: { audit_log: true, domain_event: false, sse: false, payment_governance: true }
```

### UI

```yaml
surfaces:
  - admin: parámetros de plataforma/región, propuestas pendientes y políticas fiscales
  - organización: márgenes de su organización
  - contratista: sus tarifas y márgenes
  - tarjeta de estimado: ver diseño abajo
states: [loading, empty, ready, forbidden, degraded, error]
required_behavior:
  - cada pantalla muestra valor efectivo, capa de origen y límites; exige motivo
  - los parámetros reservados solo aparecen en admin
  - la tarjeta distingue "estimado preliminar", "cotización" y "precio contratado"
  - muestra estado de la estimación, ubicación, fecha de precios y "¿cómo se calculó?" según el modo
  - es/en completos, moneda localizada, estados de error y accesibilidad móvil
  - opción "No sé" en las preguntas y supuestos explicados
  - aviso: el estimado preliminar no es una oferta contractual ni autoriza cobro o liberación de fondos
```

### Agente/Prometeo

```yaml
tools: [protools estimate]
approval_policy: la IA nunca cambia parámetros ni políticas del motor y nunca es autoridad para mover fondos
forbidden_behavior: escribir CostParameter/TaxPolicy, saltarse límites o capas, recalcular estimados aceptados
```

## 6. FSM, eventos y reconstrucción

- FSM afectado: ninguno directamente. Un estimado es derivado, pero alimenta cotizaciones y escrow: la traza se
  guarda con el resultado y los importes aceptados **no** se recalculan.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md`. Costo interno, precio de venta y obligación de pago son
  tres cosas distintas (P8).
- Eventos: **ninguno nuevo** en `EVENT_CATALOG.md`. Rastro: `AuditLog`.
- Replay/rebuild: un estimado se reproduce con su `costTrace`.
- DLQ/compensación: no aplica.

## 7. Datos y migración

- `CostParameter` (`id`, `scope`, `scopeId`, `key`, `value Decimal`, `version Int`, `reason`, `createdBy`,
  `createdAt`, `updatedAt`; único por `scope+scopeId+key`). Solo excepciones; sin filas rige el registro/motor.
- `CostParameterChange` (`id`, `scope`, `scopeId`, `key`, `proposedValue`, `reason`, `effectiveFrom`, `proposedBy`,
  `approvedBy?`, `approvedAt?`, `status`, `expiresAt`, `proposalVersion`): flujo de doble control para fee y tax.
- `TaxPolicy` (`id`, `jurisdiction`, `contractType`, `rulesJson`, `version`, `effectiveFrom`, `effectiveTo?`,
  `reviewedBy`, `reviewedAt`, `status`): versionada e inmutable una vez activa; una corrección crea una versión nueva.
- `MaterialPriceObservation` (§5): se difiere a la fase de datos de mercado; hasta entonces el PPI queda marcado como no confiable.
- Los estimados guardados siguen usando `ProjectIntake.generatedEstimateJson`; `costTrace` y `regionalAdjustment`
  viven ahí sin migración.
- Migración: aditiva, tablas nuevas sin FK a las existentes (los `scopeId` son texto validado en servicio).
- Estrategia expand/contract: solo expand. Backfill: ninguno. Drift: `prisma migrate diff` (`semse-prisma-workflow`).
- Compatibilidad hacia atrás: la fórmula plana de Smart Intake y `quote-engine` se mantienen hasta migrarlos con evidencia.
- Rollback de código: apagar `COST_ENGINE_SMART_INTAKE`/`COST_ENGINE_SHADOW`. De datos: borrar filas; vuelve el comportamiento actual.

> Nunca `prisma db push` en producción. Las migraciones se crean solo en la fase 3 y con aprobación explícita del owner (AGENTS.md).

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: latencia p95 de `compute` y de `analyze`/`estimate`; tasa de `ENGINE_FAILURE`; caída a fórmula plana;
  ratio motor/plana por oficio y estado (sombra); proporción de estimados con "impuestos no determinados".
- Logs: `trade`, `stateCode`, capas aplicadas y versión; sin texto libre del cliente ni márgenes del contratista.
- Feature flags separados: `COST_ENGINE_SHADOW`, `COST_ENGINE_SMART_INTAKE` (apagados por defecto); alinear con el mecanismo vigente.
- Canary: sombra con criterio de salida medible (Q7), luego activación por oficio, de menor a mayor riesgo, con smoke en Chrome.
- Evidencia de producción: informe de sombra, capturas con traza y registros de `AuditLog` y de aprobaciones.
- Señal de rollback: ratio fuera de lo aprobado, `ENGINE_FAILURE` sobre el umbral o regresión de p95.
- Owner operativo: semse-core.

## 9. Tests requeridos

- [x] *(T-004, PR #1076)* **Diagnóstico de los 24 motores (72 escenarios):** componentes base, resultado actual, reconstrucción con `buildCostSummary`, unidades, redondeos y escenarios límite; verifica también los márgenes propios del oficio.
- [ ] Resolución por capas: precedencia, límites, capas reservadas, reversión y conservación del default del oficio.
- [ ] `TaxPolicy`: vigencia, componentes gravables, jurisdicción sin política (sin 7 % implícito).
- [ ] Doble control: el solicitante no aprueba, caducidad al editar, reautenticación, vigencia.
- [ ] Control optimista de versión (`409`) e idempotencia de PUT/DELETE.
- [ ] Privacidad: pruebas negativas sobre el JSON del modo `client`.
- [ ] Aislamiento entre tenants y organizaciones; permiso `pricing:org:manage` con membresía inactiva o de otra organización.
- [ ] Unificación: `quote-engine` y `contractor-estimate` producen el mismo total que el servicio para el mismo caso.
- [ ] PPI: conversión con índice de la fecha del precio base, unidad y serie compatibles.
- [ ] Adaptador de Smart Intake: respuestas → entradas por categoría; rango por escenarios; sin regresión con flags apagados.
- [ ] Sombra: no cambia la respuesta ni bloquea ante fallos.
- [ ] Inmutabilidad: un estimado aceptado no se recalcula.
- [ ] Migración reproducible; UI en sus seis estados y es/en; canary autenticado en producción.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/pricing/cost-engine.service.ts`, `cost-parameter-registry.ts`, `cost-parameter.service.ts`, `tax-policy.service.ts` (nuevos).
- `apps/api/src/modules/pricing/{location-cost,contractor-rate,bls-ppi,oews}.service.ts` y `pricing.controller.ts`.
- `apps/api/src/modules/contractor/contractor-estimate.service.ts`: adaptar según ADR-027.
- `apps/api/src/modules/smart-intake/`: adaptador y rango por escenarios.
- `apps/api/src/modules/tools/tools.service.ts` y `semse-agents/protools.agent.ts`: consumidores posteriores.

### Packages

- `packages/tools/src/business/quote-engine.ts`: composición única vía servicio.
- `packages/auth/src/rbac.ts`: `pricing:org:manage` y permisos de plataforma.
- `packages/schemas/src/`: contratos de `CostParameter`, `TaxPolicy` y `costTrace`.
- `packages/db/prisma/schema.prisma` y migración (fase 3).

### Web

- Pantallas admin, organización y contratista; tarjeta de estimado en `apps/web/components/project-intake/`.

### Tests

- `apps/api/test/cost-engine-*.test.ts` (nuevos) y los existentes de Smart Intake, ProTools y precios.

## 11. Investigación externa y preguntas

### Decididas (recomendación adoptada para este borrador; no aprueban valores)

- **Q1** doble control + reautenticación para comisión e impuestos; fiscalidad como `TaxPolicy` versionada (§3, P6, P7).
- **Q4** permiso `pricing:org:manage` vía `Membership` activa; sin rol `ORG_ADMIN` nuevo (§3).
- **Q6** márgenes privados, matriz de visibilidad aplicada en el servidor (§3).
- **Q8** esta spec es la rectora; #1074 pasa a `SUPERSEDED` tras tu confirmación (§2).

### Pendientes (bloquean `APPROVED`; criterios medibles y validación profesional)

- **Q2** criterio de calibración de confianza: qué evidencia retrospectiva (estimado vs. costo observado) y por qué oficio/región/complejidad.
- **Q3** valores por defecto y límites del registro de parámetros.
- **Q5** política de aviso si un estimado guardado quedó desactualizado.
- **Q7** duración y criterio de salida del modo sombra.
- **Q9** mapeo respuesta → cantidades representativas por categoría, revisado por especialistas de cada oficio.
- **Q10** revisión fiscal profesional de las `TaxPolicy` iniciales (jurisdicciones y tipos de contrato a cubrir primero).
- **Q11** fuente y fecha de los precios de referencia por material y derechos de uso de datos tipo RSMeans.

### Validación de datos (pendiente; no certificada)

- **No verifiqué** que precios base, rendimientos, multiplicadores, márgenes ni salarios reflejen el mercado actual.
  Los multiplicadores estáticos "tipo RSMeans 2023" no pueden presentarse como validados sin referencias y derechos de uso.
- **Licencia RSMeans** *(citado por el owner, no verificado por mí)*: las condiciones publicadas por Gordian para RSMeans
  Online restringen integrar sus datos en programas de software y bases de datos salvo autorización contractual. SEMSE
  no debe incorporar datos propietarios de RSMeans a un motor SaaS sin comprobar que tiene derechos suficientes; puede usar
  datos de fuentes autorizadas y estimaciones propias, pero no debe asumir que una suscripción de usuario permite
  redistribución comercial (Q11).
- **Fiscalidad de Florida** *(citado por el owner)*: la guía vigente del Departamento de Ingresos distingue los contratos de
  mejora de inmuebles (precio global, costo más honorarios, tiempo y materiales) de los de venta minorista con instalación;
  en los primeros, en general el contratista paga el impuesto sobre materiales y no lo cobra al propietario como línea
  aparte. Respalda quitar el 7 % universal, **pero no certifica una `TaxPolicy` lista para producción**: Q10 sigue exigiendo
  revisión fiscal profesional.
- **AACE** *(citado por el owner)*: para edificios y construcción general es más aplicable la práctica recomendada
  **56R-08** que la orientada a plantas de proceso; considera la madurez del alcance y los riesgos al evaluar la exactitud (Q2).
- Reportado por la auditoría y por contrastar: los datos OEWS más recientes son estadísticos (p. ej. mayo 2025), no
  tarifas facturables; los precios deben guardarse con proveedor, ubicación, unidad, fecha y vigencia; los rendimientos
  deben distinguir cuadrilla, desperdicio, acceso, transporte y preparación; la exactitud debe medirse
  retrospectivamente. Fuentes a consultar: BLS OEWS y PPI, RSMeans, AACE International (clasificación de estimados),
  NIST AC-5/AC-3(2) y OWASP para la separación de funciones.
- Aplicado ahora: nada. Backlog: migrar ProTools, Prometeo, cotizaciones y órdenes de cambio. Descartado: reescribir los motores.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
