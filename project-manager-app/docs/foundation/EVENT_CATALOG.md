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

## Contratos F1 aprobados, todavía no implementados

Los siguientes nombres están reservados por
[`../specs/platform/event-backbone.spec.md`](../specs/platform/event-backbone.spec.md),
pero no deben tratarse como eventos emitidos hasta que el slice F1 pase tests y
se despliegue:

- `evidence.uploaded.v1`
- `ops.event_replay_requested.v1`

La convención v1 sin suffix permanece activa para código existente. La
migración es productor por productor y usa adapter explícito; no se hace
dual-write.

## Auth / Identity

- `user.created`
- `user.verified`
- `user.suspended`
- `organization.created`
- `membership.created`
- `membership.updated`

## Jobs

- `job.created`
- `job.posted`
- `job.reserved`
- `job.accepted`
- `job.started`
- `job.review_requested`
- `job.partially_paid`
- `job.completed`
- `job.disputed`
- `job.cancelled`

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
- `milestone.paid`

## Evidence

- `evidence.uploaded`
- `evidence.review_started`
- `evidence.accepted`
- `evidence.rejected`

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
- `dispute.review_started`
- `dispute.resolution_proposed`
- `dispute.resolved`
- `dispute.cancelled`

## Trust

- `trust.signal_recorded`
- `trust.recalculated`
- `trust.flag_added`
- `trust.flag_cleared`

## Agents

- `agent.run_created`
- `agent.action_logged`
- `agent.recommendation_accepted`
- `agent.recommendation_rejected`
- `agent.override_required`

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
