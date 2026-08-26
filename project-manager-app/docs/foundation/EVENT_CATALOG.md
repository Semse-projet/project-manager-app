# Event Catalog

## Objetivo

Definir el catálogo mínimo de eventos del sistema para que SEMSEproject opere
como plataforma auditable y automatizable, y no como simple CRUD.

## Regla

Un evento existe para:

- auditoría;
- workers;
- notificaciones;
- trust;
- agentes;
- reconciliación;
- observabilidad.

Si una acción importante no produce evento ni deja audit log, está incompleta.

## Convención

- formato: `aggregate.action`
- payload mínimo:
  - `eventId`
  - `eventType`
  - `aggregateType`
  - `aggregateId`
  - `actorType`
  - `actorId`
  - `timestamp`
  - `requestId`
  - `metadata`

## Contratos F1 versionados

Los siguientes nombres están reservados por
[`../specs/platform/event-backbone.spec.md`](../specs/platform/event-backbone.spec.md),
El slice Evidence F1-A..F1-D ya está integrado en `main`: contrato v2, productor
atómico, outbox, dispatcher BullMQ y consumer idempotente. Sigue controlado por
kill switches/allowlists; los switches se ejercitaron durante F3, pero F1-F
transversal aún no está cerrado:

- `evidence.uploaded.v1`

F1-E (Ops/replay) implementado sobre `main`: list/delivery/replay tenant-scoped
con RBAC (`domain-events:read` / `domain-events:replay` + `OPS_ADMIN`), redaction
de payload y auditoría con `replayCount`. Se registra como AuditLog
(`domain.event.emit`, `entityType: DomainEvent`) al ejecutar un replay:

- `ops.event_replay_requested.v1`

La convención v1 sin suffix permanece activa para código existente. La
migración es productor por productor y usa adapter explícito; no se hace
dual-write.

## Project Lifecycle Projection F3

Contrato canónico desplegado y verificado en canary para `tenant_default`:

- Evento: `project.lifecycle-source-changed.v1`
- Schema ref:
  `semse://schemas/events/project.lifecycle-source-changed.v1`
- Módulo/agregado: `projects` / `Project`
- Consumer: `project-lifecycle-projection.v1`
- Resultado: rebuild tenant-scoped, persistencia CAS, AuditLog y receipt
  `DomainEventConsumption`

Payload:

```yaml
projectId: string
sourceEventType: string
sourceEntityType: string
sourceEntityId: string
```

El envelope v2 conserva actor, tenant, org, correlation, causation e
idempotency key. Los hooks cubren cambios relevantes de Project,
Milestone/Evidence, Dispute, Payment, Expense, Risk y promoción BuildOps.

Evidence registra su mutación y outbox F3 en la misma transacción. Los demás
hooks actuales son post-commit best-effort; el cálculo read-through y el
rebuild idempotente son la recuperación documentada. No se atribuye atomicidad
a esos productores hasta que su bounded context adopte outbox transaccional.

Canary de producción: cinco eventos `PUBLISHED`, cinco consumos `COMPLETED`,
cero estados failed/dead-letter y replay `no_op` sin efecto duplicado. La
activación sigue limitada por flags y allowlists; no es rollout global.

## Auth / Identity

- `user.created`
- `user.password_changed`
- `user.verified`
- `user.suspended`
- `organization.created`
- `membership.created`
- `membership.updated`

## Jobs & Bids Event Projection

Reconciliación 2026-08-26 (ver
[`../specs/operations/jobs-bids-event-projection.spec.md`](../specs/operations/jobs-bids-event-projection.spec.md)):
la lista anterior de `## Jobs` (`job.posted`, `job.reserved`, `job.started`,
`job.review_requested`, `job.partially_paid`, `job.disputed`,
`job.cancelled`) era aspiracional — orientada a las transiciones FSM, no a
lo que `jobs.service.ts` emite realmente. El código solo emite tres tipos,
vía `DomainEventBus` (no outbox) desde `jobs.service.ts`:

- `job.created`
- `job.status_changed`
- `job.preferred_professional_selected`

Esta spec agrega el envelope v2 versionado para esos tres (dual-write junto
al `DomainEventBus` existente, que se mantiene intacto) y dos eventos
nuevos de `bids` que no existían en ningún catálogo hasta ahora:

- `job.created.v1`
- `job.status_changed.v1`
- `job.preferred_professional_selected.v1` (schema reservado — el productor
  de este evento en outbox no está instrumentado todavía, fuera del
  alcance de esta spec; ver spec §6)
- `bid.created.v1`
- `bid.accepted.v1`
- `bid.rejected.v1` (emitido por-bid, uno por cada bid competidor que
  pierde cuando otro es aceptado — no agregado)

Módulo/agregado: `jobs` / `Job` para los tres `job.*`; `bids` / `Bid` para
los tres `bid.*`. Consumer: `jobs-bids-projection.v1`, registrado en el
dispatch genérico de `domain-event-consumer.service.ts` (mismo mecanismo
de idempotencia `DomainEventConsumption` que `evidence-readiness.v1` /
`project-lifecycle-projection.v1`). Rebuild tenant-scoped desde estado
actual de `Job`+`Bid` (no aplicación de deltas), persistido con CAS por
`revision`+`sourceUpdatedAt` en `JobsBidsProjection`, mismo molde que
`ProjectLifecycleProjection`.

