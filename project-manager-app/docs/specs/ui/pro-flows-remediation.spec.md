---
id: "ui.pro-flows-remediation"
title: "Pro/Worker UI Flows — Remediation (auditoría 2026-07-20)"
domain: "ui"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
date: "2026-07-20"
author: "Claude Sonnet — sesión de auditoría en vivo (código + producción)"
spec_index: "docs/SPEC_INDEX.md"
complements: "docs/specs/ui/pro-flows.spec.md (ese spec cubre ProTools específicamente, no la app de /worker/* en general)"
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
last_verified: "2026-07-21"
---

# Spec: Pro/Worker UI Flows — Remediation

> **Nota de nomenclatura — léela antes que nada.** El rol real en la base de datos (`Role.name`) es **`PRO`**, no `WORKER`. La UI vive bajo `/worker/*` y el sidebar se etiqueta a sí mismo "Profesional". El spec anterior (`docs/specs/ui/pro-flows.spec.md`, `status: VERIFIED`) **no es incorrecto, es más angosto de lo que su nombre sugiere**: sus `related_files`/`related_tests` (`apps/web/app/pro`, `apps/web/app/(app)/tools`, `pro-tools-*.spec.ts`) muestran que en realidad especifica el catálogo **ProTools** (calculadoras de oficio), no la aplicación autenticada completa del rol PRO. La app real de `/worker/*` — dashboard, trabajos, tracker, pagos, perfil — nunca tuvo spec propio. Este documento cubre esa brecha; no reemplaza al spec de ProTools, que además tiene su propio gap confirmado (ver G-CLI-04 en `client-flows-remediation.spec.md`: `POST /api/semse/agents/protools/estimate` da 404 — contradice su `status: VERIFIED`).
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

### G-PRO-00 — CRÍTICO — Mismo bug de causa raíz que G-CLI-00, manifestado distinto
**Archivo:** `apps/web/app/(app)/worker/jobs/[jobId]/page.tsx:150-151`.
**Contrato roto:** la variable se llama `normalizedStatus` pero nunca aplica `.toLowerCase()` — toma `job?.status` crudo (p. ej. `"ACCEPTED"`) y lo busca en un mapa `JOB_STATUS_META` con claves en minúsculas. La búsqueda falla y cae al fallback `JOB_STATUS_META.posted`.
**Confirmado en vivo:** el trabajo `cmqvqsol40023k101j9fh81mq`, que el cliente ve `Aceptado` con escrow listo, el profesional asignado a ese mismo trabajo lo ve `Publicado` en esta pantalla — y por lo tanto recibe el "próximo paso" equivocado (`WORKER_NEXT_ACTION[normalizedStatus]` también falla contra el mismo mapa).
**Fix esperado:** mismo que G-CLI-00 — comparar/mapear contra los valores reales de `JobStatus` (mayúsculas), idealmente normalizando en un solo punto compartido (BFF o mapper), no en cada componente. **Matiz confirmado en vivo:** el mismo patrón de código existe en `worker/agenda/page.tsx:149,154,160`, pero ahí la pantalla mostró el estado correcto ("Aceptado") para el mismo job — indica que esa ruta ya recibe el status normalizado desde su fuente de datos, a diferencia de esta pantalla. `worker/dashboard/page.tsx` sigue sin confirmar en pantalla.

### G-PRO-01 — CRÍTICO — Dos cronómetros de tiempo desconectados bajo el mismo rol
**Confirmado en vivo:** `/worker/field-ops` ("Operaciones de campo") tiene su propia pestaña "Tracker" — cronómetro independiente y completamente funcional (`Total hoy: 00:00`, botón "▶ Iniciar nueva sesión" real), separado del Time Tracker real (`/worker/tracker`, Labor Engine, 6 tabs correctas). No se activó para no generar horas fantasma reales en producción.
**Archivo legacy:** `apps/web/app/(app)/worker/field-ops/page.tsx:895-1120` (`TrackerTab`), respaldado por `FieldOpsService`/`TrackerSession` — el propio `CLAUDE.md` del repo dice que ese motor "remains only as legacy API", pero la UI sigue dejando registrar horas completas ahí.
**Impacto:** horas registradas en el cronómetro legacy nunca se concilian contra nómina/escrow real.
**Fix esperado:** cerrar o bloquear la pestaña "Tracker" de `/worker/field-ops` como ruta de registro de horas activa; si se necesita conservar por datos históricos, dejarla solo de lectura.

