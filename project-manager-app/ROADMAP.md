# Roadmap maestro de SEMSEproject

**Actualizado:** 2026-07-31
**Arquitectura:** [`docs/architecture/CURRENT_ARCHITECTURE.md`](docs/architecture/CURRENT_ARCHITECTURE.md)
**Matriz:** [`docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md`](docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md)

El roadmap anterior describia una migracion futura hacia monorepo, API, Prisma y
RBAC. Esas fundaciones ya existen. El programa activo consolida el ecosistema
actual sin reescritura ni renombramiento masivo.

## Estado base

- Monorepo pnpm, Next.js, NestJS, Prisma, PostgreSQL, Redis y BullMQ existen.
- Core, Connect, Payments, Trust, AI, Agro, BuildOps, Knowledge e Integrations
  tienen implementacion real en distintos grados.
- Prometeo Runtime P2 esta fusionado y desplegado.
- `origin/main` y API/Web/Worker/Vision están en `114cb9ca`, todos con
  deployments terminales `SUCCESS`; ese SHA contiene F3 (`f1234291`).
- F1-D y Product Intelligence PI-00..PI-06 están integrados. Los switches del
  Event Backbone se activaron con allowlists acotadas para Evidence y F3; esto
  no equivale al cierre global F1-F.
- El programa F3-F9 está gobernado por
  `docs/specs/platform/production-convergence-program.spec.md`.

## F0 — Sincronizar la verdad (COMPLETADO; REVALIDADO 2026-07-28)

Entregables:

- arquitectura vigente canónica;
- contexto operativo para agentes;
- matriz implementado/parcial/pendiente;
- roadmap F0-F9;
- documentos historicos marcados como supersedidos;
- snapshot de `main` frente a produccion.

Gate de salida:

- ningun documento canónico afirma que el repo carece de API/DB/monorepo;
- Prometeo P2 aparece como desplegado;
- cada sistema transversal distingue estado real de arquitectura objetivo.
- la línea base mantiene 98 specs y `spec:validate:strict` reporta 0 errores y
  0 warnings;
- el snapshot registra por separado `main`, checkout local, CI, deploy,
  endpoints y configuracion no verificable.

## F1 — Event Backbone (F1-A..F1-E EN MAIN; F1-F CIERRE TRANSVERSAL PENDIENTE)

Contrato ejecutable:

- [`docs/specs/platform/event-backbone.spec.md`](docs/specs/platform/event-backbone.spec.md)
- [`docs/specs/platform/event-backbone.plan.md`](docs/specs/platform/event-backbone.plan.md)
- [`docs/specs/platform/event-backbone.tasks.md`](docs/specs/platform/event-backbone.tasks.md)
- [`docs/architecture/ADR-022-transactional-outbox-bullmq.md`](docs/architecture/ADR-022-transactional-outbox-bullmq.md)

Objetivo: introducir entrega durable sin reemplazar de golpe el bus actual.

Entregables:

- envelope `SemseDomainEvent` v2;
- catalogo versionado y schemas Zod/JSON Schema;
- correlation, causation, idempotency, actor y trace context;
- modelo outbox y dispatcher;
- ingress BullMQ;
- consumer idempotente;
- retry, DLQ, replay y metricas de lag;
- primer slice vertical end-to-end.

Slice recomendado: `evidence.submitted -> review -> milestone readiness`, sin
activar liberacion monetaria automatica.

Estado del corte:

