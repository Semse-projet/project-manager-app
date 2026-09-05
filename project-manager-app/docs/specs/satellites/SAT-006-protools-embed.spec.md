---
id: "satellites.protools-embed"
title: "SAT-006 — Pro Tools v2 HTML embebible (satélite protools-embed)"
domain: "tools"
sdd_version: "2.0"
version: "1.1"
status: "DRAFT"
owner: "semse-core"
risk: "low"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/tools/tools.controller.ts
  - apps/api/src/modules/tools/tools.module.ts
  - apps/api/src/modules/satellites/satellites.service.ts
  - apps/api/src/modules/satellites/satellite-scope.guard.ts
  - apps/api/src/modules/satellites/satellite-scopes.decorator.ts
  - packages/sdk/src/index.ts
  - packages/sdk/src/resources/satellites.ts
  - apps/web/app/(app)/tools/page.tsx
  - docs/specs/ui/pro-flows.spec.md
  - SATELLITES.md
related_tests: []
related_endpoints: []
# v1/tools/external-quotes, v1/tools/embed-config: propuestos en §5 Contratos,
# no existen en código todavía (code_status: NOT_STARTED) — spec-validate
# exige que related_endpoints solo referencie superficie real ya presente en
# apps/api/src, no contratos propuestos.
related_events: []
related_agents: []
last_verified: "2026-08-17"
---

# Spec: Pro Tools v2 HTML embebible (satélite `protools-embed`)

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

**Clase (SATELLITES.md §2): LATENTE** — se especifica el conector; se activa
solo con demanda real de distribución offline/compartible de calculadoras.
Este spec migra el contenido del documento SDD 1.x anterior al formato
SDD 2.0 y lo verifica contra el código real; **no se escribió código nuevo**.

## 1. Problema y resultado

**Para quién:** un contratista o prospecto sin cuenta SEMSE que abre uno de
los HTML standalone de Pro Tools v2 (`../SEMSE Pro Tools v2/herramientas_html/`,
fuera del monorepo — 12 archivos: concreto, carpintería, electricista, HVAC,
drywall, pintura, pisos, plomería, roofing, inspección, cotizador-escrow,
suite) para calcular un estimado sin conexión ni cuenta.

**Problema:** esas calculadoras HTML fueron el antecesor de los 27 tools ya
nivelados en `apps/api/src/modules/tools/tools.controller.ts` (`TOOL_CATALOG`,
mismo módulo consumido por `apps/web/app/(app)/tools`), pero siguen siendo
valiosas como artefacto **compartible por archivo** — un contratista sin
internet ni cuenta las abre y calcula. Hoy el resultado muere en el
navegador: no hay forma de que ese lead entre al pipeline de SEMSE (admin,
mismo destino que smart-intake) sin copiar/pegar manualmente.

**Resultado esperado:** un botón opcional "Enviar a SEMSE" en cada HTML que,
con conexión disponible, envía la cotización ya calculada a un endpoint
público de SEMSE y esta aparece como lead en admin con canal
`protools-embed`. Sin conexión, el botón falla en silencio — el cálculo
offline sigue funcionando al 100% sin el botón.

## 2. Alcance

### Incluido

- `POST /v1/tools/external-quotes` — recepción pública (satellite token,
  scope `tools:invoke`) de una cotización ya calculada client-side.
- `GET /v1/tools/embed-config` — descubrimiento de si el canal está activo
  (kill switch), sin exponer el secreto del token en claro (ver §12,
  bloqueo de decisión — el diseño original de este endpoint es ambiguo).
- `semse-embed.js`: bundle browser mínimo (`auth` + `tools` únicamente),
  IIFE, < 30 KB, cero dependencias, servible junto al HTML (funciona desde
  `file://`).
- Inyección del snippet en 3 HTML piloto: concreto, electricista, plomería
  (`../SEMSE Pro Tools v2/herramientas_html/semse_herramienta_concreto.html`,
  `..._electricista.html`, `..._plomeria.html`).
- Guía de distribución en el README del satélite
  (`../SEMSE Pro Tools v2/README.md`, fuera del monorepo).

