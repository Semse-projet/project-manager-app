---
id: "api-cost-engine"
title: "Motor de costos unificado"
domain: "pricing"
sdd_version: "2.0"
version: "0.1"
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
  - "packages/tools/src/core/cost-engine.ts"
  - "packages/tools/src/core/types.ts"
  - "packages/tools/src/business/quote-engine.ts"
  - "apps/api/src/modules/tools/tools.service.ts"
  - "apps/api/src/modules/pricing/location-cost.service.ts"
  - "apps/api/src/modules/pricing/contractor-rate.service.ts"
  - "apps/api/src/modules/pricing/pricing.controller.ts"
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

> Spec SDD 2.0 **DRAFT**. No autoriza implementación hasta pasar a `APPROVED`.
> Riesgo **alto**: los parámetros del motor (comisión SEMSE, impuestos, márgenes) afectan lo que se
> cotiza, se contrata y se paga en escrow.

## 1. Problema y resultado

**Para quién:** clientes que reciben estimados, contratistas que cotizan, organizaciones/empresas y el equipo de
operaciones que responde por la calidad y la rentabilidad de los precios.

**Problema (verificado leyendo el repo el 2026-10-30):**

1. **Hay dos sistemas de costos paralelos.** `packages/tools` tiene 24 motores por oficio (plomería, pintura,
   techos, HVAC…) que calculan materiales, mano de obra, overhead, ganancia, comisión SEMSE e impuestos, con
   precios BLS y multiplicadores por ubicación. Smart Intake **no los usa**: calcula con una fórmula plana por
   categoría (`rates.baseMin/baseMax`). Los motores solo se invocan desde ProTools, Prometeo y el puente
   posterior a publicar (`intake-operations-bridge`).
2. **Los márgenes están fijos en el código.** `cost-engine.ts` define `SEMSE_FEE_RATE = 5 %`,
   `DEFAULT_OVERHEAD = 15 %`, `DEFAULT_PROFIT = 20 %` y `DEFAULT_TAX = 7 %` (el propio comentario dice que el
   impuesto "varía por estado"). Nadie puede ajustarlos sin desplegar código, ni por organización ni por contratista.
3. **No hay trazabilidad.** Un estimado no guarda qué parámetros, precios ni versión del motor usó, así que no
   se puede explicar ni reproducir cuando hay una disputa.
4. **Los rangos engañan.** El estimador plano de Smart Intake produjo $109 – $1,638 con "high confidence" para
   una reparación de fuga (máximo = 15× el mínimo, sin importar las respuestas).

**Resultado esperado:** un único servicio de costos que cualquier módulo invoque, que:

- calcule con los motores existentes y los parámetros **efectivos** de cada contexto;
- permita configurar esos parámetros por capas (plataforma, región, organización, contratista) con límites,
  motivo y auditoría;
- devuelva y guarde una **traza** (parámetros usados y su origen, precios, versión del motor);
- produzca rangos honestos a partir de escenarios de entrada, no de topes fijos.

## 2. Alcance

### Incluido

- Servicio `CostEngineService` en la API que envuelve los motores de `packages/tools`.
- Registro de parámetros (`PARAMETER_REGISTRY`) con valor por defecto, límites y capas permitidas.
- Resolución por capas con procedencia: contratista > organización > región > plataforma > default del motor.
- Recalculo del resumen de costos fuera de los motores (ver §5), sin tocar los 24 motores.
- Traza de cálculo persistida con cada estimado.
- Adaptador de Smart Intake que traduce respuestas a entradas del motor y produce el rango por escenarios.
- API admin y pantallas para capas plataforma, región, organización y contratista.
- Modo sombra: calcular con el motor y con la fórmula plana, servir la plana y registrar la diferencia.

### Fuera de alcance

- Editar el catálogo de materiales o rendimientos por oficio dentro de cada motor (se mantiene en código).
- Precios de proveedores en vivo distintos de BLS; monedas distintas de USD; mercados fuera de EE. UU.
- Reemplazar el motor de escrow/pagos (`escrow-engine`) o cambiar cómo se libera dinero.
- Reescribir los motores por oficio.
- Migrar los consumidores distintos de Smart Intake (ProTools, Prometeo, cotizaciones, órdenes de cambio):
  se hace en fases posteriores y cada uno con su propia verificación.

