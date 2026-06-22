# Auditoria de navegacion SEMSE: Mission Control -> Workspace -> Context Panel

Fecha: 2026-06-07  
Scope auditado: `apps/web/app`, `apps/web/components`, `apps/web/lib`, `packages/auth`, `apps/api/src/modules`, `docs/program/architecture`.

## Resumen ejecutivo

SEMSE ya tiene la mayoria de capacidades operativas necesarias: intake, jobs, BuildOps, milestones, evidence, escrow/payments, disputes, field ops, marketplace, contractors CRM, governance, Prometeo, AI Mission Control, runtime de agentes y observer. El problema principal no es falta de componentes ni falta de endpoints: es una arquitectura de informacion que muestra varias capas al mismo tiempo.

El patron encontrado se repite:

1. **Metricas**: jobs, revenue, escrow, alerts, trust, AI, workers, risk.
2. **Listados/work queues**: jobs, projects, milestones, evidence, payments, disputes, change orders, runs, proposals.
3. **Detalle/contexto**: job, project, milestone, evidence item, payment, runtime trace, proposal, worker, incident.

Hoy varias pantallas mezclan estas tres capas. La migracion recomendada es convertir SEMSE en una arquitectura explicita de tres niveles:

```txt
Mission Control -> Workspace -> Context Panel
```

La regla central: **Mission Control no lista objetos, Workspace no renderiza detalle profundo, Context Panel concentra el detalle y las acciones contextuales**.

## Decision ejecutiva

SEMSE debe adoptar una navegacion por **sistemas operativos de trabajo** y dejar de organizarse como una coleccion plana de pantallas.

Decision propuesta:

```txt
Admin default:
  /admin/dashboard        -> deprecado como destino primario
  /admin/mission-control  -> Mission Control canonico

Operaciones:
  /admin/ops              -> legacy alias
  /ops/monitoring         -> workspace canonico futuro

BuildOps:
  /buildops               -> legacy alias visible
  /ops/buildops           -> workspace canonico futuro

AI:
  /admin/ai-mission-control -> legacy alias
  /ai/mission-control       -> health ejecutivo
  /ai/prometeo              -> RAG/memoria/documentos
  /ai/router                -> modelos/proveedores/routing
  /ai/observer              -> runtime/incident/context

Client:
  /client/dashboard -> Client OS Home

Contractor:
  /worker/dashboard -> Contractor OS Home, manteniendo el prefijo tecnico /worker
```

No se recomienda renombrar rutas fisicamente en el primer paso. La primera entrega debe ser un **registry canonico de navegacion** que clasifique rutas existentes y permita que la shell, breadcrumbs, sidebar, analytics y futuros redirects lean de la misma fuente.

## Resultado objetivo

La experiencia final debe sentirse asi:

```txt
Mission Control
  muestra estado agregado y riesgos
  no obliga a leer tablas
  envia al workspace correcto

Workspace
  muestra una cola/lista/tablero de trabajo
  conserva filtros y seleccion
  no abre detalle profundo inline salvo resumen minimo

Context Panel
  muestra entidad, timeline, evidencia, dinero, AI/risk y acciones
  permite decidir sin perder la cola de trabajo
```

Indicador de exito: un admin debe poder responder en menos de 10 segundos **que esta en riesgo**, **en que workspace entra**, y **que accion concreta corresponde**.

## Tabla de decisiones

| Decision | Estado | Razon |
| --- | --- | --- |
| Usar tres capas `Mission Control -> Workspace -> Context Panel`. | Recomendada | El codigo ya contiene estos niveles, pero mezclados. |
| Mantener rutas legacy al inicio. | Requerida | Evita romper favoritos, RBAC, deep links y pruebas existentes. |
| Declarar `/admin/mission-control` como Mission Control canonico. | Recomendada | Es la pantalla mas cercana al modelo correcto. |
| No convertir `/admin/dashboard` en Mission Control nuevo. | Recomendada | Ya duplica proposito y enlaces de muchas areas. |
| Mantener `/worker` como prefijo tecnico. | Recomendada | Cambiarlo a `/contractor` toca RBAC, middleware y links; primero cambiar copy/shell. |
| Crear `navigation-registry.ts` antes de mover rutas. | Requerida | Reduce riesgo y hace verificable la arquitectura. |
| Migrar primero `/admin/ops` a Workspace + Context Panel. | Recomendada | Es la pantalla con mayor mezcla de niveles y mayor riesgo operativo. |

## Investigacion externa y marco profesional

La recomendacion de tres capas no sale solo de la lectura del codigo. Esta alineada con patrones usados en productos operativos maduros y con guias de diseno reconocidas:

- **Material Design / Android canonical layouts**: recomienda layouts adaptativos como `list-detail` para explorar una lista y ver informacion suplementaria del item seleccionado en un segundo panel. Esto valida el patron `Workspace + Context Panel` para entidades como jobs, milestones, evidence, payments, runtime traces y governance proposals. Referencia: https://developer.android.com/develop/ui/views/layout/canonical-layouts
- **Material navigation drawer / navigation rail**: para productos con muchas areas, la navegacion primaria debe agrupar destinos y adaptarse al tamano de pantalla. Material indica que un drawer aplica cuando hay cinco o mas destinos principales o jerarquias de dos o mas niveles; un rail aplica para tres a siete destinos principales. Esto soporta reducir el sidebar admin plano y convertirlo en OS groups. Referencias: https://m2.material.io/components/navigation-drawer y https://m2.material.io/components/navigation-rail
- **Material side sheets**: el detalle contextual encaja con un side sheet/panel persistente, especialmente cuando el usuario necesita inspeccionar informacion sin perder la cola de trabajo. Referencia: https://m2.material.io/components/sheets-side
- **Microsoft NavigationView**: Microsoft documenta `NavigationView` como un control adaptativo para navegacion top-level, util para experiencia consistente, ahorro de espacio y organizacion de muchas categorias. Esto refuerza la idea de shell unica y registry canonico. Referencia: https://learn.microsoft.com/en-us/windows/apps/design/controls/navigationview
- **Atlassian/Jira navigation**: Jira separa navegacion global, sidebar de proyecto, issues/boards y contenido principal. Atlassian tambien documenta el uso de sidebar contextual para arquitecturas de informacion profundas. Esto es comparable a `Mission Control -> OS Workspace -> Entity Context`. Referencias: https://developer.atlassian.com/cloud/jira/platform/navigation/ y https://confluence.atlassian.com/jirasoftware/navigate-projects-with-the-sidebar-1528532974.html
- **Asana**: organiza el trabajo alrededor de tareas, proyectos, equipos, portafolios y objetivos, con sidebar para acceso rapido y vistas especificas. La separacion entre portfolio/project/task se parece a la separacion propuesta entre estado agregado, workspace y detalle. Referencias: https://help.asana.com/s/article/navigating-asana y https://asana.com/product/portfolios
- **Linear**: enfatiza vistas filtradas, agrupacion, ordenamiento, board/list layout y preferencias por workspace. Esto valida que SEMSE necesita workspaces configurables y no solo dashboards fijos. Referencias: https://linear.app/docs/display-options y https://linear.app/docs/custom-views
- **ClickUp hierarchy**: formaliza una jerarquia de Workspace, Spaces, Folders, Lists y Tasks para escalar organizacion y permisos. SEMSE no debe copiar esa taxonomia literalmente, pero si debe tener una jerarquia explicita entre OS, workspace, entidad y accion. Referencia: https://help.clickup.com/hc/en-us/articles/13856392825367-Intro-to-the-Hierarchy
- **Baymard dashboard UX**: sus hallazgos sobre dashboards de cuenta muestran que listas planas de enlaces reducen eficiencia, mientras que cards consistentes con headers claros mejoran escaneo e informacion contextual. Esto soporta convertir el home por rol en launcher accionable, no en menu textual largo. Referencias: https://baymard.com/blog/use-icons-in-the-account-dashboard y https://baymard.com/blog/cards-dashboard-layout

Conclusion de investigacion: los patrones externos coinciden en tres principios: **jerarquia explicita**, **vistas de trabajo orientadas a colas o entidades**, y **detalle persistente sin perder contexto**. SEMSE ya tiene los dominios; falta que la navegacion refleje esa arquitectura.

## Criterios profesionales de auditoria

Para que la migracion sea medible, cada pantalla debe evaluarse con estos criterios:

| Criterio | Pregunta de auditoria | Resultado esperado |
| --- | --- | --- |
| Proposito unico | La pantalla responde una pregunta principal? | Mission Control informa estado; Workspace permite trabajar; Context Panel permite decidir. |
| Nivel correcto | La pantalla mezcla KPIs, lista y detalle profundo? | Si mezcla dos o tres niveles, se divide o se reubica el contenido. |
| Ruta canonica | Existe una URL canonica por concepto? | La ruta legacy puede existir, pero debe apuntar a un owner claro. |
| Rol y OS | El usuario entiende si esta en Client OS, Contractor OS, Operations OS, AI o Governance? | La shell, copy y sidebar deben reforzar el OS activo. |
| Escaneo | El usuario puede identificar lo urgente en menos de 10 segundos? | Maximo 5-7 bloques principales en Mission Control; listas filtrables en Workspace. |
| Profundidad controlada | El detalle aparece sin abandonar la cola? | Context Panel persistente o ruta de detalle equivalente con back claro. |
| Accionabilidad | Cada alerta o item tiene proxima accion clara? | Approve, reject, request changes, retry, requeue, resolve, dispute, assign. |
| Compatibilidad | El cambio rompe links, RBAC o favoritos? | Aliases y redirects durante 1-2 releases. |
| Telemetria | Se puede medir si la migracion mejora navegacion? | Eventos de entrada, seleccion, accion, abandono y uso de rutas legacy. |

