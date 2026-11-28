---
id: "ui.digital-twin-activation"
title: "Activación del gemelo digital SEMSE: descubribilidad y telemetría first-party"
domain: "ui"
sdd_version: "2.0"
version: "1.0"
status: "REVIEW"
owner: "semse-core"
risk: "medium"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
verification_scope: "none:spec-en-revision-pendiente-de-aprobacion-del-owner"
feature_flags: []
production_evidence: []
related_files:
  - apps/web/components/landing/landing-footer.tsx
  - apps/web/app/sitemap.ts
  - apps/web/app/semse-consciousness-map/page.tsx
  - apps/web/components/semse/semse-consciousness-map.tsx
  - apps/web/components/semse/digital-twin/SemseDigitalTwin.tsx
  - apps/web/components/semse/digital-twin/SemseDigitalTwin2D.tsx
  - apps/web/app/(app)/admin/consciousness/page.tsx
  - apps/web/app/semse-api.ts
  - apps/web/app/api/semse/ops/llm-metrics/route.ts
  - apps/api/src/modules/ops/ops.controller.ts
  - apps/api/src/infrastructure/llm/metrics/provider-metrics.store.ts
  - docs/specs/ui/ecosystem-digital-twin-3d.spec.md
related_tests:
  - tests/e2e-semse/semse-digital-twin.spec.ts
related_endpoints:
  - "POST /v1/ops/twin/events"
  - "GET /v1/ops/twin/metrics"
  - "POST /api/semse/ops/twin-events"
  - "GET /api/semse/ops/twin-metrics"
related_events:
  - map_view
  - view_switch
  - flow_play
  - webgl_fallback
related_agents: []
last_verified: ""
date: "2026-11-28"
author: "Kimi"
spec_index: "docs/SPEC_INDEX.md"
---

# Spec: Activación del gemelo digital SEMSE: descubribilidad y telemetría first-party

> Estado de autorización: este spec se entrega en `REVIEW`. No autoriza escribir
> código. La implementación requiere que el owner lo promueva a `APPROVED`.
> Las decisiones de diseño recogidas aquí (enlace en footer público, contadores
> first-party anónimos, panel dentro de `/admin/consciousness`) fueron
> delegadas por el owner el 2026-11-28.

## 1. Problema y resultado

**Para quién:** visitantes públicos de la landing (descubrimiento) y el equipo
operativo de SEMSE (decisión con datos).

