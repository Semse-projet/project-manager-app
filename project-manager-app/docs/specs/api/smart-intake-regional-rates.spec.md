---
id: "api-smart-intake-regional-rates"
title: "Smart Intake — Tarifas regionales y rango de estimado"
domain: "smart-intake"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - "SMART_INTAKE_REGIONAL_RATES"
production_evidence: []
related_files:
  - "apps/api/src/modules/smart-intake/smart-intake.logic.ts"
  - "apps/api/src/modules/smart-intake/smart-intake.service.ts"
  - "apps/api/src/modules/smart-intake/smart-intake.types.ts"
  - "apps/api/src/modules/smart-intake/config/category-registry.ts"
  - "apps/api/src/modules/pricing/location-cost.service.ts"
  - "apps/api/src/modules/pricing/oews.service.ts"
  - "apps/api/src/modules/pricing/pricing.controller.ts"
  - "packages/db/prisma/schema.prisma"
  - "packages/auth/src/rbac.ts"
related_tests:
  - "apps/api/test/smart-intake-estimate.test.ts"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "NOT_VERIFIED"
---

# Spec: Smart Intake — Tarifas regionales y rango de estimado

> Spec SDD 2.0 **DRAFT**. No autoriza implementación hasta pasar a `APPROVED`.
> Las specs históricas de Smart Intake (`intake.spec.md` y las de categorías) siguen
> siendo la línea base; esta spec añade comportamiento sobre ellas.

## 1. Problema y resultado

**Para quién:** clientes anónimos y autenticados que usan el wizard de Smart Intake, y el equipo
de operaciones (admin) que responde por la calidad de los estimados.

**Problema (verificado en producción el 2026-10-30):**

1. El estimado usa tarifas en USD **únicas para todo el país**. Un mismo trabajo cuesta igual en
   Miami, Nueva York o Boise, aunque el wizard ya pide la ciudad.
2. El repo **ya tiene** datos de costo por ubicación que Smart Intake no usa: `LocationCostIndex`
   (multiplicadores de mano de obra y material por estado), `LocationCostService` (BLS OEWS +
   índices estáticos tipo RSMeans, con caché de 7 días) y el `price-refresh.job`. Nadie puede
   corregir esos valores a mano: `LocationMultipliers.source` admite `"manual"` pero no existe
   ruta de escritura.
3. El rango del estimado no se estrecha con la información. Ejemplo medido: plomería, "reparación de
   fuga, 2–4 accesorios, acceso fácil", precisión 90 % → **$109 – $1,638** con etiqueta
   "high confidence". En categorías de tarifa fija el máximo es `baseMax / baseMin` veces el mínimo
   (15× en plomería) sin importar cuántas preguntas se respondan.

**Resultado esperado:**

- El estimado refleja la región del trabajo cuando se puede resolver, y dice con claridad qué región
  y qué fuente usó; si no se puede resolver, usa tarifa nacional y lo declara.
- Un admin puede ajustar los multiplicadores de una región con motivo y auditoría, y revertir.
- El rango se estrecha conforme sube la precisión y la etiqueta de confianza no contradice el ancho.

## 2. Alcance

### Incluido

- Resolver región (estado) desde el campo `city` ya existente (ZIP, "Ciudad, ST" o nombre de estado).
- Aplicar multiplicadores regionales de mano de obra y material al estimado de **todas** las categorías.
- Exponer la región aplicada, factores y fuente en el estimado (`regionalAdjustment`) y en los supuestos.
- Estrechar el rango según la precisión y hacer coherente la etiqueta de confianza.
- Anulaciones manuales (`manual`) por estado, con motivo, auditoría y reversión, vía API y pantalla admin.
- Feature flag `SMART_INTAKE_REGIONAL_RATES` para activación gradual.

### Fuera de alcance