## Matriz de severidad por pantalla

| Superficie | Problema | Severidad | Razon | Accion recomendada |
| --- | --- | --- | --- | --- |
| `/admin/ops` | Mezcla metricas, colas, traces, payloads, timeline y acciones runtime. | Alta | Es una pantalla operativa critica; la sobrecarga aumenta riesgo de error. | Primer candidato para `Workspace + Context Panel`. |
| `/admin/dashboard` | Compite con Mission Control y enlaza demasiados modulos. | Alta | Duplica proposito y mantiene sidebar/admin como lista plana. | Convertir en alias o home transitorio hacia `/admin/mission-control`. |
| `/dashboard` | Legacy neutral que mezcla jobs, filtros, tabla y accesos. | Alta | Rompe el modelo por rol y confunde ownership. | Redirect por rol o pagina de transicion. |
| `/admin/ai-mission-control` | Es runtime workspace mas que Mission Control ejecutivo. | Media-alta | AI requiere observabilidad profunda, pero no todo debe vivir en el nivel ejecutivo. | Separar AI health, AI workspace y AI context. |
| `/client/dashboard` | Home por rol con demasiadas listas y acciones cruzadas. | Media | Afecta claridad del cliente, pero el riesgo operativo es menor que admin/ops. | Convertir a Client OS Home con proximas acciones. |
| `/worker/dashboard` | Home operativo saturado de enlaces y summaries. | Media | El contractor necesita rapidez en campo; demasiadas opciones reducen foco. | Cambiar copy a Contractor OS y mover listas a workspaces. |
| `/admin/governance` | Expansion inline mezcla lista, detalle y decision. | Media | La decision governance requiere trazabilidad; el scroll inline puede ocultar contexto. | Mover proposal detail y voting a Context Panel. |
| `/buildops` | Buen workspace, pero presenta metricas y enlaces de muchas areas. | Media | Puede funcionar como hub, pero debe tener owner claro dentro de Operations OS. | Canonicalizar como `/ops/buildops`. |

## Benchmark de patrones aplicables a SEMSE

| Producto / guia | Patron observado | Aplicacion en SEMSE |
| --- | --- | --- |
| Jira / Atlassian | Global nav + project/sidebar contextual + issue detail. | `Mission Control` como global; `Operations/Client/Contractor OS` como contexto; detalle de job/payment/evidence en panel. |
| Asana | Portfolios para salud agregada; projects/tasks para ejecucion. | Mission Control no debe listar todos los jobs; debe enlazar a workspaces por dominio. |
| Linear | Views filtradas, board/list toggle, display options por workspace. | Workspaces SEMSE deben guardar filtros por rol: pending evidence, blocked payments, risk signals, open disputes. |
| ClickUp | Jerarquia explicita para escalar permisos y organizacion. | Registry canonico con `os`, `layer`, `roles`, `entityType` y `legacyHref`. |
| Material canonical layouts | List-detail y supporting panes. | `SemseContextPanel` para mantener contexto al seleccionar entidad. |
| Microsoft NavigationView | Navegacion adaptativa para muchas categorias. | Shell por OS y sidebar agrupado, no lista admin plana. |
| Baymard dashboard UX | Cards consistentes, headers claros, evitar dashboard como lista textual. | OS homes deben ser launchers accionables, no directorios de enlaces. |

## Companias comparables y como abordan el mismo problema

SEMSE cruza varias categorias de producto. No compite solo con un project manager generico: toca construccion, field service, marketplace de profesionales, pagos, evidencia, disputas y AI operations. Por eso el benchmark debe mirar companias de varios grupos.

### 1. Procore: Construction OS enterprise

Procore organiza la propuesta alrededor de una plataforma unificada para construccion: preconstruction, project management, workforce management, financial management y analytics. Sus docs muestran una separacion fuerte entre **portfolio/dashboard**, **project tools** y **items relacionados** como RFIs, documents, submittals, commitments y reports.

Patrones relevantes:

- Portfolio Financials usa dashboard como vista agregada de budget/schedule de muchos proyectos, no como detalle profundo de cada item.
- Los project tools separan dominios especificos: RFIs, Submittals, Drawings, Daily Log, Punch List, Documents, Financials.
- Los dashboards financieros permiten drill-down hacia assets/items concretos.
- `Related Items` conecta objetos entre herramientas sin obligar a mezclar todo en una sola pantalla.

Referencias:

- https://www.procore.com/
- https://support.procore.com/products/portfolio-financials/user-guide/dashboard
- https://support.procore.com/products/online/user-guide/company-level/reports/tutorials/view-the-financials-dashboard
- https://support.procore.com/faq/what-are-related-items-in-procore

Leccion para SEMSE:

- Copiar: separar portfolio/mission control de project tools y usar relaciones entre entidades.
- Evitar: volverse demasiado pesado para contractors pequenos; Procore es potente, pero puede sentirse caro y complejo para equipos chicos.
- Diferenciacion SEMSE: ofrecer mission control + escrow/evidence/AI en una experiencia mas accionable y menos enterprise-heavy.

### 2. Autodesk Construction Cloud: common data environment

Autodesk Construction Cloud se apoya en Autodesk Docs como **common data environment** que unifica documentos y workflows de Build, BIM Collaborate, Takeoff, Docs, Insight y Administration. La arquitectura se vende como plataforma conectada por datos comunes, con Insight/Construction IQ para riesgo y analytics.

Patrones relevantes:

- Un repositorio central de documentos como base para workflows.
- Separacion por ciclo de vida: Design, Plan, Build, Operate.
- Cost Management centraliza budgets, contracts, risk, forecasts y cash flow.
- Insight agrega analytics y AI/risk sobre datos recolectados.

Referencias:

- https://help.autodesk.com/cloudhelp/ENG/Docs-About-ACC/files/About_Autodesk_Construction_Cloud.html
- https://help.autodesk.com/cloudhelp/ENU/Docs-About-ACC/files/about-acc/About_Autodesk_Construction_Cloud_Build.html
- https://help.autodesk.com/cloudhelp/ENU/BIM360D-Cost-Management/files/BIM360D_Cost_Management_about_cost_management_html.html
- https://www.construction.autodesk.com/pricing/

Leccion para SEMSE:

- Copiar: common data layer para evidence/documents/payment readiness; Insight como capa agregada, no como lista operativa.
- Evitar: que cada producto tenga su propia navegacion aislada.
- Diferenciacion SEMSE: convertir evidence + escrow + AI recommendations en una cadena de decision mas directa que un simple repositorio documental.

### 3. Buildertrend: contractor/home builder OS con portal cliente y pagos

Buildertrend apunta a home builders, remodelers y specialty contractors. Su patron fuerte es conectar job management, schedule, client portal, invoices, payments, change orders y comunicacion.

Patrones relevantes:

- Client Portal como lugar donde el cliente ve proyecto, schedule, fotos, invoices y puede pagar.
- Los pagos estan conectados al job, invoices, budgets, purchase orders y schedules.
- El flujo de pago puede ocurrir por portal o por link de invoice email.
- La visibilidad de pago se rastrea por reportes/transacciones.

Referencias:

- https://buildertrend.com/find-your-plan/
- https://buildertrend.com/communication/construction-client-portal/
- https://buildertrend.com/payment-processing/
- https://buildertrend.com/help-article/buildertrend-payments-receiving-client-payments/

Leccion para SEMSE:

- Copiar: Client OS debe mostrar "que falta para mover el proyecto": approvals, payments, schedule, photos/evidence.
- Evitar: esconder decisiones importantes en emails o portales desconectados.
- Diferenciacion SEMSE: usar escrow, milestone evidence y dispute readiness como ventaja sobre invoice/payment simple.

### 4. Houzz Pro: client dashboard como single source of truth

Houzz Pro combina marketplace/inspiration con software para profesionales. En client dashboard enfatiza comunicacion, archivos, fotos, daily logs, financials, approvals, invoices y project schedule.

Patrones relevantes:

- Cliente ve outstanding invoices, approvals y recordatorios.
- Daily logs y photos dan transparencia sin obligar al cliente a navegar herramientas internas.
- Financials agrupa estimates, proposals, invoices, variation orders y contracts.
- El dashboard se puede compartir por link/email.

Referencias:

- https://pro.houzz.com/for-pros/feature-client-dashboards
- https://www.houzz.co.uk/for-pros/feature-client-dashboards
- https://www.houzz.com.au/pro-help/r/how-to-use-your-project-dashboard-for-clients
- https://www.houzz.com.au/pro-help/r/how-to-preview-and-share-the-client-dashboard

Leccion para SEMSE:

- Copiar: Client OS Home debe ser un estado de proyecto entendible: schedule, evidence/photos, approvals, balance/payments, messages.
- Evitar: mostrar al cliente complejidad interna de ops, AI runtime o governance.
- Diferenciacion SEMSE: convertir el dashboard cliente en "approval cockpit" para milestones, change orders y escrow release.