### Fuera de alcance

- **Paridad con los 27 tools del monorepo.** Los HTML standalone son un
  snapshot congelado, no se mantienen a la par de `TOOL_CATALOG`
  (`apps/api/src/modules/tools/tools.controller.ts:12-37`). Ese catálogo y
  su UI en `apps/web/app/(app)/tools` los cubre `ui-pro-flows.spec.md`
  (`ui-pro-flows`) — este spec no re-especifica ProTools, solo el ángulo de
  satélite/embed de sus HTML predecesores.
- **`POST /v1/agents/semse/protools/estimate`** — endpoint distinto, ya
  implementado (`apps/api/src/modules/semse-agents/semse-agents.controller.ts:42`,
  `@Controller("v1/agents/semse")`) y consumido por la BFF route
  `apps/web/app/api/semse/agents/protools/estimate/route.ts`, que reenvía
  exactamente a `${API}/v1/agents/semse/protools/estimate`. **Verificación
  de esta sesión:** el handler existe en código con esa misma ruta — la nota
  REVIEW de `docs/specs/ui/pro-flows.spec.md` (línea 35, fecha 2026-07-20)
  que reporta 404 en producción para ese endpoint parece ser un problema de
  despliegue/routing, no de código ausente; queda **fuera del alcance de
  este spec** — pertenece a `ui-pro-flows.spec.md` / al módulo
  `semse-agents`, no a SAT-006. No se toca ni se re-verifica aquí.
- UI nueva dentro de `apps/web` — el "envío" ocurre exclusivamente desde el
  HTML standalone fuera del monorepo.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Visitante anónimo vía HTML embebido (identidad = satellite token `protools-embed`) | scope satélite `tools:invoke` (ya reservado en `SATELLITE_SCOPE_CATALOG`, `apps/api/src/modules/satellites/satellites.service.ts:24`) | sin tenant — la request no lleva sesión de usuario | Enviar una cotización a `POST /v1/tools/external-quotes`; leer `GET /v1/tools/embed-config` | Leer cualquier otro recurso — todo `GET` fuera de `embed-config` bajo este token → 403 (caso negativo obligatorio, Anillo 1) |
| `OPS_ADMIN` | `satellites:admin` (ya otorgado, `packages/auth/src/rbac.ts:218`) | admin panel | Emitir/revocar el token `protools-embed` vía `POST/DELETE /v1/satellites/tokens` (ya implementado, `apps/api/src/modules/satellites/satellites.controller.ts`) | — |
| `OPS_ADMIN` | `tools:read` / `tools:run` (ya otorgados) | mismo destino que smart-intake | Ver la cotización entrante en admin | — |

- **Tenant boundary:** el token viaja **dentro del HTML distribuido** ⇒ se
  asume público (mismo texto que el spec original, sección de seguridad).
  No hay `tenantId` de origen — el lead se crea sin tenant, mismo patrón que
  otros canales de intake anónimos. A confirmar contra el modelo real de
  leads/smart-intake (`apps/api/src/modules/smart-intake`) durante `plan`.
- **Ownership/resource policy:** N/A — escritura pura de un recurso nuevo,
  sin lectura de datos de otros usuarios.
- **Step-up o aprobación humana:** ninguno.
- **Datos `privacyCritical`:** si el formulario de cotización incluye
  contacto (nombre/email/teléfono opcional), ese campo es `privacyCritical`
  y debe enrutarse igual que el resto de intake — a decidir en el schema
  Zod del `input_schema` de §5.
- **Requisitos de auditoría:** `AuditLog` de creación de lead con
  `channel: "protools-embed"`, mismo patrón que smart-intake.

## 4. Escenarios y criterios de aceptación

### P1 — Contratista sin cuenta calcula y envía una cotización

```gherkin
DADO un HTML de Pro Tools v2 abierto vía file:// o servido estático, con
     semse-embed.js resolviendo un canal activo contra GET /v1/tools/embed-config
CUANDO el usuario completa el cálculo offline y pulsa "Enviar a SEMSE"
ENTONCES POST /v1/tools/external-quotes con Authorization: Bearer sst_...
     (scope tools:invoke) crea un lead visible en admin con channel=protools-embed
Y la respuesta es exactamente { received: true, quoteId } — ningún otro dato
Y se emite AuditLog de creación de lead
```

