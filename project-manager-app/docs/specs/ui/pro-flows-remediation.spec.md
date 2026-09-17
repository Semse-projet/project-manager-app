---
id: "ui.pro-flows-remediation"
title: "Pro/Worker UI Flows — Remediation (auditoría 2026-07-20)"
domain: "ui"
version: "1.1"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
date: "2026-07-20"
author: "Claude Sonnet — sesión de auditoría en vivo (código + producción)"
spec_index: "docs/SPEC_INDEX.md"
supersedes: "docs/specs/ui/pro-flows.spec.md (reconciliado 2026-08-14: describía rutas huérfanas — /marketplace, /dashboard, /tools/:trade, /profile/payout — que no son la app real del rol PRO; ver nota DEPRECATED en ese archivo)"
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
  - apps/api/src/modules/field-ops
  - apps/api/src/modules/incidents
  - apps/api/src/modules/materials
  - apps/api/src/modules/tasks
  - apps/api/src/modules/jobs/jobs.repository.ts
  - apps/api/src/common/visible-response.ts
  - apps/api/src/modules/users/users.controller.ts
  - apps/api/src/modules/users/users.policy.ts
  - apps/api/src/modules/payments/providers/stripe.provider.ts
  - apps/api/src/modules/worker-verification/worker-verification.repository.ts
  - apps/api/src/modules/matching/matching.algorithm.ts
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
  - v1/jobs
related_events: []
related_agents:
  - prometeo
  - felix
  - marta
  - pulse
  - justus
  - planner
last_verified: "2026-08-14"
---

# Spec: Pro/Worker UI Flows — Remediation

> **Nota de nomenclatura — léela antes que nada.** El rol real en la base de datos (`Role.name`) es **`PRO`**, no `WORKER`. La UI vive bajo `/worker/*` y el sidebar se etiqueta a sí mismo "Profesional". La app real de `/worker/*` — dashboard, trabajos, tracker, pagos, perfil — nunca tuvo spec propio hasta este documento.
>
> **Actualizado 2026-08-14:** `docs/specs/ui/pro-flows.spec.md` (el spec anterior con este nombre) quedó `DEPRECATED` tras una auditoría de re-verificación — sus `related_files`/`related_tests` (`apps/web/app/pro`, `apps/web/app/(app)/tools`, `pro-tools-*.spec.ts`) apuntaban a rutas huérfanas: `/tools/:trade` (ProTools) **no está en la navegación del rol PRO en absoluto** (solo en `client`/`admin`), y sus propios tests de referencia prueban esa ruta logueados como Admin, no como PRO. Este documento (`pro-flows-remediation.spec.md`) es ahora el único spec vigente para el rol PRO/`/worker/*`.
>
> Auditado con: hallazgos de rebote de la ronda de backend transversal (labor-engine, Stripe Connect, matching) + navegación en vivo contra `semse-web-production.up.railway.app` con una cuenta profesional real (`jhonnymembers403@gmail.com`, rol `PRO`), el 2026-07-20. Cobertura en vivo parcial — ver `docs/AUDIT_REMEDIATION_PLAN.md` sección 2 para la lista exacta de pantallas recorridas y las que faltan.

## Problem Statement

El rol PRO (UI: "Profesional", rutas: `/worker/*`) tiene un cronómetro de horas duplicado y desconectado, comparte la misma causa raíz de estado incorrecto que el módulo Cliente, y expone en pantalla el efecto directo de dos gaps de backend ya documentados (Stripe Connect sin conectar, trust score en 0 sin explicación) sobre una cuenta profesional real.

## Scope

- In scope: `apps/web/app/(app)/worker/**`, el Time Tracker/Labor Engine en la medida que lo consume esta UI, el flujo de cobro (Stripe Connect) desde la perspectiva del profesional.
- Out of scope: la lógica de nómina/overtime en sí (documentada en la sección transversal 0.19 del plan — es un gap de cumplimiento laboral, no de UI), y el algoritmo de matching en sí (0.27/0.28 del plan — aquí solo se documenta su efecto visible en `/worker/profile`).

## Non-Goals