### 5. Jobber: field service lifecycle simple

Jobber se concentra en field service para pequenos y medianos negocios: request, quote, schedule, job, invoice, payment y client hub. Su fuerza es reducir friccion operativa, especialmente en mobile y portal cliente.

Patrones relevantes:

- Client Hub permite request work, approve quotes, view appointment details y make payments.
- El flujo quote -> schedule -> invoice -> pay esta muy claro.
- La app de campo se centra en detalles de job, fotos, forms, time y pagos.
- Mobile-friendly y acceso por links reduce friccion para clientes.

Referencias:

- https://www.getjobber.com/features/client-hub/
- https://help.getjobber.com/hc/en-us/articles/1500011237822-What-Do-Your-Clients-See-in-Client-Hub-
- https://www.getjobber.com/features/field-service-management-software/

Leccion para SEMSE:

- Copiar: Contractor OS debe priorizar rapidez: today's work, required evidence, next appointment/task, collect/confirm payment state.
- Evitar: forzar al field user a navegar dashboards complejos.
- Diferenciacion SEMSE: unir field execution con evidence quality checks, escrow readiness y AI assistance.

### 6. ServiceTitan: field service enterprise con dispatch, audit trail y portal

ServiceTitan opera en field service mas enterprise: CRM, dispatch, invoices, customer portal, payments, memberships/contracts y appointment scheduler.

Patrones relevantes:

- Customer Portal centraliza unpaid invoices, service history, appointment requests y payments.
- Los pagos en portal quedan visibles en el job audit trail.
- Modulos del portal: invoices, memberships/contracts, appointment scheduler.
- La configuracion del portal esta separada de la operacion diaria.

Referencias:

- https://help.servicetitan.com/docs/customer-portal-overview
- https://help.servicetitan.com/v1/docs/customer-portal-overview

Leccion para SEMSE:

- Copiar: cada accion financiera importante debe dejar audit trail visible desde el job/project.
- Evitar: que configuracion/admin contamine la experiencia diaria del tecnico o cliente.
- Diferenciacion SEMSE: usar audit trace + evidence + AI recommendation como parte del contexto de decision, no solo como log historico.

### 7. Thumbtack y Angi: marketplace/leads, no project operating system completo

Thumbtack y Angi se enfocan en matching/leads entre clientes y profesionales. Son relevantes para SEMSE por marketplace, contractor acquisition y trust, pero no resuelven igual de bien la ejecucion post-hire.

Patrones relevantes:

- Thumbtack Pro enfatiza leads, presupuesto/control de leads, customer intent y competition limits.
- Angi enfatiza comparar quotes, gestionar proyectos, deals, reviews y comunicacion con pros.
- Ambos separan claramente marketplace/acquisition de project operations.
- La friccion recurrente reportada por contractors en foros se concentra en calidad/costo de leads, refunds, competencia y transparencia.

Referencias:

- https://www.thumbtack.com/pro
- https://www.thumbtack.com/pro-basics/
- https://www.angi.com/app
- https://ir.angi.com/node/13051/pdf

Leccion para SEMSE:

- Copiar: Marketplace OS debe tener leads/opportunities, matching, profile, reputation y quote/proposal flow.
- Evitar: que el negocio dependa solo de vender leads; eso genera desconfianza si no hay calidad verificable.
- Diferenciacion SEMSE: cerrar el loop completo: lead -> proposal -> milestone -> evidence -> escrow release -> review/trust signal.

## Sintesis competitiva

| Categoria | Companias | Como estructuran el producto | Que debe aprender SEMSE |
| --- | --- | --- | --- |
| Construction enterprise | Procore, Autodesk Construction Cloud | Portfolio/dashboard, project tools, docs, cost, field, analytics. | Separar estado agregado de herramientas por dominio; usar data/evidence comun. |
| Contractor/client portal | Buildertrend, Houzz Pro | Job/project dashboard, schedule, photos, invoices, approvals, payments. | Client OS debe mostrar proximas aprobaciones, pagos, evidencia y progreso. |
| Field service | Jobber, ServiceTitan | Request/quote/schedule/job/invoice/pay, dispatch, mobile field app, customer portal. | Contractor OS debe ser rapido, mobile-friendly y orientado a tareas/evidence. |
| Marketplace/leads | Thumbtack, Angi | Leads, matching, quotes, reviews, pro profiles. | Marketplace OS debe estar separado de Operations OS y debe proteger trust/calidad. |
| Work/project management | Jira, Asana, Linear, ClickUp | Jerarquia, views, filters, project/task detail, saved views. | Workspaces SEMSE necesitan filtros persistentes, views y context panel. |

## Implicacion estrategica para SEMSE

La oportunidad de SEMSE no es copiar una sola plataforma. La oportunidad es unir lo que hoy aparece fragmentado:

```txt
Marketplace lead
  -> qualified intake
  -> proposal / bid
  -> job / project
  -> milestone
  -> field evidence
  -> AI quality/risk check
  -> escrow/payment readiness
  -> approval / dispute / release
  -> review / trust signal
```

Para que esa cadena no se vuelva caotica, la navegacion debe separar:

- **Marketplace OS**: conseguir y calificar trabajo.
- **Client OS**: aprobar, pagar, revisar progreso y resolver excepciones.
- **Contractor OS**: ejecutar, documentar y cobrar.
- **Operations OS**: monitorear riesgo, evidencia, pagos, disputes y runtime.
- **AI Mission Control**: observar salud de AI, routing, RAG, Prometeo y traces.
- **Mission Control**: ver el estado agregado y saltar al workspace correcto.

Esto refuerza la recomendacion original: SEMSE necesita menos "pantallas sueltas" y mas sistema operativo de trabajo por rol/dominio.

## Propuesta de innovacion: SEMSE como Exception-First Work OS

La mayoria de competidores organizan el trabajo por modulos: proyectos, documentos, costos, agenda, invoices, leads o RFIs. SEMSE puede diferenciarse organizando la experiencia por **excepciones accionables** y por **estado de confianza del trabajo**.

Tesis:

```txt
Los usuarios no entran a SEMSE para ver todo.
Entran para saber que esta bloqueado, que pueden aprobar,
que deben documentar, que se puede cobrar y que necesita intervencion.
```

Esto convierte a SEMSE en un `Exception-First Work OS`: un sistema donde Mission Control prioriza excepciones, los Workspaces resuelven colas y el Context Panel explica por que una accion es segura, riesgosa o bloqueada.

### Diferenciador 1: Work Graph en lugar de menu

Crear un grafo operativo que conecte entidades:

```txt
Lead
  -> Proposal
  -> Job / Project
  -> Milestone
  -> Task
  -> Evidence
  -> Payment / Escrow
  -> Dispute / Change Order
  -> Review / Trust Signal
  -> Agent Trace / Audit Event
```

Cada pantalla debe poder mostrar "related work" desde el Context Panel:

- Job relacionado con milestones, evidence, payments, disputes y messages.
- Evidence relacionada con requirement, milestone, worker, AI quality check y payment readiness.
- Payment relacionado con invoice, escrow state, approvals, evidence checklist y audit trail.
- Runtime trace relacionado con user action, API event, agent run y affected entity.

Innovacion concreta:

- `Related Work Graph` dentro del Context Panel.
- Deep links a cualquier nodo del grafo.
- Timeline unificada por entidad, no timelines aisladas por modulo.

### Diferenciador 2: Navigation by Next Best Action

En vez de que el usuario navegue por menus largos, SEMSE debe proponer el siguiente paso segun rol y estado:

| Rol | Next Best Action |
| --- | --- |
| Cliente | Approve milestone, request changes, fund escrow, review evidence, respond to dispute. |
| Contractor | Upload missing evidence, accept job, submit change order, confirm material, mark task complete. |
| Operador | Resolve risk signal, approve payment release, inspect trace, requeue failed run, escalate dispute. |
| AI engineer | Investigate provider degradation, inspect prompt/run, replay RAG context, tune routing. |

Innovacion concreta:

- `NextActionRail`: una barra lateral o top strip con 3-5 acciones priorizadas.
- Cada accion tiene `reason`, `risk`, `deadline`, `moneyImpact` y `confidence`.
- Mission Control muestra acciones agregadas; Workspace muestra acciones por cola; Context Panel ejecuta la accion.

### Diferenciador 3: Trust Ledger visible

Procore y Autodesk manejan registros y auditoria; marketplaces manejan ratings. SEMSE puede unir ambos en un `Trust Ledger` operacional:

```txt
Evidence submitted
  -> AI quality check
  -> Client approval
  -> Escrow release
  -> Dispute outcome
  -> Review impact
  -> Contractor trust score
```

El Trust Ledger no debe ser solo un score. Debe explicar que eventos subieron o bajaron la confianza:

- Evidencia completa a tiempo.
- Rechazos por baja calidad.
- Disputas abiertas/cerradas.
- Cambios aprobados.
- Pagos liberados sin disputa.
- Rework o incidentes.
- Agent confidence y overrides humanos.

Innovacion concreta:

- Tab `Trust` en Context Panel para job, contractor, client y evidence.
- `Why this trust score?` con eventos trazables.
- Trust signals como input para matching, risk y escrow readiness.

