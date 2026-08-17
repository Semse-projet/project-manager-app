---
id: "ui.client-flows-remediation"
title: "Client Web UI Flows"
domain: "ui"
sdd_version: "2.0"
version: "2.0"
status: "REVIEW"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
# ci_status/deploy_status/activation_status: NOT_RUN/NOT_DEPLOYED/INACTIVE is
# about this SDD 2.0 delivery-evidence trail, not the real feature -- /client
# has been live for a while (see production_evidence: audited live with a
# real account 2026-07-20), but no CI run or fresh canary is tied to *this*
# documented contract, and "no se inventa evidencia retroactiva"
# (SDD_GOVERNANCE §5) rules out claiming DEPLOYED/ACTIVE without one.
ci_status: "NOT_RUN"
merge_status: "MERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence:
  - "docs/AUDIT_REMEDIATION_PLAN.md Sección 1 — módulo Cliente auditado completo, código + en vivo, 2026-07-20 (evidencia histórica; no cubre los hallazgos re-verificados en esta revisión 2026-08-17, ver §9)"
related_files:
  - apps/web/app/(app)/client
  - apps/web/app/(app)/client/dashboard/page.tsx
  - apps/web/app/(app)/client/jobs/page.tsx
  - apps/web/app/(app)/client/jobs/[jobId]/page.tsx
  - apps/web/app/(app)/client/jobs/new/page.tsx
  - apps/web/app/(app)/client/leads/page.tsx
  - apps/web/app/(app)/client/marketplace/page.tsx
  - apps/web/app/(app)/client/protools/page.tsx
  - apps/web/lib/job-intake.ts
  - apps/web/app/components/prometeo/PrometeoCopilot.tsx
  - apps/web/app/(app)/agents/page.tsx
  - apps/web/middleware.ts
  - apps/web/app/api/semse/jobs/route.ts
  - apps/web/app/api/semse/jobs/[jobId]/route.ts
  - apps/web/app/api/semse/agents/protools/estimate/route.ts
  - apps/api/src/modules/semse-agents/semse-agents.controller.ts
  - apps/api/src/modules/bids/bids.repository.ts
  - apps/api/src/modules/payments
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/common/request-context.ts
  - apps/api/src/modules/intelligence/budget-intelligence.service.ts
  - packages/schemas/src/job.schema.ts
related_tests: []
related_endpoints:
  - v1/jobs
  - v1/bids
  - v1/milestones
  - v1/payments
  - v1/auth/login
  - v1/agents/semse/protools/estimate
  - v1/prometeo/copilot/message
related_events:
  - milestone.approved
  - payment.released
related_agents:
  - prometeo
last_verified: "2026-08-17"
---

# Spec: Client Web UI Flows

> Contrato ejecutable SDD 2.0. Sustituye a `docs/specs/ui/client-flows.spec.md`
> (`DEPRECATED`, describe la implementación huérfana `/jobs/*`) como única
> fuente de verdad para la superficie web del rol `CLIENT`. Complementa —no
> compite con— `docs/specs/ui/mobile-client-tab.spec.md` (`IMPLEMENTED`), que
> cubre el subconjunto móvil (jobs/bids/milestones/ratings, evidencia
> solo-lectura); este documento es más amplio porque incluye publicación de
> jobs, marketplace, leads y pagos, que mobile explícitamente deja fuera de
> alcance.
>
> **Por qué se reescribe.** La versión anterior (`DRAFT`,
> `last_verified: 2026-07-20`) documentaba 10 gaps (`G-CLI-00` a `G-CLI-09`)
> encontrados en una auditoría de código + navegación en vivo. Releer el
> código actual para esta revisión (2026-08-17) encontró que **7 de esos 10
> gaps ya están resueltos** — algunos por el mismo fix transversal que
> `admin-flows-remediation.spec.md` ya documentó para el Dashboard de Admin
> (`G-ADM-00`), otros por trabajo específico de este módulo con comentarios en
> código que citan `AUDIT_REMEDIATION_PLAN.md` explícitamente. El spec nunca
> se actualizó para reflejarlo — el mismo patrón de documentación
> desincronizada que el propio proyecto ya identificó dos veces antes. Cada
> gap de §2 cita archivo:línea de la verificación hecha en esta sesión.

