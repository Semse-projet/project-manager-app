# Matriz de implementacion de la arquitectura SEMSE

**Corte:** 2026-07-17
**Base codigo/produccion:** `main@646528c64cfb774c74bef119522d73b1b2578bd8`
**Limitacion:** deploy exact-SHA y superficies públicas fueron verificados por
Railway/GitHub; flags, allowlists y servicios privados no fueron inspeccionados.

## Leyenda

- **IMPLEMENTADO:** existe en codigo y tiene evidencia de validacion relevante.
- **PARCIAL:** existe una parte util, pero falta el contrato transversal o el
  criterio de cierre.
- **PENDIENTE:** no existe como capacidad comun verificable.
- **DESPLEGADO:** verificado en produccion para el SHA del corte.
- **ACTIVO:** feature flag/allowlist verificada. No se infiere de
  **DESPLEGADO**.

## Matriz

| Capacidad | Estado | Evidencia actual | Criterio de cierre siguiente |
| --- | --- | --- | --- |
| Monorepo pnpm | IMPLEMENTADO | `pnpm-workspace.yaml`, `apps/*`, `packages/*` | Mantener `pnpm verify:workspace` verde |
| Web/BFF | IMPLEMENTADO/DESPLEGADO | `apps/web`, Route Handlers, Railway Web HTTP 200 | SLO y trazas por journey |
| API NestJS/Prisma | IMPLEMENTADO/DESPLEGADO | `apps/api`, `packages/db`, `/v1/health` HTTP 200 | Telemetria end-to-end y ownership por bounded context |
| Worker/BullMQ | IMPLEMENTADO | `apps/worker`, queues, scheduled jobs, autonomy loops | Consola comun de retries/DLQ y event lag |
| Nueve dominios | IMPLEMENTADO/DESPLEGADO como superficies canónicas | `pnpm verify:modules`; 9 probes API protegidos + 9 páginas web verdes en Production Health `29599005110` | Mantener ownership, profundidad honesta y gate 9/9 |
| Prometeo Runtime P2 | IMPLEMENTADO/DESPLEGADO | `PrometeoMissionService`, `AgentWorkPlan`, controllers/BFF; PR #289 | Verify/learn, budgets, timeout y compensacion |
| Tool Registry | PARCIAL | 23 descriptors read, 7 write; 17 casos read cableados | Adapter por tool, policy central, audit y verification; write gradual |
| Video tool | PENDIENTE | Descriptor `vision.analyze_video` marcado `adapter_pending` | Pipeline temporal, storage, limits y review humano |
| Domain Event schema | IMPLEMENTADO para slice Evidence | `domain-events-v2.schema.ts`, envelope v2 y `evidence.uploaded.v1` | Ampliar catalogo versionado dominio por dominio |
| Domain Event bus | PARCIAL (F1-D); DESPLEGADO; ACTIVACION NO VERIFICADA | Evidence state+outbox, dispatcher BullMQ, worker y receipt/efecto atomico | Ops/replay, trace extendido, canary y adopcion multi-dominio |
| Event Catalog | PARCIAL | `docs/foundation/EVENT_CATALOG.md` | Alinear nombres al schema, versionar y mapear producers/consumers |
| Transactional Outbox general | PARCIAL (F1-D); DESPLEGADO; ACTIVACION NO VERIFICADA | Contratos v2, producer Evidence atomico, dispatcher con leases, BullMQ ingress y `evidence-readiness.v1` | Replay/operacion F1-E, canary F1-F y mas producers |
| Communications delivery outbox | PARCIAL | Delivery row + adapter WhatsApp | Separar persistencia de envio; worker/retry/circuit breaker durable |
| Idempotencia transversal | PARCIAL | Unique producer key y receipt `(eventId, consumerName)` probados con concurrencia/crash | Replay autorizado y adopcion por cada consumer |
| Event DLQ/replay | PARCIAL | Outbox y consumer alcanzan `DEAD_LETTER`; BullMQ corta 4xx terminal | Replay RBAC/tenant/auditado y operacion desde Mission Control |
| Payment orchestration | IMPLEMENTADO/PARCIAL | `PaymentEscrow`, `PaymentTxn`, Stripe, payment governance | Reconciliacion integral y lenguaje legal consistente |
| Shared Economic Ledger | PENDIENTE | PaymentTxn y credit ledgers verticales no son double-entry comun | Accounts, entries, balanced lines, reversals y trial balance |
| Evidence provenance | PARCIAL | checksum, metadata, geo, validation, Vision, bucketKey | Chain of custody, signatures, retention y access history unificados |
| Object storage abstraction | PARCIAL | `StorageService` local/S3-R2 y MinIO local | Verificar provider/retention/backups por ambiente |
| Trust/Governance | IMPLEMENTADO/PARCIAL | ratings, trust, governance credits, compliance, disputes | Rulebook versionado y explicacion/apelacion universal |
| RBAC boundary | IMPLEMENTADO | `@RequirePermissions`, guard default-deny, specs | Tests de resource authorization y step-up para acciones criticas |
| Policy/Approval Engine | PARCIAL | Aprobaciones verticales y reglas locales | Contrato comun principal/action/resource/context + decision reason |
| Mission Control | PARCIAL | `/admin/mission-control`, signals, incidents, SSE y AI health | Cockpit unico de exceptions, events, queues, approvals y runbooks |
| Project Lifecycle Projection | PENDIENTE como proyeccion unica | Datos existen en projects, milestones, evidence y payments | Read model versionado con bloqueo, owner, fecha, costo y next action |
| Product Intelligence | IMPLEMENTADO/PARCIAL (PI-00..PI-06); DESPLEGADO; ACTIVACION NO VERIFICADA | `@semse/product-events`, modelos/ingesta/retencion, auth-wizard funnel y funnel economico | Activar/verificar flags; PI-07 Friction Engine y PI-08..PI-11 |
| Workspace/Context Bridge | PARCIAL | developer runtime, context bridge panel y contexto operacional | Terminal registry, shared mission context y policy de scopes |
| SDD/Blueprint Engine | PARCIAL | specs, preflight, developer runtime y plan mode | Flujo gobernado idea->spec->tasks->PR->deploy->observacion |
| Knowledge/RAG | IMPLEMENTADO/PARCIAL | documents, chunks, hybrid retrieval, embeddings, Graphify, feedback | Learning loop, source governance y evaluation set transversal |
| Vision | IMPLEMENTADO/PARCIAL | servicio, analyzers, persistence y UI | Validacion continua con evidencia real y thresholds por vertical |
| Agro | IMPLEMENTADO/PARCIAL | modelos y servicios de fincas, animales, grupos, costos, tareas y sync | Offline completo, ledger comun y flows productivos restantes |
| Labor Engine | IMPLEMENTADO/PARCIAL | tracker, sesiones, rates, admin y worker flows | Cost posting comun, approvals y payroll/export governance |
| Agenda/Dispatch | PARCIAL | reservations, disponibilidad/field ops y weather/travel dispersos | Calendar canónico, conflicts, routing, reminders y rescheduling |
| Observabilidad | PARCIAL | Sentry, Prometheus, health/readiness y audit | OTel traces, correlation y SLOs de negocio |
| Backup/DR | PARCIAL | BCP/restore simulations para operacion asistida | Restore real DB/storage, PITR y evidencia RPO/RTO |
| CI/CD | IMPLEMENTADO/DESPLEGADO | CI, CodeQL, smoke, integration, deploy exact-SHA `29598805544` y health gate `29599005110` verdes para `646528c` | Mantener pipeline <15 min o justificar excepcion; migration gates |
| Salud SDD | IMPLEMENTADO | baseline: 66 specs, 0 errores, 0 warnings; 61/66 con tests y 45/66 VERIFIED; CI del corte verde | Mantener metadata/evidencia; completar T-016 y validacion/canary F1-E/F |

