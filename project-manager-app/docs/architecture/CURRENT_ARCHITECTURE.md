# Arquitectura vigente de SEMSEproject

**Estado:** CANONICA
**Corte verificado:** 2026-07-12
**Codigo verificado:** `main@b7691f4e209a4fdce250da063b75b790bd48679d`
**Repositorio:** `Semse-projet/project-manager-app`
**Raiz de aplicacion:** `project-manager-app/`

Este documento describe la arquitectura vigente y la direccion aprobada. No
reemplaza los contratos SDD, modelos Prisma ni tests. Su funcion es ordenar esas
fuentes y evitar que documentos historicos vuelvan a describir el repositorio
como una app local sin backend.

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

## 2. Jerarquia de fuentes de verdad

En caso de contradiccion se usa este orden:

1. Codigo actual de `main`.
2. Specs aprobados, contratos Zod, modelos Prisma, migrations y tests.
3. Estado comprobado en produccion.
4. Documentacion operativa actualizada.
5. Conversaciones y vision de producto.
6. Investigacion externa.

Una capacidad puede estar implementada, probada, integrada y desplegada en
momentos distintos. Los documentos deben declarar esas etapas por separado.

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
| SEMSE Agro | Fincas, animales, cultivos, inventario, costos y trazabilidad | `apps/api/src/modules/agro`, `apps/web/app/agro`, `apps/mobile` |
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
- `apps/vision-service`: analisis visual especializado.
- `apps/autonomy-server`: runtime de autonomia donde se despliegue.
- `apps/mobile`: cliente movil y primitives offline.
- `apps/angular` y `apps/assistant-portal`: superficies adicionales o de
  transicion; no redefinen la raiz canónica.

Paquetes compartidos existentes:

```text
packages/agents       packages/auth       packages/autonomy
packages/db           packages/knowledge  packages/schemas
packages/sdk          packages/shared     packages/tools
packages/ui
```

Los futuros paquetes `events`, `policies`, `ledger` y `observability` solo se
crearan cuando la responsabilidad transversal ya no pueda vivir con claridad
en los modulos actuales.

## 6. Sistemas transversales y estado real

| Sistema | Estado | Hecho verificado | Brecha principal |
| --- | --- | --- | --- |
| Domain Events | Parcial | Union Zod tipada, bus NestJS, auditoria y routing a agentes/notificaciones | Envelope incompleto, nombres sin version y cobertura limitada por dominio |
| Transactional Outbox | Parcial/vertical | Existe persistencia de delivery en comunicaciones | No hay outbox transaccional general junto al write de dominio ni dispatcher durable |
| BullMQ y loops | Implementado/parcial | Worker, retries, backpressure, kill switch y agent runs dead-lettered | Falta unificar observabilidad, replay y DLQ por evento |
| Prometeo Runtime P2 | Implementado y desplegado | Misiones persistentes sobre `AgentWorkPlan`, aprobacion y checkpoints | Mutaciones, compensacion, budgets y verificacion transversal pendientes |
| Prometeo Tool Registry | Parcial | 23 tools read y 7 write declaradas; 17 casos read cableados | Write bloqueado; tools declaradas sin adapter; permisos por tool aun dispersos |
| Evidence provenance | Parcial | Evidence, checksum, metadata, geo, analisis visual y storage abstraction | Chain of custody, firmas, retencion y acceso no estan unificados |
| Economic Ledger | Pendiente como sistema comun | `PaymentTxn` y ledgers verticales registran movimientos operativos | No existe double-entry compartido, cuentas, lineas, reversals ni trial balance |
| Policy/Approval | Parcial | RBAC default-deny y aprobaciones en Prometeo, BuildOps y Payments | No existe decision engine transversal versionado |
| Mission Control | Parcial | UI, signals, incidents, SSE, AI health y acciones operativas | Las colas y workspaces siguen fragmentados; no hay cockpit unico de eventos/DLQ |
| Product Intelligence | Parcial | Analytics, reporting, operational intelligence y metricas | Falta un modelo transversal de funnels y friccion por journey/rol |
| Workspace/Context Bridge | Parcial | Developer runtime, context bridge panel y capas de contexto existentes | Registry de terminales, shared mission context y scopes uniformes |
| SDD/Blueprint Engine | Parcial | Specs, preflight, developer runtime y flujos de plan | Pipeline idea->spec->tasks->PR->deploy gobernado de punta a punta |
| Observabilidad | Parcial | Sentry, metricas Prometheus, health/readiness y auditoria | No hay trazas OTel end-to-end ni SLOs de negocio completos |
| Storage | Parcial | Storage service con local y S3/R2, MinIO local, Evidence bucket keys | Debe verificarse provider y politicas de retencion en cada ambiente |
| Offline | Parcial | Mobile offline store y Agro sync service | No hay sincronizacion compartida completa ni UX offline uniforme |
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

## 8. Event Backbone objetivo

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

El envelope canónico futuro debe contener al menos:

```text
eventId, eventType, version, occurredAt, recordedAt,
tenantId, orgId, actor, module, entityType, entityId,
correlationId, causationId, idempotencyKey,
payload, metadata, traceContext, schemaRef
```

No se migrara con un big bang. F1 debe introducir el envelope y la outbox en un
slice vertical de alto valor, probar replay/idempotencia y luego ampliar dominio
por dominio.

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

## 11. Estado de produccion verificado

Verificado el 2026-07-12 despues de la PR #289:

- `main`: `b7691f4e209a4fdce250da063b75b790bd48679d`.
- Railway Deploy: exitoso.
- Production Health Gate: exitoso.
- API `/v1/health`: HTTP 200.
- Web: HTTP 200.
- `/v1/prometeo/tools`: HTTP 401 sin token, confirmando que la ruta esta
  desplegada y protegida; el estado anterior de HTTP 404 queda supersedido.
- CI de `main`: quality gates, coverage y E2E exitosos.

Estos datos son un snapshot, no una garantia permanente. Cada documento de
estado posterior debe registrar nuevo SHA, fecha y evidencia de CI/deploy.

## 12. Programa de ejecucion

El orden aprobado es F0-F9 y se mantiene en [`../../ROADMAP.md`](../../ROADMAP.md):

1. F0: sincronizar la verdad.
2. F1: Event Backbone.
3. F2: Prometeo Tool Registry gobernado.
4. F3: Project Lifecycle Projection.
5. F4: Mission Control 2.0.
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