### Relación con otras specs

- `api-smart-intake-regional-rates` (PR #1074, `DRAFT`): su resolución de región (ZIP, "Ciudad, ST", nombre de
  estado) y el uso de `LocationCostIndex` se reutilizan aquí. Su tabla `LocationCostOverride` se generaliza como la
  capa **región** de `CostParameter`. Decidir si #1074 se cierra o se reduce a la fase de región (ver Q8).

## 3. Actores, permisos y límites

| Actor | Capa que puede escribir | Parámetros | Límites |
|---|---|---|---|
| Admin de operaciones (`OPS_ADMIN`) | plataforma y región | todos | rangos del registro; motivo obligatorio |
| Administrador de organización | su organización | `overheadRate`, `profitRate`, `contingencyRate`, `laborRatePerHour`, `materialMarkup` | dentro de los límites del registro; no toca otras organizaciones |
| Contratista | solo la suya (contratista) | `laborRatePerHour`, `materialMarkup`, `overheadRate`, `profitRate` | idem; **no** ve ni edita parámetros de plataforma |
| Cliente (anónimo o autenticado) | ninguna | — | solo recibe el resultado según su modo |

- **Parámetros solo de plataforma** (ninguna capa inferior los puede cambiar): `platformFeeRate` (comisión
  SEMSE) y `taxRate`. Son ingreso de plataforma y obligación fiscal; ver Q1.
- **Tenant boundary:** la configuración de organización y contratista nunca se lee ni escribe entre tenants.
  Los datos de plataforma y región son globales y solo los escribe `OPS_ADMIN`.
- **Ownership/resource policy:** un contratista solo edita su propia fila; un administrador de organización solo
  la de su `orgId`. Se valida en backend con los permisos existentes (`semse-rbac-permissions`).
- **Visibilidad de márgenes:** el modo `client` de los motores no expone `overhead`, `profit` ni la traza de
  parámetros del contratista; el modo `professional` ve los suyos; `admin` ve todo (ver Q6).
- **Step-up o aprobación humana:** cambiar `platformFeeRate` o `taxRate` requiere un segundo admin
  (aprobación de dos personas) o, como mínimo, step-up de sesión (Q1). Todo cambio exige motivo ≥ 10 caracteres.
- **Datos `privacyCritical`:** no; la dirección/ciudad ya pertenece al intake y no sale a servicios externos.
- **Auditoría:** `AuditLog` con `entityType: "CostParameter"`, `before`/`after`, actor, IP y user agent.

## 4. Escenarios y criterios de aceptación

### P1 — Costo con parámetros efectivos y traza

```gherkin
DADO un contratista con overhead 12 % en su capa, una organización con profit 18 % y la plataforma con fee 5 %
CUANDO se calcula el costo de un trabajo de plomería en CA
ENTONCES overhead = 12 % (capa contratista), profit = 18 % (capa organización), fee = 5 % (plataforma)
Y los multiplicadores de mano de obra y material son los de CA con su fuente
Y la respuesta incluye costTrace: cada parámetro con valor, capa de origen y fecha, más versión del motor y fecha de precios
```

### P2 — Un nivel inferior no puede tocar lo reservado

```gherkin
DADO un contratista con sesión válida
CUANDO intenta guardar platformFeeRate = 0 en su capa
ENTONCES recibe 403 y no se escribe nada ni se audita como cambio aplicado
```

### P3 — Rango honesto en Smart Intake

```gherkin
DADO un intake de plomería con respuestas que fijan cantidad de accesorios, acceso y calidad
CUANDO se genera el estimado con COST_ENGINE_SMART_INTAKE activo
ENTONCES el rango sale de ejecutar el motor con los escenarios bajo y alto de cada respuesta aproximada
Y max/min cumple el objetivo de precisión de la spec (Q2) y la etiqueta "high" exige max/min <= 3
```

### P4 — Reproducibilidad

