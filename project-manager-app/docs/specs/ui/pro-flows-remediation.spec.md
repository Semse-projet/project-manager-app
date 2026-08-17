---
id: "ui.pro-flows-remediation"
title: "Pro/Worker UI Flows — Remediation (re-verificado 2026-08-17)"
domain: "ui"
sdd_version: "2.0"
version: "2.0"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "MERGED"
deploy_status: "DEPLOYED"
activation_status: "ACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/web/app/(app)/worker
  - apps/web/app/(app)/worker/dashboard/page.tsx
  - apps/web/app/(app)/worker/jobs/[jobId]/page.tsx
  - apps/web/app/(app)/worker/field-ops/page.tsx
  - apps/web/app/(app)/worker/tracker
  - apps/web/app/(app)/worker/agenda/page.tsx
  - apps/web/app/(app)/worker/payments/page.tsx
  - apps/web/app/(app)/worker/profile/page.tsx
  - apps/web/app/(app)/worker/evidence/page.tsx
  - apps/web/app/(app)/worker/travel/[travelId]/page.tsx
  - apps/api/src/modules/evidence/evidence.controller.ts
  - apps/web/app/(app)/worker/review/page.tsx
  - apps/web/app/(app)/worker/rates/page.tsx
  - apps/web/app/(app)/worker/incidents/page.tsx
  - apps/web/app/(app)/worker/materials/page.tsx
  - apps/web/app/(app)/worker/tasks/page.tsx
  - apps/web/app/(app)/worker/disputes/page.tsx
  - apps/web/app/(app)/worker/opportunities/page.tsx
  - apps/web/app/(app)/worker/settings/page.tsx
  - apps/web/app/(app)/worker/bids/page.tsx
  - apps/web/app/(app)/worker/travel/page.tsx
  - apps/web/app/components/disputes/DisputeResolutionWorkspace.tsx
  - apps/web/app/components/payments/PayoutMethodForm.tsx
  - apps/api/src/modules/labor-engine
  - apps/api/src/modules/travel
  - apps/api/src/modules/travel/travel.service.ts
  - apps/api/src/modules/field-ops
  - apps/api/src/modules/field-ops/field-ops.repository.ts
  - apps/api/src/modules/incidents/incidents.service.ts
  - apps/api/src/modules/materials/materials.service.ts
  - apps/api/src/modules/tasks/tasks.service.ts
  - apps/api/src/modules/jobs/jobs.repository.ts
  - apps/api/src/common/visible-response.ts
  - apps/api/src/modules/users/users.controller.ts
  - apps/api/src/modules/users/users.policy.ts
  - apps/api/src/modules/payments/providers/stripe.provider.ts
  - apps/api/src/modules/worker-verification/worker-verification.repository.ts
  - apps/api/src/modules/matching/matching.algorithm.ts
  - apps/api/src/modules/intelligence/budget-intelligence.service.ts
  - apps/api/src/modules/pricing/contractor-rate.service.ts
  - packages/auth/src/rbac.ts
  - apps/api/src/common/rbac.guard.ts
  - apps/api/src/modules/ai-models/ai-models.controller.ts
  - apps/api/src/modules/prometeo-copilot/prometeo-copilot.controller.ts
  - apps/web/lib/language-context.tsx
related_tests: []
related_endpoints:
  - v1/time-tracker
  - v1/field-ops
  - v1/payments/connect
  - v1/matching
  - v1/ai-models/prometeo/chat
  - v1/prometeo-copilot
  - v1/uploads/plan
  - v1/uploads/files
  - v1/travel
  - v1/incidents
  - v1/materials
  - v1/tasks
  - v1/users
  - v1/users/:userId/verify-request
  - v1/jobs
  - v1/intelligence/budget/suggest
related_events: []
related_agents:
  - prometeo
  - felix
  - marta
  - pulse
  - justus
  - planner
last_verified: "2026-08-17"
---

# Spec: Pro/Worker UI Flows — Remediation

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.
>
> **Nota de nomenclatura.** El rol real en la base de datos (`Role.name`) es
> **`PRO`**, no `WORKER`. La UI vive bajo `/worker/*` y el sidebar se
> etiqueta a sí mismo "Profesional". Este spec cubre esa app completa —
> distinta de `docs/specs/ui/pro-flows.spec.md`, que cubre específicamente
> el catálogo ProTools (`apps/web/app/(app)/tools`). Ver §2.

