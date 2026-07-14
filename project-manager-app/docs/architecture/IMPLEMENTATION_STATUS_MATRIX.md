# Matriz de implementacion de la arquitectura SEMSE

**Corte:** 2026-07-12
**Base:** `main@b7691f4e209a4fdce250da063b75b790bd48679d`

## Leyenda

- **IMPLEMENTADO:** existe en codigo y tiene evidencia de validacion relevante.
- **PARCIAL:** existe una parte util, pero falta el contrato transversal o el
  criterio de cierre.
- **PENDIENTE:** no existe como capacidad comun verificable.
- **DESPLEGADO:** verificado en produccion para el SHA del corte.

## Matriz

| Capacidad | Estado | Evidencia actual | Criterio de cierre siguiente |
| --- | --- | --- | --- |
| Monorepo pnpm | IMPLEMENTADO | `pnpm-workspace.yaml`, `apps/*`, `packages/*` | Mantener `pnpm verify:workspace` verde |
| Web/BFF | IMPLEMENTADO/DESPLEGADO | `apps/web`, Route Handlers, Railway Web HTTP 200 | SLO y trazas por journey |
| API NestJS/Prisma | IMPLEMENTADO/DESPLEGADO | `apps/api`, `packages/db`, `/v1/health` HTTP 200 | Telemetria end-to-end y ownership por bounded context |
| Worker/BullMQ | IMPLEMENTADO | `apps/worker`, queues, scheduled jobs, autonomy loops | Consola comun de retries/DLQ y event lag |
| Nueve dominios | IMPLEMENTADO como taxonomia | `docs/SEMSE_CONNECT_TAXONOMY.md` y modulos mapeados | Mantener ownership y evitar duplicacion cross-domain |
| Prometeo Runtime P2 | IMPLEMENTADO/DESPLEGADO | `PrometeoMissionService`, `AgentWorkPlan`, controllers/BFF; PR #289 | Verify/learn, budgets, timeout y compensacion |
| Tool Registry | PARCIAL | 23 descriptors read, 7 write; 17 casos read cableados | Adapter por tool, policy central, audit y verification; write gradual |
| Video tool | PENDIENTE | Descriptor `vision.analyze_video` marcado `adapter_pending` | Pipeline temporal, storage, limits y review humano |
| Domain Event schema | PARCIAL | `packages/schemas/src/domain-events.schema.ts` con union Zod | Envelope v2 con IDs, version en type, causation, idempotency, schemaRef y trace |
| Domain Event bus | PARCIAL | AuditLog, notifications best-effort y AgentTriggerRouter con retry inline | Persistencia atomica, dispatcher, durable delivery y replay |
| Event Catalog | PARCIAL | `docs/foundation/EVENT_CATALOG.md` | Alinear nombres al schema, versionar y mapear producers/consumers |
| Transactional Outbox general | PARCIAL (F1-B) | Contratos Zod v2, migracion aditiva y producer Evidence state+outbox atomico | Dispatcher, BullMQ ingress, consumer, replay y lag observable |
| Communications delivery outbox | PARCIAL | Delivery row + adapter WhatsApp | Separar persistencia de envio; worker/retry/circuit breaker durable |
| Idempotencia transversal | PARCIAL | Headers y reglas puntuales | Inbox/consumer keys y pruebas de replay por slice |
| Event DLQ/replay | PARCIAL | AgentRun dead-letter y replay de algorithm engine | DLQ de eventos y operacion desde Mission Control |
| Payment orchestration | IMPLEMENTADO/PARCIAL | `PaymentEscrow`, `PaymentTxn`, Stripe, payment governance | Reconciliacion integral y lenguaje legal consistente |
| Shared Economic Ledger | PENDIENTE | PaymentTxn y credit ledgers verticales no son double-entry comun | Accounts, entries, balanced lines, reversals y trial balance |
| Evidence provenance | PARCIAL | checksum, metadata, geo, validation, Vision, bucketKey | Chain of custody, signatures, retention y access history unificados |
| Object storage abstraction | PARCIAL | `StorageService` local/S3-R2 y MinIO local | Verificar provider/retention/backups por ambiente |
| Trust/Governance | IMPLEMENTADO/PARCIAL | ratings, trust, governance credits, compliance, disputes | Rulebook versionado y explicacion/apelacion universal |
| RBAC boundary | IMPLEMENTADO | `@RequirePermissions`, guard default-deny, specs | Tests de resource authorization y step-up para acciones criticas |
| Policy/Approval Engine | PARCIAL | Aprobaciones verticales y reglas locales | Contrato comun principal/action/resource/context + decision reason |
| Mission Control | PARCIAL | `/admin/mission-control`, signals, incidents, SSE y AI health | Cockpit unico de exceptions, events, queues, approvals y runbooks |
| Project Lifecycle Projection | PENDIENTE como proyeccion unica | Datos existen en projects, milestones, evidence y payments | Read model versionado con bloqueo, owner, fecha, costo y next action |
| Product Intelligence | PARCIAL | analytics/reporting/operational intelligence | Funnels por rol, abandono y friccion ligados a versiones |
| Workspace/Context Bridge | PARCIAL | developer runtime, context bridge panel y contexto operacional | Terminal registry, shared mission context y policy de scopes |
| SDD/Blueprint Engine | PARCIAL | specs, preflight, developer runtime y plan mode | Flujo gobernado idea->spec->tasks->PR->deploy->observacion |
| Knowledge/RAG | IMPLEMENTADO/PARCIAL | documents, chunks, hybrid retrieval, embeddings, Graphify, feedback | Learning loop, source governance y evaluation set transversal |
| Vision | IMPLEMENTADO/PARCIAL | servicio, analyzers, persistence y UI | Validacion continua con evidencia real y thresholds por vertical |
| Agro | IMPLEMENTADO/PARCIAL | modelos y servicios de fincas, animales, grupos, costos, tareas y sync | Offline completo, ledger comun y flows productivos restantes |
| Labor Engine | IMPLEMENTADO/PARCIAL | tracker, sesiones, rates, admin y worker flows | Cost posting comun, approvals y payroll/export governance |
| Agenda/Dispatch | PARCIAL | reservations, disponibilidad/field ops y weather/travel dispersos | Calendar canónico, conflicts, routing, reminders y rescheduling |
| Observabilidad | PARCIAL | Sentry, Prometheus, health/readiness y audit | OTel traces, correlation y SLOs de negocio |
| Backup/DR | PARCIAL | BCP/restore simulations para operacion asistida | Restore real DB/storage, PITR y evidencia RPO/RTO |
| CI/CD | IMPLEMENTADO | quality gates, coverage, E2E, smoke, integration, Railway health | Mantener pipeline <15 min o justificar excepcion; migration gates |
| Salud SDD | IMPLEMENTADO | `spec:validate -- --strict`: 64 specs, 0 errores, 0 warnings; `spec:coverage`: 92% con tests, 70% VERIFIED | Mantener metadata/evidencia; F1-B debe ampliar pruebas de integración T-012–T-017 |

