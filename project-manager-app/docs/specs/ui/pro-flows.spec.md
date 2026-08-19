---
id: "ui-pro-flows"
title: "ProTools Catalog UI Flows"
domain: "ui"
sdd_version: "2.0"
version: "2.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
# ci_status/deploy_status/activation_status: NOT_RUN/NOT_DEPLOYED/INACTIVE is
# about this SDD 2.0 delivery-evidence trail, not the real feature -- the
# ProTools catalog has been live for a while, but the fix to the 2026-07-20
# production 404 finding was verified by reading code this session, not by a
# live request (§8/§9 already flag this explicitly as the gap before
# VERIFIED), so "no se inventa evidencia retroactiva" (SDD_GOVERNANCE §5)
# rules out claiming DEPLOYED/ACTIVE without a fresh canary.
ci_status: "NOT_RUN"
merge_status: "MERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/web/app/(app)/tools
  - apps/web/components/tools
  - apps/api/src/modules/tools
  - apps/api/src/modules/semse-agents/semse-agents.controller.ts
  - apps/api/src/modules/semse-agents/protools.agent.ts
  - apps/api/src/modules/semse-agents/semse-agents.module.ts
  - apps/web/app/api/semse/agents/protools/estimate/route.ts
  - apps/api/src/modules/buildops/buildops.controller.ts
  - apps/api/src/modules/payments/payments.controller.ts
  - apps/api/src/modules/jobs/jobs.controller.ts
  - apps/web/app/pro/[slug]/page.tsx
related_tests:
  - tests/e2e-semse/pro-tools-concrete.spec.ts
  - tests/e2e-semse/pro-tools-dashboard.spec.ts
  - tests/e2e-semse/tools-api-routes.spec.ts
related_endpoints:
  - v1/tools
  - v1/jobs
  - v1/jobs/:jobId/bids
  - v1/jobs/:jobId/transition
  - v1/evidence/presign
  - v1/evidence
  - v1/milestones/:milestoneId/submit
  - v1/agents/semse/protools/estimate
  - v1/buildops/estimates/from-tool-result
  - v1/workers/me/payout-method
related_events:
  - milestone.submitted
related_agents:
  - protools
last_verified: "2026-08-17"
---

# Spec: ProTools Catalog UI Flows

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

## 1. Problema y resultado

**Para quién:** actores con rol `PRO` (y `CLIENT`, que también consume el
mismo catálogo de herramientas de estimación) en SEMSE OS.

**Problema:** el catálogo de herramientas por oficio ("ProTools" —
calculadoras de materiales, mano de obra y estimados por trade) y el flujo
de bid/evidencia/cobro de un job puntual no tenían un contrato SDD 2.0
correcto: el spec original mezclaba en su título "Pro Contractor UI Flows"
la impresión de cubrir toda la app autenticada del rol PRO, cuando sus
`related_files`/`related_tests` reales (`apps/web/app/(app)/tools`,
`pro-tools-*.spec.ts`) siempre describieron solo el catálogo de
herramientas. Además, una auditoría en vivo del 2026-07-20 encontró
`POST /api/semse/agents/protools/estimate` respondiendo `404` en
producción — dato que dejó este spec en `REVIEW` con su `status: VERIFIED`
anterior invalidado.

**Resultado esperado:** un contrato claro y no ambiguo específicamente para
el catálogo ProTools (bid en jobs, evidencia/milestone, estimador por
trade, método de cobro, cierre de job) — con el hallazgo del 404
re-verificado contra el código actual (ver §2 y hallazgo abajo) y con el
alcance de la app completa `/worker/*` delegado explícitamente a
`docs/specs/ui/pro-flows-remediation.spec.md`.

**Hallazgo verificado en código, no asumido — el 404 de
`POST /api/semse/agents/protools/estimate` ya no es reproducible en el
código actual:**

- El controlador existe y está registrado: `@Controller("v1/agents/semse")`
  con `@Post("protools/estimate")`
  (`apps/api/src/modules/semse-agents/semse-agents.controller.ts:19,42`),
  dentro de `SemseAgentsModule`
  (`apps/api/src/modules/semse-agents/semse-agents.module.ts`), que está
  importado en `apps/api/src/app.module.ts:141`.
- La ruta BFF (`apps/web/app/api/semse/agents/protools/estimate/route.ts:8`)
  reenvía correctamente a `${API}/v1/agents/semse/protools/estimate` — el
  mismo path que expone el controlador. No hay descalce de paths.