## 1. Problema y resultado

**Para quién:** actores con rol `PRO` (UI: "Profesional") y `WORKER`
(alias legado del mismo rol) usando `apps/web/app/(app)/worker/**`.

**Problema (estado 2026-07-20/21, auditoría original):** la app completa
del rol PRO nunca tuvo spec propio. Una auditoría en vivo + una ronda de 5
agentes de código en paralelo encontraron 13 gaps `CRÍTICO` (G-PRO-00 a
G-PRO-13) y 42 hallazgos adicionales (catalogados en
`docs/AUDIT_REMEDIATION_PLAN.md` sección 2), incluyendo un badge de estado
de trabajo que no coincidía con lo que veía el cliente, evidencia que no se
subía realmente a storage, el chat de todos los agentes de IA
(Prometeo/Felix/Marta/...) roto por RBAC, y varios IDOR cross-tenant/
cross-worker.

**Estado re-verificado ahora (2026-08-17):** al releer el código actual
contra cada gap (no contra el reporte de la auditoría), **9 de los 13
gaps `CRÍTICO` (G-PRO-01, 05, 06, 07, 09, 10, 11, 12, 13) y los 3 IDOR
`ALTO` del catálogo de seguridad ya están resueltos en código**, cada uno
con evidencia file:line concreta abajo — varios incluso con comentarios en
el propio código que referencian el hallazgo original
(`docs/AUDIT_REMEDIATION_PLAN.md`, `G-PRO-XX`). Esto es una actualización
sustancial respecto al `DRAFT` anterior, que databa todo como pendiente.

**Lo que sigue roto, confirmado hoy contra el código, no asumido:**

- **G-PRO-00** — el mismatch de badge de estado (`normalizedStatus` sin
  `.toLowerCase()`) sigue presente tal cual, sin cambios, en
  `apps/web/app/(app)/worker/jobs/[jobId]/page.tsx:150`.
- **Parte no resuelta de G-PRO-08** — `/worker/dashboard` sigue sin
  mostrar oportunidades reales; ver detalle abajo (el gap de seguridad de
  G-PRO-08 sí se resolvió, el de UI no).
- **G-PRO-02** (Stripe Connect sin explicación clara al profesional) y
  **G-PRO-04** (verificación DID no funcional) — ver "Bloqueado por
  decisión de producto" abajo; no son bugs de una línea.

**Resultado esperado:** cerrar los 2 gaps de UI que quedan abiertos
(G-PRO-00 y el remanente de G-PRO-08), obtener una decisión de producto
sobre G-PRO-02/G-PRO-04, y — antes de `APPROVED` — que exista al menos un
test de regresión real para cada gap ya resuelto (`related_tests` sigue
vacío: todo lo confirmado abajo se verificó leyendo código, no corriendo
una suite).

## 2. Alcance

### Incluido

- `apps/web/app/(app)/worker/**` completo: dashboard, jobs, field-ops,
  tracker (Labor Engine), agenda, payments, profile, evidence, travel,
  review, rates, incidents, materials, tasks, disputes, opportunities,
  settings, bids.
- El Time Tracker/Labor Engine en la medida que lo consume esta UI.
- El flujo de cobro (Stripe Connect) desde la perspectiva del profesional.
- El chat de Prometeo/agentes especializados desde `/worker/*` (RBAC).
- IDOR y aislamiento tenant/actor en los endpoints que esta UI consume
  (field-ops, incidents, materials, tasks, travel).

### Fuera de alcance

- **El catálogo ProTools** (`apps/web/app/(app)/tools`,
  `apps/api/src/modules/tools`, `apps/api/src/modules/semse-agents/protools.agent.ts`)
  — cubierto por `docs/specs/ui/pro-flows.spec.md`. Este spec solo toca
  ProTools indirectamente en G-PRO-13 (la tarifa del profesional
  afectando un estimado), y ahí solo desde el ángulo de
  `budget-intelligence.service.ts`, no del estimador ProTools en sí.
- La lógica de nómina/overtime en sí (0.19, transversal) — un gap de
  cumplimiento laboral, no de UI.
- El algoritmo de matching en sí (0.27/0.28) — aquí solo se documenta su
  efecto visible en `/worker/profile` (Trust 0%).
- Si el rol debería renombrarse de `PRO` a `WORKER` en la base de datos —
  solo se documenta que hoy existen ambos nombres.