- Multiplicadores por metro o condado (solo estado en esta versión; ZIP se usa solo para derivar estado).
- Tarifas por contratista (`ContractorRateOverride`) aplicadas a estimados de Smart Intake.
- Mercados fuera de EE. UU. y monedas distintas de USD (`PUBLIC_MARKET_CURRENCY` = USD).
- Validar que las tarifas base por categoría correspondan al mercado real (ver §11, depende de investigación).
- Cambiar el orden de detección de categoría o el cuestionario.
- Nuevos eventos de dominio (solo `AuditLog`; ver §6).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| Cliente anónimo | público (sesión de intake) | su borrador | Ver estimado ajustado por región | Ver o editar multiplicadores |
| Cliente autenticado | los existentes de Smart Intake | sus intakes | Igual que anónimo | Editar multiplicadores |
| Admin de operaciones | `ops:dashboard:read` (leer) y `pricing:location:manage` (**nuevo**, solo `OPS_ADMIN`) | plataforma (datos globales) | Listar, anular y revertir multiplicadores por estado | Anular fuera de [0.5, 2.0] o sin motivo |

- **Tenant boundary:** `LocationCostIndex` es dato global de plataforma, sin `tenantId`. Las
  escrituras quedan registradas en `AuditLog` con el `tenantId` del admin actor. Ninguna ruta pública
  puede escribir.
- **Ownership/resource policy:** el estimado solo lee multiplicadores; nunca expone quién los editó.
- **Step-up o aprobación humana:** no aplica a dinero movido (el estimado es informativo), pero toda
  anulación exige un motivo de al menos 10 caracteres.
- **Datos `privacyCritical`:** no. `city` ya es dato del intake; no se envía a servicios externos.
  La resolución de región es local y determinista.
- **Auditoría:** `AuditLog` con `entityType: "LocationCostOverride"`, `before`/`after`, actor, IP y user agent.

## 4. Escenarios y criterios de aceptación

### P1 — Estimado con región conocida

```gherkin
DADO un intake de plomería con ciudad "Miami, FL" y el flag activo
CUANDO se genera el estimado
ENTONCES el costo se multiplica por el factor combinado de FL
Y estimate.regionalAdjustment = { stateCode: "FL", laborMultiplier, materialMultiplier, appliedFactor, source }
Y los supuestos incluyen "Región: FL (<fuente>)" en el idioma del intake
```

### P2 — Región no resoluble

```gherkin
DADO un intake con ciudad "Miami" (sin estado ni ZIP) o sin ciudad
CUANDO se genera el estimado
ENTONCES se usa factor 1.0 y regionalAdjustment.source = "national"
Y los supuestos dicen que se usó tarifa nacional promedio
Y los tips sugieren añadir estado o ZIP
```

### P3 — Anulación de admin

```gherkin
DADO un admin con pricing:location:manage
CUANDO fija labor 1.40 para CA con motivo "Mercado SF Bay Area, Q4"
ENTONCES el siguiente estimado de CA usa 1.40 con source = "manual"
Y existe un AuditLog con before/after y el actor
Y al borrar la anulación vuelve a OEWS/estático sin otro cambio
```

### P4 — Rango coherente con la información

```gherkin
DADO un estimado generado con precisión >= 80
CUANDO se calcula totalRange
ENTONCES max/min <= 2.5
Y la etiqueta "high" solo aparece si max/min <= 3
```

Casos borde:

- [ ] ZIP de 5 dígitos, ZIP+4 y ZIP con espacios; "Miami, Florida"; "miami fl"; "St. Louis, MO".
- [ ] Estado inexistente en la tabla → factor 1.0 y fuente `national`.
- [ ] Multiplicador fuera de [0.5, 2.0], NaN, negativo o sin motivo → 400.
- [ ] Caché de `LocationCostIndex` vencida o ausente: el intake público **no** dispara una consulta
      en vivo a BLS; usa el último valor o el estático (ver §5).
- [ ] Un refresh de OEWS no pisa una anulación manual.
- [ ] Estimados ya guardados no cambian hasta regenerarse; nunca se recalculan en lectura.
- [ ] Usuario sin permiso → 403; sin sesión → 401.

## 5. Contratos

### Resolución de región (interno, puro)

```yaml
function: resolveRegion(city: string | null)
returns: { stateCode: string | null, via: "zip" | "state_abbr" | "state_name" | "none" }
rules:
  - zip: 5 dígitos (se ignora +4) -> LocationCostService.zipToState
  - state_abbr: ", ST" o " ST" al final, ST en tabla de estados
  - state_name: nombre de estado completo (sin acentos, minúsculas)
  - none: devuelve null; nunca adivina por nombre de ciudad
```

### Lectura de multiplicadores para el intake