### Diferenciador 4: Escrow Readiness Engine

Los competidores suelen mostrar invoices/payments. SEMSE puede mostrar si un pago esta **listo para liberarse**:

```txt
Escrow readiness =
  milestone status
  + required evidence completeness
  + AI evidence quality
  + client approval state
  + dispute state
  + compliance checks
  + trust/risk signals
```

Innovacion concreta:

- Badge unico: `Ready`, `Blocked`, `Needs Review`, `Disputed`, `Release Recommended`.
- Checklist explicable dentro del Context Panel.
- Boton de accion solo aparece cuando readiness permite actuar.
- Prometeo puede recomendar, pero no ejecutar liberaciones sensibles sin control humano.

### Diferenciador 5: AI como operador contextual, no como pagina separada

AI no debe vivir solo en `/admin/ai-mission-control`. Debe aparecer donde ayuda a decidir:

- En evidence: calidad, completitud, duplicados, inconsistencias.
- En payments: readiness, riesgo, missing approvals.
- En disputes: resumen de hechos, timeline, evidencia contradictoria.
- En ops: causa probable, run replay, retry recommendation.
- En marketplace: fit entre proyecto, contractor, disponibilidad y trust.

Innovacion concreta:

- `Prometeo Brief` embebido en Context Panel.
- `AI Confidence + Human Override` visible en decisiones sensibles.
- `Explain decision inputs` antes de aprobar/rechazar/release.
- `Replay this recommendation` para auditoria AI.

### Diferenciador 6: Role Lenses sobre la misma entidad

La entidad `Job` no debe duplicarse por rol. Debe tener lentes:

```txt
Job canonical entity
├── Client lens: progress, approvals, payments, messages
├── Contractor lens: tasks, evidence, materials, field notes
├── Operator lens: risk, SLA, disputes, escrow, audit
└── AI lens: signals, recommendations, traces, confidence
```

Innovacion concreta:

- Rutas canonicas pueden cambiar de lens sin duplicar entidad.
- Context Panel usa el mismo `entityId`, pero cambia tabs/acciones por rol.
- Permite compartir deep links seguros: el mismo job abre distinta vista segun permisos.

### Diferenciador 7: Command Palette operacional

Para usuarios expertos, un sidebar agrupado no basta. SEMSE debe tener una command palette:

```txt
Open job 123
Show blocked payments
Upload evidence for milestone X
Find traces for correlationId Y
Approve proposal Z
Show contractors at risk
```

Innovacion concreta:

- `Cmd/Ctrl+K` para navegar por OS, workspace, entidad y accion.
- Acciones filtradas por rol/RBAC.
- Resultados agrupados por `Go to`, `Open entity`, `Run action`, `Ask Prometeo`.
- La palette usa el mismo `navigation-registry.ts`.

### Diferenciador 8: Exception Queues

Crear colas canonicas de excepcion, no solo listas por entidad:

| Queue | Owner | Incluye |
| --- | --- | --- |
| `Blocked Payments` | Operations / Finance | escrow bloqueado, evidence faltante, approvals vencidos, disputes. |
| `Evidence Needs Review` | Ops / Client / Contractor | baja confianza AI, foto incompleta, requirement faltante. |
| `At-Risk Jobs` | Operations | SLA, cost overrun, no-show, material delay, dispute risk. |
| `Client Waiting` | Client Success | aprobaciones, mensajes sin respuesta, payments pendientes. |
| `Contractor Action Required` | Contractor OS | tareas vencidas, evidence, change orders, materials. |
| `AI Runtime Exceptions` | AI / Ops | failed runs, degraded provider, low-confidence routing, RAG misses. |

Innovacion concreta:

- Mission Control muestra conteos y severidad por queue.
- Workspace abre la queue.
- Context Panel resuelve item por item.

### Diferenciador 9: Decision Receipts

Cada decision sensible debe producir un recibo auditable:

```txt
Decision Receipt
├── who decided
├── what changed
├── evidence reviewed
├── AI recommendation shown
├── risk/confidence at decision time
├── money impact
├── affected entities
└── rollback/escalation path
```

Innovacion concreta:

- Al aprobar milestone, liberar escrow, rechazar evidencia o resolver disputa, SEMSE genera receipt.
- Receipts aparecen en Trust Ledger y Audit Timeline.
- Prometeo puede resumir receipts para cliente, contractor y admin con copy segun rol.

### Diferenciador 10: Progressive Autonomy

SEMSE ya tiene runtime de agentes. La navegacion debe preparar el producto para autonomia gradual:

| Nivel | AI puede | Humano debe |
| --- | --- | --- |
| L0 Observe | resumir, detectar, sugerir | decidir todo |
| L1 Draft | redactar respuestas, preparar checklist | aprobar envio/accion |
| L2 Assisted Action | ejecutar acciones reversibles | confirmar acciones sensibles |
| L3 Policy-Bound | resolver casos de bajo riesgo bajo reglas | auditar excepciones |
| L4 Autonomous Ops | operar colas acotadas | gobernar politicas y overrides |

Innovacion concreta:

- Cada Context Panel muestra `Autonomy Level`.
- Cada accion declara si es `suggest`, `draft`, `execute with approval` o `auto-execute`.
- Governance OS administra politicas de autonomia por dominio.

## Vision de producto: la pantalla ideal

La version innovadora de SEMSE no empieza con un menu. Empieza con una respuesta:

```txt
Today in SEMSE
├── 7 payments can be released safely
├── 3 milestones need client approval
├── 5 evidence items block escrow
├── 2 contractors show rising dispute risk
├── 1 AI provider degraded routing quality
└── Prometeo recommends 4 actions with high confidence
```

Al hacer click:

```txt
Mission Control signal
  -> Exception Queue workspace
  -> Context Panel with entity graph
  -> Prometeo brief + readiness checklist
  -> human action
  -> decision receipt
  -> Trust Ledger update
```

Esta es la innovacion central: SEMSE debe navegar por **estado, riesgo, dinero y confianza**, no solo por modulos.

## Experimentos de producto recomendados

| Experimento | Hipotesis | Implementacion pequena | Senal de exito |
| --- | --- | --- | --- |
| `Blocked Payments Queue` | Finanzas/ops resuelve mas rapido si ve bloqueos por readiness. | Vista filtrada sobre payments/evidence/disputes. | Menor tiempo de release y menos clicks por pago. |
| `Evidence Context Panel` | El detalle lateral reduce perdida de contexto. | Aplicar panel a `/admin/ops` o evidence queue. | Mas acciones completadas desde la misma pantalla. |
| `Prometeo Brief in Milestone` | Cliente aprueba mas rapido si ve resumen claro de evidencia. | Brief no-autonomo en milestone detail. | Menor tiempo de aprobacion. |
| `Decision Receipt` | Auditoria mejora confianza en releases/disputes. | Receipt markdown/json por approval/reject/release. | Menos ambiguedad en disputas y soporte. |
| `Command Palette` | Usuarios expertos navegan mas rapido que con sidebar. | Buscar rutas registry + entity search basica. | Uso recurrente por admins/operators. |
| `Trust Ledger` | Trust explicable mejora matching y resolucion de conflictos. | Timeline de trust events por contractor/job. | Menos decisiones manuales sin contexto. |

## Roadmap innovador por releases

### Release A: Claridad y control

- Registry canonico.
- Sidebar por OS.
- Mission Control exception-first.
- `/admin/ops` con Context Panel.
- Aliases legacy.

### Release B: Decision intelligence

- Escrow Readiness Engine.
- Evidence quality checklist.
- Prometeo Brief embebido.
- Decision Receipts.
- Instrumentacion de next actions.

### Release C: Trust y marketplace cerrado

- Trust Ledger.
- Matching con trust/risk/evidence history.
- Marketplace OS conectado a execution history.
- Client/Contractor role lenses sobre job canonico.

### Release D: Progressive autonomy

- Autonomy levels por dominio.
- AI actions con approval gates.
- Governance policies para agentes.
- Replay/audit de recomendaciones AI.

## Principios de diseno resultantes

1. **Una pantalla, una pregunta principal.** Si una pantalla responde "como esta el sistema?", "que lista trabajo?" y "que hago con este item?" al mismo tiempo, esta mezclando capas.
2. **La navegacion primaria debe ser pequena.** El sidebar principal debe mostrar OS o dominios mayores; las rutas especificas viven dentro del workspace correspondiente.
3. **El detalle no debe destruir el contexto.** Seleccionar un job, proposal, event trace o payment debe abrir un Context Panel o una ruta de detalle con retorno evidente.
4. **Los dashboards no son work queues.** Pueden mostrar estado, riesgos y proximas acciones, pero no deben convertirse en tablas operativas largas.
5. **Los workspaces son para operar.** Deben tener filtros, tabs, board/list donde aplique, bulk actions y estado de seleccion.
6. **Las acciones deben vivir cerca del objeto.** Approve/reject/retry/requeue/dispute/request changes pertenecen al Context Panel del objeto concreto.
7. **Los roles cambian perspectiva, no duplican dominio.** Job, evidence y payment pueden aparecer para admin, client y contractor, pero deben compartir entidad canonica y cambiar permisos/copy.
8. **AI debe tener dos niveles.** Salud ejecutiva de AI en Mission Control; logs, prompts, provider, RAG context y traces en AI Workspace/Context Panel.
9. **La migracion debe ser reversible.** Primero registry y aliases; despues shell; despues mover contenido.
10. **La telemetria decide deprecaciones.** No retirar rutas legacy hasta medir uso real y completar redirects.

