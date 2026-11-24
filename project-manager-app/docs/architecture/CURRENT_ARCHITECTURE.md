# Arquitectura vigente de SEMSEproject

**Estado:** CANONICA
**Corte de código:** 2026-11-24, `origin/main` `594279afefad1fe760b94ec84c2cee382281ceb1` (PR #1169)
**Producción:** no re-verificada desde 2026-10-03. Ese día API y Web estaban en `3d9743d4` (PR #753) y `main` en `7da00947` (PR #757). No usar esos SHA como producción de hoy.
**F3 en código:** merge `f1234291` (ancestro). El canary de producción no se re-verificó desde 2026-07-31 (§11).
**Repositorio:** `Semse-projet/project-manager-app`
**Raiz de aplicacion:** `project-manager-app/`

> **Nota de alcance (2026-11-24):** se contrastó el árbol de `main` (apps,
> módulos, flags por defecto, ancestros git de F3/F4/F10/móvil y el registro
> de tools). No se consultó Railway. Hay 219 archivos
> `docs/specs/**/*.spec.md`; `node ./scripts/spec-validate.mjs --strict` en
> este checkout dio 0 errores y 0 warnings. Las filas de §6 que este pase
> no releyó en código siguen siendo la foto anterior y hay que tratarlas
> como históricas. La lectura de producción del 2026-10-03 queda en §11
> marcada como no re-verificada desde esa fecha.

Este documento describe la arquitectura vigente y la direccion aprobada. No
reemplaza los contratos SDD, modelos Prisma ni tests. Su funcion es ordenar esas
fuentes y evitar que documentos historicos vuelvan a describir el repositorio
como una app local sin backend.

El aterrizaje de la síntesis transversal sobre componentes actuales vive en
[`PRODUCTION_CONVERGENCE_MAP.md`](PRODUCTION_CONVERGENCE_MAP.md).

## 1. Tesis de producto

SEMSEproject es un sistema operativo modular, transaccional y cognitivo para
coordinar identidad, organizaciones, proyectos, trabajo de campo, evidencia,
dinero, confianza, conocimiento e inteligencia artificial.

- BuildOps es el vertical de construccion y servicios de campo.
- Agro es un vertical hermano que reutiliza las capacidades transversales.
- Connect une personas, empresas, trabajos y recursos entre verticales.
- Prometeo es la interfaz cognitiva y el coordinador de misiones; no es un
  backend paralelo ni sustituye los modulos de dominio.
- Mission Control supervisa excepciones, salud, decisiones y ejecucion.

## 2. Ejes de fuentes de verdad

Constitución/specs, código `main`, producción comprobada y contratos
ejecutables son ejes distintos. Ninguno borra una contradicción del otro: se
registra drift y se reconcilia. La precedencia y ownership completos están en
[`../SOURCE_OF_TRUTH.md`](../SOURCE_OF_TRUTH.md).

Una capacidad puede estar implementada, probada, integrada, desplegada y
activada en momentos distintos. Los documentos declaran esas etapas por
separado y acotan `CANARY` frente a `ACTIVE`.

## 3. Taxonomia oficial

La taxonomia aprobada conserva los nombres actuales del codigo. No se autoriza
un renombramiento masivo.

| Dominio | Responsabilidad principal | Evidencia en el repositorio |
| --- | --- | --- |
| SEMSE Core | Identidad, organizaciones, tenants, roles, permisos y auditoria | `apps/api/src/modules/auth`, `users`, `organizations`, `compliance`, `did`, `worker-verification` |
| SEMSE Connect | Intake, jobs, matching, bids, contratos, agenda, comunicaciones y Labor Engine | `jobs`, `marketplace`, `matching`, `bids`, `field-ops`, `labor-engine`, `communications`, `contracts` |
| SEMSE Payments | Pagos, estados de escrow operativo, releases, refunds y gobierno financiero | `payments`, `escrow`, `payment-governance`, `finance`, `liens` |
| SEMSE Trust | Reputacion, verificacion, cumplimiento, disputas y governance | `ratings`, `trust`, `governance`, `compliance`, `disputes` |
| SEMSE AI | Prometeo, agentes, autonomia, Vision, Browser Agent e inteligencia | `prometeo`, `agents`, `autonomy`, `vision`, `browser-agent`, `operational-intelligence` |
| SEMSE Agro | Fincas, animales, cultivos, inventario, costos y trazabilidad | `apps/api/src/modules/agro`, `apps/web/app/agro` |
| SEMSE BuildOps | Proyectos, hitos, ProTools, materiales, incidentes y operaciones de construccion | `buildops`, `milestones`, `projects`, `pricing`, `materials`, `incidents`, `tools` |
| SEMSE Knowledge | RAG, documentos, trade library, Graphify, embeddings y memoria institucional | `knowledge`, `repo-knowledge`, `runtime-knowledge`, `graphify`, `skills` |
| SEMSE Integrations | Stripe, WhatsApp, Railway, modelos, storage, webhooks, SDK y satelites | adapters en API, `developer-runtime`, `evidence-gateway`, specs SAT |

El detalle de ownership permanece en
[`docs/SEMSE_CONNECT_TAXONOMY.md`](../SEMSE_CONNECT_TAXONOMY.md).

### Normalizacion de conceptos historicos

| Nombre anterior | Identidad vigente |
| --- | --- |
| Sense Project / Sense OS | SEMSEproject |
| Sense Connect | SEMSE Connect |
| OKComputer | Absorbido por SEMSE Connect; no es producto independiente |
| Scout | Funcion de perception/discovery/research dentro de Prometeo |
| OMEGA | Capa interna de supervision y metricas, no producto separado |
| Time Tracker | Capacidad del Labor Engine |
| Tool Hub | SEMSE Integrations + Tool Registry |
| SenseConnect multi-terminal | SEMSE Workspace + Context Bridge |
| Help4IA / constructor de ideas | SEMSE Blueprint Engine |
| Consciousness Map | Mission Control + Ecosystem Digital Twin |
| Browser inteligente | SEMSE Browser Agent |
| FarmOps / RanchOps | Capacidades internas de SEMSE Agro |
| Prometeo Chat | Prometeo Multimodal Workspace |

Los nombres historicos pueden permanecer en archivos, rutas o codigo legado por
trazabilidad. No autorizan crear productos paralelos.

## 4. Arquitectura de ejecucion

```text
Experience Platform
  Web publica | portales | movil | Prometeo Workspace | admin
                              |
                              v
SEMSE Core
  identidad | tenant | organizacion | RBAC | auditoria
                              |
                              v
Ecosystem Orchestrator
  comandos | politicas | misiones | eventos | workers | proyecciones
                              |
        +---------------------+---------------------+
        |                     |                     |
        v                     v                     v
     Connect              BuildOps                Agro
        |                     |                     |
        +---------------------+---------------------+
                              |
                              v
Evidence | Payments | Trust | Knowledge | Integrations
                              |
                              v
SEMSE AI: Prometeo | Vision | Agents | Loops
                              |
                              v
Mission Control / OMEGA
```

## 5. Topologia tecnica actual

La raiz canónica es un monorepo pnpm. Las aplicaciones principales son:

- `apps/web`: Next.js y BFF por Route Handlers.
- `apps/api`: NestJS, Prisma y reglas de dominio.
- `apps/worker`: BullMQ, timers y trabajos asincronos.
- `apps/mobile`: cliente Expo/React Native del monorepo (`@semse/mobile`).
  `package.json` fija `expo` `~57.0.34` y `react-native` `0.86.3`. `app.json`
  usa el nombre `SEMSE` y el slug `semse-mobile`. El primer `package.json`
  en `main` es #489 (`01a9247e`, 2026-07-31). La consolidación #598
  (`a42600ec`) es ancestro; #1162, #1166, #1167, #1181 y #1182 son commits
  posteriores de compilación, CI mínimo y perfil EAS. No hay release de
  tienda ni canary en dispositivo re-verificado en este corte. El spike de
  junio de 2026 archivado en `archive/mobile-spike-2026-06` es otra línea:
  no describe este árbol.
- `apps/vision-service`: analisis visual especializado.
- `apps/autonomy-server`: runtime de autonomia donde se despliegue.
- `apps/angular` y `apps/assistant-portal`: superficies adicionales o de
  transicion; no redefinen la raiz canónica.

Paquetes compartidos existentes:

```text
packages/agents         packages/auth          packages/autonomy
packages/db             packages/design-tokens packages/forge
packages/knowledge      packages/product-events
packages/schemas        packages/sdk           packages/shared
packages/tools          packages/ui
```

Los futuros paquetes `events`, `policies`, `ledger` y `observability` solo se
crearan cuando la responsabilidad transversal ya no pueda vivir con claridad
en los modulos actuales.

## 6. Sistemas transversales y estado real

| Sistema | Estado | Hecho verificado | Brecha principal |
| --- | --- | --- | --- |
| Domain Events | Implementado/parcial y activo en canary acotado | Envelope v2; Evidence F1; F3 `project.lifecycle-source-changed.v1`; dispatcher BullMQ; consumers idempotentes, ops/replay | Falta adopción transaccional dominio por dominio y cierre global F1-F |
| Transactional Outbox | Implementado/parcial y ejercitado | Evidence + outbox comparten transacción; dispatcher usa leases; effect + receipt son atómicos; F3 verificó publicación, consumo y replay | Hooks F3 fuera de Evidence siguen post-commit best-effort |
| BullMQ y loops | Implementado/parcial | Worker, retries, backpressure, kill switch y agent runs dead-lettered | Falta unificar observabilidad, replay y DLQ por evento |
| Prometeo Runtime P2 | Implementado y desplegado | Misiones persistentes sobre `AgentWorkPlan`, aprobacion y checkpoints | Mutaciones, compensacion, budgets y verificacion transversal pendientes |
| Prometeo Tool Registry | Implementado/parcial (código 2026-11-24) | 41 descriptores en `prometeo-tool-registry.ts`: 31 `readTool`, 10 `writeTool` | `adapterPending: true` en `vision.analyze_video`, `business_os.assign_task` y `business_os.release_task`; verification/compensación explícita sigue pendiente. El conteo 31/24/7 es el corte 2026-07-31 |
| Model Gateway unificado (`ADR-023`) | Specs avanzaron, código sin tocar — verificado 2026-10-03 | `SPEC-AGT-002`(Prometeo Core)/`SPEC-AGT-004`(ToolResult multimodal): `IMPLEMENTED`/mergeados; `SPEC-GTW-001`(unificación gateway): `APPROVED`; `SPEC-GTW-002`(cache control)/`SPEC-AGT-003`(retrieval AgentDecision): `REVIEW` | `ai-model-gateway.service.ts::executeWithSlug` sigue bifurcando DeepSeek/Kimi/GLM fuera de `LLMOrchestrator`/`ProviderMetricsStore` tal como describía `SPEC-GTW-001` — el diseño está aprobado, la implementación no empezó; ver skill `semse-prometeo-orchestrator` |
| Evidence provenance | Parcial | Evidence, checksum, metadata, geo, analisis visual y storage abstraction | Chain of custody, firmas, retencion y acceso no estan unificados |
| Economic Ledger | Pendiente como sistema comun | `PaymentTxn` y ledgers verticales registran movimientos operativos | No existe double-entry compartido, cuentas, lineas, reversals ni trial balance |
| Policy/Approval | Parcial | RBAC default-deny y aprobaciones en Prometeo, BuildOps y Payments | No existe decision engine transversal versionado |
| Mission Control | F4 mergeado en código (#486 `afb2dccd`, ancestro de `594279af`) | `isMissionControlV2Enabled`: solo `SEMSE_MISSION_CONTROL_V2_ENABLED=true` o tenant en `SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS`. Spec `activation_status: INACTIVE` | Activación de producción no re-verificada desde la evidencia del spec (2026-10-11). No hace falta otro merge para que el código exista |
| Project Lifecycle Projection | Código F3 en `main` (`f1234291`, ancestro). Canary de producción no re-verificado desde 2026-07-31 | El cálculo exige `SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED=true` y allowlist (`SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS`, o `*`). La persistencia exige `SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED=true` | Releer flags en Railway antes de llamar al canary “activo”. SLO y outbox atómica por dominio siguen abiertos |
| Product Intelligence | Código presente, incluida la agregación PI-07 en `product-intelligence.service.ts` | El observer leído sale solo si `PRODUCT_INTELLIGENCE_ENABLED=true` | Valor de producción no re-verificado. No se re-auditó PI-08..PI-11 en este pase |
| Workspace/Context Bridge | Parcial | Developer runtime, context bridge panel y capas de contexto existentes | Registry de terminales, shared mission context y scopes uniformes |
| SDD/Blueprint Engine | 219 archivos `*.spec.md`. Strict local 0/0 el 2026-11-24 (`node ./scripts/spec-validate.mjs --strict`) | Templates SDD 2.0 y columnas separadas de entrega siguen vigentes | El conteo 98 (2026-07-31) y 128 (2026-10-03) es histórico. El 0/0 de este corte es local, no el CI del PR |
| Observabilidad | Parcial | Sentry, metricas Prometheus, health/readiness y auditoria | No hay trazas OTel end-to-end ni SLOs de negocio completos |
| Storage | Parcial | Storage service con local y S3/R2, MinIO local, Evidence bucket keys | Debe verificarse provider y politicas de retencion en cada ambiente |
| Offline | Parcial | `apps/mobile/src/timer/localTimer.ts` es el timer offline del cliente Expo; el web usa otro store | No hay sincronización compartida única entre web y móvil |
| Backup/DR | Parcial | Simulaciones BCP y restore de operacion asistida en CI | Falta evidencia de PITR/restore real de DB y object storage de produccion |

La matriz con evidencia y criterios de cierre vive en
[`IMPLEMENTATION_STATUS_MATRIX.md`](IMPLEMENTATION_STATUS_MATRIX.md).

## 7. Runtime canónico de Prometeo

```text
OBSERVE
  -> INTERPRET
  -> PLAN
  -> REQUEST APPROVAL
  -> EXECUTE
  -> VERIFY
  -> LEARN
```

Reglas:

- Prometeo consulta o propone; el modulo de dominio conserva la autoridad.
- Toda mutacion critica requiere policy y, cuando aplique, aprobacion humana.
- Una tool declara modo, riesgo, permisos, input, output y adapter.
- Las tools read-only pueden autoaprobarse si la policy lo permite.
- Las tools write/critical deben dejar auditoria, resultado verificable y ruta de
  compensacion antes de habilitarse.
- Prometeo nunca mantiene una copia paralela del estado de negocio.

## 8. Event Backbone en consolidacion

El estado actual no debe confundirse con el objetivo. El flujo durable aprobado
es:

```text
Command/Webhook
  -> policy + validation
  -> transaction(domain state + outbox row)
  -> outbox dispatcher
  -> BullMQ ingress
  -> idempotent consumers
  -> projections/notifications/agents/ledger
  -> verification
  -> Mission Control
```

El envelope canónico v2 contiene al menos:

```text
eventId, eventType, version, occurredAt, recordedAt,
tenantId, orgId, actor, module, entityType, entityId,
correlationId, causationId, idempotencyKey,
payload, metadata, traceContext, schemaRef
```

No se migra con un big bang. F1 introdujo el envelope, outbox Evidence,
dispatcher BullMQ, consumers idempotentes y operaciones de replay. F3 adoptó el
backbone con `project.lifecycle-source-changed.v1` y
`project-lifecycle-projection.v1`. El worker recibe sólo `eventId`; API
reconstruye el evento durable desde PostgreSQL y confirma effect, AuditLog y
receipt del consumer en una transacción.

El canary F3 activó dispatcher/consumers con allowlists acotadas y verificó
cinco publicaciones, cinco consumos, duplicado y replay. Esto demuestra el
slice F3, no cierra F1 globalmente. Evidence conserva escritura+outbox atómica;
los hooks F3 de otros dominios son post-commit best-effort y dependen de
read-through/rebuild como recuperación hasta su migración transaccional.

El contrato F1 está en
[`../specs/platform/event-backbone.spec.md`](../specs/platform/event-backbone.spec.md)
y ADR-022. F1-F sigue pendiente como cierre transversal de canary/SLO y
adopción general.

## 9. Flujos canónicos

### Flujo monetizable

```text
Lead -> Smart Intake -> Job -> Matching -> Bid -> Contract -> Project
     -> Milestones -> Labor -> Evidence -> Approval -> Payment Governance
     -> Release -> Rating -> Trust -> Knowledge
```

### Evidencia, pago y confianza

```text
Trabajo -> Evidence -> validacion tecnica/visual -> revision humana
        -> approval -> policy financiera -> release/block
        -> movimiento economico -> Trust -> audit
```

### Autonomia gobernada

```text
Loop detecta -> registra -> propone -> verifica -> revision humana
             -> branch/PR -> CI -> merge humano -> despliegue -> observacion
```

No existe auto-merge como politica del runtime.

## 9.1 SEMSE Workspace y Blueprint Engine

El Context Bridge transportara solo contexto autorizado entre terminales,
modelos, repositorios y herramientas. Cada terminal debe declarar identidad,
owner, organizacion, capacidades, permisos, sesion, limites y proyecto activo.
Compartir una mision no implica compartir toda la conversacion ni todos los
secretos.

El Blueprint Engine transforma vision en ejecucion gobernada:

```text
idea -> contexto -> problema -> requisitos -> arquitectura
     -> impacto de datos/seguridad -> spec/ADR -> fases/tareas
     -> branch -> tests -> PR -> deploy -> observacion
```

Prepara trabajo y evidencia; no omite approvals ni ejecuta cambios criticos por
su cuenta.

## 10. Decisiones vigentes

1. Monorepo modular primero; extraer servicios por carga, aislamiento o
   compliance demostrado.
2. PostgreSQL + Prisma siguen siendo el sistema de registro.
3. Redis + BullMQ siguen siendo la base de jobs y sagas cortas. Temporal se
   evalua solo cuando los workflows humanos largos lo justifiquen.
4. No hay rename big-bang de carpetas o modulos.
5. Stripe implementa pagos protegidos y control de releases; SEMSE no debe
   prometer escrow legal sin estructura y revision juridica por jurisdiccion.
6. Evidence, Trust, Payments y Knowledge se conectan por contratos/eventos, no
   por acceso indiscriminado a tablas ajenas.
7. Mission Control es exception-first; los workspaces resuelven y el context
   panel explica/ejecuta.
8. Toda declaracion de estado debe distinguir codigo, pruebas, merge y
   produccion.

## 11. Estado de produccion

**No re-verificado desde 2026-10-03.** Esta pasada no llamó a Railway ni a
los healthchecks. El bloque siguiente es la última lectura en vivo que este
archivo conserva; no es el SHA desplegado hoy. `main` avanzó de `7da00947`
a `594279af` (2026-11-24). El PR abierto #1142 anotó, el 2026-11-12, API y
Worker en `7e80dd0f`; esa nota tampoco se releyó y el runbook no está en
`main`.

**Lectura en vivo del 2026-10-03** (modo `PRODUCTION_VERIFIED` ese día —
`mcp__Railway__list-deployments`/`environment-status`, no solo healthcheck).
Tratarla como histórica:

- `origin/main`: `7da00947` (PR #757).
- Producción Railway (proyecto `SEMSEproject`, environment `production`):
  servicio `semse-API` con deployment `71ac7abd` `SUCCESS`, commit `3d9743d4`
  (PR #753, `fix(c51): clima por proyecto exige tenant + ProjectScope`);
  servicio `semse-web` con deployment `5df35495` `SUCCESS`, mismo commit
  `3d9743d4`. Ambos confirmados vía API de Railway, no por inferencia.
- `semse-worker` y `semse-vision` figuran `SUCCESS`/`online` en el mismo
  environment (deployments `ccdbdfa3` y `aa14d6c7`), desplegados en la misma
  ventana (2026-10-03T02:04-02:08Z); su `commitHash` individual no se
  verificó en este pase — tratar como `READ_ONLY_PARTIAL` hasta confirmarlo.
- **Brecha real entre código y producción:** `main` (#757) va 4 PRs por
  delante de lo desplegado (#753) al momento de este corte — no es un
  defecto necesariamente, pero no debe asumirse que lo mergeado en esos 4
  PRs ya está en producción.
- Postgres: `online`, 1 warning no crítico (no investigado en este pase).
- Sin fallos recientes ni trabajo pendiente (`pendingWork: []`) en ningún
  servicio del environment al momento de la consulta.

**Snapshot anterior (2026-07-31, `HISTORICAL` — conservado para
trazabilidad, no re-verificado):**

- `origin/main` y producción: `114cb9ca4007d32bf3fbbfc9c36d54b1e862236a`.
- F3 events: PR #477, merge `f1234291fc190c6611d3f2258630ac08315bd060`; CI,
  CodeQL, integración PostgreSQL y E2E verdes.
- Railway Deploy workflow `30597913257`: éxito.
- API `575a82f1-ac99-4d60-a5d2-e6aeb645e096`, Web
  `3ffb51d5-6dd1-4fd3-afa2-b7c6b1cff489`, Worker
  `8fe3b3fc-c10a-4843-82cf-d4a2e79297ec` y Vision
  `bf804e3b-9a56-4b94-b1ad-6e6bcafd57cd`: `SUCCESS`, `114cb9ca`.
- El Worker conserva rol `EVENT_CONSUMER`.
- API health por dominio Railway y `api.semseproject.com` = 200; Web health por
  dominio custom y Railway = 200.
- F3: 5 outbox `PUBLISHED`, 5 receipts `COMPLETED`, cero
  pending/failed/dead-letter; replay idempotente `no_op`.
- `api.semseproject.com` figura `ACTIVE`, valida TLS estricto y responde health
  200; `app.semseproject.com` también responde health 200.

La evidencia operativa detallada vive en
[`../PRODUCTION_CONVERGENCE_TRACKER.md`](../PRODUCTION_CONVERGENCE_TRACKER.md)
y el runbook
[`../runbooks/F3_PROJECT_LIFECYCLE_EVENT_CANARY.md`](../runbooks/F3_PROJECT_LIFECYCLE_EVENT_CANARY.md)
(no re-verificados en este pase).

Estos datos son un snapshot, no una garantia permanente. Cada documento de
estado posterior debe registrar nuevo SHA, fecha y evidencia de CI/deploy.

## 12. Programa de ejecucion

El orden aprobado es F0-F9 y se mantiene en [`../../ROADMAP.md`](../../ROADMAP.md):

1. F0: sincronizar la verdad.
2. F1: Event Backbone.
3. F2: Prometeo Tool Registry gobernado.
4. F3: Project Lifecycle Projection.
5. F4: Mission Control 2.0 — código mergeado (#486); encendido por flag o lista canario; activación de producción no re-verificada desde 2026-10-11.
6. F5: Shared Economic Ledger.
7. F6: Agenda y Dispatch.
8. F7: Prometeo Multimodal.
9. F8: Domain Loops.
10. F9: Production Hardening.

## 13. Regla de cambio

Un cambio arquitectonico de alto impacto requiere:

1. spec o ADR;
2. impacto en datos y migracion;
3. contrato de seguridad/permisos;
4. criterios de aceptacion y rollback;
5. pruebas proporcionadas al riesgo;
6. actualizacion de esta arquitectura o de la matriz si cambia el estado real.