- Implementar verificación DID real (criptografía real) — decisión de
  producto pendiente, ver sección de bloqueo abajo.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `PRO` | `agents:run:create` | tenant del actor | chatear con Prometeo/agentes (ver G-PRO-05, resuelto) | — |
| `PRO` | `travel:manage` | viajes propios | crear/gestionar sus propios viajes (ver G-PRO-10, resuelto) | gestionar viajes de otro profesional (ver IDOR resuelto abajo) |
| `PRO` | `users:verify:request` | su propio usuario | solicitar revisión de verificación (ver G-PRO-09, resuelto) | ejecutar `users:verify` (exclusivo `OPS_ADMIN`) |
| `PRO`/`WORKER` | `field-ops:write` | unidades de su tenant | actualizar estado de una `FieldUnit` de su propio tenant | actualizar una `FieldUnit` de otro tenant (ver G-PRO-11, resuelto) |
| `WORKER` (alias) | mismos permisos que `PRO` salvo `bids:create`/`milestones:submit`/`change-orders:*` | — | — | — |

- **Tenant boundary:** `resolveRequestContext` sigue siendo la única
  fuente de `tenantId`; los fixes de IDOR listados abajo agregan el filtro
  `tenantId` que faltaba en el `where`, no una fuente nueva de contexto.
- **Ownership/resource policy:** `incidents`, `materials` y `travel` ahora
  verifican explícitamente que el actor esté asignado al job/viaje
  (`ForbiddenException("actor is not assigned to this job/travel")`) antes
  de leer o escribir — cerrando el IDOR intra-tenant documentado en la
  auditoría original.
- **Step-up o aprobación humana:** ninguna nueva.
- **Datos `privacyCritical`:** ninguno nuevo introducido por estos fixes.
- **Requisitos de auditoría:** el override manual de `OPS_ADMIN` sobre
  `updateUnitStatus`/tareas/incidentes sigue sin trazabilidad explícita de
  actor/motivo más allá de lo que cada módulo ya registraba — no se agregó
  auditoría nueva en los fixes revisados.

## 4. Escenarios y criterios de aceptación

### P1 — El badge de estado de un trabajo coincide con lo que ve el cliente (ABIERTO)

```gherkin
DADO un job con status ACCEPTED (mayúsculas, como lo devuelve la API)
CUANDO un PRO abre /worker/jobs/[jobId]
ENTONCES el badge debe mostrar "Aceptado", igual que /client/jobs/[jobId]
```

**Estado real confirmado hoy:** falla. `normalizedStatus = asString(job?.status) ?? "posted"`
(`apps/web/app/(app)/worker/jobs/[jobId]/page.tsx:150`) nunca aplica
`.toLowerCase()`, y `job.status` llega en mayúsculas porque
`GET /v1/jobs/:jobId` pasa por `toVisibleJob()`
(`apps/api/src/modules/jobs/jobs.controller.ts:48,92,120,164`, que
uppercasea vía `jobStatusVisibleMap` en
`apps/api/src/common/visible-response.ts:3-17,63-65`). La búsqueda en
`JOB_STATUS_META` (claves en minúsculas) falla y cae al fallback
`.posted` — el mismo patrón que en `worker/agenda/page.tsx`, que **sí**
normaliza correctamente porque construye su propio `status: String(j.status ?? "")`
desde `fetchMyJobs()` sin pasar por el mismo camino de mayúsculas (ver
`apps/web/app/(app)/worker/agenda/page.tsx:36` vs. `STATUS_CONFIG` en
minúsculas también ahí — coincide por una ruta de datos distinta, no
porque el bug esté arreglado).

### P2 — El dashboard muestra oportunidades reales (PARCIALMENTE ABIERTO)

```gherkin
DADO jobs con status POSTED en el tenant
CUANDO un PRO abre /worker/dashboard
ENTONCES la sección "Oportunidades abiertas" debe listarlos
Y la llamada no debe traer jobs DRAFT de otras organizaciones
```

**Estado real confirmado hoy — dividido en dos mitades:**

- **Mitad de seguridad — RESUELTA:** `jobs.repository.ts:79-126`
  (`listByTenant`) ahora aplica `visibilityWhere` para `PRO`/`WORKER`:
  solo jobs `POSTED`/`PUBLISHED`, o donde el actor tiene bid/reserva
  activa/contrato/proyecto asignado. Ya no expone jobs `DRAFT` de otras
  orgs sin relación con el actor.