```yaml
function: LocationCostService.getCachedMultipliers(stateCode)
behavior:
  - orden de precedencia: override manual > LocationCostIndex (aunque esté vencido) > tabla estática > 1.0
  - prohíbe llamadas de red; el refresco lo hace price-refresh.job
  - clamp a [0.5, 2.0] antes de usar
```

### Estimado

```yaml
generateEstimate(intake, regional?: RegionalAdjustment | null)   # sigue siendo función pura
RegionalAdjustment:
  stateCode: string | null
  laborMultiplier: number
  materialMultiplier: number
  appliedFactor: number        # laborShare * labor + (1 - laborShare) * material
  source: "oews" | "static" | "manual" | "national"
laborShare: por categoría en CATEGORY_REGISTRY (valor por defecto 0.6; ver pregunta abierta Q1)
ProjectEstimate.regionalAdjustment: añadido; JSON existente, sin migración
```

### Rango

```yaml
spread_target_by_accuracy:      # PROPUESTO, requiere aprobación (Q2)
  "< 35": sin cambio
  "35-59": max/min <= 6
  "60-79": max/min <= 4
  "80+": max/min <= 2.5
method: se conserva la media geométrica del rango original y se comprime hacia ella hasta el objetivo; nunca se amplía
confidence: "high" exige max/min <= 3; si no, baja a "medium"
```

### API admin — `/v1/pricing/location-costs` (endpoint nuevo; aún no existe en `apps/api/src`, por eso `related_endpoints` está vacío hasta la fase C)

```yaml
GET  /v1/pricing/location-costs
  auth: required
  permissions: [ops:dashboard:read]
  output: lista por estado { stateCode, stateName, laborMultiplier, materialMultiplier, source, validUntil, override? }
PUT  /v1/pricing/location-costs/:stateCode/override
  auth: required
  permissions: [pricing:location:manage]
  input: { laborMultiplier?: number, materialMultiplier?: number, reason: string(min 10) }
  errors: { 400: valor fuera de [0.5,2.0] o motivo corto, 401, 403, 404: estado desconocido }
  effects: { audit_log: true, domain_event: false, sse: false, payment_governance: false }
DELETE /v1/pricing/location-costs/:stateCode/override
  auth: required
  permissions: [pricing:location:manage]
  errors: { 401, 403, 404: no hay anulación }
  effects: { audit_log: true }
```

### UI

```yaml
surfaces:
  - "apps/web/app/(app)/admin/pricing/location-costs/page.tsx"   # admin; BFF /api/semse/...
  - landing / wizard: línea de región y fuente en la tarjeta del estimado
states: [loading, empty, ready, forbidden, degraded, error]
required_behavior:
  - la pantalla admin muestra valor base, valor efectivo y fuente, y exige motivo para guardar
  - la tarjeta del estimado traduce los supuestos de región al idioma del intake (es/en)
  - sin región: invita a añadir estado o ZIP
```

### Agente/Prometeo

