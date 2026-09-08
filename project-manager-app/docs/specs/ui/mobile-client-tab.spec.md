---
id: "ui.mobile-client-tab"
title: "Mobile Client Tab — Fase 2 de apps/mobile"
domain: "ui"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
ci_status: "PASS"
merge_status: "MERGED"
merge_ref: "699e2a2e"
merge_pr: "#542"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/mobile/src/navigation/ClientTabNavigator.tsx
  - apps/mobile/src/navigation/ClientJobsStackNavigator.tsx
  - apps/mobile/src/navigation/RoleGate.tsx
  - apps/mobile/src/navigation/types.ts
  - apps/mobile/src/screens/client/JobsListScreen.tsx
  - apps/mobile/src/screens/client/JobDetailScreen.tsx
  - apps/mobile/src/screens/client/RatingFormScreen.tsx
  - apps/mobile/src/screens/client/ClientSettingsScreen.tsx
  - apps/mobile/src/api/jobs.ts
  - apps/mobile/src/api/bids.ts
  - apps/mobile/src/api/evidence.ts
  - apps/mobile/src/api/milestones.ts
  - apps/mobile/src/api/ratings.ts
  - apps/api/src/modules/jobs/jobs.controller.ts
  - apps/api/src/modules/bids/bids.controller.ts
  - apps/api/src/modules/milestones/milestones.controller.ts
  - apps/api/src/modules/ratings/ratings.controller.ts
  - packages/schemas/src/api-input.schema.ts
  - packages/schemas/src/milestone.schema.ts
  - packages/schemas/src/rating.schema.ts
  - packages/db/prisma/seed.ts
related_tests:
  - apps/mobile/src/api/jobs.test.ts
  - apps/mobile/src/screens/client/JobsListScreen.test.tsx
  - apps/mobile/src/screens/client/JobDetailScreen.test.tsx
  - apps/mobile/src/screens/client/RatingFormScreen.test.tsx
related_endpoints:
  - v1/jobs
  - v1/jobs/:jobId
  - v1/jobs/:jobId/bids
  - v1/jobs/:jobId/milestones
  - v1/jobs/:jobId/evidence
  - v1/bids/:bidId/accept
  - v1/milestones/:milestoneId/approve
  - v1/ratings
  - v1/push/register
related_events:
  - job.created
  - milestone.submitted
  - milestone.approved
  - milestone.rejected
related_agents: []
last_verified: "2026-08-05"
---

# Spec: Mobile Client Tab — Fase 2 de `apps/mobile`

> Contrato ejecutable SDD 2.0. Completar todas las secciones aplicables y
> cambiar `status` a `APPROVED` antes de implementar. Código, CI, merge,
> deploy y activación se registran por separado; un deploy no demuestra
> activación ni verificación funcional.

## 1. Problema y resultado

**Para quién:** usuarios con rol `CLIENT` que usan `apps/mobile`.