### G-PRO-02 — ALTO — Esta cuenta profesional real no tiene Stripe Connect conectado
**Confirmado en vivo:** `/worker/payments` → "Método de cobro" → *"Cuenta Stripe Connect: Sin cuenta conectada — crea una para recibir pagos automáticos."*
**Conecta con backend (transversal 0.16):** si el escrow de este trabajo se liberara hoy, `createPayoutIntent` (`apps/api/.../stripe.provider.ts:73-83`) caería en la cuenta `STRIPE_CONNECT_ACCOUNT_ID` legacy compartida en vez de pagarle a este profesional — no es un riesgo teórico, es el estado real de una cuenta real hoy.
**Fix esperado (UI):** si el backend bloquea el payout sin Connect activo (fix de 0.16), esta pantalla debería comunicar claramente por qué el profesional no puede cobrar todavía, no solo mostrar un CTA neutral de "crea una cuenta".

### G-PRO-03 — MEDIO — El perfil muestra "Trust 0%" sin ningún contexto
**Confirmado en vivo:** `/worker/profile` → badges "Profesional", **"Trust 0%"**, "Disponible". "Verificación: Sin verificar".
**Conecta con backend:** `trustScore` por defecto es `0` real (no un prior neutral, `schema.prisma:230`), y es exactamente el sesgo de cold-start que 0.28 documenta en el algoritmo de matching — aquí se ve el efecto directo sobre una persona real, sin explicación de qué significa el número ni cómo subirlo.
**Fix esperado (UI, independiente del fix de algoritmo):** como mínimo, no mostrar "0%" desnudo — agregar contexto ("Nuevo en la plataforma — tu trust score sube con trabajos completados") mientras se decide el fix de fondo del algoritmo.

### G-PRO-04 — CRÍTICO — Verificación de identidad (firma DID) es un stub, expuesto como "Sin verificar" al profesional
**Backend:** `apps/api/.../worker-verification.repository.ts:115-135` — el código comenta *"for now, return synthetic verification"*, solo valida que las strings no estén vacías, cero criptografía real.
**Relación con la UI:** `/worker/profile` muestra "Verificación: Sin verificar" — si un profesional intentara completar esa verificación hoy, el backend la aprobaría sin validar nada real, contradiciendo la promesa de marca "Profesionales verificados" (landing pública).

### G-PRO-05 — CRÍTICO — El chat de Prometeo y de TODOS los agentes especializados está roto para el rol PRO (y para WORKER) por un permiso RBAC que ningún endpoint de chat acepta
**Confirmado en vivo, reproducible:** en `/worker/dashboard`, al abrir el widget flotante de Prometeo y enviar cualquier mensaje — probado con Prometeo directamente y con Felix — la respuesta es siempre `⚠ Insufficient permissions` (string cruda en inglés, sin traducir, mostrada tal cual al usuario). El mensaje del propio usuario ni siquiera se agrega como burbuja enviada; el textarea no se limpia. Reproducido dos veces con Felix, una vez con Prometeo — 100% reproducible, no es un fallo transitorio.
**Causa raíz exacta:** `POST /api/semse/cortex/chat` (BFF) reenvía a `POST /v1/ai-models/prometeo/chat` en el backend (`apps/api/src/modules/ai-models/ai-models.controller.ts:213-214`), decorado con `@RequirePermissions("agents:run:create")`. La matriz de permisos por rol (`packages/auth/src/rbac.ts:3-103`) le da `"agents:run:create"` a `CLIENT` (línea 41) y a `OPS_ADMIN` (línea 184) — **pero no a `PRO`** (líneas 58-103) **ni a `WORKER`** (líneas 104-116), que en su lugar reciben `"agents:run:worker"` y `"agents:run:manage"`, dos permisos distintos que el guard de este endpoint nunca comprueba (`apps/api/src/common/rbac.guard.ts:45-53`, comparación exacta por string vía `hasPermission`).
**Alcance del mismo bug — todos comparten el decorador `@RequirePermissions("agents:run:create")` y por tanto el mismo bloqueo para PRO/WORKER:**
  - `apps/api/src/modules/agents/agents.controller.ts:182` (`POST /agents/chat`) y `:199,207` (listado/lectura de threads) — esto es probablemente lo que respondía el ítem de menú "Asistente IA" antes de resolverse en algo distinto (ver nota debajo).
  - `apps/api/src/modules/prometeo/prometeo.controller.ts` (14 endpoints, líneas 27-506)
  - `apps/api/src/modules/prometeo-copilot/prometeo-copilot.controller.ts:25,36,47,58` — el módulo "Prometeo Copilot" backend en sí.
  - `apps/api/src/modules/forge/forge.controller.ts:75,130` (chat con el agente Forge/dev)
  - `apps/api/src/modules/browser-agent/browser-agent.controller.ts` (5 endpoints)
  - `apps/api/src/modules/orchestration/orchestration.controller.ts` (3 endpoints)
  - `apps/api/src/modules/ai-models/ai-models.controller.ts:68,74,80,131,145,152,167,173,180,198,214` (registry, readiness, chat)