- **Mitad de UI — SIGUE ABIERTA:** `worker/dashboard/page.tsx:155`
  filtra `["posted","published"].includes(job.status)`, pero `job.status`
  llega en mayúsculas (mismo `toVisibleJob()` que en P1, aplicado en
  `GET /v1/jobs` línea 35 del controller). El filtro nunca matchea — la
  sección de oportunidades sigue vacía siempre, mismo síntoma que G-PRO-08
  documentó originalmente, causa raíz idéntica a G-PRO-00.

### P3 — Subir evidencia sube el archivo real (RESUELTO)

```gherkin
DADO un PRO en /worker/evidence con un archivo seleccionado
CUANDO presiona "Registrar"
ENTONCES ocurre un PUT real a la URL de presign
Y el objeto existe en storage antes de registrar la evidencia
```

**Estado real confirmado hoy:** resuelto en ambos archivos.
`apps/web/app/(app)/worker/evidence/page.tsx:141-149` y
`apps/web/app/(app)/worker/travel/[travelId]/page.tsx:274-282` ahora
hacen `fetch(".../uploads/files/${key}", { method: "PUT", body: file })`
con la `key` real devuelta por `planUpload()`, antes de registrar
evidencia/gasto — ya no fabrican una key local ni omiten el `PUT`.

### P4 — Un PRO puede chatear con Prometeo/agentes (RESUELTO)

```gherkin
DADO un usuario con rol PRO o WORKER
CUANDO envía un mensaje a Prometeo o a cualquier agente especializado
ENTONCES recibe una respuesta real, no "Insufficient permissions"
```

**Estado real confirmado hoy:** resuelto. `packages/auth/src/rbac.ts:94,113`
ya incluye `"agents:run:create"` en los arrays de `PRO` y `WORKER` — el
mismo permiso que exige `POST /v1/ai-models/prometeo/chat`
(`ai-models.controller.ts:213-214`) y el resto de los 40+ endpoints de
chat listados en la auditoría original, todos gateados por el mismo
`@RequirePermissions("agents:run:create")`. La traducción de
`nav.aiSettings` también se corrigió: `apps/web/lib/language-context.tsx:83`
ahora dice "Configuración del asistente" en español (antes decía
"Asistente IA", que confundía con un chat).

### P5 — Un PRO puede enviar una reseña de cliente (RESUELTO)

```gherkin
DADO un job completado/en revisión con contrato firmado
CUANDO el PRO completa el formulario de reseña en /worker/review
ENTONCES la reseña se crea sin depender de un campo inexistente
```

**Estado real confirmado hoy:** resuelto. `JobRecordView` ahora declara
`clientUserId`/`clientEmail` (`packages/schemas/src/job.schema.ts:76-77`),
y `fetchMyJobs()` (`apps/web/app/semse-api.ts:378-381`) los llena con
datos reales desde `Contract.clientUserId` vía `bids.repository.ts` — el
comentario en el código cita explícitamente "G-PRO-07/2.17". La página
`worker/review/page.tsx` ya no necesita el cast `(j as any)`.

### P6 — Verificación de perfil, viajes y estado de pagos (RESUELTO)

- **G-PRO-09 (botón "Verificar" 403):** resuelto —
  `users.controller.ts:157-158` agregó `POST /:userId/verify-request`
  gateado por `users:verify:request` (que `PRO`/`WORKER` sí tienen),
  distinto del endpoint admin-only `POST /:userId/verify`. El frontend
  (`worker/profile/page.tsx:156`) ya llama al endpoint nuevo.
- **G-PRO-10 (viajes 403 siempre):** resuelto — `travel.controller.ts`
  usa `@RequirePermissions("travel:manage")` en vez de `jobs:create`; ese
  permiso nuevo sí está en `PRO`/`WORKER`/`CLIENT`.
- **G-PRO-12 (badge de pago por `type`, no `status`):** resuelto —
  `worker/payments/page.tsx:82-86` ahora deriva el badge de `row.status`
  real (`FAILED`/`REVERSED` nunca se pintan como liberado/en escrow),
  con comentario explícito en el código citando el fix.