No aplica.

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno. El estimado es un cálculo derivado, no una transición.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md` (el estimado no mueve ni retiene dinero).
- Eventos declarados: **ninguno nuevo**. `EVENT_CATALOG.md` no se modifica; el rastro es `AuditLog`.
- Replay/rebuild: no aplica. Un estimado se regenera desde las respuestas y los multiplicadores vigentes.
- DLQ/compensación: no aplica.

## 7. Datos y migración

- Modelos Prisma: **nuevo** `LocationCostOverride` (id, stateCode único, laborMultiplier?, materialMultiplier?,
  reason, createdBy, createdAt, updatedAt). Tabla separada de `LocationCostIndex` para que el refresh de
  OEWS no pueda pisar una anulación y para revertir con un `DROP TABLE`.
- Migración: aditiva, una tabla nueva sin FK a tablas existentes; `20261030...` (nombre final en el plan).
- Estrategia expand/contract: solo expand; el código funciona sin filas en la tabla.
- Backfill: ninguno.
- Compatibilidad hacia atrás: las fases A y B no tocan el esquema; los intakes e estimados guardados siguen válidos.
- Verificación de drift: `prisma migrate diff` contra la migración, según `semse-prisma-workflow`.
- Rollback de código: desactivar `SMART_INTAKE_REGIONAL_RATES`.
- Rollback/forward-fix de datos: borrar filas de `LocationCostOverride`; el sistema vuelve a OEWS/estático.

> Nunca usar `prisma db push` en producción. La migración la crea y aplica solo la fase C, y solo con
> aprobación explícita del owner (AGENTS.md).

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: proporción de estimados con `source = "national"` (indica ciudades sin estado), y
  latencia p95 de `analyze`/`estimate` sin regresión > 10 %.
- Logs: estado resuelto y vía (`zip`, `state_abbr`...), sin loguear el texto completo de la ciudad.
- Feature flags: `SMART_INTAKE_REGIONAL_RATES` (por defecto apagado).
- Plan de canary: encender en producción, ejecutar intakes de prueba en 3 estados (uno bajo, uno alto,
  uno sin resolver), comparar contra el cálculo manual de la spec.
- Evidencia de producción requerida: capturas del estimado con `regionalAdjustment` y registro de `AuditLog`.
- Señal de rollback: error 5xx en `analyze`/`estimate` o p95 por encima del umbral.
- Owner operativo: semse-core.

## 9. Tests requeridos

- [ ] Unitarios: `resolveRegion` (tabla de casos de §4), factor combinado, clamp y compresión de rango.
- [ ] `generateEstimate` conserva sus resultados actuales con `regional = null` (sin regresión).
- [ ] Contrato API admin (GET/PUT/DELETE) y validaciones.
- [ ] Permiso denegado (403) y sin sesión (401); un cliente no puede escribir.
- [ ] El intake público no hace llamadas de red a BLS.
- [ ] El refresh de OEWS no borra una anulación manual.
- [ ] Migración reproducible y compatible (solo fase C).
- [ ] UI admin: loading/empty/forbidden/degraded/error.
- [ ] Smoke en producción tras el despliegue, con el flag encendido.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/smart-intake/config/region.ts` (nuevo): `resolveRegion`, tabla de estados.
- `apps/api/src/modules/smart-intake/smart-intake.logic.ts`: `generateEstimate(intake, regional?)`, compresión de rango, confianza.
- `apps/api/src/modules/smart-intake/smart-intake.service.ts`: resolver región y pasar `regional`.
- `apps/api/src/modules/pricing/location-cost.service.ts`: `getCachedMultipliers`, lectura de override.
- `apps/api/src/modules/pricing/pricing.controller.ts`: endpoints admin.

### Web

- `apps/web/app/(app)/admin/pricing/location-costs/page.tsx` y su BFF.
- `apps/web/components/project-intake/preliminary-estimate-card.tsx`: región, fuente y traducción de supuestos.

### Worker/Packages/DB

- `packages/db/prisma/schema.prisma` y migración (solo fase C).
- `packages/auth/src/rbac.ts`: permiso `pricing:location:manage` en `OPS_ADMIN`.
- `packages/schemas/src/`: contratos del admin y de `regionalAdjustment`.

### Tests

- `apps/api/test/smart-intake-estimate.test.ts`, `smart-intake-region.test.ts` (nuevo), `pricing-location-costs.test.ts` (nuevo).

## 11. Investigación externa y preguntas abiertas

**Estado: pendiente. Esta spec no puede pasar a `APPROVED` hasta cerrar estos puntos.**

- Los multiplicadores existentes vienen de BLS OEWS y de una tabla estática marcada en el código como
  aproximación tipo RSMeans 2023. **No verifiqué** que esos valores, ni las tarifas base por categoría
  (`rates.baseMin`/`baseMax`), reflejen el mercado actual. Hace falta una validación con fuentes primarias
  antes de presentar el estimado como confiable.
- **Q1:** ¿`laborShare` por defecto 0.6 es razonable? Debe definirse por categoría (mudanzas es casi 100 %
  mano de obra; pisos es mayormente material).
- **Q2:** ¿Se aprueban los objetivos de rango (6 / 4 / 2.5) y el umbral 3 para la etiqueta "high"?
- **Q3:** ¿Quién es el responsable operativo de revisar anulaciones, y con qué frecuencia?
- **Q4:** ¿Se acepta resolver solo por estado en v1, y metro/ZIP en una versión posterior?
- Aplicado ahora: nada. Backlog: tarifas por contratista (`ContractorRateOverride`). Descartado: tabla
  estática nueva dentro de Smart Intake (duplicaría `LocationCostIndex`).

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