**No es específico de un agente:** el catálogo `/agents` (`apps/web/app/(app)/agents/page.tsx`) lista 16 agentes "Conversacionales" (Prometeo, Marta, Felix, Pulse, Justus, Planner con "Chat directo"; Escrow/Legal/Vesper/Security/Binary/Tech/Design/Marketing/Health/Evidence Coach "canalizados vía" uno de los anteriores) — todos comparten el mismo endpoint `/v1/ai-models/prometeo/chat` con `agentId` como parámetro, así que los 16 fallan igual para PRO. Solo se probó explícitamente Prometeo y Felix en vivo; Marta, Pulse, Justus y Planner no se reprobaron individualmente en esta pasada porque comparten el mismo código server-side sin ninguna rama condicional por `agentId` antes del guard.
**"Asistente IA" no es lo que parece:** el ítem del sidebar de `/worker` etiquetado "Asistente IA" (`apps/web/app/(app)/layout.tsx:90`, `labelKey: "nav.aiSettings"`) en realidad enlaza a `/worker/settings` — una pantalla de *configuración de tono del asistente* ("Amistoso"/"Formal"/"Técnico"), no un chat. La clave de traducción `nav.aiSettings` se traduce como **"Asistente IA"** en español (`apps/web/lib/language-context.tsx:81`) pero como **"AI Settings"** en inglés (línea 739) — la versión en inglés sí describe correctamente el contenido; la española no. Esto generó confusión real durante esta auditoría (se esperaba un chat y se encontró un panel de configuración). No se confirmó ningún cuelgue reproducible de esta pantalla — un cuelgue de navegador observado durante la sesión no se reprodujo en un segundo intento y se atribuye a inestabilidad de sesión durante un reset de contraseña concurrente, no a un bug de esta página.
**Prometeo Copilot (workspace de página completa):** existe en `apps/web/app/(app)/client/projects/[projectId]/copilot/page.tsx` — es una superficie exclusiva de `client/projects/*`, no tiene equivalente bajo `/worker/*`. Como CLIENT sí tiene `agents:run:create`, no se ve afectado por G-PRO-05, pero no se pudo verificar en vivo en ninguna sesión de esta auditoría (lista de proyectos vacía cuando se revisó desde el lado cliente).
**Impacto:** todo profesional real en producción que use el botón de ayuda de Prometeo o cualquier agente especializado recibe un error técnico en inglés sin ninguna explicación ni fallback — la funcionalidad de IA conversacional, presentada de forma prominente en toda la UI de `/worker/*` (widget flotante siempre visible), no funciona en absoluto para el rol que más la usaría en campo.
**Fix esperado:** agregar `"agents:run:create"` al array de permisos de `PRO` y de `WORKER` en `packages/auth/src/rbac.ts` (fix de una línea cada uno, mínimo riesgo dado que es agregar permiso, no quitarlo) — o, más correcto a mediano plazo, hacer que los controladores de chat acepten cualquiera de `agents:run:create` / `agents:run:worker` (el guard actual solo soporta AND de una lista, no OR entre alternativas — requeriría extender `RbacGuard`). Además: traducir `nav.aiSettings` a algo como "Configuración del asistente" en español para que coincida con su contenido real, y que el frontend traduzca/oculte errores `403` crudos en vez de mostrar `Insufficient permissions` sin procesar al usuario final.

### G-PRO-06 — CRÍTICO — Subir evidencia real no sube el archivo: el presign se completa pero el `PUT` real nunca se dispara