## 1. Problema y resultado

**Para quién:** usuarios con rol `CLIENT` que usan `apps/web/app/(app)/client/*`.

**Problema:** el spec anterior describía tres clases de problema — un bug de
comparación de `JobStatus` que rompía los KPIs del dashboard, acciones de
dinero/disputa sin confirmación, y un rol "Cliente" que mezcla dos personas de
producto (dueño que contrata vs. contratista con su propio CRM de leads) sin
avisar. Verificado contra el código actual: el bug de `JobStatus` y las
confirmaciones de dinero/disputa están resueltos; la mezcla de personas de
producto sigue sin resolver porque es una decisión de producto, no un bug de
código — ver §"Bloqueado por decisión de producto".

**Resultado esperado:** un contrato preciso de lo que la superficie CLIENT web
hace hoy, con cada afirmación verificada contra código real, que distingue
claramente entre lo ya resuelto (no repetir como si fuera un problema activo)
y lo que sigue genuinamente abierto.

## 2. Alcance

### Incluido

- `apps/web/app/(app)/client/**`: dashboard, jobs (lista/detalle/wizard de
  publicación), leads, marketplace, protools, payments/escrow.
- El BFF (`apps/web/app/api/semse/**`) en la medida que sirve a estas
  pantallas.
- Los endpoints de `apps/api` que consume: jobs, bids, milestones, payments,
  escrow, `agents/semse/protools/estimate`, `prometeo/copilot/*`.
- El subconjunto que se solapa con `mobile-client-tab.spec.md` (ver jobs,
  bids, milestones, evidencia de solo lectura) se referencia, no se
  re-especifica — ese documento es la fuente de verdad para el comportamiento
  de esas acciones en mobile; este documento cubre las mismas acciones del
  lado web más todo lo que mobile deja fuera (publicar job, marketplace,
  leads, pagos).

### Fuera de alcance

- El módulo Worker/PRO (`pro-flows-remediation.spec.md`) y Admin
  (`admin-flows-remediation.spec.md`), salvo causa raíz compartida (marcada
  explícitamente donde aplica).
- El motor de pagos en sí (double-payment, webhook no-op) —
  `docs/AUDIT_REMEDIATION_PLAN.md` sección 0, transversal, no específico de
  UI de cliente.
- La ruta huérfana `/jobs/*` (no `/client/jobs/*`) — sigue sin ningún enlace
  de navegación activo desde superficie CLIENT (confirmado de nuevo en esta
  sesión, `grep` de `href="/jobs/` y `clientJobsHref`/`CLIENT_ROUTES` sin
  resultados fuera de `apps/web/app/jobs/**` mismo). El código bajo
  `apps/web/app/jobs/**` recibió fixes de confirmación reales (ver G-CLI-01,
  G-CLI-02) pese a ser huérfano — no se decide aquí si se elimina o se
  reconecta; ver Non-Goals.

## Non-Goals

- Este spec no decide si "Cliente" debe seguir siendo un rol híbrido (dueño +
  contratista) o dividirse en dos — ver "Bloqueado por decisión de producto".
- No decide si `apps/web/app/jobs/**` (huérfano) se elimina o se reconecta a
  la navegación real — ambas rutas comparten los mismos fixes de
  confirmación hoy, así que no hay urgencia de seguridad en dejarlo así, pero
  sigue siendo código duplicado sin dueño claro.

## Bloqueado por decisión de producto

**G-CLI-08 — el rol "Cliente" mezcla dos personas de producto sin avisar.**
Confirmado vigente en esta sesión (2026-08-17), sin cambios desde la
auditoría original:

- `apps/web/app/(app)/client/leads/page.tsx:5-6` importa
  `fetchLeads`/`fetchLeadStats`/`ContractorLead`/`LeadStatus` — un CRM de
  prospectos con lenguaje de contratista (`jobType`, `nextAction`, `source`,
  estados `new`/...), no de cliente que contrata.