- **G-PRO-13 (tarifa del profesional sin efecto real):** resuelto —
  `budget-intelligence.service.ts:199-224` ahora aplica
  `contractorRate.getOverride(proUserId)` del profesional **asignado**
  (vía `Contract.professionalUserId`) al calcular `POST /v1/intelligence/budget/suggest`,
  y el texto de `/worker/rates` se corrigió para prometer solo esto
  ("una vez que ese trabajo te lo asignen a vos" en vez de "en todos los
  estimados futuros").

Casos borde (todos los anteriores):

- [ ] Ninguno de los fixes anteriores tiene un test de regresión dedicado
      todavía (`related_tests: []`) — confirmados por lectura de código,
      no por suite verde.
- [ ] `worker/agenda/page.tsx` no debe regresar al mismo bug de mayúsculas
      si algún día empieza a consumir `job.status` desde `GET /v1/jobs`
      en vez de `fetchMyJobs()`.

## 5. Contratos

### API — sin contratos nuevos

Este spec no introduce endpoints nuevos; documenta permisos y filtros que
ya cambiaron en endpoints existentes:

```yaml
auth: required
permissions: [travel:manage, users:verify:request, agents:run:create, field-ops:write]
effects:
  audit_log: sin cambios nuevos en esta pasada
  domain_event: ninguno
  sse: ninguno
  payment_governance: no aplica directamente — G-PRO-02 (Connect) sigue
    dependiendo de que el payout falle explícitamente sin cuenta conectada,
    ya resuelto en apps/api/src/modules/payments/providers/stripe.provider.ts:82-97
```

### UI

```yaml
surfaces:
  - /worker/dashboard
  - /worker/opportunities
  - /worker/jobs
  - /worker/jobs/[jobId]
  - /worker/tracker (Labor Engine real — 6 tabs: Timer/Resumen/Registros/Proyectos/Reportes/Asistente)
  - /worker/field-ops (pestaña "Tracker" removida 2026-07-27 — ver G-PRO-01 abajo)
  - /worker/payments
  - /worker/profile
  - /worker/evidence
  - /worker/travel / /worker/travel/[travelId]
  - /worker/tasks
  - /worker/materials
  - /worker/incidents
  - /worker/review
  - /worker/rates
states:
  - loading
  - empty
  - ready
  - forbidden
  - degraded
  - error
required_behavior:
  - El badge de estado de un trabajo debe coincidir exactamente con lo que
    ve el cliente para el mismo jobId — BLOQUEADO hoy por G-PRO-00 (P1)
  - "Oportunidades abiertas" debe listar jobs POSTED reales — BLOQUEADO
    hoy por el remanente de G-PRO-08 (P2)
  - Un archivo de evidencia subido debe existir en storage — RESUELTO (P3)
  - Un PRO debe poder chatear con Prometeo/agentes — RESUELTO (P4)
  - Solo debe existir una ruta activa de registro de horas por profesional
    — RESUELTO 2026-07-27 (G-PRO-01)
```

### Agente/Prometeo

```yaml
tools: []
input_schema: n/a — este spec no define tools nuevas
output_schema: n/a
source_citations_required: false
approval_policy: n/a
forbidden_behavior:
  - El chat de Prometeo/agentes no debe devolver un error crudo en inglés
    sin traducir al usuario final (mitigado indirectamente: el 403 ya no
    debería ocurrir para PRO/WORKER tras el fix de RBAC de P4, pero no se
    confirmó que el frontend traduzca un 403 si ocurriera por otra causa)
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: `Job` (visualización de estado únicamente — sin
  transiciones nuevas ni distintas de `docs/foundation/DOMAIN_INVARIANTS.md`).
- Invariantes: los estados visibles canónicos (`DRAFT/POSTED/RESERVED/
  ACCEPTED/IN_PROGRESS/REVIEW/DISPUTE/COMPLETED/CANCELLED`) ya están
  correctamente definidos en `jobStatusVisibleMap`
  (`apps/api/src/common/visible-response.ts:3-17`) — el bug de P1/P2 es
  puramente de comparación de casing en el cliente, no de mapeo de estado.
- Eventos declarados: ninguno nuevo.
- Productor + outbox atómico / Consumidores + idempotencia / Replay/DLQ:
  no aplica — sin cambios de arquitectura de eventos en este spec.

## 7. Datos y migración

- Modelos Prisma: ninguno nuevo.
- Migración: no aplica — todos los fixes verificados son de lógica
  (filtros `where`, permisos RBAC, normalización de estado en frontend),
  no de esquema.
- Compatibilidad hacia atrás: los fixes de IDOR (`field-ops`, `incidents`,
  `materials`, `tasks`, `travel`) son estrictamente más restrictivos que
  antes — no deberían romper ningún flujo legítimo, solo bloquear acceso
  cross-tenant/cross-actor que nunca debió funcionar.
- Verificación de drift: no aplica.
- Rollback de código: cada fix es reversible individualmente (son diffs
  acotados por archivo, listados en §10); no hay dependencia entre ellos.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva definida en este spec.
- **Feature flags:** ninguno — todos los fixes son código incondicional.
- **Plan de canary:** no aplica — cambios ya integrados en el árbol
  principal de `apps/web`/`apps/api`, sin flag de activación.
- **Evidencia de producción requerida antes de `VERIFIED`:** ninguno de
  los "RESUELTO" de este spec fue confirmado con una sesión real en
  `semse-web-production.up.railway.app` — toda la re-verificación de esta
  pasada fue lectura de código, consistente con lo que pide la
  constitución (Artículo XIII: "si no se puede observar un estado, se
  registra como no verificado; nunca se infiere"). Antes de `VERIFIED`
  se necesita repetir el estilo de auditoría en vivo del 2026-07-20/21
  con una cuenta PRO real, esta vez enfocada en confirmar P1-P6.
- **Señal de rollback:** reaparición de `Insufficient permissions` en el
  chat, o de un IDOR cross-tenant confirmado en producción.
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [ ] `/worker/jobs/[jobId]` muestra el mismo badge de estado que
      `/client/jobs/[jobId]` para el mismo `jobId` — **sigue fallando**
      (G-PRO-00 / P1, no resuelto)
- [ ] `/worker/dashboard` muestra oportunidades reales cuando existen jobs
      `posted` en el tenant — **sigue fallando** (remanente de G-PRO-08 / P2)
- [x] La pestaña "Tracker" de `/worker/field-ops` no permite iniciar una
      sesión de tiempo nueva — removida por completo 2026-07-27 (G-PRO-01)
- [ ] Un usuario con rol `PRO` puede enviar un mensaje a Prometeo y recibe
      respuesta real — código lo permite hoy (RBAC arreglado), pero sin
      test automatizado que lo bloquee de regresar (P4)
- [ ] Un usuario con rol `WORKER` (literal) tiene el mismo resultado —
      mismo estado que el punto anterior
- [ ] Subir una foto en `/worker/evidence` hace un `PUT` real y el objeto
      existe en storage — código lo hace hoy, sin test automatizado (P3)
- [ ] Subir un comprobante en `/worker/travel/[travelId]` — ídem
- [ ] Un PRO puede enviar una reseña desde `/worker/review` — código lo
      permite hoy, sin test automatizado (P5)
- [ ] Un PRO puede completar "Solicitar verificación" sin 403 — código lo
      permite hoy, sin test automatizado
- [ ] Un PRO puede crear un viaje en `/worker/travel` sin 403 — código lo
      permite hoy, sin test automatizado
- [ ] Un pago `FAILED`/`REVERSED` no se muestra como "Liberado"/"En
      escrow" — código lo hace bien hoy, sin test automatizado
- [ ] Guardar una tarifa en `/worker/rates` tiene efecto verificable en un
      estimado real cuando el profesional está asignado al job — código
      lo hace hoy vía `budget-intelligence.service.ts`, sin test
      automatizado
- [ ] IDOR: `updateUnitStatus`, incidents/materials/tasks/travel de otro
      actor/tenant deben rechazarse — código lo hace hoy, sin test
      automatizado que fije la regresión

## 10. Mapa de implementación

### Web — abierto

- `apps/web/app/(app)/worker/jobs/[jobId]/page.tsx:150` — G-PRO-00, aplicar
  `.toLowerCase()` (o normalizar en un punto compartido BFF/mapper) antes
  de indexar `JOB_STATUS_META`/`WORKER_NEXT_ACTION`.
- `apps/web/app/(app)/worker/dashboard/page.tsx:155` — remanente de
  G-PRO-08, mismo fix de normalización aplicado a `job.status` antes de
  filtrar `["posted","published"]`.

### Web — ya resuelto (referencia, sin acción)

- `apps/web/app/(app)/worker/evidence/page.tsx:120-154`
- `apps/web/app/(app)/worker/travel/[travelId]/page.tsx:256-288`
- `apps/web/app/(app)/worker/review/page.tsx`
- `apps/web/app/(app)/worker/profile/page.tsx:151-158`
- `apps/web/app/(app)/worker/payments/page.tsx:82-86`
- `apps/web/app/(app)/worker/rates/page.tsx:140,158`
- `apps/web/lib/language-context.tsx:83`
- `apps/web/app/components/payments/PayoutMethodForm.tsx` (migración a
  Stripe Elements — pendiente solo configurar
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` en Railway, fuera del control de
  este spec)