**Confirmado en vivo con un archivo real:** en `/worker/evidence`, subir una foto JPEG para el job `cmqvqsol40023k101j9fh81mq` produce esta traza: `POST /api/semse/uploads/plan` → `200` (presign correcto, con `uploadUrl`/`key` reales) → **cero peticiones `PUT` en toda la sesión de red** → `POST /api/semse/jobs/:jobId/evidence` → `400`. El archivo nunca llega a storage.
**Causa raíz exacta:** `apps/web/app/(app)/worker/evidence/page.tsx:120-154` (`handleUpload`). Para `recommendedStrategy === "single_put"` (el caso normal, cualquier archivo bajo 25MB — prácticamente toda foto/documento real de evidencia):
  1. Nunca hace `fetch`/`PUT` a `plan.uploadUrl` (el endpoint real de subida, `apps/api/.../evidence.controller.ts:107`).
  2. Nunca usa `plan.key` (la key real que generó el backend) — fabrica una key local sin relación: `` `jobs/${selectedJobId}/evidence/${Date.now()}_${file.name}` `` (línea 131).
  3. Llama `registerJobEvidence` con esa key fabricada — de ahí el 400. Solo la rama `multipart` (>25MB) sí sube algo real.
**Mismo patrón confirmado por código en otro módulo:** `apps/web/app/(app)/worker/travel/[travelId]/page.tsx:261-295` (`prepareReceiptUpload`, comprobantes de viaje/hospedaje) — para la rama no-multipart retorna `plan.uploadUrl`/`plan.key` **directamente como si fuera el `receiptUrl` final** (línea 273), sin nunca hacer el `PUT`, y lo persiste tal cual en el formulario de gasto. No se pudo reproducir en vivo por falta de un viaje activo en esta cuenta (crear uno falso habría ensuciado datos financieros reales), pero el código es idéntico en estructura al de evidencia.
**Impacto:** la función de subir evidencia — el mecanismo que sustenta directamente la aprobación de milestones y la liberación de escrow — no sube el archivo real en el caso de uso más común (single_put). Mismo problema en comprobantes de viaje.
**Fix esperado:** en ambos archivos, antes de registrar/guardar, hacer `fetch(plan.uploadUrl, { method: "PUT", body: file, headers: { "content-type": contentType } })` para la rama no-multipart, y usar `plan.key` real (no una key fabricada). Buscar si el mismo patrón (`planUpload` + rama single_put sin `fetch` real) existe en más pantallas antes de dar el fix por cerrado.
**Detalle completo:** ver `docs/AUDIT_REMEDIATION_PLAN.md` → 0.34 (actualizado 2026-07-21 con la causa raíz exacta: la key fabricada no cumple el formato `tenants/{tenantId}/.../evidence/...` que exige el backend, en ningún ambiente — y la rama "multipart" resultó ser igual de falsa que "single_put", sin subir bytes reales en ningún lado, ni cliente ni servidor) y 2.18 (la respuesta de `GET .../evidence` además descarta `validationStatus`/`aiQualityScore`/`previewUrl`/`filename`, dejando el badge pegado en "Pendiente" y el link "Ver" muerto para siempre).

## Gaps adicionales — ronda de 5 agentes de código en paralelo (2026-07-21)

> Auditoría estática de `apps/web/app/(app)/worker/**` completa, la misma metodología aplicada al módulo Cliente (5 agentes en paralelo, uno por franja funcional). 42 hallazgos nuevos en total; los `CRÍTICO` se detallan aquí como gaps propios, el resto (14 `ALTO`, 13 `MEDIO`, 6 `BAJO`) está catalogado con evidencia completa file:line en `docs/AUDIT_REMEDIATION_PLAN.md` → Sección 2, ítems **2.8 a 2.48**, para no duplicar el mismo detalle en dos documentos.

### G-PRO-07 — CRÍTICO — Las reseñas de cliente están 100% rotas: ningún profesional puede enviar una, nunca
`apps/web/app/(app)/worker/review/page.tsx:84-85,104-108` depende de `job.clientUserId` — campo que no existe en `JobRecordView`/`jobRecordSchema` (`packages/schemas/src/job.schema.ts:53-67`) ni en `fetchMyJobs()` (`semse-api.ts:363-378`); de ahí el cast `(j as any)`. `handleSubmit` corta siempre con "No se encontró el ID del cliente". La UI (estrellas, comentario, botón) se ve completamente funcional. Fix: exponer `clientUserId`/`clientEmail` en el job record que consume esta pantalla, o resolverlo por otra vía (p. ej. desde el contrato/reserva del job). Detalle: plan → 2.17.