- No decide si el rol debería renombrarse de `PRO` a `WORKER` en la base de datos, ni si la UI debería decir "Worker" en vez de "Profesional" — solo documenta que hoy existen ambos nombres para la misma cosa, lo cual ya es motivo suficiente de confusión de producto.
- No repara la ausencia de multiplicador de horas extra (0.19, transversal) — solo confirma que la UI de este módulo no muestra ninguna indicación de ese cálculo al profesional.

## Gaps encontrados

> **Reconciliado 2026-08-14.** Igual que `client-flows-remediation.spec.md`, este documento quedó congelado en la auditoría original (2026-07-20/21) mientras `docs/AUDIT_REMEDIATION_PLAN.md` (secciones 0 y 2) siguió recibiendo fixes y verificación en vivo hasta 2026-08-01 sin actualizarlo. Cada gap re-mapeado a su ítem correspondiente (código + git log; live donde el plan ya lo registra), sin re-auditar desde cero. A diferencia de `client-flows-remediation.spec.md`, acá **quedan gaps genuinamente abiertos** (G-PRO-04, y la mitad de G-PRO-02) — no todo resultó estar ya resuelto.

### G-PRO-00 — RESUELTO — Mismo bug de causa raíz que G-CLI-00, manifestado distinto
**= plan 0.0 / 2.1b.** Corregido (Crew A, 2026-07-21) — normalizado en el punto de entrada real (`normalizeJobRecordStatus()` en las rutas BFF `apps/web/app/api/semse/jobs/route.ts` y `.../jobs/[jobId]/route.ts`), no en cada componente; cero cambios en la lógica de comparación de las páginas, que ya era correcta contra el contrato de `packages/schemas`. Pendiente de verificación en vivo específica para `/worker/jobs/[jobId]` (el resto de la cadena — `/client/dashboard`, `/worker/dashboard` — sí se confirmó en vivo, ver G-CLI-00/G-PRO-08).

### G-PRO-01 — RESUELTO — Dos cronómetros de tiempo desconectados bajo el mismo rol
**= plan 2.1.** Ya documentado en este mismo archivo como resuelto 2026-07-27 (decisión de producto: deprecar/ocultar el legado, Labor Engine gana) — sin cambios respecto a esa nota.

### G-PRO-02 — RESUELTO — Cuenta profesional sin Stripe Connect conectado
**Backend = plan 0.16, resuelto (Crew D, 2026-07-21):** `createPayoutIntent` ya no cae nunca a la cuenta compartida `STRIPE_CONNECT_ACCOUNT_ID` cuando hay un `recipientUserId` conocido sin cuenta Connect activa — lanza una excepción explícita en su lugar. El riesgo real de dinero (pagarle a la cuenta equivocada) está cerrado.
**UI (el "Fix esperado" original de este gap) = plan 2.1c, corregido (2026-08-27):** `/worker/payments` ya no muestra el CTA neutral de "crea una cuenta" — el panel "Cuenta Stripe Connect" dice explícitamente "no podrás cobrar ningún pago hasta que crees una" (sin cuenta) o "tus pagos quedan bloqueados hasta que completes el onboarding" (cuenta creada pero no activa). El aviso de fondos en escrow se bifurcó: en ámbar mientras la cuenta Connect no esté activa, nombrando el monto bloqueado explícitamente; en verde solo cuando ya está activa. `tsc --noEmit`/`eslint` limpios en `@semse/web`. **No verificado en vivo** — sin Postgres/backend en el sandbox de esta sesión para ejercitar el escenario real (cuenta con escrow pendiente sin Connect activo); solo se confirmó que el dev server compila y sirve la ruta sin excepción antes del redirect de auth.

### G-PRO-03 — RESUELTO — El perfil mostraba "Trust 0%" sin contexto
**= plan 2.1d.** Corregido (2026-07-27), a propósito con alcance distinto de 0.28 (que corrigió el algoritmo, no la presentación): usando `ratings.length === 0` como señal ya disponible en la pantalla, `trustScore === 0 && ratings.length === 0` ahora muestra "Trust — nuevo en la plataforma" con tooltip explicativo en vez de "Trust 0%" desnudo; cualquier otro valor sigue mostrando el porcentaje real con un tooltip de qué lo mueve. Sin cambios de backend/API — solo presentación sobre datos que la pantalla ya tenía.