- El endpoint exige `@RequirePermissions("projects:read")`
  (`semse-agents.controller.ts:43`); tanto `CLIENT` como `PRO` tienen ese
  permiso en `packages/auth/src/rbac.ts` (líneas 21 y 70), así que no
  debería fallar por RBAC tampoco para ninguno de los dos roles.
- **No se pudo hacer una petición real contra producción en esta sesión**
  (sin acceso a servidor en vivo) — esto confirma que el 404 **no viene de
  código faltante hoy**, no que el endpoint responda `200` en producción
  ahora mismo. Ver `production_evidence` — pendiente un smoke test
  autenticado antes de `VERIFIED`.
- Esta corrección coincide con `docs/AUDIT_REMEDIATION_PLAN.md` → 0.31,
  que documentó el mismo 404 y pedía "implementar o corregir la ruta del
  BFF/backend" — el código de ambos lados ya existe correctamente wireado.

## 2. Alcance

### Incluido

- Catálogo de herramientas por oficio: `apps/web/app/(app)/tools/**`
  (`/tools/:trade`, ej. `/tools/painting`, `/tools/drywall`) y
  `apps/web/components/tools`.
- El agente ProTools (`apps/api/src/modules/semse-agents/protools.agent.ts`,
  `semse-agents.controller.ts`) y el módulo `apps/api/src/modules/tools`.
- El flujo puntual de un PRO sobre **un job dado**: explorar/bid,
  subir evidencia y someter milestone, ver feedback de rechazo, configurar
  método de cobro, solicitar revisión final — descritos como flujos de
  producto (Flujos 1-6 abajo), no como inventario completo de pantallas de
  `/worker/*`.
- `apps/web/app/pro/[slug]/page.tsx` — perfil público de un profesional
  (trust score, badges); es una superficie de marketing/confianza distinta
  de la app autenticada, incluida aquí porque comparte `related_files` con
  el spec original y no tiene spec propio en ningún otro documento.

### Fuera de alcance

- **La app completa autenticada del rol PRO bajo `/worker/*`** (dashboard,
  jobs, field-ops, tracker, agenda, payments, profile, evidence, travel,
  review, rates, incidents, materials, tasks, disputes, opportunities,
  settings, bids) — nunca estuvo cubierta por este spec pese a lo que
  sugería su título anterior ("Pro Contractor UI Flows"). Ver
  `docs/specs/ui/pro-flows-remediation.spec.md`, que sí la cubre con
  hallazgos verificados file:line.
- El Labor Engine / Time Tracker (`/worker/tracker`) y Field Ops
  (`/worker/field-ops`) — cubiertos por `pro-flows-remediation.spec.md`.
- El algoritmo de matching, el cálculo de trust score, y la infraestructura
  de agentes (`/agents/**`) en sí mismos — este spec solo consume sus
  resultados vía UI.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `PRO` | `bids:create`, `evidence:write`, `milestones:submit`, `tools:run`, `projects:read` | jobs/proyectos donde tiene bid/reserva/contrato | hacer bid, subir evidencia, someter milestone, usar el estimador ProTools, solicitar revisión final | ver financials de jobs sin asignación, aprobar su propio milestone |
| `CLIENT` | `tools:run`, `projects:read` | jobs propios de su org | usar el estimador ProTools desde `/client/protools` | hacer bid como profesional |

- **Tenant boundary:** `resolveRequestContext` inyecta `tenantId` en todos
  los endpoints listados; sin excepciones nuevas en este spec.
- **Ownership/resource policy:** un bid solo lo puede crear el `PRO`
  autenticado que lo envía (`ctx.userId`); una evidencia/milestone requiere
  pertenecer al job/proyecto del actor.
- **Step-up o aprobación humana:** ninguna en estos flujos.
- **Datos `privacyCritical`:** ninguno — el estimador ProTools usa datos de
  proyecto (dimensiones, materiales), no PII sensible ni financiera.
- **Requisitos de auditoría:** creación de bid y submit de milestone deben
  quedar auditables vía los mecanismos ya existentes de `jobs`/`milestones`
  (Artículo V de la constitución); este spec no introduce lógica nueva de
  AuditLog.

## 4. Escenarios y criterios de aceptación

### P1 — Explorar y hacer bid en un job

```gherkin
DADO un PRO autenticado en /marketplace
CUANDO ve un job POSTED y completa el formulario de oferta (amount, etaDays)
ENTONCES POST /v1/jobs/:jobId/bids crea el bid
Y la UI muestra confirmación y, en visitas posteriores, el badge
  "Ya tienes una oferta"
```