### G-PRO-08 — CRÍTICO — "Oportunidades abiertas" del dashboard siempre vacío, y la misma llamada expone jobs `DRAFT` de otras organizaciones
`dashboard/page.tsx:155` filtra `["posted","published"].includes(job.status)` contra un `job.status` que llega en MAYÚSCULAS (mismo patrón que G-PRO-00/0.0, pero esta vez porque `dashboard/page.tsx:130-139` hace `fetch("/api/semse/jobs")` directo, cuya respuesta pasa por `toVisibleJob()` que mayúsculiza intencionalmente). Es la pantalla de aterrizaje principal del PRO — siempre muestra cero oportunidades. Además, esa misma llamada trae **todos los jobs del tenant sin filtro de status ni de organización** (`jobs.repository.ts:62-69`, `listByTenant`), incluidos `DRAFT` (aún privados) de clientes no relacionados — el payload completo ya llegó al navegador aunque la UI rota no lo muestre. Fix: aplicar el mismo fix de normalización que G-PRO-00, y agregar `?status=posted` (o el filtro server-side correspondiente) a esta llamada. Detalle: plan → 2.26, 2.27.

### G-PRO-09 — CRÍTICO — Los botones "Verificar" del perfil siempre fallan con 403 para cualquier PRO
`/worker/profile` → "Solicitar" (Documento de identidad / Antecedentes / Teléfono) llama `POST /v1/users/:userId/verify`, gateado por `@RequirePermissions("users:verify")` (`users.controller.ts:96-98`) — permiso exclusivo de `OPS_ADMIN` (`rbac.ts:165`), ausente en `PRO`. `users.policy.ts:16-18` (`canVerifyUser`) refuerza el mismo requisito. Distinto de G-PRO-04 (el stub DID) — aquí la petición muere en el guard RBAC antes de llegar a esa lógica. El botón de "solicitar verificación" está conectado por error a un endpoint exclusivo de administración. Fix: crear un endpoint/flujo de solicitud accesible para PRO que solo notifique/encole la verificación para revisión de OPS_ADMIN, en vez de intentar ejecutar la verificación admin directamente. Detalle: plan → 2.28.

### G-PRO-10 — CRÍTICO — El módulo de Movilidad (viajes) es completamente inalcanzable para cualquier PRO real
Todos los endpoints de escritura de `/v1/travel` (crear viaje, cambiar estado, gastos, hospedaje, anticipos, cerrar liquidación — `travel.controller.ts`) exigen `jobs:create`, permiso que ni `PRO` ni `WORKER` tienen en `packages/auth/src/rbac.ts` (solo `CLIENT`/`OPS_ADMIN`). El botón "+ Nuevo viaje" responde 403 siempre — ningún profesional puede crear un viaje, no solo "subir un comprobante" (eso es un problema aparte, ver G-PRO-06/0.34, que además resultó estar roto en ambas rutas de subida). El propio test del backend (`travel.controller.test.ts`) usa `roles: ["PRO"]` pero llama al controller directo sin pasar por `RbacGuard`, por lo que nunca detectó este mismatch. Fix: agregar `jobs:create` a `PRO`/`WORKER`, o (más correcto) introducir un permiso propio para "gestionar mis propios viajes" que no dependa del permiso de creación de jobs. Detalle: plan → 2.31.

### G-PRO-11 — CRÍTICO (seguridad, IDOR cross-tenant) — El estado de cualquier unidad de campo de cualquier tenant se puede sobreescribir
`apps/api/.../field-ops.repository.ts:122-127` (`updateUnitStatus`) recibe `tenantId` pero nunca lo usa en el `where` del `update` (a diferencia de `findUnitById`, que sí lo hace) — cualquier usuario con `field-ops:write` (PRO o WORKER) puede cambiar el estado de una `FieldUnit` de otra organización con solo conocer/adivinar su `id`. Fix: agregar `tenantId` al `where` del update, igual que en el resto de repositorios de este módulo. Detalle: plan → 2.32.