Read-through: `OperationalContextService.buildContext()` lee el campo
`jobs` desde la proyección solo si `SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED`
y el tenant está en `SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS`, con fallback
obligatorio a la query directa (`prisma.job.findMany()`) si la lectura
falla o la proyección todavía no alcanzó la cantidad real de jobs del
tenant (backfill en curso) — no negociable en el path de `POST
/prometeo/chat`, que llama `buildContext()` sin `.catch()`.

Activación (`SEMSE_JOBS_PROJECTION_ENABLED`,
`SEMSE_JOBS_PROJECTION_PERSIST_ENABLED`,
`SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS`,
`SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED`) sigue
`docs/runbooks/JOBS_BIDS_PROJECTION_CANARY.md` — no desplegada/activada
todavía al momento de este cambio (`activation_status: INACTIVE` en el
frontmatter de la spec).

## Reservations

- `reservation.created`
- `reservation.expired`
- `reservation.accepted`
- `reservation.released`

## Contracts

- `contract.generated`
- `contract.client_signed`
- `contract.professional_signed`
- `contract.activated`
- `contract.superseded`
- `contract.voided`

## Milestones

- `milestone.created`
- `milestone.updated`
- `milestone.submitted`
- `milestone.approved`
- `milestone.rejected`
- `milestone.revision_requested`
- `milestone.paid`

## Evidence

- `evidence.uploaded`
- `evidence.review_started`
- `evidence.accepted`
- `evidence.rejected`

## Project Originator (F10)

- `project.originator_proposed.v1`
- `project.originator_validated.v1`

`project.originator_reward_earned.v1` (spec §6) no se declara todavía —
sigue la misma disciplina del resto del catálogo de no registrar un evento
sin productor real (ver `docs/specs/core/originador-referral-program.spec.md`).

## Payments / Escrow

- `payment.intent_created`
- `payment.held`
- `payment.funded`
- `payment.release_requested`
- `payment.released`
- `payment.refunded`
- `payment.reconciled`

## Disputes

- `dispute.opened`
- `dispute.assigned`
- `dispute.evidence_submitted`
- `dispute.under_review`
- `dispute.resolution_proposed`
- `dispute.resolved`

## Trust

- `trust.signal_recorded`
- `trust.recalculated`
- `trust.flag_added`
- `trust.flag_cleared`

## Agents

- `agent.run_created`
- `agent.action_logged`
- `agent.human_review_requested`
- `agent.recommendation_accepted`
- `agent.recommendation_rejected`
- `agent.override_required`

### Productores — Prometeo (Orchestrator / Copilot)

Prometeo reutiliza los eventos canónicos existentes; no introduce nombres nuevos.

- **Prometeo Orchestrator** (`POST /v1/prometeo/orchestrate`) emite
  `agent.action_logged` (`agentType=prometeo-orchestrator`, `actionType=generate`,
  `targetType=orchestration`) al completar una orquestación. Cuando el plan
  `requiresApproval` (intención ambigua o pasos que mutan recursos protegidos)
  emite además `agent.human_review_requested`.
- **Prometeo Copilot** (`POST /v1/prometeo/copilot/mission/create`) emite
  `agent.action_logged` (`agentType=prometeo-copilot`, `actionType=generate`,
  `targetType=mission`) al materializar una misión en el Workspace.

Ambos se emiten vía `DomainEventBus` (audit + routing canónico). La detección de
contexto, el chat y las quick-actions read-only del Copilot, y la navegación del
Workspace, son estado de UI y **no** producen eventos (regla anti-ruido).

## Notifications

- `notification.queued`
- `notification.sent`
- `notification.read`

## Ops / Control

- `ops.override_applied`
- `ops.case_escalated`
- `ops.alert_raised`
- `ops.alert_resolved`

## Event consumers mínimos

### Audit

Consume todos los eventos sensibles.

### Notifications

Consume:

- `job.accepted`
- `milestone.submitted`
- `milestone.approved`
- `milestone.rejected`
- `payment.funded`
- `payment.released`
- `dispute.opened`
- `dispute.resolved`

### Trust

Consume:

- `milestone.approved`
- `milestone.rejected`
- `payment.released`
- `dispute.opened`
- `dispute.resolved`
- `reservation.expired`

### Agents

Consume:

- `milestone.submitted`
- `evidence.uploaded`
- `dispute.opened`
- `job.created`

### Workers

Consume:

- `reservation.created`
- `payment.intent_created`
- `notification.queued`

### Forge

- `forge.run.created`
- `forge.task.assigned`
- `forge.task.queued`
- `forge.sandbox.planned`
- `forge.patch.proposed`
- `forge.patch.simulated`
- `forge.tools.planned`
- `forge.verification.completed`
- `forge.pr.ready`
- `forge.deployment.proposed`
- `forge.rollback.proposed`
- `forge.security.review.completed`
- `forge.observation.proposed`
- `forge.run.closed`
- `forge.human_review.requested`
- `forge.approval.decided`
- `forge.run.blocked`
- `forge.run.rolled_back`

## Definition of Done para un evento

Un evento se considera correctamente introducido cuando:

1. tiene nombre estable;
2. tiene agregado y actor claros;
3. tiene payload documentado;
4. tiene al menos un consumidor o una razón explícita de auditoría;
5. no duplica otro evento con semántica casi igual;
6. puede mapearse a observabilidad y trazabilidad.

## Regla anti-ruido

No crear eventos por cada microdetalle de UI.

Crear eventos por cambios de dominio o de consecuencia operativa real.