```gherkin
DADO un estimado guardado con costTrace
CUANDO un admin cambia un parámetro después
ENTONCES el estimado guardado no cambia al leerse
Y regenerarlo produce un estimado nuevo con su propia traza
```

### P5 — Modo sombra

```gherkin
DADO COST_ENGINE_SHADOW activo y COST_ENGINE_SMART_INTAKE apagado
CUANDO se genera un estimado en Smart Intake
ENTONCES se sirve el cálculo plano actual sin cambios
Y se registra la diferencia contra el motor (categoría, estado, ratio) sin guardar texto libre del cliente
Y un fallo del motor nunca rompe ni retrasa la respuesta
```

Casos borde:

- [ ] Parámetro fuera de límites, NaN, negativo, `null` o sin motivo → 400.
- [ ] Contratista o administrador de una organización intentan escribir en otra → 403/404 sin filtrar existencia.
- [ ] Dos escrituras concurrentes al mismo parámetro: gana la última con versión; no se pierde la auditoría.
- [ ] Capa borrada (reversión): vuelve al valor de la capa siguiente sin otro efecto.
- [ ] Motor sin escenario para una respuesta ("no estoy seguro"): usa el rango completo del campo y lo declara en supuestos.
- [ ] Categoría de Smart Intake sin motor equivalente: usa la fórmula plana y lo registra.
- [ ] Un motor lanza una excepción: el servicio devuelve error tipado; Smart Intake cae a la fórmula plana.
- [ ] `perUnit` de `CostSummary` se conserva al recalcular (ver §5).
- [ ] Precios BLS vencidos: se usa el último valor conocido y se muestra su fecha en la traza.
- [ ] Impuesto por estado: estado sin entrada → impuesto por defecto declarado en supuestos.

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
      mode: client | professional | admin
    options: { traceLevel: "summary" | "full" }
  response:
    result: SemseToolResult     # contrato existente de packages/tools
    costTrace:
      engineVersion: string
      pricesAsOf: ISO date
      parameters:
        - { key, value, source: contractor|org|region|platform|engine_default, version }
      region: { stateCode, laborMultiplier, materialMultiplier, source }
    errors: tipados (INVALID_INPUT, ENGINE_FAILURE, UNKNOWN_TRADE)
```

### Recalculo de márgenes fuera del motor

Los motores ya devuelven `costs.materials` y `costs.labor` (base antes de márgenes) y llaman a
`buildCostSummary(materials, labor, options)`. El servicio **vuelve a llamar** a `buildCostSummary` con los
parámetros efectivos (`overhead`, `profit`, `semseFeeRate`, `taxRate`, divisor de `perUnit` derivado del
resultado original). Así no se modifican los 24 motores. Este supuesto debe verificarse con pruebas de
contrato por motor antes de aprobar (ver T-004).

### Registro de parámetros (en código, no en base de datos)

```yaml
PARAMETER_REGISTRY:
  overheadRate:        { default: 0.15, min: 0.00, max: 0.40, layers: [platform, org, contractor] }
  profitRate:          { default: 0.20, min: 0.00, max: 0.50, layers: [platform, org, contractor] }
  contingencyRate:     { default: por precisión, min: 0.00, max: 0.30, layers: [platform, org] }
  laborRatePerHour:    { default: tarifa nacional BLS, min: 10, max: 250, layers: [platform, org, contractor] }
  materialMarkup:      { default: 0.00, min: 0.00, max: 1.00, layers: [platform, org, contractor] }
  platformFeeRate:     { default: 0.05, min: 0.00, max: 0.15, layers: [platform] }      # reservado
  taxRate:             { default: 0.07, min: 0.00, max: 0.15, layers: [platform, region] }  # reservado
  laborMultiplier:     { default: 1.0,  min: 0.5,  max: 2.0,  layers: [region] }
  materialMultiplier:  { default: 1.0,  min: 0.5,  max: 2.0,  layers: [region] }