### G-PRO-12 — CRÍTICO (dinero) — El estado visual de un pago se calcula solo por `type`, ignorando el `status` real — un pago fallido puede mostrarse como ya liberado
`apps/web/app/(app)/worker/payments/page.tsx:58-61` deriva el badge (`released`/`in_escrow`/`pending`) únicamente de `row.type`, sin leer el campo `status` real (`PENDING|SUCCEEDED|FAILED|REVERSED`) que el backend ya envía (`toVisiblePaymentTxn`, `visible-response.ts:128-139`). Un `RELEASE` con `status: FAILED` o `REVERSED` igual se pinta verde "Liberado" y suma a `totalReleased`; un `DEPOSIT` con `status: FAILED` igual se pinta "En escrow". Un worker puede creer que ya cobró, o que hay fondos a su favor, sin ser cierto. Fix: leer `row.status` real y solo mostrar "Liberado"/"En escrow" cuando `status === "SUCCEEDED"`; mostrar un estado distinto y visible para `FAILED`/`REVERSED`. Detalle: plan → 2.39.

### G-PRO-13 — CRÍTICO — "Mis Tarifas" no tiene ningún efecto real: la promesa central de la pantalla es falsa
`/worker/rates` promete *"Tus tarifas reales reemplazan los promedios BLS en cada estimado... se usarán en todos los estimados futuros"*. El guardado funciona, pero `ContractorRateService.getOverride()` solo se lee desde `protools.agent.ts:139-158`, invocado únicamente por `POST /v1/semse-agents/protools/estimate` — cuya única UI consumidora es `client/protools/page.tsx` (lado **cliente**, con el `userId` del cliente, no del profesional). La tarifa guardada por un PRO no puede llegar a ningún estimado real, ni por su propia cuenta ni por la del cliente. Fix: decidir el diseño real (¿el estimado de ProTools debería aceptar el `userId` del profesional asignado al job? ¿o esta pantalla debería alimentar otro cálculo, como el de pricing/matching?) antes de tocar código — no es un bug de una línea. Detalle: plan → 2.40.

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
  - /worker/field-ops (legacy — pestaña "Tracker" debe desactivarse o quedar solo lectura, ver G-PRO-01)
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
  - Solo debe existir una ruta activa de registro de horas por profesional (bloqueado hoy por G-PRO-01)
  - Un archivo de evidencia subido en `/worker/evidence` debe existir realmente en storage tras "Registrar" (bloqueado hoy por G-PRO-06)
  - Un usuario PRO debe poder enviar un mensaje a Prometeo/agentes y recibir respuesta real (bloqueado hoy por G-PRO-05)