Casos borde:

- [ ] Doble submit del formulario de bid (evitar bids duplicados)
- [ ] `GET /v1/jobs?status=posted` vacío → estado empty explícito
- [ ] Bid a un job de otro tenant → 403/404, nunca 200

### P2 — Subir evidencia y someter milestone

```gherkin
DADO un milestone en awaiting_review con evidenceCount > 0
CUANDO el PRO presiona "Someter a revisión"
ENTONCES POST /v1/milestones/:id/submit transiciona awaiting_review → submitted
Y el CLIENT recibe la actualización vía SSE (milestone.submitted)
```

Casos borde:

- [ ] Botón "Someter" deshabilitado con evidenceCount == 0 (con tooltip)
- [ ] Reintento tras error de red durante el upload no duplica evidencia
- [ ] Milestone de otro proyecto no accesible desde esta pantalla

### P3 — Usar ProTools para estimar trabajo

```gherkin
DADO un PRO en /tools/:trade con permiso tools:run
CUANDO completa el formulario (dimensiones, materiales, condiciones)
ENTONCES el cálculo se muestra en tiempo real
Y "Usar en proyecto" vincula el resultado al BuildOpsProject vía
  POST /v1/buildops/estimates/from-tool-result
```

Casos borde:

- [ ] `POST /v1/agents/semse/protools/estimate` sin `trade`/`description` →
      error de validación claro, no 500 crudo (el controlador ya retorna
      `{ error: "trade y description son requeridos" }` — confirmar que la
      UI lo traduce a un mensaje utilizable)
- [ ] Estimado sin `projectId` no debe intentar vincularse a ningún
      proyecto

## 5. Contratos

### API — `POST /v1/agents/semse/protools/estimate`

```yaml
auth: required
permissions: [projects:read]
input_schema: ProToolsEstimateInput { trade, description, area?, rooms?, projectId?, zipCode? }
output_schema: ProToolsEstimateResult + { requestedBy, agentName: "protools", agentVersion }
errors:
  400: "trade y description son requeridos (retornado como 200 con { error } hoy — no es un 400 real; ver nota abajo)"
  401: sin sesión
  403: falta projects:read
effects:
  audit_log: ninguno nuevo
  domain_event: ninguno
  sse: ninguno
  payment_governance: no aplica (estimado, no movimiento de fondos)
```

> **Nota de contrato a corregir, no solo de comportamiento:** el
> controlador (`semse-agents.controller.ts:51-53`) responde `200 OK` con
> body `{ error: "trade y description son requeridos" }` en vez de un
> `400 Bad Request` real cuando falta un campo requerido — inconsistente
> con el resto de la API (`packages/schemas` valida con Zod y devuelve 400).
> No es el bug que motivó la baja a `REVIEW` (ese era el 404, ya
> resuelto), pero es un gap de contrato real que vale la pena corregir en
> una iteración futura; no bloquea `APPROVED` porque no es lo que este
> spec promete verificar.

### UI

```yaml
surfaces:
  - /marketplace
  - /projects/:projectId/milestones/:milestoneId
  - /tools/:trade
  - /profile/payout
  - /projects/:projectId
states:
  - loading
  - empty
  - ready
  - forbidden
  - degraded
  - error
required_behavior:
  - Card de job con title, scope preview, budgetMin-Max, urgency
  - Badge "Ya tienes una oferta" si el PRO ya hizo bid
  - Upload zone visible solo cuando milestone.status == awaiting_review
  - Botón "Someter a revisión" disabled sin evidencia, con tooltip
  - Formulario de ProTools con cálculo en tiempo real
  - Botón "Usar en proyecto" solo si hay projectId de destino
  - Formulario de payout method validado por tipo (bank_account/paypal/zelle/cashapp)
```

### Agente/Prometeo