Casos borde:

- [ ] Sin red: el botón falla en silencio (no bloquea ni degrada el cálculo
      offline, que ya terminó antes de intentar el envío).
- [ ] Token revocado o expirado → 401; el embed lo trata igual que "sin red"
      (fail-soft, sin exponer detalle interno del error).
- [ ] Rate limit por IP excedido → 429, mismo fail-soft.
- [ ] `SATELLITE_PROTOOLS_ENABLED=false` (o `SATELLITE_TOKENS_ENABLED=false`
      heredado de SAT-001) → `GET /v1/tools/embed-config` reporta canal
      inactivo → el botón "Enviar a SEMSE" nunca se muestra roto, desaparece.
- [ ] Token válido pero con scope distinto de `tools:invoke` intentando
      cualquier `GET` del namespace `tools` → 403 (caso negativo obligatorio
      de Anillo 1, mismo patrón que `apps/api/test/satellites-service.test.ts`).
- [ ] Aislamiento: la respuesta de `external-quotes` nunca incluye datos de
      otro lead/usuario, ni siquiera un conteo.

## 5. Contratos

### API — `POST /v1/tools/external-quotes`

```yaml
auth: satellite token (Authorization: Bearer sst_...) — patrón SatelliteScopeGuard
  (apps/api/src/modules/satellites/satellite-scope.guard.ts), NO @RequirePermissions
  de RBAC de usuario: no hay sesión de usuario en esta request.
permissions: satellite scope "tools:invoke" (ya reservado en SATELLITE_SCOPE_CATALOG)
input_schema:
  tool: string          # uno de TOOL_CATALOG.id (tools.controller.ts:12-37)
  input: Record<string, unknown>   # eco de lo que el usuario tipeó, sin validar de nuevo
  result: Record<string, unknown>  # resultado ya calculado client-side
  contact: { name?: string; email?: string; phone?: string }  # opcional, privacyCritical si presente
output_schema:
  received: boolean   # siempre true en 2xx
  quoteId: string
errors:
  400: input inválido (Zod)
  401: token inválido, revocado o expirado
  403: scope insuficiente
  429: rate limit por IP excedido
  503: SATELLITE_PROTOOLS_ENABLED (o SATELLITE_TOKENS_ENABLED) apagado
effects:
  audit_log: lead.created channel=protools-embed
  domain_event: NINGUNO declarado en docs/foundation/EVENT_CATALOG.md hoy —
    no se inventa uno aquí (prohibido por AGENTS.md); confirmar durante plan
    si smart-intake ya emite un evento de creación de lead reutilizable.
  sse: no
  payment_governance: no
```

### API — `GET /v1/tools/embed-config`

```yaml
auth: public (@Public(), sin token) — es el endpoint de descubrimiento previo al token
permissions: ninguno
output_schema:
  channelActive: boolean   # refleja el kill switch, nunca el secreto
errors:
  200 siempre (nunca 401/403 — es información pública de disponibilidad)
effects: ninguno
```

