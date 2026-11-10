---
type: plan
feature: "Event backbone F2 — slice 1: disputas"
domain: "platform"
spec: "docs/specs/platform/event-backbone-f2-legacy-producers.spec.md"
version: "1.0"
status: "APPROVED"
branch: "feat/event-backbone-f2-disputes"
date: "2026-11-10"
---

# Plan — Event backbone F2, slice 1: disputas

**Spec:** [`platform.event-backbone-f2-legacy-producers`](event-backbone-f2-legacy-producers.spec.md) (APPROVED; D1–D4 aceptadas el 2026-11-10) · **Slice:** 1 (disputas, D2)

## 1. Diseño

| Pieza | Cambio |
|---|---|
| `@semse/schemas` | 5 eventos v2 nuevos: `dispute.opened.v1`, `dispute.assigned.v1`, `dispute.evidence_submitted.v1`, `dispute.under_review.v1` y `dispute.resolved.v1`. Envelope F1 §5, `module: "disputes"`, `entityType: "Dispute"`, `entityId` igual a `payload.disputeId`. El payload es `strict` y lleva **solo referencias** (`disputeId`, `projectId`, `jobId` y, según el evento, `raisedById`, `assigneeUserId`, `evidenceIds`, contadores, `resolutionType`); el texto (`reason`, `resolution`) nunca viaja (F1, decisión 9). |
| Flag (D1) | `SEMSE_DISPUTE_EVENTS_V2_MODE` = `off` (por defecto) \| `shadow` \| `on`, más `SEMSE_DISPUTE_EVENTS_V2_TENANT_IDS` (lista separada por comas o `*`). Un valor desconocido o un tenant fuera de la lista se trata como `off`. Si el servicio no tiene `OutboxRepository` inyectado, también degrada a `off`. |
| Productor | `DisputesRepository.create/assign/submitEvidence/markUnderReview/resolve` aceptan un hook opcional `withinTx(tx, { record, projectId, jobId })` que se ejecuta **en la misma transacción** que el cambio de estado. Sin hook, cada método escribe exactamente como antes (sin transacción nueva). En `shadow`/`on`, `DisputesService` usa ese hook para insertar el evento v2 en el outbox; si el insert falla, se revierte el cambio de estado (F1 §8). |
| Modo sellado | El productor graba en `metadata.effectsMode` (`shadow` u `on`) quién es dueño de los efectos de **ese** evento, junto con `requestId`. El consumidor obedece al modo sellado, no al flag actual: cambiar el flag nunca pierde ni duplica efectos de eventos ya escritos. |
| Bus legacy (D3) | `DomainEventBus.emit` acepta `{ effects: "audit-only" }`: escribe `AuditLog` (con `effects: "audit-only"` en `afterJson`), invalida el contexto operativo y la proyección del ciclo de vida, pero **no** notifica ni dispara agentes. En `on`, disputas usa ese modo; en `off` y `shadow`, el bus hace todo como hasta ahora. |
| Consumidor | `dispute-effects.v1` (`DisputeEffectsConsumer`), registrado en `DomainEventConsumerService` para los 5 tipos. Valida el envelope, relee la disputa **por tenant** (`reason`, `raisedById`, `resolution`) y reconstruye el evento legacy idéntico al que emite el servicio (`buildLegacyDisputeEvent`). En `shadow` no ejecuta nada: el recibo guarda `effect: "no_op"` con las notificaciones y los triggers que habría producido. En `on` llama primero a `agentTriggerRouter.route` (idempotente por tipo, correlación y agente) y después a `notificationsService.handleEvent`. Recibo por `(eventId, consumer)`, `AuditLog` del consumo, DLQ y replay heredados de F1. Tipo desconocido, envelope inválido o disputa ausente en el tenant ⇒ error terminal ⇒ `DEAD_LETTER`. |

## 2. Activación (D1)

1. Desplegar con el modo en `off`. No cambia nada.
2. Añadir `dispute-effects.v1` a `SEMSE_EVENT_CONSUMER_ALLOWLIST` y los 5 tipos a `SEMSE_EVENT_TYPE_ALLOWLIST`.
3. Pasar a `shadow` para uno o varios tenants y comparar el `resultJson` de los recibos (`notifications`, `triggers`) con lo que envió el legacy.
4. Pasar a `on` para esos tenants: el legacy queda en solo auditoría y el consumidor notifica y dispara agentes.
5. Retirar el `emit()` legacy de disputas cuando todos los tenants estén en `on` (cierre del slice, en un PR aparte).

Los pasos 2–4 son cambios de variables de entorno en Railway: los hace el dueño, no el agente.

## 3. Riesgos

- **Varios consumidores por tipo:** el registro actual admite un solo consumidor por `eventType`. Disputas no choca con nadie, pero el **slice 2** sí (`milestone.approved.v1` ya pertenece a `satellite-webhooks.v1`). Antes del slice 2 hay que permitir fan-out en el registro.
- **Efecto parcial en `on`:** si el trigger se ejecuta y la notificación falla, o la notificación se crea y falla el recibo, el reintento puede duplicar la notificación (at-least-once, igual que los webhooks de satélites). Mitigación: el trigger va primero (idempotente) y la notificación después.
- **`on` sin consumidor habilitado:** si se activa `on` sin el paso 2, los eventos se acumulan en el outbox sin notificar hasta habilitar el consumidor. El orden de activación lo evita; no se pierden, porque quedan en el outbox.
- **Brechas legacy heredadas:** la paridad exige reproducir el payload legacy tal cual. Hoy `dispute.assigned` no tiene plantilla de notificación, `dispute.evidence_submitted` no lleva `assigneeUserId` y `dispute.resolved` no lleva `raisedById`, así que esos tres no notifican a nadie. Corregirlo cambia qué se notifica, y eso está fuera de alcance (spec §3); queda anotado en el reporte.