```

Los valores por defecto y límites son una **propuesta** y requieren aprobación (Q1, Q3).

### API — `/v1/pricing/cost-parameters` (nuevo)

```yaml
GET    /v1/pricing/cost-parameters?scope=platform|region|org|contractor&scopeId=
PUT    /v1/pricing/cost-parameters/:scope/:scopeId/:key     # body: { value, reason }
DELETE /v1/pricing/cost-parameters/:scope/:scopeId/:key     # revierte a la capa siguiente
auth: required
permissions: por capa (ver §3); los de plataforma y región solo OPS_ADMIN
errors: { 400: fuera de límites o motivo corto, 401, 403, 404, 409: conflicto de versión }
effects: { audit_log: true, domain_event: false, sse: false, payment_governance: true (fee y tax) }
```

### UI

```yaml
surfaces:
  - admin: parámetros de plataforma y región (tabla con valor base, efectivo y fuente)
  - organización: márgenes de su organización
  - contratista: sus tarifas y márgenes (ya existe parte en /v1/pricing/labor-rates)
  - tarjeta de estimado: región, fuente y "cómo se calculó" resumido (según modo)
states: [loading, empty, ready, forbidden, degraded, error]
required_behavior:
  - cada pantalla muestra valor efectivo, capa de origen y límites; exige motivo para guardar
  - los parámetros reservados aparecen solo en admin
  - textos es/en
```

### Agente/Prometeo

```yaml
tools: [protools estimate]            # consumidor posterior; no se modifica en las primeras fases
approval_policy: la IA nunca cambia parámetros del motor
forbidden_behavior: escribir CostParameter, saltarse límites o capas
```

## 6. FSM, eventos y reconstrucción

- FSM afectado: ninguno directamente. Un estimado es un cálculo derivado; **sí** alimenta cotizaciones y escrow,
  por eso la traza se guarda con el resultado y los valores contratados no se recalculan solos.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md`. Ningún cambio de parámetros modifica montos de contratos,
  hitos o escrow ya existentes.
- Eventos: **ninguno nuevo** en `EVENT_CATALOG.md` (no se inventan nombres). Rastro: `AuditLog`.
- Replay/rebuild: un estimado se reproduce con su `costTrace`; no hay proyección que reconstruir.
- DLQ/compensación: no aplica.

## 7. Datos y migración

- Modelos Prisma (nuevos): `CostParameter` (`id`, `scope`, `scopeId`, `key`, `value Decimal`, `version Int`,
  `reason`, `createdBy`, `createdAt`, `updatedAt`; único por `scope+scopeId+key`). Solo se guardan **excepciones**;
  sin filas, rige el registro en código.
- `ProjectIntake.generatedEstimateJson` ya es JSON: `costTrace` y `regionalAdjustment` se guardan ahí sin migración.
- Migración: aditiva, una tabla nueva sin FK a tablas existentes (el `scopeId` es texto y se valida en servicio).
- Estrategia expand/contract: solo expand; el sistema funciona sin filas.
- Backfill: ninguno.
- Compatibilidad hacia atrás: la fórmula plana de Smart Intake sigue disponible hasta retirarla (fase final).
- Verificación de drift: `prisma migrate diff` según `semse-prisma-workflow`.
- Rollback de código: apagar `COST_ENGINE_SMART_INTAKE` (y `COST_ENGINE_SHADOW`).
- Rollback/forward-fix de datos: borrar filas de `CostParameter`; el sistema vuelve al registro en código.

> Nunca `prisma db push` en producción. La migración la crea solo la fase 3 y solo con aprobación
> explícita del owner (AGENTS.md).

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: latencia p95 de `compute` y de `analyze`/`estimate`; tasa de `ENGINE_FAILURE`; tasa de caída a
  la fórmula plana; distribución del ratio motor/plana por categoría y estado (modo sombra).
- Logs: `trade`, `stateCode`, capas aplicadas y versión; sin texto libre del cliente ni márgenes del contratista.
- Feature flags: `COST_ENGINE_SHADOW` y `COST_ENGINE_SMART_INTAKE` (apagados por defecto); alinear con el
  mecanismo de flags existente.
- Plan de canary: sombra en producción durante un periodo definido (Q7) y revisión de la diferencia; luego
  activar por categoría empezando por las de menor riesgo; smoke en Chrome por categoría y estado.