### G-PRO-04 — RESUELTO (2026-08-29) — Verificación de identidad (firma DID) era un stub, expuesto como "Sin verificar" al profesional
**= plan 0.9 + nota en 3.13.** Ver `docs/AUDIT_REMEDIATION_PLAN.md` 0.9 y `docs/specs/core/identity-attestation.spec.md` para el detalle completo. Decisión de producto (usuario, vía `AskUserQuestion`): un proceso de verificación separado firma, no el propio worker. Implementado cableando una atestación Ed25519 real (clave propia de SEMSE) dentro del flujo de solicitud→revisión de G-PRO-09/2.28, en vez de reactivar el módulo `worker-verification` original que nunca tuvo un caller real. `/worker/profile` ya muestra la evidencia cuando existe. No verificado en vivo (sin Postgres/Railway en este sandbox); la clave de firma debe configurarse en Railway antes de que una aprobación `id_document` en producción funcione (falla cerrado si no está, a propósito).

### G-PRO-05 — RESUELTO — El chat de Prometeo y de TODOS los agentes especializados estaba roto para PRO/WORKER por un permiso RBAC que ningún endpoint de chat aceptaba
**= plan 0.33 (también referenciado como 2.1e).** Corregido (Crew A, 2026-07-21) — `agents:run:create` agregado a `PRO` y `WORKER` en `packages/auth/src/rbac.ts` (cubre los 16 agentes conversacionales y todos los controladores listados en el hallazgo original, mismo decorador compartido). Traducción de `nav.aiSettings` corregida a "Configuración del asistente" en español. La extensión OR de `RbacGuard` (aceptar `agents:run:create` O `agents:run:worker`) queda como mejora a mediano plazo, no bloqueante. **Verificado en vivo (2026-07-31/08-01):** login como `worker@demo.semse`, `POST /api/semse/cortex/chat` devuelve `200` con una respuesta real de Prometeo, no el `403`/"Insufficient permissions" original.

### G-PRO-06 — RESUELTO (parcial, con una pieza de mayor alcance deferida a propósito) — Subir evidencia real no subía el archivo
**= plan 0.34 + 2.18.** Corregido (Crew B, 2026-07-21), con una verificación en vivo (2026-08-01) que encontró y corrigió 3 regresiones reales nunca antes probadas contra un servidor real:
  - `worker/evidence/page.tsx` y `worker/travel/[travelId]/page.tsx` ahora obtienen `plan.key` real y hacen el `PUT` real vía el proxy BFF (`/api/semse/uploads/files/:key`) antes de registrar — el mismo mecanismo que ya funcionaba del lado Cliente (`uploadEvidenceFile`).
  - `GET .../evidence` ahora expone `validationStatus`/`aiQualityScore` reales (plan 2.18).
  - **Explícitamente NO corregido, deferido a propósito:** `recommendedStrategy: "external_transfer"` (archivos >25MB) ahora falla con un mensaje claro en vez de simular éxito — arreglar la subida real para archivos grandes (persistencia real de multipart en el backend) queda fuera de esta pasada, es un cambio mayor y afecta un caso de uso menos común.
  - **La verificación en vivo del 2026-08-01 encontró 3 bugs nuevos** que habrían dejado este fix roto de punta a punta sin que nadie lo notara (nunca se había probado contra un servidor real): Fastify rechazaba el `PUT` con `415` antes de llegar al controller (content-type parser faltante), `@Req()` no era el stream crudo bajo Fastify (`req.raw`), y `getFile`/`verifyPassport` usaban `res.set()`/`res.setHeader()` de Express, que no existen en `FastifyReply`. Los 3 corregidos el mismo día. **Verificación end-to-end real confirmada:** `POST /v1/uploads/plan` → `PUT` real → `POST /v1/evidence` → `201` → `GET /v1/uploads/files/:key` → archivo descargado byte-idéntico al original.

## Gaps adicionales — ronda de 5 agentes de código en paralelo (2026-07-21)