## Modelo de informacion recomendado

```txt
OS
├── layer: mission-control | workspace | context
├── role perspective: admin | client | contractor | operator | ai-engineer
├── domain: jobs | projects | evidence | payments | disputes | governance | ai | runtime
├── entity: job | project | milestone | evidenceItem | payment | proposal | trace | worker
└── action: approve | reject | assign | retry | requeue | resolve | dispute | requestChanges
```

Este modelo debe alimentar:

- Sidebar.
- Breadcrumbs.
- Page titles.
- RBAC route checks.
- Analytics events.
- Command palette futura.
- Deep links hacia Context Panel.

## Reglas concretas para contenido por capa

### Mission Control

- Maximo 5-7 dominios visibles.
- Top signals limitados a 3 por dominio.
- Sin payload JSON, tablas largas ni formularios.
- Cada card debe tener un destino de workspace.
- KPIs con estado, tendencia y umbral, no solo numeros.

### Workspace

- Lista, board o queue como superficie principal.
- Filtros persistentes por usuario/rol.
- Empty state con accion primaria.
- Bulk action solo cuando el dominio lo justifique.
- Seleccion de item abre Context Panel.

### Context Panel

- Header con identidad del objeto, estado y prioridad.
- Tabs consistentes: Summary, Timeline, Evidence, Money, AI/Risk, Actions, Audit.
- Acciones destructivas o financieras con confirmacion explicita.
- Deep link opcional para abrir detalle full-page si el objeto lo requiere.
- El panel debe poder cerrarse sin perder filtros del workspace.

## Instrumentacion recomendada

Para validar que la nueva navegacion mejora el producto:

| Evento | Cuando se dispara | Uso |
| --- | --- | --- |
| `nav.os_opened` | Usuario entra a un OS. | Medir adopcion de Client/Contractor/Operations/AI/Governance. |
| `nav.workspace_opened` | Usuario entra a workspace canonico. | Detectar workspaces reales vs rutas legacy. |
| `context_panel.opened` | Usuario selecciona entidad. | Medir si el panel reemplaza detalle inline. |
| `context_panel.action_completed` | Usuario completa accion. | Medir accionabilidad por entidad. |
| `legacy_route.visited` | Usuario entra por ruta antigua. | Decidir cuando retirar alias. |
| `mission_control.signal_clicked` | Usuario abre una senal desde Mission Control. | Validar que Mission Control dirige al trabajo correcto. |
| `workspace.filter_changed` | Usuario cambia filtros. | Identificar filtros que deberian ser defaults. |

## Definition of Done de la migracion

La migracion de navegacion se considera profesionalmente completa cuando:

1. Cada ruta visible tiene `layer`, `os`, `roles`, `canonicalHref` y `legacyHref` si aplica.
2. El sidebar admin ya no muestra mas de 7 grupos top-level.
3. `/admin/mission-control` no contiene tablas largas ni payloads.
4. `/admin/ops` usa layout de workspace con Context Panel para trace/event/run.
5. Client OS y Contractor OS tienen homes orientados a proxima accion.
6. AI tiene separacion entre health ejecutivo y runtime/debug workspace.
7. Rutas legacy siguen funcionando mediante aliases/redirects.
8. Existe test de registry para evitar rutas visibles sin owner.
9. Existe telemetria basica de ruta legacy, workspace y context panel.
10. La documentacion de arquitectura refleja el mapa canonico nuevo.

## Evidencia principal en codigo

### Navegacion por rol

Archivo: `apps/web/app/(app)/layout.tsx`

La app ya distingue roles por prefijo:

- `/admin/*` -> admin
- `/worker/*` -> worker/profesional
- `/client/*` -> client
- rutas neutrales como `/agents`, `/buildops`, `/tools` dependen del contexto visual o cookie de rol.

`packages/auth/src/rbac.ts` confirma el mismo modelo con `defaultDashboardForRole`:

- admin -> `/admin/dashboard`
- worker -> `/worker/dashboard`
- client -> `/client/dashboard`

Problema: el sidebar `admin` contiene mas de 30 entradas y mezcla control ejecutivo, operaciones, negocio, IA, laboratorio y configuracion en un unico menu. El resultado es una navegacion plana para un sistema que ya es modular.

### Dashboard global legado

Archivo: `apps/web/app/dashboard/dashboard-client.tsx`

La ruta `/dashboard` mezcla:

- metricas de jobs
- accesos rapidos
- filtros
- tabla de jobs recientes
- links directos a detalle y escrow

Esto confirma que el dashboard intenta ser Mission Control, workspace de jobs y launcher de acciones al mismo tiempo.

### Admin Dashboard

Archivo: `apps/web/app/(app)/admin/dashboard/page.tsx`

Mezcla:

- metricas de operacion
- alertas
- gestion rapida
- enlaces a casi todos los modulos admin

Debe evolucionar a Mission Control o ser reemplazado por `/admin/mission-control` como pantalla inicial de admin.

### Mission Control

Archivo: `apps/web/app/(app)/admin/mission-control/page.tsx`

Es la pantalla mas cercana al modelo correcto. Ya separa:

- salud operacional
- Prometeo Brief
- resumen ejecutivo
- feed de senales
- intelligence runs recientes
- link explicito hacia AI Mission Control

Problema: todavia muestra feed/listado de senales y runs dentro de Mission Control. Eso puede quedarse temporalmente, pero el destino ideal es que Mission Control muestre indicadores y enlaces a workspaces de `Operations`, `Risk`, `Evidence`, `Payments`, `AI`.

### Operations

Archivo: `apps/web/app/(app)/admin/ops/page.tsx`

Mezcla:

- metricas runtime
- filtros
- listas de domain events
- detalle de event trace
- payload JSON
- timeline
- acciones de retry/requeue/incidente
- pending approvals

Esta pagina es funcionalmente valiosa, pero esta haciendo Workspace y Context Panel al mismo tiempo. Debe convertirse en `Operations OS` con una vista de colas/categorias y un panel contextual para correlationId, event trace o agent run.

### BuildOps

Archivo: `apps/web/app/(app)/buildops/page.tsx`

Mezcla:

- metricas de proyectos, estimates, tasks, milestones, evidence y risk
- actividad reciente
- acciones rapidas
- enlaces hacia `/buildops/projects`, `/buildops/tasks`, `/buildops/milestones`, `/tools`, `/admin/ops`

Es un Workspace claro, no un dashboard ejecutivo. Debe vivir como `Operations OS / BuildOps` o `Contractor OS / Projects`, segun rol.

### Client Dashboard

Archivo: `apps/web/app/(app)/client/dashboard/page.tsx`

Mezcla:

- metricas de cliente
- trabajos recientes
- objetivos de contratacion
- acciones rapidas
- pagos, propuestas, disputas y milestones

Debe convertirse en `Client OS Home`: categorias y proximo paso, no lista extensa ni detalle.

### Worker / Contractor Dashboard

Archivo: `apps/web/app/(app)/worker/dashboard/page.tsx`

Mezcla:

- metricas de trabajos
- evidencia pendiente
- resumen operativo
- acciones rapidas
- links a tracker, evidence, materials, incidents, payments, travel, field ops, opportunities

Debe convertirse en `Contractor OS Home`. La semantica publica deberia hablar de Contractor/Professional OS, aunque internamente el prefijo `/worker` puede mantenerse por compatibilidad.

### AI Mission Control

Archivo: `apps/web/app/(app)/admin/ai-mission-control/page.tsx`

Es un workspace de AI runtime mas que Mission Control puro:

- metricas AI
- success rate
- postura
- modelo dominante
- routing
- stability alerts
- incident feed
- operational context
- observer panel

Debe dividirse en:

- `AI Mission Control`: salud ejecutiva de AI.
- `AI Workspace`: Prometeo, RAG, Router, Observer, Evolution.
- `AI Context Panel`: log, incident, provider, prompt, trace.

### Governance

Archivo: `apps/web/app/(app)/admin/governance/page.tsx`

Governance ya se comporta como workspace + context local:

- lista de proposals
- expansion inline de proposal
- tally
- votos
- MCA advice
- modal de creacion

Debe mantenerse como Workspace, pero mover detalle expandido a Context Panel para consistencia y menor scroll.

## Mapa actual de navegacion