### API — ya resuelto (referencia, sin acción)

- `packages/auth/src/rbac.ts:94,113` (`agents:run:create` para PRO/WORKER)
- `apps/api/src/modules/users/users.controller.ts:157-158` (`verify-request`)
- `apps/api/src/modules/travel/travel.controller.ts` (`travel:manage`)
- `apps/api/src/modules/travel/travel.service.ts:298-311` (IDOR assignedTo)
- `apps/api/src/modules/field-ops/field-ops.repository.ts:123-133` (tenantId en `updateMany`)
- `apps/api/src/modules/incidents/incidents.service.ts:8-13` (ownership check)
- `apps/api/src/modules/materials/materials.service.ts:8-13` (ownership check)
- `apps/api/src/modules/tasks/tasks.service.ts:139-142` (assignedTo check)
- `apps/api/src/modules/jobs/jobs.repository.ts:79-126` (`visibilityWhere` por rol)
- `apps/api/src/modules/payments/providers/stripe.provider.ts:72-97` (fallo explícito sin Connect)
- `apps/api/src/modules/intelligence/budget-intelligence.service.ts:199-224` (tarifa del PRO asignado)
- `apps/api/src/modules/worker-verification/worker-verification.repository.ts:115-135` (falla cerrado en vez de aprobar sin validar)