```yaml
tools: [protools.estimate]
input_schema: ProToolsEstimateInput
output_schema: ProToolsEstimateResult
source_citations_required: false
approval_policy: none (lectura/estimado, no ejecuta acción de escritura)
forbidden_behavior:
  - No debe vincular un estimado a un proyecto sin projectId explícito del usuario
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: `Milestone` (`awaiting_review → submitted`, ver
  `docs/foundation/DOMAIN_INVARIANTS.md`) — sin transiciones nuevas.
- Invariantes: `docs/foundation/DOMAIN_INVARIANTS.md` §Milestone — "el
  submit durable termina en `SUBMITTED`; `READY` no es un valor
  persistido" — coincide con el Flujo 2 de este spec.
- Eventos declarados: `milestone.submitted` (`docs/foundation/EVENT_CATALOG.md`).
- Productor + outbox atómico: ya cubierto por el módulo `milestones`, sin
  cambios aquí.
- Consumidores + idempotencia: SSE al CLIENT, ya existente.
- Replay/rebuild: no aplica — este spec no introduce proyecciones nuevas.
- DLQ/compensación: no aplica.

## 7. Datos y migración

- Modelos Prisma: ninguno nuevo.
- Migración: no aplica.
- Estrategia expand/contract: no aplica.
- Backfill: no aplica.
- Compatibilidad hacia atrás: no aplica.
- Verificación de drift: no aplica.
- Rollback de código: revertir el commit que corrigió el wiring de
  `protools/estimate` si se detectara regresión (no identificado en este
  spec — el wiring ya estaba correcto al momento de esta verificación).
- Rollback/forward-fix de datos: no aplica.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna específica de este spec definida aún.
- **Logs/traces/correlation:** `resolveRequestId` ya presente en el
  controlador de ProTools.
- **Health/readiness:** cubierto por los probes canónicos de
  `docs/architecture/SEMSE_API_SURFACE_V1.md` (`GET /v1/prometeo/tools`
  para el módulo AI; ProTools no tiene probe dedicado).
- **Feature flags/allowlists:** ninguno.
- **Plan de canary:** no aplica — funcionalidad ya en producción desde
  antes del 2026-06-09 según `last_verified` histórico.
- **Evidencia de producción requerida antes de `VERIFIED`:** una petición
  autenticada real a `POST /api/semse/agents/protools/estimate` en
  `semse-web-production.up.railway.app` que confirme `200` (no `404`) —
  no se pudo ejecutar en esta sesión por no tener acceso a un servidor en
  vivo. Este es el único punto que separa `APPROVED` de `VERIFIED` para el
  hallazgo que motivó la baja de estado original.
- **Señal de rollback:** vuelta a `404`/`500` sostenido en ese endpoint en
  producción.
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [x] `tests/e2e-semse/pro-tools-concrete.spec.ts` — existe.
- [x] `tests/e2e-semse/pro-tools-dashboard.spec.ts` — existe.
- [x] `tests/e2e-semse/tools-api-routes.spec.ts` — existe.
- [ ] Ninguno de los tests existentes fue ejecutado en esta sesión (tarea
      docs-only, sin correr `pnpm test:e2e`) — su estado verde/rojo actual
      no está confirmado, solo su existencia.
- [ ] Smoke autenticado en producción para `protools/estimate` (ver §8).
- [ ] Test de contrato que confirme `400` real (no `200` con `{ error }`)
      para `trade`/`description` faltantes — gap de contrato nuevo,
      documentado en §5.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/semse-agents/semse-agents.controller.ts`
- `apps/api/src/modules/semse-agents/protools.agent.ts`
- `apps/api/src/modules/semse-agents/semse-agents.module.ts`
- `apps/api/src/modules/tools/`
- `apps/api/src/modules/buildops/buildops.controller.ts` (`estimates/from-tool-result`)
- `apps/api/src/modules/payments/payments.controller.ts` (`v1/workers/me/payout-method`)
- `apps/api/src/modules/jobs/jobs.controller.ts` (`:jobId/transition`)

### Web

- `apps/web/app/(app)/tools/**`
- `apps/web/components/tools/`
- `apps/web/app/api/semse/agents/protools/estimate/route.ts`
- `apps/web/app/pro/[slug]/page.tsx`

### Worker/Packages/DB

- No aplica.

### Tests

- `tests/e2e-semse/pro-tools-concrete.spec.ts`
- `tests/e2e-semse/pro-tools-dashboard.spec.ts`
- `tests/e2e-semse/tools-api-routes.spec.ts`

## 11. Investigación externa

No aplica — funcionalidad interna, sin dependencias externas nuevas.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes (confirmar que los 3 e2e existentes
      pasan — no verificado en esta sesión)
- [ ] `pnpm spec:validate:strict` verde
- [x] Migración reproducible y rollback/forward-fix documentado (no aplica)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED` (razonable por convención del repo —
      Railway despliega `main` automáticamente — pero sin verificación en
      vivo esta sesión)
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados con un smoke
      test real de `protools/estimate`
- [ ] Sólo entonces `status: VERIFIED`