```txt
Public
├── /
├── /login
├── /register
├── /privacy
├── /terms
└── /data-deletion

Legacy / neutral
├── /dashboard
├── /jobs
├── /jobs/new
├── /jobs/:jobId
├── /jobs/:jobId/escrow
├── /jobs/:jobId/evidence
├── /field-ops
├── /communications
├── /cortex
├── /agents
├── /knowledge
├── /runtime-map
├── /repo-map
└── /semse-consciousness-map

Client
├── /client/dashboard
├── /client/leads
├── /client/jobs
├── /client/jobs/new
├── /client/jobs/:jobId
├── /client/projects
├── /client/milestones
├── /client/professionals
├── /client/marketplace
├── /client/bids
├── /client/proposals
├── /client/protools
├── /client/documents
├── /client/reviews
├── /client/payments
├── /client/finance
├── /client/finance/invoices/:id
├── /client/change-orders
└── /client/disputes

Worker / Contractor
├── /worker/dashboard
├── /worker/agenda
├── /worker/jobs
├── /worker/jobs/:jobId
├── /worker/tasks
├── /worker/tracker
├── /worker/evidence
├── /worker/materials
├── /worker/incidents
├── /worker/payments
├── /worker/travel
├── /worker/travel/:travelId
├── /worker/field-ops
├── /worker/opportunities
├── /worker/profile
├── /worker/rates
├── /worker/review
└── /worker/settings

BuildOps
├── /buildops
├── /buildops/projects
├── /buildops/projects/new
├── /buildops/projects/:projectId
├── /buildops/tasks
├── /buildops/tasks/new
├── /buildops/tasks/:taskId
└── /buildops/milestones

Tools
├── /tools
├── /tools/dashboard
├── /tools/project-manager
└── /tools/:trade
    └── /tools/:trade/:section

Admin
├── /admin/dashboard
├── /admin/mission-control
├── /admin/ops
├── /admin/contractors
├── /admin/marketplace
├── /admin/trust
├── /admin/worker
├── /admin/autonomy
├── /admin/developer-runtime
├── /admin/communications
├── /admin/domain-events
├── /admin/users
├── /admin/users/:id
├── /admin/disputes
├── /admin/qa
├── /admin/compliance
├── /admin/finance
├── /admin/travel
├── /admin/travel/:travelId
├── /admin/reports
├── /admin/field-ops
├── /admin/settings
├── /admin/html-in-canvas
├── /admin/coordinator
├── /admin/algorithm-engine
├── /admin/ai-mission-control
├── /admin/agents
├── /admin/consciousness
├── /admin/ecosystem
├── /admin/llm-metrics
├── /admin/pmo
├── /admin/semse-x
├── /admin/memory
├── /admin/prometeo
├── /admin/governance
└── /admin/intelligence-rooms/:id
```

## Redundancias y duplicaciones

### Dashboards que compiten

- `/dashboard`: dashboard legado de jobs.
- `/admin/dashboard`: panel de operaciones.
- `/admin/mission-control`: verdadero Mission Control operacional.
- `/client/dashboard`: home del Client OS.
- `/worker/dashboard`: home del Contractor OS.
- `/tools/dashboard`: hub de herramientas.
- `/cortex`, `/admin/consciousness`, `/semse-consciousness-map`: superficies cercanas de sistema/observer.
- `/admin/ai-mission-control`, `/admin/llm-metrics`, `/admin/prometeo`, `/admin/memory`: superficies AI/RAG parcialmente solapadas.

Decision recomendada:

- Mantener dashboards por rol solo como OS homes.
- Declarar `/admin/mission-control` como Mission Control ejecutivo.
- Convertir `/dashboard` en alias/redirect por rol o retirar del header global.

### Conceptos repetidos en varias rutas

- Jobs aparecen en `/`, `/jobs`, `/client/jobs`, `/worker/jobs`, `/admin/ops`, `/dashboard`.
- Projects aparecen como `/client/projects`, `/buildops/projects`, `/admin/pmo`, `/admin/intelligence-rooms`.
- Evidence aparece en `/jobs/:id/evidence`, `/worker/evidence`, `/buildops`, `/admin/mission-control`, milestones detail.
- Payments/escrow aparecen en `/jobs/:id/escrow`, `/client/payments`, `/client/finance`, `/worker/payments`, `/admin/finance`, `payment-governance`.
- Risk/trust aparecen en `/admin/mission-control`, `/admin/ops`, `/admin/trust`, `/admin/ai-mission-control`, `/admin/consciousness`.
- AI aparece en `/agents`, `/admin/agents`, `/admin/ai-mission-control`, `/admin/llm-metrics`, `/admin/prometeo`, `/admin/memory`, `/admin/coordinator`, `/admin/developer-runtime`.

### Panels que mezclan resumen y detalle

- `/admin/ops`: listas + trace + payload + timeline + runtime actions.
- `/admin/governance`: lista + detalle expandido + voting + create modal.
- `/client/dashboard`: metricas + lista de jobs + quick actions.
- `/worker/dashboard`: metricas + evidence summary + quick actions + operational summary.
- `/admin/ai-mission-control`: metricas + alertas + incident feed + operational context + logs/routing.

## Mapa propuesto

```txt
SEMSE OS
├── Mission Control
│   ├── Operational Health
│   ├── Revenue / Escrow
│   ├── Risk / Trust
│   ├── Evidence / Payments
│   ├── AI / Prometeo
│   └── Governance
│
├── Client OS
│   ├── Jobs
│   ├── Projects
│   ├── Milestones
│   ├── Payments
│   ├── Documents
│   ├── Professionals
│   └── Messages
│
├── Contractor OS
│   ├── Opportunities
│   ├── Projects
│   ├── Tasks
│   ├── Evidence
│   ├── Materials
│   ├── Field Ops
│   ├── Change Orders
│   ├── Payments
│   └── Travel
│
├── Operations OS
│   ├── Monitoring
│   ├── BuildOps
│   ├── Risk
│   ├── Evidence Review
│   ├── Payments Governance
│   ├── Disputes
│   ├── Field Ops
│   ├── Trust
│   └── Observer
│
├── Marketplace OS
│   ├── Leads
│   ├── Matching
│   ├── Professionals
│   ├── Bids / Proposals
│   └── Reputation
│
├── Governance OS
│   ├── Proposals
│   ├── Voting
│   ├── Policy
│   └── MCA Advice
│
└── AI Mission Control
    ├── Prometeo
    ├── RAG
    ├── Router
    ├── Providers
    ├── Observer
    ├── Memory
    ├── Agents
    └── Evolution
```

## Rutas propuestas sin romper compatibilidad

La migracion debe introducir rutas canonicas nuevas y dejar las rutas actuales como aliases durante varias versiones.

```txt
/admin/mission-control                  -> Mission Control canonico
/client/dashboard                       -> /client/os
/worker/dashboard                       -> /contractor/os o alias visual Contractor OS
/buildops                               -> /ops/buildops
/admin/ops                              -> /ops/monitoring
/admin/governance                       -> /governance/proposals
/admin/ai-mission-control               -> /ai/mission-control
/admin/prometeo                         -> /ai/prometeo
/admin/llm-metrics                      -> /ai/router
/admin/memory                           -> /ai/memory
/admin/consciousness                    -> /ops/observer
/admin/marketplace + /client/marketplace -> /marketplace, con perspectiva por rol
```

Compatibilidad minima:

- No borrar rutas existentes.
- Mantener redirects o rewrites desde rutas antiguas.
- Mantener `defaultDashboardForRole` hasta que la nueva shell este estable.
- Agregar un registry de navegacion canonica antes de mover archivos fisicamente.

## Contrato operativo por capa

Esta tabla debe usarse como gate de arquitectura antes de aprobar nuevas pantallas o migraciones.

| Capa | Pregunta que responde | Superficie permitida | Prohibido | Ejemplos SEMSE |
| --- | --- | --- | --- | --- |
| Mission Control | Que requiere atencion ahora? | KPIs, estado, top signals, links a workspaces. | Tablas largas, payload JSON, formularios, detalle por entidad. | `/admin/mission-control`, futuro `/ai/mission-control`. |
| Workspace | Donde trabajo esta cola/categoria? | Listas, tabs, filtros, board/list, bulk actions moderadas. | Timeline completa, payload crudo, decisiones financieras profundas inline. | `/ops/buildops`, `/ops/monitoring`, `/client/jobs`, `/worker/evidence`. |
| Context Panel | Que hago con este objeto? | Summary, Timeline, Evidence, Money, AI/Risk, Audit, Actions. | Navegacion global, listas largas no relacionadas, KPIs agregados del sistema. | Job, milestone, evidence item, payment, proposal, runtime trace. |

Estructura estandar del Context Panel:

```txt
Context Panel
├── Header: entidad, estado, prioridad, owner
├── Summary: datos minimos para decidir
├── Timeline: eventos importantes
├── Evidence: documentos, fotos, checklist, calidad
├── Money: escrow, payment readiness, invoices, change orders
├── AI/Risk: recomendacion, confianza, blockers
├── Audit: actor, timestamp, correlationId, payload si aplica
└── Actions: approve, reject, request changes, retry, requeue, resolve, dispute
```

Regla de layout:

```txt
Workspace
├── Toolbar / filtros / tabs
├── Queue o list principal
└── Context Panel persistente cuando hay seleccion
```

Si una pantalla necesita mostrar dos entidades relacionadas, el Context Panel debe tener tabs o subpanels; no debe duplicar otra tabla completa dentro del detalle.

## Flujos de usuario propuestos

### Admin resuelve riesgo operacional

```txt
Mission Control
  -> card "Risk / Payment blocked"
  -> Operations OS / Risk workspace
  -> selecciona signal
  -> Context Panel
      -> evidencia asociada
      -> payment readiness
      -> Prometeo recommendation
      -> acknowledge / resolve / open dispute
```

### Cliente aprueba milestone