- `apps/web/app/(app)/client/marketplace/page.tsx:95,195` tiene un botón
  literal "Aplicar al trabajo" / "Aplicar" — el cliente ve su propio job
  publicado con la opción de postularse a él, como si él mismo pudiera ser el
  profesional.

**Pregunta abierta exacta:** ¿"Cliente" es intencionalmente un rol híbrido
(dueño que contrata Y contratista con su propio pipeline de leads), o son dos
personas de producto que deberían separarse en dos roles/superficies
distintas? Esto no es resoluble leyendo código — ninguna de las dos
implementaciones (CRM de leads, marketplace con "Aplicar") está rota; ambas
funcionan como fueron construidas. Lo que falta es que el dueño de producto
confirme cuál de las dos lecturas es la intencional, porque cambia cómo se
debe presentar la navegación y el copy, no la lógica de negocio.

**Por qué esto bloquea `APPROVED`:** el spec original (v1.0) ya condicionaba
explícitamente su propio paso a `APPROVED` a esta confirmación ("sin eso, no
hay plan.md que pueda proponer un fix de código para ese gap concreto").
Todos los demás gaps (G-CLI-00 a G-CLI-07, G-CLI-09) sí pueden y deben leerse
como resueltos o accionables independientemente — no están bloqueados por
esta pregunta.

## Gaps encontrados (auditoría 2026-07-20, re-verificados 2026-08-17)

### G-CLI-00 — RESUELTO — `JobStatus` en mayúsculas comparado contra literales en minúsculas

**Confirmado por código 2026-08-17:** el mismo fix transversal que
`admin-flows-remediation.spec.md` documenta para `G-ADM-00` cubre las tres
superficies citadas originalmente:

- `apps/web/app/api/semse/jobs/route.ts:3,18` y
  `apps/web/app/api/semse/jobs/[jobId]/route.ts:2,12` aplican
  `normalizeJobRecordStatus()` (`packages/schemas/src/job.schema.ts:122-125`,
  que hace `.toLowerCase()`) a toda respuesta antes de reenviarla al browser.
- `apps/web/app/(app)/client/dashboard/page.tsx:83,99,119-122` y
  `apps/web/app/(app)/client/jobs/page.tsx:99,112-116` consumen
  `/api/semse/jobs` (ya normalizado) y filtran con literales minúsculas
  (`"in_progress"`, `"accepted"`, etc.) — que ahora sí hacen match porque el
  BFF ya bajó el enum real (`ACCEPTED`/`IN_PROGRESS`, Prisma) a minúsculas
  antes de que React lo vea.
- `apps/web/app/(app)/client/jobs/[jobId]/page.tsx:456` además normaliza
  localmente (`String(job?.status ?? "").toLowerCase()`) — doble protección,
  no depende únicamente del BFF.

**Conclusión:** el bug descrito (KPI "Trabajos activos" siempre en 0, pestaña
"Activos" siempre vacía) no reproduce contra el código actual. No hay
verificación en vivo con sesión CLIENT real en esta tarea (alcance
docs-only), pero la misma normalización ya fue confirmada en vivo para
Admin Dashboard (`admin-flows-remediation.spec.md`, 2026-07-31 y 2026-08-02) —
mismo código, mismo mecanismo.

### G-CLI-01 — RESUELTO — Fondear escrow / liberar pago sin confirmación ni monto visible

**Confirmado por código 2026-08-17** en las tres superficies citadas
originalmente:

- `apps/web/app/(app)/client/jobs/[jobId]/page.tsx:303-306` (`handleFundEscrow`)
  ahora solo abre `EscrowFundModal` (`setFundModalOpen(true)`) — comentario
  explícito en línea 300-302 confirma que reemplaza el disparo directo
  original. `handleRelease` (líneas 364-372) abre un estado de confirmación
  con `title`/`amount` visibles antes de llamar `releaseMilestoneEscrow`
  (confirmado en `confirmRelease`, líneas 374-394).
- `apps/web/app/jobs/[jobId]/escrow/page.tsx:189,223-227` (superficie
  huérfana) también abre `EscrowFundModal` en vez de llamar la API
  directamente; su `handleReleaseMilestone` (línea 79) se pasa como prop a un
  componente que ya implementa el paso de confirmación (ver punto siguiente).
- `packages/ui/src/components/EscrowTimeline.tsx:256-280` — el botón
  "Liberar pago" ahora abre un estado `confirming` que muestra
  `Confirmar liberación de {formatCurrency(...)}` antes de exponer un botón
  de confirmación real.

**Conclusión:** las tres superficies pasan por un paso de confirmación con
monto visible. Resuelto.

### G-CLI-02 — RESUELTO — "Resolver disputa" fijo a `pro_favor`, sin confirmación

**Confirmado por código 2026-08-17:**
`apps/web/app/jobs/[jobId]/page.tsx:278-311`. `handleResolveDispute` (línea
287) ya no llama a la API directo — abre un estado de confirmación
(`setDisputeConfirmId`); `confirmResolveDispute` (línea 292) es quien ejecuta
`resolveDispute(...)`. El comentario en líneas 278-286 documenta la decisión
de diseño con precisión: cita `disputes.policy.ts assertDisputeResolvable`
para justificar por qué la única opción visible al cliente es "a favor del
profesional" (no un selector de resultado que el backend rechazaría) —
consistente con `docs/foundation/DOMAIN_INVARIANTS.md` ("el cliente dueño
solo puede cerrar por acuerdo a favor del profesional, mientras refund, split
y escalamiento legal requieren `OPS_ADMIN`").

**Nota heredada:** este archivo sigue viviendo en la ruta huérfana
`/jobs/[jobId]`, no en `/client/*` — confirmado de nuevo sin enlace de
navegación real (ver §2, Fuera de alcance). El fix ya se aplicó ahí de
cualquier forma.

### G-CLI-03 — RESUELTO — Wizard de publicación pierde el progreso al refrescar

**Confirmado por código 2026-08-17:**
`apps/web/app/(app)/client/jobs/new/page.tsx:23-29` importa
`saveJobWizardDraft`/`loadJobWizardDraft`/`clearJobWizardDraft` desde
`apps/web/lib/job-intake.ts:236-284`, que persisten el estado completo del
wizard (paso, categoría, título, descripción, ubicación, presupuesto,
urgencia, deadline) en `window.localStorage` bajo una clave dedicada, con
parseo defensivo (`loadJobWizardDraft` valida cada campo antes de
restaurarlo) y limpieza explícita al completar (`clearJobWizardDraft`). El
componente mantiene un flag `draftRecovered` (línea 120) para reflejarlo en
UI.

**Conclusión:** el escenario descrito (2 pasos completados, refresh, vuelta a
Paso 1 sin rastro) no reproduce contra el código actual.

### G-CLI-04 — RESUELTO — "Calcular estimado" de ProTools daba 404

**Confirmado por código 2026-08-17, extremo a extremo:**
`apps/web/app/api/semse/agents/protools/estimate/route.ts` existe y reenvía a
`POST /v1/agents/semse/protools/estimate`
(`apps/api/src/modules/semse-agents/semse-agents.controller.ts:19,42`, el
controller usa `@Controller("v1/agents/semse")` + `@Post("protools/estimate")`,
que arman exactamente esa ruta). Antes 404'aba porque la ruta BFF no
existía; ahora existe y apunta a un endpoint backend real.

### G-CLI-05 — RESUELTO — Sugeridor de presupuesto con IA ignoraba categoría/área

**Confirmado por código 2026-08-17:**
`apps/api/src/modules/intelligence/budget-intelligence.service.ts` — el
comentario en líneas 143-148 documenta explícitamente el fix ("Never mix
unrelated categories... see 0.29 in AUDIT_REMEDIATION_PLAN.md"). El fallback
de pocos datos (línea 136 en adelante) ahora:

1. Con ≥3 jobs similares, calcula percentiles reales (líneas 136-141).
2. Sin eso, restringe a la **misma categoría** únicamente (líneas 149-162) —
   ya no mezcla "reparación de fugas" con remodelaciones grandes.
3. Sin datos de la misma categoría, **no fabrica un número** — devuelve
   `budgetMin/Max/Median: 0`, `confidence: "low"` y una nota explícita
   recomendando cotización manual (líneas 163-175).
4. Ajuste regional real vía `LocationCostService` usando `zipCode`/`location`
   (líneas 178-199) y ajuste por tarifa real del profesional asignado vía
   `ContractorRateService`, con ownership verificado server-side
   (`clientOrgId === input.orgId` o `OPS_ADMIN`, líneas 207-219) — el
   comentario en líneas 71-78 confirma explícitamente que nunca confía en un
   `userId` de profesional provisto por el cliente.

**Conclusión:** el escenario descrito ($80 de referencia → $2,074–$4,839
auto-aplicado) no reproduce contra la lógica actual.

### G-CLI-06 — RESUELTO — Catálogo de 24 agentes de IA: solo 6 alcanzables, sin avisar

**Confirmado por código 2026-08-17:**
`apps/web/app/(app)/agents/page.tsx:46-63` (`PANEL_AGENT_ROUTE_MAP`) sigue
mapeando los 16 agentes nombrados a 6 destinos operativos reales
(`assistant`, `marta`, `planner`, `felix`, `pulse`, `justus`) — pero ahora el
comportamiento de clic (líneas 118-171, 174-222) selecciona la tarjeta, la
expande con detalle, y muestra explícitamente
`"Canalizado vía {PANEL_AGENT_LABELS[routedAgent]}"` (línea 164) o
`"Chat directo"` (línea 163) según corresponda, con un botón
`"Abrir en {X}"` / `"Chatear con {X}"` (línea 217) que abre el panel
correctamente enrutado — no siempre Prometeo sin importar la tarjeta. El
texto de ayuda (línea 199) es honesto: "hoy es uno de los 6 agentes
operativos del panel".

**Conclusión:** el comportamiento roto original (clic sin efecto, FAB siempre
a Prometeo) no reproduce; la limitación real (16 agentes nombrados, 6
destinos reales) ahora está comunicada en la propia UI en vez de oculta.

### G-CLI-07 — RESUELTO — "Prometeo Copilot" exponía un error interno crudo

**Confirmado por código 2026-08-17:**
`apps/web/app/components/prometeo/PrometeoCopilot.tsx:33-58` (`handleSend`)
llama `sendCopilotMessage` contra
`apps/web/app/api/semse/prometeo/copilot/message/route.ts`, que reenvía a
`POST /v1/prometeo/copilot/message` — endpoint real, respaldado por
`apps/api/src/modules/prometeo-copilot/prometeo-copilot.controller.ts:26-27`
(`@Controller("v1/prometeo/copilot")`), no un stub. `handleQuickAction`
(líneas 82-113) llama `executeCopilotAction` contra
`/api/semse/prometeo/copilot/action/execute` (BFF real) y solo muestra el
mensaje genérico `"Acción "{desc}" ejecutada."` (línea 99) tras una respuesta
exitosa real de la API — no incondicionalmente. Los errores se capturan y se
muestran como mensaje del asistente (líneas 101-109), no como texto crudo de
excepción.

**Conclusión:** el flujo completo (chat libre + quick actions + creación de
misión) pasa por endpoints reales de principio a fin. No se reprodujo el
error literal `"Authentication required for SEMSE API route"` contra el
código actual.

### G-CLI-09 — MAYORMENTE RESUELTO — Navegación huérfana y marca dividida

**Confirmado por código 2026-08-17, por sub-ítem:**

- **`/dashboard` huérfano en cero:** RESUELTO.
  `apps/web/app/dashboard/page.tsx:1-20` ya no renderiza nada — es un
  `redirect("/login")` inerte, y el comentario explica que
  `apps/web/middleware.ts:102-117` intercepta `/dashboard` antes de que este
  componente se ejecute, redirigiendo al dashboard real del rol del visitante
  (o a `/login` sin sesión). El componente solo existe como fallback si el
  matcher de middleware cambiara.
- **Marca dividida "SEMSE Project" (claro) vs "SEMSE OS" (oscuro):**
  RESUELTO. `grep` de `"SEMSE OS"` en `apps/web/app` no tiene resultados —
  cero ocurrencias en todo el árbol actual; "SEMSE Project" es el único
  nombre usado, incluyendo dentro de `client/dashboard/page.tsx`.
- **Tema claro/oscuro no sobrevive un refresh:** RESUELTO.
  `apps/web/app/(app)/layout.tsx:507,515` persiste el tema elegido en
  `window.localStorage` (clave `semse-theme`) y lo restaura al cargar.
- **FAB de asistente tapa el monto de una propuesta en mobile:** **sin
  verificar** — `apps/web/app/components/prometeo/PrometeoCopilot.tsx:120,129`
  usa un offset fijo (`bottom-24 right-6`) sin variante específica para
  viewport móvil visible en el CSS, así que no se puede descartar el
  solapamiento solo leyendo código; requiere una captura real en un viewport
  angosto para confirmar o descartar. No se marca RESUELTO ni ABIERTO —
  queda como verificación en vivo pendiente.

## UI Contract

```yaml
screens:
  - /client/dashboard
  - /client/jobs
  - /client/jobs/[jobId]
  - /client/jobs/new (wizard, 4 pasos, con draft persistido en localStorage)
  - /client/milestones
  - /client/payments
  - /client/protools
  - /client/leads
  - /client/marketplace
  - /client/bids
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - "Trabajos activos" y la pestaña "Activos" reflejan jobs ACCEPTED/IN_PROGRESS/RESERVED/REVIEW reales (verificado, G-CLI-00)
  - Ninguna acción que mueva dinero o cierre una disputa ejecuta sin un paso de confirmación explícito con el monto/resultado visible (verificado, G-CLI-01/02)
  - El wizard de publicación no pierde datos ante un refresh accidental (verificado, G-CLI-03)
```

## Security / RBAC

- **Tenant boundary:** no se encontraron fugas cross-tenant específicas de
  este módulo en esta sesión — consistente con el spec anterior. Las fugas
  cross-tenant confirmadas (evidencia de milestones, change-orders, SSE)
  están en `docs/AUDIT_REMEDIATION_PLAN.md` sección 0, transversales, no
  exclusivas de CLIENT.
- **Bypass de identidad por header cuando `AUTH_SECRET` no está
  configurado — sigue presente en código, verificado 2026-08-17, NO
  resuelto.**
  `apps/api/src/modules/auth/auth.service.ts:105-108`
  (`authenticateRequest`) y `apps/api/src/common/request-context.ts:43-51,75`
  (`resolveRequestContext`): si `process.env.AUTH_SECRET` no está definido,
  ambas funciones caen a `parseHeaderRequestContext(req.headers)`
  (`request-context.ts:34-41`), que construye el contexto de auth
  (`userId`/`tenantId`/`orgId`/`roles`) **directamente de headers HTTP
  provistos por el llamante**, sin verificar ninguna credencial. Esto no es
  específico de CLIENT — afecta la entrada a todos los endpoints `/v1/*` — y
  ya estaba señalado en el spec anterior citando
  `AUDIT_REMEDIATION_PLAN.md` sección 0.1. Sigue sin corregirse. Su severidad
  real depende de si `AUTH_SECRET` está garantizado presente en todo entorno
  de producción — algo que este spec, con alcance solo de código, no puede
  confirmar ni descartar; requiere evidencia de configuración de Railway, no
  lectura de código. Se mantiene fuera del scope de fix de este documento
  (transversal, sección 0 del plan) pero se documenta aquí porque es
  directamente relevante para el riesgo `critical` de este módulo — cualquier
  fix de UI de confirmación (G-CLI-01/02) es irrelevante si la identidad que
  llega al backend puede spoofearse en la puerta de entrada.
- **Aceptar un bid valida ownership server-side:**
  `apps/api/src/modules/bids/bids.repository.ts:308`
  (`if (bid.job.clientOrgId !== input.orgId && !input.roles.includes("OPS_ADMIN"))`)
  — un CLIENT no puede aceptar un bid de un job que no es de su org. Mismo
  patrón que documenta `mobile-client-tab.spec.md` §3 para el mismo endpoint.

## Tests Required

- [ ] `client/dashboard` — job con status `ACCEPTED` cuenta en "Trabajos
      activos" — comportamiento verificado por código (G-CLI-00), sin test de
      regresión dedicado localizado en `apps/web` para esta pantalla
      específica.
- [ ] Fondear escrow / liberar pago requieren confirmación con monto visible
      — verificado por código (G-CLI-01), sin test E2E dedicado localizado.
- [ ] Wizard de publicación sobrevive un refresh en cualquier paso —
      verificado por código (G-CLI-03), sin test dedicado localizado.
- [ ] `POST /api/semse/agents/protools/estimate` responde 200 — verificado
      por código que la ruta existe (G-CLI-04), sin test de contrato
      localizado.
- [ ] Sugeridor de presupuesto no mezcla categorías no relacionadas y no
      fabrica un número sin datos — verificado por código (G-CLI-05), sin
      test unitario localizado para `budget-intelligence.service.ts`.
- [ ] `authenticateRequest`/`resolveRequestContext` rechazan el fallback de
      headers cuando `AUTH_SECRET` está configurado (comportamiento correcto
      ya presente) y — idealmente — un test que falle explícitamente el CI si
      algún entorno de despliegue corre sin `AUTH_SECRET` seteado, ya que el
      código hoy permite ese fallback silenciosamente.

## Implementation Map

### Web

- `apps/web/app/(app)/client/**` (ya no requiere los fixes de G-CLI-00/01/03/04/05/06/07/09 — ya aplicados)
- `apps/web/app/jobs/**` (huérfano, mismos fixes de confirmación ya aplicados — decisión pendiente de eliminar o reconectar, ver Non-Goals)
- `apps/web/lib/job-intake.ts`
- `packages/ui/src/components/EscrowTimeline.tsx`
- `apps/web/app/components/payments/EscrowFundModal.tsx`

### API

- `apps/api/src/modules/bids/bids.repository.ts`
- `apps/api/src/modules/semse-agents/semse-agents.controller.ts`
- `apps/api/src/modules/intelligence/budget-intelligence.service.ts`
- `apps/api/src/modules/auth/auth.service.ts` + `apps/api/src/common/request-context.ts` (fallback de headers sin resolver, ver Security/RBAC)

## Acceptance Criteria

- [x] Este spec reemplaza a `docs/specs/ui/client-flows.spec.md` en
      `SPEC_INDEX.md` (el anterior ya está `DEPRECATED`)
- [ ] Owner confirma explícitamente G-CLI-08 (decisión de producto) — bloquea
      `APPROVED` de este documento específicamente; el resto de gaps ya están
      resueltos o documentados sin bloquear.
- [ ] `pnpm spec:validate:strict` pasa — no ejecutado en esta sesión (lo
      corre la sesión coordinadora)
- [x] Cada gap G-CLI-00 a G-CLI-07 y G-CLI-09 re-verificado contra código
      real en esta sesión (2026-08-17), con file:line

## Rollback Considerations

- Ninguno de los gaps ya resueltos requiere rollback — son correcciones de
  lectura/normalización (G-CLI-00), pasos de confirmación en el cliente
  (G-CLI-01/02) o rutas nuevas puramente aditivas (G-CLI-04). No cambian
  contratos de API existentes de forma incompatible.
- El bypass de auth por header (Security/RBAC) no se toca en este spec —
  cualquier fix ahí es un cambio transversal de plataforma, no de este
  módulo, y necesita su propio spec + verificación de configuración de
  entornos antes de tocarse.