## Hallazgos que cambian documentos anteriores

1. `SEMSEPROJECT_BLUEPRINT.md` y el `ROADMAP.md` anterior describian una app
   local sin API. Esa descripcion ya no es valida.
2. Prometeo Runtime P2 esta en `main` y en Railway. `/v1/prometeo/tools` no es
   404; requiere autenticacion y responde 401 sin Bearer token.
3. El Event Backbone no debe marcarse como inexistente: F1-A-F1-D implementan
   un slice durable de Evidence. Tampoco debe marcarse como cerrado o activo:
   replay operacional, canary y adopcion multi-dominio siguen pendientes.
4. `CommunicationsOutboxService` es una capacidad vertical; no sustituye la
   outbox de plataforma.
5. `PaymentTxn` registra movimientos de pago, pero no implementa contabilidad
   double-entry compartida.
6. Prometeo tiene registry real; la brecha es gobernanza y ejecucion completa,
   no la ausencia total de catalogo.
7. Product Intelligence ya no es solo analytics disperso: PI-00..PI-06 tienen
   SDK, persistencia, ingesta e interfaces. Su activacion en Railway no fue
   verificada.

## Protocolo para actualizar esta matriz

Cada cambio de estado debe registrar:

- SHA de codigo;
- spec/test que demuestra el comportamiento;
- estado de PR/merge;
- estado de produccion cuando aplique;
- criterio pendiente si permanece PARCIAL.

No se acepta marcar **IMPLEMENTADO** solo porque exista un archivo o una UI de
demostracion.