- F1-A: contratos v2 y migracion aditiva, completado;
- F1-B: producer atomico `Evidence + outbox`, completado;
- F1-C: dispatcher con leases e ingreso BullMQ, completado;
- F1-D: worker y consumer `evidence-readiness.v1` idempotente, completado;
- F1-E: outbox list/delivery/replay, RBAC (`domain-events:read`/`domain-events:replay`
  + `OPS_ADMIN`), redaccion y trace extendido, completado en `main`
  (PR #354, #355; reporte `docs/reportes/F1E_OPS_DLQ_REPLAY_2026-07-19.md`);
- F1-F: los switches y allowlists se ejercitaron mediante el canary F3, pero el
  canary/SLO transversal y el cierre global F1 siguen pendientes.
- receipt y efecto se confirman en la misma transaccion;
- duplicados, crash/retry, no-op sin milestone y dead letter fueron probados
  contra PostgreSQL y Redis reales;
- `Milestone.status`, `paymentReadiness` y Payments no son mutados.

El código F1-D/F1-E está mergeado/desplegado. Dispatcher y consumers están
activos sólo para types/consumers allowlisted; no se declara el backbone
globalmente cerrado.

Gate de salida:

- business write + outbox se confirman atomicamente;
- replay no duplica efectos;
- un fallo llega a DLQ y se recupera desde una operacion auditada;
- compatibilidad con eventos v1 documentada.

## Programa transversal — Product Intelligence

PI observa la experiencia sin mezclar `ProductEvent` con `DomainEvent` y sin
aplicar cambios automaticos.

- PI-00..PI-04: spec, guard Prisma, SDK, modelos, ingesta y retencion,
  completados;
- PI-05: instrumentacion auth/registro/wizard y funnel admin, completado;
- PI-06: funnel economico derivado de Job/Bid/Contract/PaymentEscrow,
  completado;
- PI-07: Friction Engine, siguiente incremento;
- PI-08..PI-11: anomaly signals, Observer, Mission Control y hardening,
  pendientes.

El codigo PI-06 esta desplegado. La activacion de
`PRODUCT_INTELLIGENCE_ENABLED` y
`NEXT_PUBLIC_PRODUCT_INTELLIGENCE_ENABLED` no fue verificada.

## F2 — Prometeo Tool Registry gobernado (GOBERNANZA EN MAIN — PRs #369/#371/#372; adapters `vision.*` cableados 2026-07-20 salvo `analyze_video`)

Entregables:

- [x] contrato comun de adapters (`invokeReadTool`/`invokeWriteTool` en `PrometeoToolExecutionService`);
- [x] permisos y scopes por tool (`evaluatePrometeoToolPolicy` gatea el 100% de invocaciones, no solo `agents:run:create` — F2-A/B);
- [x] policy/risk/approval consistente (`approvalPolicy`: `none`/`confirm`/`human_required`; `PrometeoProposedAction` + `POST /v1/prometeo/tools/invocations/:id/approve|reject` — F2-C/D);
- [x] resultados estructurados y auditables (`PrometeoToolInvocationAudit` por invocacion; `resultJson`/`auditRef` en cada ejecucion);
- [x] habilitar mutaciones de bajo riesgo gradualmente (6 write tools cableadas: `time_tracker.*`, `agro.create_task` — F2-C);
- [x] gate hibrido de pagos (`payments.propose_release` -> `PaymentsService.release()` real via aprobacion `human_required` de un `OPS_ADMIN` — F2-D);
- [x] completar adapters read declarados: 5 de las 6 tools `vision.*` cableadas a `VisionService` real (`analyze_image`, `compare_before_after`, `detect_material`, `classify_space`, `check_safety`); solo `analyze_video` sigue `adapter_pending` — necesita un pipeline temporal que no existe hoy, tratado como capacidad separada ("Video tool" en la matriz), no como deuda de gobernanza;
- [ ] verification y compensacion explicita (hoy: estado terminal `BLOCKED`/`EXECUTED` + audit trail; no hay un paso de verification/compensacion separado — evaluar si aplica en un incremento futuro).

Gate de salida:

- [x] ninguna tool declarada aparece como ejecutable sin adapter (`executable: !adapterPending` es real por tool);
- [x] write tools requieren aprobacion cuando corresponde (las 7 tienen `approvalPolicy` != `none`; ninguna se forzo a `none` sin decision de producto);
- [x] cada ejecucion deja `auditRef` y `resultado` reales;
- [ ] "verification status" explicito — no implementado como campo separado, ver nota arriba.

## F3 — Project Lifecycle Projection (VERIFIED EN CANARY)

Contrato ejecutable:

- [`docs/specs/operations/project-lifecycle-projection.spec.md`](docs/specs/operations/project-lifecycle-projection.spec.md)
- [`docs/specs/operations/project-lifecycle-projection.plan.md`](docs/specs/operations/project-lifecycle-projection.plan.md)
- [`docs/specs/operations/project-lifecycle-projection.tasks.md`](docs/specs/operations/project-lifecycle-projection.tasks.md)

Estado del corte:

- spec SDD 2.0 `VERIFIED`, CI/E2E/integración `PASS`, merge/deploy completos;
- código event-driven mergeado en `f1234291`; `origin/main@114cb9ca` lo contiene;
- PostgreSQL tiene las tres migraciones F3 aplicadas, incluida la reparación
  canónica de Evidence verificada con nueve columnas, cero tenant nulo, dos FKs
  y tres índices;
- cálculo y persistencia están activos sólo para `tenant_default`;
- el canary autenticado produjo revisión estable y un snapshot durable con
  mismatch cero;
- rebuild idempotente, evento/consumer, consumo automático, duplicado y replay
  quedaron verificados: 5 publicaciones, 5 consumos y cero estados fallidos;
- F3 queda cerrado para el scope canary, no promovido globalmente.

Crear un read model por proyecto que responda:

- etapa actual;
- bloqueos;
- responsable de la proxima accion;
- fechas y SLA en riesgo;
- costo, gasto, saldo y forecast;
- evidencia faltante;
- pago retenido;
- trust/risk signals.

Gate de salida: cumplido para `tenant_default`; la vista es coherente y
reconstituible por replay. F4 es el siguiente child; su SDD ya está aprobado y
abre la implementación reversible.

## F4 — Mission Control 2.0

**Child SDD 2.0 `operations.mission-control-2` aprobado y analizado;
implementación pendiente.**

Contrato ejecutable:

- [`docs/specs/operations/mission-control-2.spec.md`](docs/specs/operations/mission-control-2.spec.md)
- [`docs/specs/operations/mission-control-2.plan.md`](docs/specs/operations/mission-control-2.plan.md)
- [`docs/specs/operations/mission-control-2.tasks.md`](docs/specs/operations/mission-control-2.tasks.md)
- [`docs/specs/operations/mission-control-2.checklist.md`](docs/specs/operations/mission-control-2.checklist.md)

Unificar exceptions y acciones de:

- servicios/deploys;
- events/outbox/DLQ;
- workers/loops;
- misiones y approvals;
- evidence/payments/disputes;
- BuildOps/Agro;
- integrations y observabilidad.

Gate de salida: pause/resume/retry/replay/escalate tienen permisos, motivo,
auditoria y runbook.

## F5 — Shared Economic Ledger

Entregables:

- accounts, entries y balanced lines;
- costos e ingresos normalizados;
- fees, reservas, payables/receivables;
- reversals inmutables;
- reconciliacion y trial balance;
- integracion Payments, BuildOps, Agro y Labor Engine.

Gate de salida: debitos = creditos, replay idempotente y reportes reproducibles.

## F6 — Agenda y Dispatch

Entregables:

- disponibilidad y conflictos;
- visitas, asignacion y rutas;
- reminders y SLA;
- rescheduling/escalation;
- sincronizacion con calendarios externos.

Gate de salida: no double booking, timezones probados y recordatorios
idempotentes.

## F7 — Prometeo Multimodal

Entregables:

- voz, camara, fotos y archivos binarios;
- video intelligence;
- transcripcion y Evidence capture;
- contexto de pantalla;
- streaming, tool cards y approval cards;
- quotas, retention y redaccion.

Gate de salida: lineage de archivos, limites y review humano para decisiones de
alto impacto.

## F8 — Domain Loops

Loops prioritarios:

- proyectos/hitos detenidos;
- evidencia vencida;
- costos fuera de presupuesto;
- pagos sin reconciliar;
- tracker sin sincronizacion;
- inventario critico y seguimiento Agro;
- contratos/licencias/seguros vencidos;
- integraciones caidas;
- drift spec-codigo.

Gate de salida: leases, budgets, max retries, kill switch, dry-run y human review.

## F9 — Production Hardening

Entregables:

- migration gates y rollback;
- backup/restore DB y storage;
- OTel y SLOs de negocio;
- rate limits, secret rotation y incident response;
- canary, load tests y DR drills;
- compliance y retencion verificables.

Gate de salida: RPO/RTO demostrados, runbooks operables y journeys criticos
estables durante canary.

## Reglas del programa

1. No big-bang rewrite ni rename masivo.
2. No introducir Temporal antes de demostrar que BullMQ no cubre el workflow.
3. No habilitar auto-merge ni mutaciones criticas autonomas.
4. Cada fase entrega un slice vertical verificable, no solo infraestructura.
5. Codigo, tests, merge y produccion se reportan por separado.