```

## Security / RBAC

- **G-PRO-11 (CRÍTICO, cross-tenant IDOR):** `updateUnitStatus` en field-ops no filtra por `tenantId` — ver arriba.
- **IDOR intra-tenant (ALTO, plan 2.19):** `POST/GET /v1/incidents` y `/v1/materials` no verifican que el actor esté asignado al `jobId` — cualquier worker del tenant puede leer/inyectar incidencias y solicitudes de material de otro job.
- **IDOR intra-tenant (ALTO, plan 2.20):** `PATCH /v1/tasks/:taskId/status` no verifica `assignedTo === actor.userId` — cualquier worker puede cambiar el estado de la tarea de otro.
- **IDOR intra-tenant (ALTO, plan 2.34):** los endpoints de detalle/mutación de `/v1/travel/:travelId` (gastos, hospedaje, anticipos, liquidación) no verifican `assignedTo === actor.userId` — cualquiera con `jobs:read` en el tenant puede ver, y quien tenga `jobs:create` puede modificar, el viaje de otro worker.
- **Cumplimiento/PCI-DSS (ALTO, plan 2.44):** `PayoutMethodForm.tsx` recolecta PAN de tarjeta y número de cuenta/routing bancario completos en inputs propios sin tokenizar (no Stripe Elements/Plaid) — transita en texto plano por el BFF antes de que el backend descarte los dígitos completos y guarde solo `last4`. Requiere decisión de producto/cumplimiento, no solo un fix de código.
- La cuenta usada para esta auditoría estuvo bloqueada por el bug transversal 0.32 (reset de contraseña no envía correo) y se desbloqueó manualmente por el operador de la sesión — ver nota en `docs/AUDIT_REMEDIATION_PLAN.md`. Se repitió una segunda vez el 2026-07-21.

## Tests Required

- [ ] `/worker/jobs/[jobId]` muestra el mismo badge de estado que `/client/jobs/[jobId]` para el mismo `jobId` (regresión directa de G-PRO-00)
- [ ] La pestaña "Tracker" de `/worker/field-ops` no permite iniciar una sesión de tiempo nueva (o queda removida)
- [ ] `/worker/payments` comunica explícitamente por qué no se puede cobrar cuando no hay cuenta Connect activa
- [ ] Un usuario con rol `PRO` puede enviar un mensaje a Prometeo (o cualquier agente) desde el widget flotante y recibe una respuesta real, no `Insufficient permissions` (regresión directa de G-PRO-05)
- [ ] Un usuario con rol `WORKER` (literal, no alias de PRO) tiene el mismo resultado
- [ ] El label del nav item que enlaza a `/worker/settings` coincide con su contenido real en ambos idiomas
- [ ] Subir una foto en `/worker/evidence` hace un `PUT` real a `plan.uploadUrl` y el objeto existe en storage después (regresión directa de G-PRO-06)
- [ ] Subir un comprobante en `/worker/travel/[travelId]` tiene el mismo comportamiento
- [ ] Un PRO puede enviar una reseña de cliente desde `/worker/review` y el registro se crea (regresión directa de G-PRO-07)
- [ ] `/worker/dashboard` muestra oportunidades reales cuando existen jobs `posted` en el tenant (regresión directa de G-PRO-08)
- [ ] La llamada que alimenta `/worker/dashboard` no devuelve jobs `DRAFT` de organizaciones distintas a las del profesional (regresión directa de G-PRO-08)
- [ ] Un PRO puede completar el flujo de "Solicitar verificación" en `/worker/profile` sin recibir 403 (regresión directa de G-PRO-09)
- [ ] Un PRO puede crear un viaje en `/worker/travel` sin recibir 403 (regresión directa de G-PRO-10)
- [ ] Un pago con `status: FAILED` o `REVERSED` no se muestra como "Liberado"/"En escrow" en `/worker/payments` (regresión directa de G-PRO-12)
- [ ] Guardar una tarifa en `/worker/rates` tiene un efecto verificable en al menos un estimado real, o la pantalla deja de prometerlo (regresión directa de G-PRO-13)

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

- [ ] Este spec se agrega a `SPEC_INDEX.md` junto a `docs/specs/ui/pro-flows.spec.md` (no lo reemplaza — cubren alcances distintos, ver nota de apertura); `pro-flows.spec.md` pasa a `REVIEW` porque G-CLI-04 contradice su `status: VERIFIED`
- [x] ~~Antes de `APPROVED`: completar la cobertura en vivo pendiente y correr la ronda de agentes de código dedicada~~ — hecho 2026-07-21: cobertura en vivo completa + ronda de 5 agentes en paralelo (42 hallazgos nuevos, ver `docs/AUDIT_REMEDIATION_PLAN.md` 2.8-2.48)
- [ ] Antes de `APPROVED`: el equipo de producto revisa y prioriza los 42+13 hallazgos de este spec (son demasiados para implementar todos a la vez) — este spec documenta el estado real, no implica que todo se arregle en un solo esfuerzo
- [ ] `pnpm spec:validate:strict` pasa

## Rollback Considerations

- G-PRO-01 (bloquear el cronómetro legacy) es la única acción aquí con consecuencia operativa real: si algún profesional depende hoy de `/worker/field-ops` para registrar horas, bloquearlo sin aviso le corta el flujo. Requiere coordinación con el owner de producto antes de desactivar, no solo un merge silencioso.
- G-PRO-13 (tarifas custom) requiere una decisión de diseño de producto antes de cualquier fix — no está claro si el comportamiento correcto es "el estimado de ProTools debe usar la tarifa del profesional asignado" o algo distinto; implementar el fix equivocado podría filtrar la tarifa de un profesional a un contexto donde no corresponde.
- Los 3 hallazgos de IDOR (G-PRO-11, incidencias/materiales, tareas) son fixes de bajo riesgo (agregar un filtro que ya falta) pero deben desplegarse junto con una revisión de si ya fueron explotados — no hay logging suficiente hoy para saber si algún dato cross-tenant/cross-worker ya fue leído o modificado por esta vía.