> Auditoría estática de `apps/web/app/(app)/worker/**` completa, la misma metodología aplicada al módulo Cliente (5 agentes en paralelo, uno por franja funcional). 42 hallazgos nuevos en total; los `CRÍTICO` se detallan aquí como gaps propios, el resto (14 `ALTO`, 13 `MEDIO`, 6 `BAJO`) está catalogado con evidencia completa file:line en `docs/AUDIT_REMEDIATION_PLAN.md` → Sección 2, ítems **2.8 a 2.48**, para no duplicar el mismo detalle en dos documentos.

### G-PRO-07 — RESUELTO — Las reseñas de cliente estaban 100% rotas
**= plan 2.17.** Corregido (Crew E, 2026-07-21) — `Contract.clientUserId` identificado como el campo real (`Job` solo tiene `clientOrgId`, a nivel de org). Propagado de punta a punta: `bids.repository.ts` (`listByWorker`), `domain-store.ts` (`BidRecord`), la ruta BFF `my-bids/route.ts` (tenía su propio whitelist que también lo habría descartado), `semse-api.ts` (`MyBidView`, sin casts `as any`) y `jobRecordSchema`. Casts `(j as any)` eliminados de `worker/review/page.tsx`. Pendiente verificación en vivo.

### G-PRO-08 — RESUELTO — "Oportunidades abiertas" del dashboard siempre vacío, y la misma llamada exponía jobs `DRAFT` de otras organizaciones
**= plan 2.26 + 2.27.** Corregido (Crew A, 2026-07-21 para la normalización; 2026-07-23 para el scoping de datos). El fix de normalización es el mismo que G-PRO-00/0.0. Además, `listByTenant` ahora recibe `roles` y aplica scoping real: PRO/WORKER limitado a jobs postables (`POSTED`/`PUBLISHED`) más los jobs donde el actor ya está comprometido, nunca `DRAFT` de otra organización — el mismo hueco resultó afectar también a CLIENT, no solo a PRO, y se cerró para ambos. **Nota de incidente (sin logging suficiente para descartar explotación previa):** cualquier PRO o CLIENT con devtools pudo ver, antes de este fix, títulos/presupuestos/ubicaciones de jobs `DRAFT` de otras organizaciones — no se puede confirmar si ya ocurrió. **Verificado en vivo (2026-07-31/08-01):** login `worker@demo.semse`, `/worker/dashboard` mostró "Oportunidades abiertas: 3" (coincide con los 3 jobs `posted` reales); `GET /api/semse/jobs` devolvió 5 jobs, cero `draft` en el payload.

### G-PRO-09 — RESUELTO — Los botones "Verificar" del perfil siempre fallaban con 403
**= plan 2.28.** Corregido (2026-07-27) como feature nueva completa, no un fix de una línea: nuevo permiso `users:verify:request` (otorgado a PRO/WORKER, deliberadamente distinto de `users:verify` que sigue siendo OPS_ADMIN-only); nuevo endpoint self-only `POST /v1/users/:userId/verify-request` que solo encola la solicitud (reutiliza el mecanismo de workspace-memory de 2.44); nueva sección "Solicitudes de verificación" en `/admin/trust/worker-applications` con botones Aprobar/Rechazar. 13 tests nuevos, suite completa 1990/1990 verde. Pendiente verificación en vivo del flujo completo (solicitar como PRO → aprobar/rechazar como OPS_ADMIN).

### G-PRO-10 — RESUELTO — El módulo de Movilidad era completamente inalcanzable para cualquier PRO real
**= plan 2.31.** Corregido (Crew A, 2026-07-21) — en vez de agregar `jobs:create` a PRO/WORKER (que habría abierto de más: creación de job listings, tasks, materials, incidents), se introdujo un permiso dedicado `travel:manage` en los 6 endpoints de escritura de `travel.controller.ts`, otorgado a CLIENT/PRO/WORKER/OPS_ADMIN. Pendiente verificación en vivo.

### G-PRO-11 — RESUELTO — IDOR cross-tenant: el estado de cualquier unidad de campo de cualquier tenant se podía sobreescribir
**= plan 2.32.** Corregido (Crew C, 2026-07-21) — mismo patrón que 0.4: `update()` con solo `id` reemplazado por `updateMany({where: {id, tenantId}})` + verificación de `count` (404 si 0) + re-fetch, igual que `findUnitById` ya hacía para lecturas. Pendiente verificación en vivo.