> **Diseño deliberadamente distinto del original.** El documento SDD 1.x
> decía que el embed "resuelve el token vigente" contra este endpoint. Un
> endpoint público que devuelva un token secreto en claro contradice la
> regla de SAT-000 §1.3 ("nunca secretos compartidos más allá del token
> propio") y la propia sección de seguridad de este spec ("el token viaja
> dentro del HTML distribuido ⇒ se asume público"). Este documento reduce
> `embed-config` a un booleano de disponibilidad; la rotación de token sigue
> exigiendo redistribuir el HTML. Ver §12 — este es exactamente el punto que
> bloquea `APPROVED`.

### UI

N/A — la superficie es HTML fuera del monorepo (`../SEMSE Pro Tools v2/`),
no `apps/web`. No aplican los 6 estados obligatorios de UI de este template.

### Agente/Prometeo

N/A — sin interacción con agentes.

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: ninguno del dominio de negocio (jobs/milestones);
  el satélite en sí sigue la FSM de `SAT-000 §3`
  (`DRAFT → APPROVED → CONNECTED-STAGING → LIVE → SUSPENDED/ARCHIVED`),
  hoy en `DRAFT (LATENTE)` según `SATELLITES.md`.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md` — no se tocan
  invariantes de Jobs/Milestones/Escrow; este flujo crea un lead, no un job.
- Eventos declarados: **ninguno cubre "cotización externa recibida"** en
  `docs/foundation/EVENT_CATALOG.md` — se debe agregar una entrada al
  catálogo antes de `implement` (no antes de `spec`, per AGENTS.md el
  catálogo se referencia, no se inventa inline).
- Productor + outbox atómico / Consumidores + idempotencia / Replay/rebuild
  / DLQ: N/A a este alcance (no hay proyección de estado, es una escritura
  de lead simple).

## 7. Datos y migración

- Modelos Prisma: ninguno nuevo confirmado — la intención es reusar el
  modelo de leads/intake existente (`apps/api/src/modules/smart-intake`)
  con un campo de canal, igual que otros canales de intake. Confirmar el
  modelo real y si admite `channel: "protools-embed"` sin migración durante
  `plan`; si no lo admite, se declara la migración ahí, no aquí.
- Migración / expand-contract / backfill / compatibilidad / drift /
  rollback: no aplican todavía — este spec no autoriza tocar
  `packages/db/prisma/schema.prisma`.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: tasa de envíos exitosos vs fail-soft (sin red/token
  inválido), latencia de `external-quotes`.
- Logs/traces/correlation: mismo patrón que el resto de `/v1` (`resolveRequestId`).
- Health/readiness: sin impacto — endpoint nuevo, no reemplaza ninguno existente.
- Feature flags/allowlists: `SATELLITE_PROTOOLS_ENABLED` (nuevo, seguiría el
  patrón ya real de `SATELLITE_TOKENS_ENABLED`,
  `apps/api/src/modules/satellites/satellites.service.ts:37`) — **no
  implementado todavía**, por eso `feature_flags: []` en el frontmatter.
- Plan de canary: activar el flag solo tras Anillo 1-3 verdes; Anillo 4
  contra Railway con un HTML real enviado por email/WhatsApp a un
  dispositivo, antes de considerar `LIVE` en `SATELLITES.md`.
- Evidencia de producción requerida: salida pegada en `docs/reportes/` con
  fecha (patrón ya usado por SAT-001/SAT-002,
  `docs/reportes/2026-07-07_sat001_sat002_railway_smoke.md`).
- Señal de rollback: apagar `SATELLITE_PROTOOLS_ENABLED` desconecta sin
  deploy (kill switch, SAT-000 §2).
- Owner operativo: `semse-core`.

## 9. Tests requeridos

Arnés SAT-000 (`docs/specs/satellites/SAT-000-sdd-harness.spec.md` §2) —
ninguno de los 4 anillos existe hoy para este alcance (verificado: cero
referencias a `external-quotes`, `embed-config` o `semse-embed` en todo el
árbol salvo este spec y `SATELLITES.md`; el script `pnpm sat:e2e` referido
por SAT-000 §2.3 tampoco existe en `package.json`).

- [ ] **Anillo 1 (contrato):** request/response Zod de `external-quotes` y
      `embed-config`; caso negativo — token con scope `tools:invoke` no
      puede leer nada (todo `GET` fuera de `embed-config` → 403); rate limit
      testeado; revocación → 401.
- [ ] **Anillo 2 (SDK):** `packages/sdk` gana un recurso `tools` (hoy no
      existe — el SDK solo expone `auth`, `intake`, `jobs`, `milestones`,
      `satellites`, ver `packages/sdk/src/index.ts`) con test contra mock
      del contrato del Anillo 1.
- [ ] **Anillo 3 (E2E local):** abrir un HTML piloto desde `file://`,
      calcular, enviar, ver el lead en admin local.
- [ ] **Anillo 4 (smoke Railway):** HTML enviado por WhatsApp/email a un
      dispositivo real; evidencia en `docs/reportes/`.
- [ ] Unitarios del dominio (creación de lead con canal `protools-embed`).
- [ ] Permiso denegado y aislamiento (scope insuficiente, sin tenant).
- [ ] Idempotencia/reintento: doble envío del mismo `quoteId` client-side
      (definir si el cliente genera `quoteId` o el server; a decidir en `plan`).
- [ ] Kill switch `SATELLITE_PROTOOLS_ENABLED`: OFF ⇒ `embed-config` reporta
      `channelActive: false` ⇒ botón desaparece en el embed.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/tools/` — nuevo controller/endpoint público
  (`@Public()` + `@UseGuards(SatelliteScopeGuard)`, mismo patrón que
  `apps/api/src/modules/satellites/satellites.controller.ts` método `me()`),
  **no** dentro de `ToolsController` actual, que exige `@RequirePermissions("tools:read")`
  a nivel de clase (`apps/api/src/modules/tools/tools.controller.ts:106-107`)
  y por tanto asume sesión de usuario — incompatible con un satellite token
  sin usuario.

### Web

- Ninguno — fuera del monorepo.

### Worker/Packages/DB

- `packages/sdk/src/resources/` — nuevo `tools.ts` (recurso ausente hoy).
- `../SEMSE Pro Tools v2/herramientas_html/` — inyección del snippet
  `semse-embed.js` en los 3 HTML piloto (fuera del monorepo, referencia).

### Tests

- `apps/api/test/` — nuevo `tools-external-quotes.test.ts` (o similar).
- `packages/sdk/test/` — nuevo test del recurso `tools`.

## 11. Investigación externa

- No se realizó investigación externa en esta sesión. El trabajo fue 100%
  verificación de esta spec contra el código real del monorepo (grep/read
  de `apps/api/src/modules/{tools,satellites}`, `packages/sdk`,
  `SATELLITES.md`, `docs/specs/ui/pro-flows.spec.md`).
- Aplicado ahora: N/A.
- Backlog: si se retoma este satélite, investigar patrones de "bundle IIFE
  público con token de bajo privilegio" antes de diseñar `embed-config`
  (ver bloqueo §12).
- Descartado: N/A.

## Bloqueado por decisión de producto

Este spec **no puede pasar a `APPROVED`** por dos preguntas reales, no
resolubles leyendo código:

1. **Demanda real.** `SATELLITES.md` clasifica este satélite como
   `DRAFT (LATENTE)` con la nota "Token asumido público", y el plan maestro
   (`docs/specs/satellites/README.md` §3, Fase 2, ítem 5) dice
   explícitamente "activar cuando haya demanda de herramientas
   offline/compartibles". No existe hoy ninguna señal de esa demanda en el
   repo (sin tickets, sin mención en `docs/reportes/`, sin uso reportado de
   los HTML de `../SEMSE Pro Tools v2/`). Construir el endpoint sin esa
   señal es trabajo especulativo — la decisión de invertir en esto (vs.
   dirigir contratistas a `apps/web/app/(app)/tools`, que ya expone los 27
   tools nivelados con persistencia real) es de producto, no de ingeniería.
2. **Diseño de `embed-config`.** El documento original pedía que el embed
   "resolviera el token vigente" contra un endpoint público de
   descubrimiento — pero eso choca con la regla de SAT-000 §1.3 de nunca
   compartir secretos más allá del token propio, y con la premisa de
   seguridad del propio spec ("el token viaja dentro del HTML ⇒ se asume
   público"). Este documento propone una alternativa (§5, endpoint reducido
   a un booleano de disponibilidad, rotación = redistribución de HTML), pero
   esa es una decisión de seguridad/producto que alguien con autoridad sobre
   el modelo de confianza de satélites debe confirmar antes de que el
   contrato de `embed-config` quede congelado.

Mientras estas dos preguntas sigan abiertas, el spec permanece en `DRAFT`.

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
- [ ] Bloqueo de producto (arriba) resuelto y documentado
- [ ] Sólo entonces `status: VERIFIED`