```txt
Client OS
  -> Milestones workspace
  -> Pending approval
  -> Context Panel: Milestone
      -> scope
      -> evidence checklist
      -> worker notes
      -> payment impact
      -> approve / request changes / dispute
```

### Contractor sube evidencia

```txt
Contractor OS
  -> Evidence workspace
  -> Required evidence queue
  -> Context Panel: Evidence item
      -> requirement
      -> upload
      -> AI quality check
      -> submit
```

### Operador inspecciona un runtime trace

```txt
Mission Control
  -> AI/runtime degraded
  -> Operations OS / Monitoring
  -> Domain event or agent run
  -> Context Panel: correlationId
      -> event payload
      -> timeline
      -> agent runs
      -> retry / requeue / open incident
```

### AI engineer revisa Prometeo/RAG

```txt
AI Mission Control
  -> RAG health / Router health
  -> AI Workspace: Prometeo or Router
  -> Context Panel: model log / document / incident
      -> context used
      -> provider
      -> failure reason
      -> backfill / re-run / mark resolved
```

## Dependencias tecnicas

### Frontend

- `apps/web/app/(app)/layout.tsx`: shell, sidebar y rol visual.
- `apps/web/lib/language-context.tsx`: labels actuales de navegacion.
- `apps/web/components/ui`, `packages/ui`: primitives reutilizables.
- `apps/web/components/ai/*`: paneles transversales de agentes y alertas.
- `apps/web/components/semse/*`: observer, trust, evidence, simulation y decision panels.
- `apps/web/lib/client-routes` actual vive en `apps/web/app/lib/client-routes.ts` y ya centraliza parte de la navegacion client.

### Auth / RBAC

- `packages/auth/src/rbac.ts`: rol por ruta y dashboard default.
- `apps/web/middleware.ts`: redireccion segun rol.

Riesgo: cambiar prefijos como `/worker` a `/contractor` toca RBAC, middleware y links existentes. Recomendacion: mantener `/worker` como prefijo tecnico y cambiar primero copy/IA a "Contractor OS".

### Backend

La API ya esta separada por dominios Nest:

- Jobs, projects, tasks, milestones, evidence.
- Payments, payment governance, finance, escrow.
- BuildOps, intake bridge, tools, change orders.
- Contractor, marketplace, matching, bids, ratings, trust.
- Ops, operational-intelligence, domain-events, agents, developer-runtime.
- Prometeo, ai-models, knowledge, runtime-knowledge, repo-knowledge.
- Governance, communications, notifications, travel, materials, incidents, field-ops.

Riesgo bajo para la migracion de navegacion: la mayoria de cambios pueden ser frontend/shell sin modificar contratos API.

### Estado y tiempo real

- SSE Mission Control: `/api/semse/sse/mission-control`
- SSE health: `/api/semse/health/stream`
- BuildOps SSE hook: `apps/web/hooks/useBuildOpsSSE.ts`
- Notifications: `NotificationBell`, `NotificationBanner`

Recomendacion: no duplicar subscriptions por pantalla. Mission Control debe mostrar agregados; Workspace/Context Panel debe subscribirse al detalle cuando la entidad esta seleccionada.

## Plan de migracion incremental

### Fase 0: Canonical navigation registry

Crear un registry unico, por ejemplo:

```txt
apps/web/lib/navigation-registry.ts
```

Debe declarar:

- `layer`: `mission-control | workspace | context`
- `os`: `client | contractor | operations | marketplace | governance | ai | system`
- `legacyHref`
- `canonicalHref`
- `roles`
- `entityType` opcional

No mover rutas todavia. Solo clasificar.

Schema recomendado:

```ts
export type NavigationLayer = "mission-control" | "workspace" | "context";
export type NavigationOS =
  | "mission-control"
  | "client"
  | "contractor"
  | "operations"
  | "marketplace"
  | "governance"
  | "ai"
  | "system";

export interface NavigationNode {
  id: string;
  labelKey: string;
  canonicalHref: string;
  legacyHrefs?: string[];
  layer: NavigationLayer;
  os: NavigationOS;
  roles: Array<"admin" | "client" | "worker">;
  owner: string;
  entityType?: "job" | "project" | "milestone" | "evidence" | "payment" | "proposal" | "trace" | "worker";
  status: "active" | "alias" | "deprecated" | "planned";
}
```

Primer set minimo:

| id | canonicalHref | legacyHrefs | layer | os | roles |
| --- | --- | --- | --- | --- | --- |
| `mission-control` | `/admin/mission-control` | `/admin/dashboard` | `mission-control` | `mission-control` | `admin` |
| `ops-monitoring` | `/ops/monitoring` | `/admin/ops` | `workspace` | `operations` | `admin` |
| `ops-buildops` | `/ops/buildops` | `/buildops` | `workspace` | `operations` | `admin`, `worker` |
| `client-home` | `/client/dashboard` | none | `workspace` | `client` | `client` |
| `contractor-home` | `/worker/dashboard` | none | `workspace` | `contractor` | `worker` |
| `ai-mission-control` | `/ai/mission-control` | `/admin/ai-mission-control` | `mission-control` | `ai` | `admin` |
| `governance-proposals` | `/governance/proposals` | `/admin/governance` | `workspace` | `governance` | `admin`, `client`, `worker` |

Gate de Fase 0:

- El sidebar puede seguir usando las rutas actuales.
- El registry debe existir y tener test.
- Ninguna ruta visible nueva se agrega sin `owner`, `layer`, `os` y `roles`.

### Fase 1: Mission Control limpio

Objetivo: hacer de `/admin/mission-control` la Capa 1 real.

Cambios:

- Reducir feed/listados a "top 3 signals" o agregados.
- Mover "all signals" a Operations OS.
- Convertir cards en entradas a workspaces.
- Cambiar `defaultDashboardForRole("admin")` solo despues de validar con usuario admin.

Entregables:

- `MissionControlCard` o equivalente con destino de workspace obligatorio.
- Estado agregado por dominio: operations, revenue/escrow, evidence, risk/trust, AI, governance.
- Banner de compatibilidad desde `/admin/dashboard` hacia Mission Control.
- Smoke visual: Mission Control no debe renderizar tablas ni payloads.

### Fase 2: Workspaces canonicos por OS

Introducir rutas canonicas sin borrar legacy:

- `/ops`
- `/ops/buildops`
- `/ops/monitoring`
- `/ops/risk`
- `/ai`
- `/ai/mission-control`
- `/marketplace`
- `/governance`

Cada ruta puede importar/reusar la pagina actual al inicio.

Regla de implementacion:

- Primero crear rutas canonicas que re-exporten paginas actuales.
- Despues actualizar sidebar para mostrar OS groups.
- Finalmente agregar redirects/aliases cuando el usuario ya pueda encontrar el destino nuevo.

Ejemplo de transicion:

```tsx
// apps/web/app/(app)/ops/monitoring/page.tsx
export { default } from "../../admin/ops/page";
```

Despues de validar, se puede mover el codigo real a `ops/monitoring` y dejar `/admin/ops` como wrapper legacy.

### Fase 3: Context Panel compartido

Crear componente transversal:

```txt
apps/web/components/context-panel/SemseContextPanel.tsx
```

Variantes iniciales:

- `JobContextPanel`
- `ProjectContextPanel`
- `MilestoneContextPanel`
- `EvidenceContextPanel`
- `PaymentContextPanel`
- `RuntimeTraceContextPanel`
- `ProposalContextPanel`

Aplicar primero en `/admin/ops`, porque es donde la mezcla lista/detalle es mas evidente.

API minima recomendada:

```tsx
type SemseContextPanelProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  status?: React.ReactNode;
  onClose: () => void;
  tabs: Array<{
    id: string;
    label: string;
    content: React.ReactNode;
  }>;
  actions?: React.ReactNode;
};
```

Primer uso recomendado:

- Lista izquierda: domain events / agent runs.
- Panel derecho: selected correlationId.
- Tabs: Summary, Event, Runtime, Timeline, Payload, Actions.
- Acciones: retry, requeue, open incident, acknowledge.

### Fase 3.5: Decision Intelligence layer

Objetivo: introducir innovacion sin reescribir los dominios existentes.

Componentes recomendados:

```txt
apps/web/components/decision/
├── NextActionRail.tsx
├── EscrowReadinessBadge.tsx
├── ReadinessChecklist.tsx
├── PrometeoDecisionBrief.tsx
├── DecisionReceipt.tsx
└── TrustLedgerTimeline.tsx
```

Primeras integraciones:

- `EscrowReadinessBadge` en payment/milestone context.
- `ReadinessChecklist` en evidencia y escrow.
- `PrometeoDecisionBrief` en milestone approval y dispute review.
- `DecisionReceipt` despues de approve/reject/release/requeue.
- `TrustLedgerTimeline` en contractor/job context.

Regla de seguridad:

- Esta fase no debe auto-ejecutar decisiones financieras.
- Prometeo puede recomendar y explicar.
- El humano aprueba acciones sensibles.
- Cada accion sensible genera receipt auditable.

### Fase 3.6: Exception Queues

Crear workspaces orientados a excepciones:

```txt
/ops/queues/blocked-payments
/ops/queues/evidence-review
/ops/queues/at-risk-jobs
/ops/queues/client-waiting
/ops/queues/contractor-action-required
/ai/queues/runtime-exceptions
```