**Problema:** `ClientTabNavigator` es un stub (`RoleGate.tsx` comment: "Client
and Admin are still placeholders") — un usuario CLIENT que abre la app ve una
sola pantalla con el texto "La app de Cliente todavía se está construyendo."
No puede ver sus jobs, revisar propuestas recibidas, aprobar milestones ni
calificar a un profesional desde el móvil, aunque todos esos endpoints ya
existen en `/v1` y ya los usa `apps/web/app/(app)/client`.

**Resultado esperado:** un usuario CLIENT autenticado en `apps/mobile` puede,
sin salir de la app: ver sus jobs activos, abrir el detalle de un job (bids
recibidos, milestones, evidencia subida por el profesional), aceptar un bid,
aprobar un milestone, y calificar al profesional al cerrar el job. Recibe
push notifications **solo para los eventos de milestones** (`submitted`,
`approved`, `rejected`) — ver el hallazgo de push/bids en §2, corregido tras
verificar el código real de `bids.service.ts`.

## 2. Alcance

### Incluido

- Dashboard: lista de jobs del cliente (`GET /v1/jobs`, ya scoped
  server-side por `actor.roles`/`userId` en `JobsService.list` — sin filtro
  nuevo del lado del cliente).
- Detalle de job: `GET /v1/jobs/:jobId` + bids recibidos
  (`GET /v1/jobs/:jobId/bids`) + milestones (`GET /v1/jobs/:jobId/milestones`)
  + evidencia (`GET /v1/jobs/:jobId/evidence`, reusa `buildEvidenceFileUrl`
  y `fetchEvidenceByJob` ya existentes en `src/api/evidence.ts` — solo
  lectura, el cliente no captura evidencia).
- Aceptar un bid: `POST /v1/bids/:bidId/accept`.
- Aprobar un milestone: `POST /v1/milestones/:milestoneId/approve`.
- Calificar al profesional: `POST /v1/ratings` (una vez por job/profesional;
  el service-side ya decide idempotencia/ventana, no se reimplementa aquí).
- Push notifications: `RoleGate` monta `AuthProvider` antes de branchear por
  rol, así que `registerForPushNotificationsAsync()`
  (`src/context/AuthContext.tsx`) ya corre para CLIENT igual que para
  WORKER — **pero solo trae valor real para milestones.**
  `milestones.service.ts` inyecta y llama `NotificationsService`
  (que sí dispara `PushDispatchService`), así que `milestone.submitted` /
  `approved` / `rejected` ya llegan como push a un CLIENT hoy, sin cambios.
  `bids.service.ts` **no** hace lo mismo: sus tres notificaciones
  (`bid_received` al crear un bid, `job_assigned` y `bid_rejected` al
  aceptar uno) escriben directo con `this.prisma.notification.create(...)`
  — bypasean `NotificationsService` por completo, así que nunca llegan a
  `PushDispatchService` ni generan push, aunque sí queden como notificación
  in-app (`GET /v1/notifications` del lado web/mobile). Esta fase **no**
  corrige `bids.service.ts` (sería tocar dominio de Bids desde un spec de
  UI mobile, fuera de alcance) — el cliente verá bids nuevos solo al abrir
  la app o hacer pull-to-refresh, no por push. Corregir esto es un hallazgo
  de backend aparte (cambiar las 3 llamadas de `bids.service.ts` para pasar
  por `NotificationsService.handleEvent` en vez de Prisma directo).
- `ClientHome` deja de ser el único screen — pasa a ser un
  `createBottomTabNavigator` con al menos `Jobs` (stack: lista → detalle) y
  `Settings` (reusar `SettingsScreen` si aplica a CLIENT, o una versión
  mínima — logout, versión de la app).

### Fuera de alcance

- **Publicar un job nuevo** (`POST /v1/jobs`, pantalla equivalente a
  `apps/web/app/(app)/client/jobs/new`) — formulario multi-campo grande,
  Fase 2b.
- **Marketplace / búsqueda de profesionales** (`apps/web/app/(app)/client/marketplace`,
  `/professionals`) — Fase 2b o posterior.
- **Rechazar o pedir cambios a un milestone**
  (`POST /v1/milestones/:milestoneId/reject`,
  `POST /v1/milestones/:milestoneId/request-changes`) — el rol `CLIENT` en
  `packages/db/prisma/seed.ts` tiene `milestones:approve` pero **no**
  `milestones:reject` (ambos endpoints exigen ese permiso). Añadir el
  permiso es una decisión de producto/RBAC que no se asume en este spec;
  hasta entonces el cliente solo puede aprobar, no rechazar, desde ningún
  cliente (mobile o web comparten la misma limitación real de backend).
- **Cualquier movimiento de dinero**: `POST /v1/jobs/:jobId/escrow/fund`,
  `POST /v1/projects/:projectId/escrow/deposit`,
  `POST /v1/milestones/:milestoneId/escrow/release`. `risk: high` de este
  spec es por el approve/accept que destraban esos flujos indirectamente,
  no porque este spec toque pagos — cualquier acción que mueva dinero real
  necesita su propio spec con revisión de `paymentGovernance` dedicada.
- **Disputes** (`POST /v1/disputes`, etc.) — Fase posterior.
- **Finance/invoices, change-orders, documents, leads, proposals,
  reviews(web)** — todo lo demás que existe bajo
  `apps/web/app/(app)/client/*` y no está listado en "Incluido" queda para
  fases futuras; ver `docs/specs/ui/client-flows-remediation.spec.md`
  (`DRAFT`) para el inventario completo del lado web.
- **Modo offline / cola de sync** para acciones del cliente — el patrón
  `trackerLocalStore` es específico de field-ops del worker, no se extiende
  aquí.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `CLIENT` | `jobs:read` | tenant/org del actor, jobs propios (scoping server-side en `JobsService.list`) | Ver sus jobs y detalle | Ver jobs de otro tenant/org |
| `CLIENT` | `bids:read` | job propio | Ver bids recibidos en su job | — |
| `CLIENT` | `bids:accept` | bid sobre job propio | Aceptar un bid | Aceptar bid de un job que no es suyo (403 esperado del backend) |
| `CLIENT` | `milestones:read` | job/project propio | Ver milestones y su estado | — |
| `CLIENT` | `milestones:approve` | milestone de job propio | Aprobar un milestone `submitted` | Rechazar o pedir cambios (permiso no otorgado, ver §2) |
| `CLIENT` | `evidence:read` | job/project propio | Ver evidencia subida | Subir evidencia (esta fase es solo lectura del lado cliente) |
| `CLIENT` | `ratings:create` | job propio, profesional que trabajó en él | Calificar | Nada lo detiene server-side de recalificar — ver hallazgo en §4 P4, no es una garantía real hoy |

- **Tenant boundary:** idéntico al resto de `/v1` — `resolveRequestContext`
  inyecta `tenantId`/`orgId` del token de sesión, no viaja en el body/query
  desde el cliente.
- **Ownership/resource policy:** cada endpoint reusado (`jobs`, `bids`,
  `milestones`, `evidence`, `ratings`) ya valida ownership server-side; este
  spec no introduce lógica de autorización nueva, solo consume endpoints
  existentes desde una superficie nueva (mobile).
- **Step-up o aprobación humana:** ninguna acción de esta fase requiere
  step-up adicional al login normal (a diferencia de fund/release, que sí lo
  tendrían en su propio spec).
- **Datos `privacyCritical`:** ninguno — no hay routing a Ollama local en
  este flujo.
- **Requisitos de auditoría:** los mismos `AuditLog` que ya emiten
  `bids.acceptBid`, `milestones.approve` y `ratings.create` del lado
  service — no se duplican ni se reemplazan por llamar desde mobile en vez
  de web.

## 4. Escenarios y criterios de aceptación

### P1 — Ver jobs y detalle

```gherkin
DADO un usuario CLIENT autenticado en apps/mobile con al menos un job posted
CUANDO abre el tab Jobs
ENTONCES ve la lista de sus jobs (GET /v1/jobs) con estado visible
Y al tocar uno ve detalle + bids + milestones + evidencia (lecturas GET existentes)
```

### P2 — Aceptar un bid

```gherkin
DADO un job propio con al menos un bid pendiente
CUANDO el cliente toca "Aceptar" sobre un bid
ENTONCES POST /v1/bids/:bidId/accept se ejecuta y el job pasa a reserved/accepted
Y el AuditLog correspondiente se emite (comportamiento ya existente del service, no nuevo)
```

### P3 — Aprobar un milestone

```gherkin
DADO un milestone en estado submitted de un job propio
CUANDO el cliente toca "Aprobar"
ENTONCES POST /v1/milestones/:milestoneId/approve se ejecuta
Y el evento milestone.approved se emite (ya cubierto por EVENT_CATALOG.md)
```

### P4 — Calificar al profesional

```gherkin
DADO un job en estado completed sin rating previo del cliente para ese profesional
CUANDO el cliente completa el formulario de rating y confirma
ENTONCES POST /v1/ratings crea la calificación
Y se emite rating.submitted (evento hoy no catalogado, ver §6)
```

**Hallazgo de §4 P4 (verificado en código, no asumido):**
`RatingsService.createRating`/`canCreateRating`
(`apps/api/src/modules/ratings/ratings.policy.ts:17`) solo valida el **rol**
del actor (`CLIENT`/`PRO`/`OPS_ADMIN`) — no hay ninguna verificación de
"¿ya existe un rating de este actor para este job/toUserId?" en el service
ni en el repository. Esto significa que **hoy, desde web, un cliente ya
puede calificar el mismo job/profesional más de una vez** sin que el
backend lo impida; no es una regresión introducida por mobile. Este spec no
agrega esa guarda (sería scope creep de negocio, no de superficie mobile) —
la UI de mobile debe reflejar la misma ausencia de idempotencia que web
tiene hoy (p.ej. deshabilitar el botón tras un submit exitoso del lado
cliente como mitigación de UX, sin depender de un 409 que el backend no
devuelve). Si se decide que esto debe cambiar, es un hallazgo de dominio
aparte para `ratings.service.ts`, no de este spec.

Casos borde:

- [ ] Aceptar un bid dos veces seguido (doble tap) — debe ser seguro o
      mostrar el error 409 del backend sin crashear la UI, no reintentarlo
      silenciosamente.
- [ ] Aprobar un milestone que ya no está en `submitted` (otro cliente/sesión
      lo aprobó primero) — mostrar el error del backend, no asumir éxito
      optimista.
- [ ] Job sin bids / sin milestones / sin evidencia — estado `empty`
      explícito, no una lista vacía sin contexto.
- [ ] Usuario con rol `CLIENT` y `PRO`/`WORKER` simultáneo — el switcher de
      `RoleGate` ya existe, verificar que cambiar de tab no deja estado
      obsoleto (p.ej. un fetch en vuelo del tab anterior sobrescribiendo el
      nuevo).

## 5. Contratos

Todos los endpoints de esta fase ya existen y están `VERIFIED`/en uso desde
`apps/web`; este spec no define contratos nuevos de API, solo declara cuáles
se consumen desde mobile. Referencia completa de request/response:
`apps/api/src/modules/{jobs,bids,milestones,evidence,ratings}/*.controller.ts`
y los tipos correspondientes en `packages/schemas/src/{job,evidence,api-input}.schema.ts`.

**Implementado:** `RatingRecordView` se agregó en un nuevo
`packages/schemas/src/rating.schema.ts` (no en `api-input.schema.ts`,
siguiendo el patrón de `evidence.schema.ts`). También se agregó
`MilestoneRecordView`/`milestoneRecordStatusSchema` en un `milestone.schema.ts`
nuevo — gap no anticipado en el spec original, encontrado recién al
implementar (`MilestoneRecord` solo existía como tipo interno de
`apps/api/src/common/domain-store.ts`, sin contraparte compartida). Nombrado
`MilestoneRecordStatus`, no `MilestoneStatus`, porque ese nombre ya existía
en `client.types.ts` con un value-set distinto (`"pending"` en vez de
`"draft"`/`"awaiting_review"`) — habría chocado en el build de
`@semse/schemas`.

**Hallazgo real encontrado al implementar (no anticipado en plan/tasks):**
`GET /v1/jobs` y `GET /v1/jobs/:jobId/milestones` corren su respuesta por
`toVisibleJob()`/`toVisibleMilestone()` (`apps/api/src/common/visible-response.ts`),
que **ponen `status` en mayúsculas** (`"posted"` → `"POSTED"`) para mostrar en
UI. `apps/web` nunca lo nota porque su BFF (`app/api/semse/jobs/route.ts`)
ya aplica `normalizeJobRecordStatus()` antes de reenviar al browser — pero
mobile no tiene BFF (habla directo a `/v1`), así que **el código de Worker ya
shippeado (`JobsListScreen`/`JobDetailScreen`, sin commitear todavía) tenía
este bug real**: toda comparación contra el enum minúscula
(`BIDDABLE_JOB_STATUSES`, `JOB_STATUS_LABEL`) nunca hacía match contra la
API real, aunque los tests locales (que mockean `fetchJobsList` directo)
nunca lo detectaban. Corregido en `src/api/jobs.ts` (aplica
`normalizeJobRecordStatus` a la respuesta) con test de regresión
(`src/api/jobs.test.ts`) — beneficia a Worker retroactivamente, no solo a
esta fase. Se agregó el mismo patrón (`normalizeMilestoneRecordStatus`) en
`src/api/milestones.ts` para el mismo problema en milestones, esta vez desde
el principio.

### UI

```yaml
surfaces:
  - apps/mobile ClientTabNavigator (bottom tabs: Jobs, Settings)
  - apps/mobile ClientJobsStackNavigator (JobsList -> JobDetail)
states:
  - loading
  - empty
  - ready
  - forbidden
  - degraded
  - error
required_behavior:
  - Reusado src/api/jobs.ts, src/api/bids.ts (+ acceptBid nuevo), src/api/evidence.ts tal cual (mismo cliente que Worker, sin fork)
  - Nuevo src/api/milestones.ts y src/api/ratings.ts
  - Nuevo src/navigation/ClientJobsStackNavigator.tsx, mismo patrón que WorkerJobsStackNavigator.tsx
  - RoleGate.tsx: comentario de TARGET_PRIORITY actualizado
  - ClientSettingsScreen.tsx separado de SettingsScreen (Worker) — ese es 100% proximityCheckInMode, no aplica a CLIENT
```

### Agente/Prometeo

No aplica — esta fase no agrega superficie de Prometeo en mobile.

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** ninguno nuevo. Se consumen transiciones de Job
  (`posted → reserved/accepted` vía bid accept) y Milestone
  (`submitted → approved`) ya definidas en `docs/foundation/STATE_MACHINES.md`.
- **Invariantes:** `docs/foundation/DOMAIN_INVARIANTS.md` — no se relajan ni
  se agregan.
- **Eventos declarados:** `job.created`, `milestone.submitted`,
  `milestone.approved`, `milestone.rejected` ya están en
  `docs/foundation/EVENT_CATALOG.md`. **Hallazgo (no introducido por este
  spec, preexistente):** `RatingsService.createRating`
  (`apps/api/src/modules/ratings/ratings.service.ts:105`) ya emite
  `rating.submitted` en producción, pero ese nombre **no está** en
  `EVENT_CATALOG.md` — es un evento no catalogado que ya corre hoy desde
  `apps/web`. Este spec no lo inventa ni lo agrega de nuevo; documentarlo o
  catalogarlo retroactivamente es un hallazgo de higiene de eventos aparte,
  fuera del alcance de la Fase 2 de mobile. `bids.service`/`bids.repository`
  no emiten ningún evento en el accept — confirmado por grep, no hay
  `domainEventBus.emit` en el módulo de bids.
- **Productor + outbox atómico / Consumidores + idempotencia / Replay /
  DLQ:** sin cambios — se reusa el pipeline existente de
  `NotificationsService` → `PushDispatchService`, que ya es agnóstico del
  rol del destinatario.

## 7. Datos y migración

- **Modelos Prisma:** ninguno nuevo. Se leen/escriben los mismos modelos
  que ya usa `apps/web/app/(app)/client` (Job, Bid, Milestone, Evidence,
  Rating).
- **Migración:** no aplica — sin cambio de schema.
- Resto de la sección: N/A.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva — se reusan los mismos endpoints ya
  monitoreados que consume `apps/web`.
- **Logs/traces/correlation:** mobile ya envía `Authorization: Bearer` vía
  `src/api/client.ts`; no hay correlation-id propio de mobile hoy — fuera de
  alcance de este spec introducirlo (aplicaría igual a Worker, no es
  específico de Client).
- **Feature flags/allowlists:** ninguno — a diferencia de las flags de
  `projects/:projectId/projection` (F3), nada de esta fase está detrás de
  flag porque son los mismos endpoints ya activos sin flag en web.
- **Plan de canary:** build interno (`eas build --profile preview`) probado
  por el propio usuario/equipo antes de `production` — ver limitación ya
  documentada en `apps/mobile/README.md` ("built in a sandbox with no
  Xcode/Android SDK/simulator available").
- **Evidencia de producción requerida:** capturas o grabación de un run real
  en un device/simulator (no solo `tsc --noEmit`), igual que se exige para
  Worker en el README.
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [ ] Unitarios: `resolveAvailableTargets`/`RoleGate` ya cubiertos si
      existieran — agregar caso si `ClientTabNavigator` deja de ser un
      componente trivial.
- [ ] Screens: `ClientJobsListScreen.test.tsx`, `ClientJobDetailScreen.test.tsx`
      (mismo patrón que `apps/mobile/src/screens/worker/*.test.tsx`, mock de
      `src/api/*`).
- [ ] Permiso denegado: 403 de `bids:accept`/`milestones:approve` sobre
      recurso ajeno debe reflejarse como error visible, no crash.
- [ ] Idempotencia/reintento: doble-tap en accept/approve (ver casos borde §4).
- [ ] UI loading/empty/forbidden/degraded/error para JobsList y JobDetail.
- [ ] No se requieren tests de migración (sin cambio de datos).
- [ ] Canary/smoke autenticado en producción antes de marcar `VERIFIED`.

## 10. Mapa de implementación

### API

- Ninguno — todos los endpoints ya existen. Único cambio potencial:
  `packages/schemas` (ver gap de `RatingRecordView` en §5), que no es
  `apps/api` sino un paquete compartido.

### Mobile (`apps/mobile`)

- `src/navigation/ClientTabNavigator.tsx` — reemplazar el stub por tabs
  reales (Jobs, Settings).
- `src/navigation/ClientJobsStackNavigator.tsx` — nuevo, mismo patrón que
  `WorkerJobsStackNavigator.tsx`.
- `src/screens/client/JobsListScreen.tsx`, `JobDetailScreen.tsx`,
  `RatingFormScreen.tsx` — nuevos.
- `src/api/ratings.ts` — nuevo.
- `src/navigation/types.ts` — agregar `ClientJobsStackParamList`.

### Packages

- `packages/schemas/src/` — tipo de salida para ratings (ver §5).

### Tests

- `apps/mobile/src/screens/client/*.test.tsx`.

## 11. Investigación externa

No aplica — esta fase reusa contratos internos ya existentes; no requiere
investigación de librerías o APIs externas nuevas (a diferencia de, por
ejemplo, la integración original de `expo-notifications`/`expo-server-sdk`).

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado (N/A — sin migración)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado (build real en device/simulador)
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