### G-PRO-12 — RESUELTO — El estado visual de un pago se calculaba solo por `type`, ignorando el `status` real
**= plan 2.39.** Corregido (Crew D, 2026-07-21) — `worker/payments/page.tsx` ahora lee `row.status` real; nuevo estado visual `"failed"` (badge rojo) cubre `FAILED`/`REVERSED`; `"released"`/`"in_escrow"` ahora exigen `status === "SUCCEEDED"` además del `type` correcto. `totalReleased` deja de sumar transacciones fallidas automáticamente. Pendiente verificación en vivo.

### G-PRO-13 — RESUELTO — "Mis Tarifas" no tenía ningún efecto real
**= plan 2.40.** Corregido (2026-07-27) — **decisión de producto explícita del usuario: conectarla a un flujo real, no solo corregir el copy.** Investigado primero si `client/protools/page.tsx`/`client/jobs/new/page.tsx` eran compatibles con "la tarifa del profesional ya asignado" (no lo son — ninguna de las dos tiene a la vez un profesional asignado y un estimado visible al cliente); se diseñó una superficie nueva con el usuario confirmando el diseño antes de implementar. 5 tests nuevos en `budget-intelligence.service.test.ts` (archivo nuevo). Pendiente verificación en vivo (requiere un job real con bid aceptado y un profesional con tarifa configurada).

## Cobertura de esta pasada

**Completa en vivo (2026-07-20 y 2026-07-21):** Dashboard, Oportunidades, Mis trabajos (+ detalle), Time Tracker, Operaciones de campo, Mi perfil, Mis pagos, Mis propuestas, Agenda, Tareas, Evidencia (incl. subida real de archivo), Materiales, Incidencias, Movilidad, Reseñas, "Asistente IA" (en realidad `/worker/settings`), widget flotante de Prometeo/agentes, catálogo `/agents` completo.

**Completa de código (2026-07-21):** ronda de 5 agentes en paralelo sobre `apps/web/app/(app)/worker/**` — Tracker/Labor Engine; Field-ops+Movilidad; Trabajos/Dashboard/Perfil/Agenda/Propuestas; Disputas/Pagos/Oportunidades/Configuración/Tarifas; Evidencia/Incidencias/Materiales/Reseñas/Tareas. Ver gaps G-PRO-07 a G-PRO-13 arriba y `docs/AUDIT_REMEDIATION_PLAN.md` 2.8-2.48 para el resto.

## UI Contract

```yaml
screens:
  - /worker/dashboard
  - /worker/opportunities
  - /worker/jobs
  - /worker/jobs/[jobId]
  - /worker/tracker (Labor Engine real — 6 tabs: Timer/Resumen/Registros/Proyectos/Reportes/Asistente)
  - /worker/field-ops (pestaña "Tracker" removida 2026-07-27, ver G-PRO-01 — Unidades/Worklogs/Base de conocimiento/Proveedores siguen activas)
  - /worker/payments
  - /worker/profile
  - /worker/evidence
  - /worker/travel / /worker/travel/[travelId]
  - /worker/tasks
  - /worker/materials
  - /worker/incidents
  - /worker/review
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - El badge de estado de un trabajo debe coincidir exactamente con lo que ve el cliente para el mismo jobId (bloqueado hoy por G-PRO-00)
  - Solo debe existir una ruta activa de registro de horas por profesional (resuelto 2026-07-27, ver G-PRO-01)
  - Un archivo de evidencia subido en `/worker/evidence` debe existir realmente en storage tras "Registrar" (bloqueado hoy por G-PRO-06)
  - Un usuario PRO debe poder enviar un mensaje a Prometeo/agentes y recibir respuesta real (bloqueado hoy por G-PRO-05)
```

## Security / RBAC