### Tests

- Ninguno existe todavía para este módulo (`related_tests: []`). Antes de
  `APPROVED` se espera al menos un test por cada fila marcada `[ ]` en §9.

## 11. Investigación externa

No aplica — remediación interna sobre código propio, sin dependencias
externas nuevas.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes — **0 tests existen hoy**
- [ ] `pnpm spec:validate:strict` verde
- [x] Migración reproducible y rollback/forward-fix documentado (no aplica)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado (los fixes ya están en el árbol, pero
      sin un PR/SHA específico registrado en este spec)
- [ ] Deployment terminal `DEPLOYED` (razonable por convención del repo,
      sin verificación en vivo esta sesión)
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` actualizado con una sesión real en producción
- [ ] Los 2 gaps de UI abiertos (G-PRO-00, remanente de G-PRO-08) resueltos
- [ ] Decisión de producto tomada sobre G-PRO-02/G-PRO-04 (ver abajo)
- [ ] Sólo entonces `status: APPROVED` → luego `VERIFIED`

## Bloqueado por decisión de producto

Este spec **no** pasa a `APPROVED` todavía porque quedan preguntas de
producto reales, no solo trabajo de código pendiente:

1. **G-PRO-04 — Verificación de identidad (DID) es intencionalmente no
   funcional.** El código ya no es un stub peligroso que aprueba
   cualquier string no vacío — `verifyDidSignature()`
   (`apps/api/src/modules/worker-verification/worker-verification.repository.ts:115-135`)
   ahora **falla cerrado siempre** (`return false`), con un comentario
   explícito explicando que no existe ningún cliente (web u otro) que
   genere un keypair real y firme un challenge. Esto es más seguro que
   antes, pero significa que **ningún profesional puede completar
   verificación DID hoy, por diseño**. Pregunta abierta para producto: ¿se
   construye un cliente de firma real (crypto.subtle/tweetnacl) en esta
   iteración, o se retira la promesa de "Profesionales verificados" de la
   landing pública hasta entonces? No es una decisión que un agente deba
   tomar unilateralmente.
2. **G-PRO-02 — Stripe Connect: el backend ya no puede pagar a la cuenta
   equivocada** (`stripe.provider.ts:82-97` ahora lanza error en vez de
   caer a la cuenta legacy compartida), **pero la UI de `/worker/payments`
   todavía no le explica al profesional, en el momento de fallar un
   payout, por qué no puede cobrar todavía.** Esto es trabajo de copy/UX
   normal, no bloqueado por una decisión — se deja documentado aquí por
   completitud, no como bloqueador real.
3. **Gate original de esta spec, nunca confirmado:** el `Acceptance
   Criteria` del `DRAFT` anterior pedía "el equipo de producto revisa y
   prioriza los 42+13 hallazgos... antes de `APPROVED`". No hay evidencia
   en el repositorio de que esa revisión formal haya ocurrido — lo que sí
   hay es evidencia fuerte de que la mayoría de los ítems `CRÍTICO` fueron
   remediados en código, lo cual sugiere que alguna forma de priorización
   sí pasó, solo que no quedó documentada como tal. Se recomienda a
   producto confirmar/cerrar este punto explícitamente en vez de asumirlo
   por inferencia de código, siguiendo el Artículo XIII de la
   constitución.

Hasta que (1) se resuelva con una decisión explícita y (2) el gate 3 se
confirme o se dé por innecesario explícitamente, el spec permanece en
`REVIEW` — no por falta de calidad de sus escenarios (P1-P6 están
completos y verificados contra código real), sino porque `APPROVED`
requeriría poder afirmar que no queda ninguna pregunta de producto abierta,
y todavía quedan dos.

## Histórico — catálogo original de gaps (2026-07-20/21)

> Preservado por trazabilidad; el estado actual de cada uno está en §4.
> Numeración original mantenida para no romper referencias cruzadas desde
> `docs/AUDIT_REMEDIATION_PLAN.md`.

- **G-PRO-00** (badge de estado) — **ABIERTO**, ver P1.
- **G-PRO-01** (dos cronómetros) — **RESUELTO** 2026-07-27: pestaña
  "Tracker" de `/worker/field-ops` removida, link a `/worker/tracker`
  agregado. Backend `FieldOpsService`/`TrackerSession` deliberadamente sin
  tocar.
- **G-PRO-02** (Stripe Connect sin explicación) — backend seguro, UI
  pendiente. Ver "Bloqueado por decisión de producto".
- **G-PRO-03** (Trust 0% sin contexto) — **RESUELTO**:
  `worker/profile/page.tsx:114-120` muestra "Trust — nuevo en la
  plataforma" cuando `trustScore === 0` y no hay ratings, en vez de "0%"
  desnudo.
- **G-PRO-04** (verificación DID stub) — comportamiento cambiado (falla
  cerrado en vez de aprobar falso), sigue no funcional. Ver "Bloqueado por
  decisión de producto".
- **G-PRO-05** (chat de agentes roto por RBAC) — **RESUELTO**, ver P4.
- **G-PRO-06** (evidencia/comprobantes no suben archivo real) —
  **RESUELTO**, ver P3.
- **G-PRO-07** (reseñas rotas por `clientUserId` inexistente) —
  **RESUELTO**, ver P5.
- **G-PRO-08** (oportunidades vacías + IDOR de jobs DRAFT) — **IDOR
  resuelto**, **UI de oportunidades sigue vacía**. Ver P2.
- **G-PRO-09** (botón "Verificar" 403) — **RESUELTO**, ver P6.
- **G-PRO-10** (viajes inalcanzables, 403) — **RESUELTO**, ver P6.
- **G-PRO-11** (IDOR cross-tenant en field-ops) — **RESUELTO**, ver P6.
- **G-PRO-12** (badge de pago ignora `status` real) — **RESUELTO**, ver P6.
- **G-PRO-13** (tarifas sin efecto real) — **RESUELTO**, ver P6.
- **IDOR intra-tenant — incidents/materials (plan 2.19)** — **RESUELTO**:
  `incidents.service.ts:8-13`/`materials.service.ts:8-13` ahora exigen
  que el actor esté asignado al job antes de leer/escribir.
- **IDOR intra-tenant — tasks (plan 2.20)** — **RESUELTO**:
  `tasks.service.ts:139-142` exige `assignedTo === actorUserId` salvo
  `OPS_ADMIN`.
- **IDOR intra-tenant — travel (plan 2.34)** — **RESUELTO**:
  `travel.service.ts:298-311` exige `assignedTo === actorUserId`.
- **PCI-DSS — PayoutMethodForm (plan 2.44)** — **RESUELTO** 2026-07-27:
  migrado a Stripe Elements (`<CardElement>`, `stripe.createToken`) — el
  backend ya no recibe PAN/routing en texto plano. Pendiente solo
  configuración de `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` en Railway (fuera
  de alcance de este spec).