**Problema:** el gemelo digital `/semse-consciousness-map` está fusionado
(#1157) y desplegado en producción desde el 2026-11-19, pero no está enlazado
desde ningún componente de la aplicación ni incluido en `app/sitemap.ts`:
está publicado por topología, no por decisión. Además el repositorio no tiene
ninguna infraestructura de analítica de producto (sin `trackEvent`, sin
dependencia de analítica, sin rutas de eventos), así que nadie puede saber si
la página se usa ni decidir su futuro con evidencia.

**Resultado esperado:** la página es descubrible desde el footer público y por
buscadores vía sitemap; cuatro eventos clave del mapa se cuentan de forma
agregada, anónima y first-party; y un admin ve esos contadores dentro de
`/admin/consciousness`. Con esa señal el owner puede decidir mantener,
promocionar o retirar el gemelo con datos reales.

## 2. Alcance

### Incluido

- Enlace «Gemelo digital» en la columna «Plataforma» de `LandingFooter`,
  apuntando a `/semse-consciousness-map`.
- Entrada de `/semse-consciousness-map` en `apps/web/app/sitemap.ts`.
- Endpoint de ingesta público `POST /v1/ops/twin/events` con allowlist de
  cuatro eventos (`map_view`, `view_switch`, `flow_play`, `webgl_fallback`),
  sin autenticación, sin PII (no IP, no user-agent, no session id, no
  fingerprint) y rate limit en memoria.
- Store de contadores en memoria `TwinTelemetryStore` siguiendo el patrón del
  `ProviderMetricsStore` existente: totales por evento y `since` (arranque del
  proceso). Sin base de datos.
- Endpoint de lectura `GET /v1/ops/twin/metrics` protegido con
  `ops:dashboard:read`.
- Rutas BFF: `POST /api/semse/ops/twin-events` (pública; valida contra la
  allowlist antes de reenviar) y `GET /api/semse/ops/twin-metrics` (patrón
  `fetchSemseDataForRequest`, idéntico a `llm-metrics/route.ts`).
- Emisión de eventos desde el cliente del mapa: `map_view` al montar (deduplicado
  por carga de página), `view_switch` al alternar 3D/2D/lista, `flow_play` al
  reproducir un flujo de valor, `webgl_fallback` cuando la vista 3D no está
  disponible y se sirve el fallback.
- Sección «Gemelo digital — señales de uso» dentro de `/admin/consciousness`
  (sin ruta admin nueva), con estados loading/empty/ready/error y la fecha
  `since` visible.
- Tests: unitarios de allowlist y contadores, contrato API (400/429), permiso
  denegado en la lectura, estados UI de la sección, presencia del enlace y de
  la entrada de sitemap, y E2E del recorrido footer → mapa → contador.

### Fuera de alcance

- Analítica de terceros (PostHog, Google Analytics, Plausible, Umami u otra),
  cookies, banner de consentimiento, fingerprinting, sesiones, funnels,
  retención o cualquier dato personal.
- Persistencia en base de datos: los contadores se reinician en cada
  deploy/restart. Limitación aceptada y declarada; la sección admin muestra
  `since` para no mentir sobre la ventana de medición.
- Cambios en Railway, variables de entorno, DNS, TLS o dominios propios.
- Modificar la visualización o los datos del gemelo (eso pertenece a
  `ui.ecosystem-digital-twin-3d`).
- Autenticar la ruta pública del mapa: permanece pública.
- SEO activo, campañas, cambios en `robots.ts` o en la landing fuera del
  enlace del footer.
- Reset o borrado de contadores vía API: no existe operación de escritura
  administrativa en este incremento.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Visitante anónimo | Ninguno (endpoint público de telemetría) | Sin tenant; contador global de instancia | Emitir eventos de la allowlist | Leer métricas, enviar eventos fuera de la allowlist, identificar o seguir a personas |
| Operador admin autenticado | `ops:dashboard:read` existente | El que ya aplica al resto de `/v1/ops/*` | Leer los contadores agregados vía BFF | Resetear contadores (no hay API), ver datos por individuo (no existen) |

- Tenant boundary: los contadores son globales de la instancia, no por tenant;
  la lectura usa el mismo guard que las demás rutas ops.
- Ownership/resource policy: sin recursos de dominio; no hay ownership nuevo.
- Step-up o aprobación humana: no aplica a lectura de contadores agregados.
- Datos `privacyCritical`: no se captura ni persiste PII. El diseño no admite
  identificadores: el payload sólo acepta el nombre del evento y, opcionalmente,
  la vista (`3d`/`2d`/`list`).
- Requisitos de auditoría: la ingesta no escribe `audit_log` (no hay actor
  autenticado). El abuso se mitiga con allowlist + rate limit; los contadores
  no alimentan decisiones financieras ni de seguridad.

## 4. Escenarios y criterios de aceptación

### P1 — Descubrimiento desde la landing

```gherkin
DADO la landing pública desplegada
CUANDO un visitante llega al footer
ENTONCES ve el enlace «Gemelo digital» en la columna «Plataforma»
Y al pulsarlo navega a /semse-consciousness-map
Y el montaje del mapa registra exactamente un map_view por carga de página
```

Criterios:

- El enlace es un `Link` más de `FOOTER_COLS`; no altera otros enlaces ni el
  layout del footer.
- `GET /sitemap.xml` incluye la URL `/semse-consciousness-map` con el `base`
  ya usado por el archivo.

### P1 — Señal visible para operaciones

```gherkin
DADO un admin autenticado con ops:dashboard:read
CUANDO abre /admin/consciousness
ENTONCES ve la sección «Gemelo digital — señales de uso»
Y los totales de map_view, view_switch, flow_play y webgl_fallback
Y la fecha/hora desde la que se cuentan (since)
```

### P2 — Ingesta robusta y anónima

```gherkin
DADO el endpoint público de ingesta
CUANDO llega un evento fuera de la allowlist o meta inválida
ENTONCES responde 400 y los contadores no cambian
CUANDO un mismo origen excede el ritmo permitido
ENTONCES responde 429 y los contadores no cambian
```

Casos borde:

- [ ] Doble montaje por React StrictMode o navegación con caché: `map_view` se
  deduplica por carga de página en el cliente (guardia en módulo), sin
  identificadores.
- [ ] Lectura de métricas sin sesión o sin `ops:dashboard:read`: misma
  respuesta de denegación que el resto de rutas ops (401/403 vía BFF).
- [ ] Contadores en cero: la sección muestra estado empty honesto, nunca
  números inventados.
- [ ] Deploy/restart reinicia contadores: `since` visible evita interpretar la
  ventana incorrectamente; no se exportan cifras como históricas.

## 5. Contratos

### API — `POST /v1/ops/twin/events`

```yaml
auth: none
permissions: []
input_schema:
  event: "map_view | view_switch | flow_play | webgl_fallback"
  meta:
    view: "3d | 2d | list" # opcional; sólo view_switch/webgl_fallback
output_schema:
  accepted: boolean
errors:
  400: evento fuera de allowlist o meta inválida
  429: rate limit excedido (ventana en memoria por origen)
effects:
  audit_log: none
  domain_event: none
  sse: none
  payment_governance: none
  storage: contadores en memoria; el payload nunca se persiste ni se loguea
```

### API — `GET /v1/ops/twin/metrics`

```yaml
auth: required
permissions: [ops:dashboard:read]
output_schema:
  since: string # ISO-8601, arranque del proceso API
  totals:
    map_view: number
    view_switch: number
    flow_play: number
    webgl_fallback: number
errors:
  401: sin sesión
  403: sin ops:dashboard:read
effects:
  writes: none
```

### BFF (web)

```yaml
POST /api/semse/ops/twin-events:
  público; valida contra la allowlist compartida antes de reenviar a
  POST /v1/ops/twin/events; no añade headers de identidad ni datos del cliente
GET /api/semse/ops/twin-metrics:
  fetchSemseDataForRequest("/v1/ops/twin/metrics", request), patrón idéntico a
  apps/web/app/api/semse/ops/llm-metrics/route.ts
```

### UI

```yaml
surfaces:
  - landing footer (enlace)
  - /sitemap.xml (entrada)
  - /admin/consciousness (sección de señales)
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - la sección muestra since junto a los totales
  - contadores en cero renderizan empty, no cifras falsas
  - el mapa público no muestra UI nueva; la telemetría es invisible
```

### Agente/Prometeo

No aplica: no se añaden tools, prompts, agentes ni citas.

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno de dominio.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md` sin cambios.
- Eventos declarados: los cuatro nombres de la allowlist son telemetría de
  producto agregada, NO eventos de dominio; no se añaden a
  `docs/foundation/EVENT_CATALOG.md`, no usan outbox ni consumidores.
- Replay/rebuild: los contadores se reconstruyen desde cero en cada arranque;
  no son fuente de verdad de nada.
- DLQ/compensación: no aplica.

## 7. Datos y migración

- Modelos Prisma: ninguno. `migration_status: NOT_APPLICABLE`.
- Migración, expand/contract, backfill, drift: no aplican.
- Compatibilidad hacia atrás: la página del mapa, el footer y el sitemap
  actuales siguen funcionando si la ingesta falla (fire-and-forget con
  degradación silenciosa en el cliente).
- Rollback de código: revertir el PR retira enlace, sitemap, endpoints y
  sección admin sin tocar datos.
- Rollback/forward-fix de datos: no aplica (no hay datos persistidos).

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: los propios contadores son la métrica. La ingesta no añade
  consultas a DB ni llamadas externas; el rate limit acota el coste por origen.
- Logs/traces/correlation: los existentes del BFF/API. El payload de eventos
  nunca se escribe en logs.
- Health/readiness: sin cambios.
- Feature flags/allowlists: sin flag; la activación ES el despliegue del
  enlace. La allowlist de eventos vive en código compartido web/API.
- Plan de canary: no aplica a un enlace y contadores anónimos; la verificación
  de producción se lista abajo.
- Evidencia de producción requerida tras el deploy:
  1. Footer de la landing mostrando «Gemelo digital» y navegando al mapa.
  2. `/sitemap.xml` incluyendo la ruta.
  3. Un `map_view` registrado tras una visita real y visible en la sección
     admin de `/admin/consciousness` con su `since`.
- Señal de rollback: enlace roto en producción, contadores con valores
  absurdos por abuso, o regresión en la landing o en el mapa → revert del PR.
- Owner operativo: `semse-core`.

## 9. Tests requeridos

- [ ] Unitarios del store: incremento por evento, `since`, rechazo de evento
  desconocido, ventana de rate limit.
- [ ] Contrato API: 400 con evento inválido; 429 al exceder el ritmo; payload
  con campos extra rechazado o ignorado de forma determinista.
- [ ] Permiso denegado: `GET /v1/ops/twin/metrics` sin sesión y con rol sin
  `ops:dashboard:read`.
- [ ] UI: sección admin en loading/empty/ready/error; enlace presente en el
  footer; emisión deduplicada de `map_view`.
- [ ] Sitemap: la ruta aparece en la salida de `app/sitemap.ts`.
- [ ] E2E: footer → mapa registra `map_view`; panel admin lo refleja (suite
  autenticada existente, nunca credenciales de fixture como producción).
- [ ] Smoke autenticado en producción tras el deploy (ver evidencia §8).

## 10. Mapa de implementación

### API

- `apps/api/src/modules/ops/twin-telemetry.store.ts` (nuevo): contadores en
  memoria, patrón `ProviderMetricsStore`
  (`apps/api/src/infrastructure/llm/metrics/provider-metrics.store.ts`).
- `apps/api/src/modules/ops/ops.controller.ts` (o controlador nuevo en el mismo
  módulo): `POST /v1/ops/twin/events` y `GET /v1/ops/twin/metrics`.

### Web

- `apps/web/components/landing/landing-footer.tsx`: enlace en `FOOTER_COLS` ›
  «Plataforma».
- `apps/web/app/sitemap.ts`: entrada nueva con el `base` existente.
- `apps/web/app/api/semse/ops/twin-events/route.ts` (nuevo): ingesta pública
  validada.
- `apps/web/app/api/semse/ops/twin-metrics/route.ts` (nuevo): proxy autenticado,
  patrón `llm-metrics/route.ts`.
- `apps/web/app/semse-api.ts`: `fetchTwinMetrics()`.
- `apps/web/lib/digital-twin/telemetry.ts` (nuevo): allowlist compartida,
  dedupe de `map_view` por carga, envío fire-and-forget.
- `apps/web/components/semse/digital-twin/SemseDigitalTwin.tsx`,
  `SemseDigitalTwin2D.tsx` y controles: puntos de emisión
  (`view_switch`, `flow_play`, `webgl_fallback`).
- `apps/web/app/(app)/admin/consciousness/page.tsx`: sección de señales.

### Worker/Packages/DB

- Sin cambios. Sin Prisma, sin migraciones, sin workers.

### Tests

- `apps/api/test/twin-telemetry.test.ts` (nuevo).
- `tests/e2e-semse/semse-digital-twin.spec.ts` (extender) o
  `tests/e2e-semse/digital-twin-activation.spec.ts` (nuevo).

## 11. Investigación externa

Tres fuentes primarias (2026-11-28):

1. Plausible (plausible.io): analítica sin cookies ni identificadores
   persistentes; el conteo agregado sin datos personales no exige banner de
   consentimiento bajo GDPR/ePrivacy. Umami (umami.is) documenta el mismo
   modelo: sin cookies, sin fingerprinting, sin datos personales.
2. Next.js App Router: `app/sitemap.ts` es la Metadata Route que publica
   `/sitemap.xml`; deben listarse sólo URLs canónicas e indexables.
3. Precedente interno: `ProviderMetricsStore` (buckets en memoria) y el BFF
   `llm-metrics/route.ts` son el patrón ya aprobado de métricas agregadas sin
   DB y de proxy autenticado a `/v1/ops/*`.

- Aplicado ahora: contadores agregados sin identificadores (modelo Plausible/
  Umami) ⇒ sin cookies ni banner; entrada de sitemap por convención; store y
  BFF por precedente interno.
- Backlog: persistencia y serie temporal diaria, si la señal lo justifica;
  requeriría spec nuevo con migración planificada.
- Descartado: PostHog/GA4 (terceros y consentimiento), hash rotativo de IP
  (innecesario para contadores globales), sesiones sintéticas, heatmaps y
  session replay.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`.
- [ ] Spec promovido a `APPROVED` por el owner antes de cualquier código.
- [ ] Spec, plan, tasks, analyze y checklist coherentes.
- [ ] Tests derivados del spec rojos antes de implementar y verdes después.
- [ ] `pnpm spec:validate:strict` verde.
- [ ] Migración `NOT_APPLICABLE` confirmada; rollback por revert documentado.
- [ ] CI `PASS`.
- [ ] PR fusionado y SHA registrado.
- [ ] Deployment terminal `DEPLOYED`.
- [ ] Evidencia de producción §8 capturada (footer, sitemap, contador, panel).
- [ ] `production_evidence` y `last_verified` actualizados.
- [ ] Sólo entonces `status: VERIFIED`.