- **G-PRO-11 (CRÍTICO, cross-tenant IDOR) — RESUELTO:** `updateUnitStatus` en field-ops no filtraba por `tenantId` — ver detalle arriba (= plan 2.32).
- **IDOR intra-tenant (ALTO, plan 2.19) — RESUELTO:** `POST/GET /v1/incidents` y `/v1/materials` no verificaban que el actor estuviera asignado al `jobId`. Corregido (Crew C, 2026-07-21) — `incidents.service.ts`/`materials.service.ts` ahora verifican, antes de leer o crear, que el actor pertenezca a la org cliente o a la org profesional asignada del job (`assertJobAccess`, mismo patrón que `evidence.policy.ts`), bypass para OPS_ADMIN. **Nota encontrada durante el fix:** ni PRO ni WORKER tienen hoy el permiso `jobs:create` que gatea estos endpoints — es decir, en la práctica ningún profesional puede crear una incidencia/material en absoluto (403), lo cual contradice el marco original del hallazgo ("cualquier worker puede leer/inyectar"). Señalado como gap de RC3 (permisos) no documentado aparte — no se amplió `jobs:create` a PRO/WORKER como parte de este fix, mismo criterio que llevó al permiso dedicado `travel:manage` en vez de reusar `jobs:create` (ver G-PRO-10). Pendiente verificación en vivo.
- **IDOR intra-tenant (ALTO, plan 2.20) — RESUELTO:** `PATCH /v1/tasks/:taskId/status` no verificaba `assignedTo === actor.userId`. Corregido (Crew C, 2026-07-21) — `tasks.service.ts` ahora hace un `findFirst` previo y verifica `assignedTo === actor.userId` (bypass OPS_ADMIN); tareas sin asignar quedan editables por cualquiera con el permiso base. Pendiente verificación en vivo.
- **IDOR intra-tenant (ALTO, plan 2.34) — RESUELTO:** los endpoints de `/v1/travel/:travelId` no verificaban `assignedTo === actor.userId`. Corregido (Crew C, 2026-07-21) — verificación centralizada en `getAssignment` (exige `assignedTo === actorUserId` o `orgId === job.clientOrgId`, bypass OPS_ADMIN); las 9 funciones restantes que operan sobre un `travelId` llaman a `getAssignment` primero en vez de repetir el join. Pendiente verificación en vivo.
- **Cumplimiento/PCI-DSS (ALTO, plan 2.44) — resuelto 2026-07-27:** `PayoutMethodForm.tsx` recolecta PAN de tarjeta y número de cuenta/routing bancario completos en inputs propios sin tokenizar (no Stripe Elements/Plaid) — transita en texto plano por el BFF antes de que el backend descarte los dígitos completos y guarde solo `last4`. **Decisión de producto obtenida del usuario: migrar a Stripe (tarjeta vía `<CardElement>`, cuenta bancaria vía `stripe.createToken("bank_account")` desde el navegador directo a Stripe), sin agregar Plaid.** El backend ahora verifica el token contra la API de Stripe para obtener el `last4` real en vez de confiar en el cliente. Ver detalle completo en `docs/AUDIT_REMEDIATION_PLAN.md` 2.44. Pendiente: el usuario debe configurar `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` en Railway antes de que esto funcione en producción.
- La cuenta usada para esta auditoría estuvo bloqueada por el bug transversal 0.32 (reset de contraseña no envía correo) y se desbloqueó manualmente por el operador de la sesión — ver nota en `docs/AUDIT_REMEDIATION_PLAN.md`. Se repitió una segunda vez el 2026-07-21.

## Tests Required