## Hallazgos que cambian documentos anteriores

1. `SEMSEPROJECT_BLUEPRINT.md` y el `ROADMAP.md` anterior describian una app
   local sin API. Esa descripcion ya no es valida.
2. Prometeo Runtime P2 esta en `main` y en Railway. `/v1/prometeo/tools` no es
   404; requiere autenticacion y responde 401 sin Bearer token.
3. El Event Backbone no debe marcarse como inexistente: hay schema, bus,
   auditoria y consumidores. Tampoco debe marcarse como terminado: los writes de
   dominio y la entrega no comparten una outbox transaccional general.
4. `CommunicationsOutboxService` es una capacidad vertical; no sustituye la
   outbox de plataforma.
5. `PaymentTxn` registra movimientos de pago, pero no implementa contabilidad
   double-entry compartida.
6. Prometeo tiene registry real; la brecha es gobernanza y ejecucion completa,
   no la ausencia total de catalogo.

## Protocolo para actualizar esta matriz

Cada cambio de estado debe registrar:

- SHA de codigo;
- spec/test que demuestra el comportamiento;
- estado de PR/merge;
- estado de produccion cuando aplique;
- criterio pendiente si permanece PARCIAL.

No se acepta marcar **IMPLEMENTADO** solo porque exista un archivo o una UI de
demostracion.