Cada queue debe cumplir:

- Tiene owner.
- Tiene severidad.
- Tiene filtro por rol.
- Abre Context Panel al seleccionar item.
- Muestra Next Best Action.
- Registra metricas de resolucion.

### Fase 4: Desaturar dashboards por rol

Cambios:

- `/client/dashboard`: mantener metricas y proximas acciones; mover trabajos recientes a `/client/jobs`.
- `/worker/dashboard`: mantener metricas y alertas de ejecucion; mover listas/acciones detalladas a workspaces.
- `/buildops`: mantener categorias; mover detalles a `/buildops/projects/:id` o Context Panel.
- `/admin/dashboard`: convertir en alias a Mission Control o retirar del sidebar principal.

### Fase 5: Sidebar por OS y no por lista plana

Reemplazar la lista larga admin por agrupacion:

```txt
Mission Control
Operations OS
Marketplace OS
Governance OS
AI Mission Control
System / Settings
```

Dentro de cada OS, mostrar subnav contextual. Esto reduce ruido sin perder rutas.

### Fase 6: Aliases y deprecacion

Mantener aliases por 1-2 releases:

- `/dashboard`
- `/admin/dashboard`
- `/admin/ops`
- `/admin/ai-mission-control`
- `/buildops`

Agregar eventos de telemetria si existe tracking interno para saber que rutas siguen siendo usadas.

Politica de deprecacion:

| Estado | Comportamiento |
| --- | --- |
| `active` | Ruta canonica en sidebar y docs. |
| `alias` | Ruta legacy funciona y puede mostrar banner corto. |
| `deprecated` | Ruta legacy redirige automaticamente y registra `legacy_route.visited`. |
| `removed` | Solo despues de dos releases sin uso significativo. |

## Backlog recomendado

Orden recomendado, con dependencias:

| Orden | Item | Dependencia | Resultado |
| --- | --- | --- | --- |
| 1 | Crear `navigation-registry.ts`. | Ninguna. | Fuente unica de rutas visibles y canonicas. |
| 2 | Agregar test unitario del registry. | Item 1. | Ninguna ruta visible queda sin owner/layer/os/roles. |
| 3 | Refactorizar `NAV` en `apps/web/app/(app)/layout.tsx` para consumir registry. | Items 1-2. | Sidebar deja de ser lista hardcodeada. |
| 4 | Crear `SemseContextPanel`. | Ninguna, pero ideal despues del registry. | Patron comun de detalle. |
| 5 | Migrar `/admin/ops` a Workspace + Context Panel. | Items 1-4. | Primer caso critico corregido. |
| 6 | Reducir `/admin/mission-control` a indicadores y top signals. | Item 5 para mover listas profundas. | Mission Control queda como Capa 1 real. |
| 7 | Cambiar copy de `/worker/dashboard` a Contractor OS. | Registry listo. | Mejor semantica sin romper `/worker`. |
| 8 | Consolidar AI nav: Mission Control, Prometeo, Router, Observer, Memory. | Registry + sidebar por OS. | AI deja de estar repartido en rutas sueltas. |
| 9 | Consolidar Marketplace nav: leads, matching, professionals, proposals, reputation. | Registry + OS groups. | Marketplace queda separado de Operations. |
| 10 | Convertir `/dashboard` legacy en redirect por rol o pagina de transicion. | Telemetria o aprobacion de producto. | Se elimina el dashboard neutral ambiguo. |
| 11 | Crear `EscrowReadinessBadge` y `ReadinessChecklist`. | Context Panel. | Pagos/milestones muestran por que estan listos o bloqueados. |
| 12 | Crear `PrometeoDecisionBrief` no-autonomo. | Context Panel + AI data disponible. | AI ayuda a decidir sin ejecutar acciones sensibles. |
| 13 | Crear `DecisionReceipt` para approve/reject/release/requeue. | Acciones existentes. | Cada decision critica queda explicada y auditable. |
| 14 | Crear primera Exception Queue: `Blocked Payments`. | Readiness checklist. | Operations resuelve bloqueos por dinero/evidencia en una cola unica. |
| 15 | Crear `TrustLedgerTimeline` inicial. | Eventos de evidence/payment/dispute. | Trust deja de ser un score opaco y se vuelve trazable. |

## Riesgos de implementacion

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Romper deep links existentes. | Alto | Mantener `legacyHrefs`, wrappers y redirects por al menos 1-2 releases. |
| Cambiar `/worker` a `/contractor` demasiado pronto. | Alto | Mantener prefijo tecnico; cambiar solo copy y agrupacion visual. |
| Sidebar por OS sin registry. | Medio-alto | No tocar shell sin `navigation-registry.ts` y test. |
| Mission Control queda como otro dashboard saturado. | Alto | Aplicar gate: sin tablas largas, sin payloads, sin formularios. |
| Context Panel se vuelve un modal enorme. | Medio | Tabs estandar y opcion de deep link full-page para objetos complejos. |
| AI se mezcla con Operations. | Medio | Separar AI health/runtime de riesgo operacional de jobs/payments/evidence. |
| Duplicar subscriptions SSE. | Medio | Mission Control escucha agregados; Context Panel escucha detalle seleccionado. |
| Migracion visual sin telemetria. | Medio | Registrar uso de legacy routes, workspace opens y context actions. |
| Introducir AI como autoridad prematura. | Alto | Mantener Prometeo en modo recomendacion; approvals humanos para dinero/disputas. |
| Readiness score opaco. | Alto | Mostrar checklist y fuentes; nunca solo un numero. |
| Exception queues duplican workspaces existentes. | Medio | Queues son vistas filtradas sobre entidades canonicas, no nuevos dominios. |

## Secuencia recomendada para el primer sprint

Objetivo del primer sprint: **establecer la arquitectura sin cambiar comportamiento funcional**.

1. Crear `apps/web/lib/navigation-registry.ts`.
2. Crear test del registry.
3. Cambiar `NAV` para derivarse del registry, manteniendo los mismos labels y hrefs visibles.
4. Agregar `status: alias | active | planned` a nodos clave.
5. Agregar banners discretos en `/admin/dashboard` y `/dashboard` si se decide comunicar la transicion.
6. Documentar en `docs/frontend/FRONTEND_ARCHITECTURE.md` que nuevas rutas deben declarar capa/OS/owner.

No hacer en el primer sprint:

- No mover carpetas grandes.
- No renombrar `/worker`.
- No retirar `/admin/dashboard`.
- No redisenar todas las pantallas.
- No mezclar esta migracion con cambios de API.

## Secuencia recomendada para el segundo sprint

Objetivo del segundo sprint: **probar el patron en una pantalla critica**.

1. Crear `SemseContextPanel`.
2. Migrar `/admin/ops` a layout de dos zonas: queue + context.
3. Extraer detalle de correlationId/event trace al panel.
4. Mantener los fetchers actuales.
5. Agregar evento `context_panel.opened` si existe infraestructura de analytics.
6. Validar que retry/requeue/open incident sigan funcionando.

Metricas de aceptacion:

- La vista inicial de `/admin/ops` muestra colas y filtros, no payloads.
- Payload/timeline solo aparecen al seleccionar un correlationId.
- Cerrar panel no pierde filtros.
- Acciones existentes siguen disponibles desde el panel.

## Secuencia recomendada para el tercer sprint

Objetivo del tercer sprint: **probar la innovacion donde hay valor economico claro**.

1. Crear `EscrowReadinessBadge`.
2. Crear `ReadinessChecklist` con fuentes explicitas: milestone, evidence, approval, dispute, compliance.
3. Crear workspace `/ops/queues/blocked-payments` como vista filtrada, no como dominio nuevo.
4. Abrir cada payment/milestone en Context Panel.
5. Agregar `PrometeoDecisionBrief` en modo solo lectura.
6. Generar `DecisionReceipt` al resolver un bloqueo o liberar/rechazar una accion.

Metricas de aceptacion:

- Cada pago bloqueado explica exactamente que falta.
- El operador puede pasar de bloqueo a accion sin abrir tres modulos.
- Las decisiones financieras dejan receipt.
- Prometeo recomienda, pero no ejecuta liberaciones.
- La queue reduce tickets ambiguos de "por que no se puede pagar?".

## Decision arquitectonica recomendada

SEMSE debe dejar de organizarse por "pantallas" y organizarse por "sistemas operativos de trabajo".

La estructura final deberia ser:

```txt
Mission Control = estado del sistema
Workspace = cola/categoria donde trabajo
Context Panel = entidad y accion concreta
```

Este cambio no requiere reescribir el backend. La API y los dominios ya existen. El mayor trabajo esta en:

- registry de navegacion
- shell por OS
- reduccion de dashboards
- contexto lateral uniforme
- aliases para compatibilidad

El hito no es "arreglar el sidebar"; el hito es convertir SEMSE de coleccion de pantallas a sistema operativo coherente.

La version innovadora del hito es mas ambiciosa:

```txt
SEMSE = Exception-first Work OS
     + Trust Ledger
     + Escrow Readiness
     + Prometeo Decision Briefs
     + Decision Receipts
     + Progressive Autonomy
```

Ese es el punto donde SEMSE deja de competir solo como project manager y empieza a competir como sistema de decision operacional para trabajos, evidencia, pagos y confianza.