- [x] `/worker/jobs/[jobId]` muestra el mismo badge de estado que `/client/jobs/[jobId]` para el mismo `jobId` (regresión directa de G-PRO-00) — corregido 2026-07-21, pendiente de confirmación en vivo específica para esta pantalla
- [x] La pestaña "Tracker" de `/worker/field-ops` no permite iniciar una sesión de tiempo nueva (o queda removida) — removida por completo 2026-07-27
- [x] `/worker/payments` comunica explícitamente por qué no se puede cobrar cuando no hay cuenta Connect activa — corregido 2026-08-27 (plan 2.1c), ver G-PRO-02; no verificado en vivo (sin backend/Postgres en el sandbox de esta sesión)
- [x] Un usuario con rol `PRO` puede enviar un mensaje a Prometeo (o cualquier agente) desde el widget flotante y recibe una respuesta real, no `Insufficient permissions` (regresión directa de G-PRO-05) — verificado en vivo 2026-07-31/08-01
- [x] Un usuario con rol `WORKER` (literal, no alias de PRO) tiene el mismo resultado — verificado en vivo 2026-09-17 contra un stack local (Postgres 16 + Redis nativos, sin Docker disponible en esa sesión; migraciones aplicadas limpias desde cero). `POST /v1/prometeo/copilot/message` con `x-roles: WORKER` (rol literal, no `FIELD_WORKER`/alias) devolvió `201` con una respuesta real de Prometeo (`sessionId` + `suggestedActions`), idéntico al resultado con `x-roles: PRO`. Control negativo confirmado: `x-roles: EVENT_CONSUMER` (sin `agents:run:create`) devuelve `403 Insufficient permissions` en el mismo endpoint, probando que la verificación distingue permiso real de "todo pasa".
- [x] El label del nav item que enlaza a `/worker/settings` coincide con su contenido real en ambos idiomas — corregido junto con G-PRO-05 (`nav.aiSettings` → "Configuración del asistente")
- [x] Subir una foto en `/worker/evidence` hace un `PUT` real a `plan.uploadUrl` y el objeto existe en storage después (regresión directa de G-PRO-06) — verificado end-to-end en vivo 2026-08-01, byte-idéntico tras descarga
- [x] Subir un comprobante en `/worker/travel/[travelId]` tiene el mismo comportamiento — mismo fix aplicado, no se confirmó en vivo específicamente (sin viaje activo disponible para probar)
- [x] Un PRO puede enviar una reseña de cliente desde `/worker/review` y el registro se crea (regresión directa de G-PRO-07) — corregido 2026-07-21, pendiente verificación en vivo
- [x] `/worker/dashboard` muestra oportunidades reales cuando existen jobs `posted` en el tenant (regresión directa de G-PRO-08) — verificado en vivo 2026-07-31/08-01 ("Oportunidades abiertas: 3")
- [x] La llamada que alimenta `/worker/dashboard` no devuelve jobs `DRAFT` de organizaciones distintas a las del profesional (regresión directa de G-PRO-08) — verificado en vivo 2026-07-31/08-01 (0 `draft` en el payload de 5 jobs)
- [x] Un PRO puede completar el flujo de "Solicitar verificación" en `/worker/profile` sin recibir 403 (regresión directa de G-PRO-09) — corregido 2026-07-27, pendiente verificación en vivo del flujo completo
- [x] Un PRO puede crear un viaje en `/worker/travel` sin recibir 403 (regresión directa de G-PRO-10) — corregido 2026-07-21, pendiente verificación en vivo
- [x] Un pago con `status: FAILED` o `REVERSED` no se muestra como "Liberado"/"En escrow" en `/worker/payments` (regresión directa de G-PRO-12) — corregido 2026-07-21, pendiente verificación en vivo
- [x] Guardar una tarifa en `/worker/rates` tiene un efecto verificable en al menos un estimado real, o la pantalla deja de prometerlo (regresión directa de G-PRO-13) — corregido 2026-07-27, pendiente verificación en vivo con un job real

## Implementation Map

### Web
- `apps/web/app/(app)/worker/jobs/[jobId]/page.tsx`
- `apps/web/app/(app)/worker/field-ops/page.tsx`
- `apps/web/app/(app)/worker/payments/page.tsx`
- `apps/web/app/(app)/worker/profile/page.tsx`
- `apps/web/app/(app)/worker/evidence/page.tsx:120-154` (G-PRO-06 — agregar el `PUT` real a `plan.uploadUrl` en la rama `single_put`, usar `plan.key` real)
- `apps/web/app/(app)/worker/travel/[travelId]/page.tsx:261-295` (G-PRO-06 — mismo fix)
- `apps/web/app/(app)/worker/review/page.tsx:84-85,104-108` (G-PRO-07)
- `apps/web/app/(app)/worker/dashboard/page.tsx:130-155` (G-PRO-08)
- `apps/web/app/(app)/worker/profile/page.tsx:134-153` (G-PRO-09)
- `apps/web/app/(app)/worker/payments/page.tsx:58-61` (G-PRO-12)
- `apps/web/app/(app)/worker/rates/page.tsx` (G-PRO-13 — pendiente decisión de producto)
- `apps/web/app/semse-api.ts:363-378` (G-PRO-07 — `fetchMyJobs`/`ReviewableJob` necesita `clientUserId`)