- Evidencia de producción: informe de la comparación sombra, capturas del estimado con traza y registros de `AuditLog`.
- Señal de rollback: ratio mediano motor/plana fuera de lo aprobado, `ENGINE_FAILURE` > umbral o regresión de p95.
- Owner operativo: semse-core.

## 9. Tests requeridos

- [ ] Contrato por motor: `costs.materials` + `costs.labor` + `buildCostSummary` con parámetros por defecto reproduce el resultado actual (valida el recalculo externo).
- [ ] Resolución por capas: precedencia, límites, capas reservadas y reversión.
- [ ] Adaptador de Smart Intake: tabla respuesta → entrada del motor para cada categoría mapeada; rango por escenarios.
- [ ] Sin regresión de `smart-intake-*` e `intake-*` con los flags apagados.
- [ ] Permiso denegado (403) y aislamiento entre tenants y organizaciones.
- [ ] Concurrencia (versión) e idempotencia de PUT/DELETE.
- [ ] Modo sombra: no cambia la respuesta ni bloquea ante fallos del motor.
- [ ] Migración reproducible y compatible (fase 3).
- [ ] UI: loading/empty/forbidden/degraded/error por pantalla.
- [ ] Canary/smoke autenticado en producción.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/pricing/cost-engine.service.ts` (nuevo), `cost-parameter-registry.ts`, `cost-parameter.service.ts`.
- `apps/api/src/modules/pricing/location-cost.service.ts`: lectura sin red y capa región.
- `apps/api/src/modules/pricing/pricing.controller.ts`: endpoints de parámetros.
- `apps/api/src/modules/smart-intake/`: adaptador respuesta → entrada del motor y rango por escenarios.
- `apps/api/src/modules/tools/tools.service.ts`: consumidor posterior.

### Web

- Pantallas admin, organización y contratista; tarjeta de estimado en `apps/web/components/project-intake/`.

### Worker/Packages/DB

- `packages/db/prisma/schema.prisma` y migración (fase 3).
- `packages/auth/src/rbac.ts`: permisos por capa.
- `packages/schemas/src/`: contratos de `CostParameter` y `costTrace`.

### Tests

- `apps/api/test/cost-engine-*.test.ts` (nuevos) y los existentes de Smart Intake y ProTools.

## 11. Investigación externa y preguntas abiertas

**Estado: pendiente. No puede pasar a `APPROVED` hasta cerrar estos puntos.**

- **Validación de datos:** no verifiqué que los precios base y rendimientos de los motores, los multiplicadores
  de `LocationCostIndex` (BLS OEWS + índices estáticos "tipo RSMeans 2023") ni los márgenes por defecto reflejen
  el mercado actual. Requiere fuentes primarias y revisión de un experto de oficio antes de presentar estimados
  como confiables.
- **Q1:** ¿`platformFeeRate` e `taxRate` quedan reservados a plataforma, y el cambio exige aprobación de dos admins
  o solo step-up? Afecta ingresos y obligaciones fiscales.
- **Q2:** objetivos de ancho de rango según precisión (propuesta de la spec regional: ≤ 6× / 4× / 2.5× y 3× para "high").
- **Q3:** valores por defecto y límites del registro de parámetros.
- **Q4:** ¿quién es "administrador de organización" en el modelo de roles actual? Hay que revisar `Membership`/roles antes del plan.
- **Q5:** política de recálculo: ¿se avisa al cliente si un estimado guardado quedó desactualizado?
- **Q6:** qué ve cada modo (`client`/`professional`/`admin`) y si el cliente puede ver márgenes del contratista (propuesta: no).
- **Q7:** duración y criterio de salida del modo sombra.
- **Q8:** qué hacer con #1074 (cerrar, o reducirla a la fase de región de este motor).
- **Q9:** mapeo respuesta → cantidades representativas por categoría; requiere revisión de oficio.
- Aplicado ahora: nada. Backlog: migrar ProTools, Prometeo, cotizaciones y órdenes de cambio al servicio. Descartado: reescribir los motores por oficio.

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