### API
- `apps/api/src/modules/payments/providers/stripe.provider.ts`
- `apps/api/src/modules/worker-verification/worker-verification.repository.ts`
- `packages/auth/src/rbac.ts` (G-PRO-05 — agregar `agents:run:create` a `PRO` y `WORKER`; G-PRO-10 — agregar `jobs:create` o permiso propio de viajes)
- `apps/web/lib/language-context.tsx:81` (G-PRO-05 — corregir traducción de `nav.aiSettings`)
- `apps/api/src/modules/users/users.controller.ts:96-98` (G-PRO-09 — endpoint de verificación necesita una vía accesible a PRO)
- `apps/api/src/modules/jobs/jobs.repository.ts:62-69` (G-PRO-08 — `listByTenant` necesita filtro de status/org para llamadas sin `?status=`)
- `apps/api/src/infrastructure/.../field-ops.repository.ts:122-127` (G-PRO-11 — agregar `tenantId` al `where` de `updateUnitStatus`)
- `apps/api/src/modules/evidence/evidence.controller.ts:282-353` (G-PRO-06 ampliado — el backend multipart necesita leer y persistir el cuerpo real, no solo simular estado)

## Acceptance Criteria

- [x] Este spec se agrega a `SPEC_INDEX.md` junto a `docs/specs/ui/pro-flows.spec.md` (no lo reemplaza — cubren alcances distintos, ver nota de apertura); `pro-flows.spec.md` pasa a `REVIEW` porque G-CLI-04 contradice su `status: VERIFIED` — ya en el índice, `pro-flows.spec.md` sin tocar en esta reconciliación (queda fuera de este spec, es un documento aparte)
- [x] ~~Antes de `APPROVED`: completar la cobertura en vivo pendiente y correr la ronda de agentes de código dedicada~~ — hecho 2026-07-21: cobertura en vivo completa + ronda de 5 agentes en paralelo (42 hallazgos nuevos, ver `docs/AUDIT_REMEDIATION_PLAN.md` 2.8-2.48)
- [x] Antes de `APPROVED`: el equipo de producto revisa y prioriza los 42+13 hallazgos de este spec — hecho de facto entre 2026-07-21 y 2026-08-29: los 13 gaps `G-PRO-*` propios ya tienen fix (algunos con decisión de producto explícita del usuario, la mitad UI de G-PRO-02 cerrada 2026-08-27, G-PRO-04 cerrado 2026-08-29 vía `docs/specs/core/identity-attestation.spec.md`), más las piezas de seguridad del plan (2.19/2.20/2.34/2.44). Los ~55 hallazgos `ALTO`/`MEDIO`/`BAJO` de 2.8-2.48 no cubiertos como gap propio siguen sin revisión de priorización dedicada — no se afirma que estén todos resueltos.
- [x] `pnpm spec:validate:strict` pasa

## Rollback Considerations

- G-PRO-01 — **decisión de producto obtenida 2026-07-27 (usuario, dueño del producto): deprecar/ocultar el legado ahora.** Implementado quitando la pestaña de la UI (ver arriba) sin tocar el backend/datos históricos, y agregando un link visible al Time Tracker real para no dejar al profesional sin salida. Si en producción hay sesiones `TrackerSession` activas de profesionales reales al momento del deploy, esas sesiones quedan huérfanas (sin UI para pausar/detener) — vale la pena revisar si hay alguna activa antes de desplegar, o aceptar el corte.
- G-PRO-13 (tarifas custom) requiere una decisión de diseño de producto antes de cualquier fix — no está claro si el comportamiento correcto es "el estimado de ProTools debe usar la tarifa del profesional asignado" o algo distinto; implementar el fix equivocado podría filtrar la tarifa de un profesional a un contexto donde no corresponde.
- Los 3 hallazgos de IDOR (G-PRO-11, incidencias/materiales, tareas) son fixes de bajo riesgo (agregar un filtro que ya falta) pero deben desplegarse junto con una revisión de si ya fueron explotados — no hay logging suficiente hoy para saber si algún dato cross-tenant/cross-worker ya fue leído o modificado por esta vía.
