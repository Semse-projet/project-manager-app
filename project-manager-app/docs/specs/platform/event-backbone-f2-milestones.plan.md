---
type: plan
feature: "Event backbone F2 — slice 2: milestones (con fan-out del registro)"
domain: "platform"
spec: "docs/specs/platform/event-backbone-f2-legacy-producers.spec.md"
version: "1.0"
status: "APPROVED"
branch: "feat/event-backbone-f2-fanout"
date: "2026-11-10"
---

# Plan — Event backbone F2, slice 2: milestones

**Spec:** [`platform.event-backbone-f2-legacy-producers`](event-backbone-f2-legacy-producers.spec.md) (APPROVED; D1–D4) · **Slice:** 2 (D2) · **Depende de:** slice 1 ([plan](event-backbone-f2-legacy-producers.plan.md), PR #1138).

El slice se entrega en dos PRs: **2a** (fan-out del registro, infraestructura sin cambio de comportamiento) y **2b** (productor y consumidor de milestones).

## 2a. Fan-out del registro de consumidores

**Por qué:** `milestone.approved.v1` y `milestone.rejected.v1` ya los consume `satellite-webhooks.v1` (SAT-007). El registro admite un solo consumidor por tipo, así que el consumidor de efectos de milestones no se podría registrar.

| Pieza | Cambio |
|---|---|
| `domain-event-fanout.ts` (nuevo, puro) | `groupDescriptorsByEventType` agrupa por tipo y falla al construir si un par `(tipo, consumidor)` se repite. `dispatchToConsumers` reparte un evento entre sus consumidores. |
| Aplicabilidad | Cada descriptor puede declarar `appliesTo(event)`. Por defecto aplica siempre. El consumidor de milestones (2b) solo aplicará a eventos con `metadata.effectsMode`, de modo que los `milestone.*.v1` de SAT-007 actuales no lo activan. |
| Un consumidor aplicable | **Idéntico** al registro 1:1: 503 si no está en la allowlist; si lo está, su resultado y sus errores tal cual. |
| Varios | Corren todos los habilitados, en orden de registro, aunque uno anterior falle. Si hay un fallo reintentable (5xx, 408, 429 o error no HTTP), se relanza para que la cola reintente el job; los consumidores ya completados responden `duplicate` desde su recibo. Si no, se relanza el primer terminal (4xx). Si no hubo fallos pero un consumidor aplicable no está en la allowlist, 503 reintentable: el evento no se salta en silencio para él. Si todo va bien, el resultado agregado es `{ consumer: "fan-out", consumers: [...] }`. |
| `DomainEventConsumerService.process` | Usa `dispatchToConsumers`. Los tipos actuales tienen un solo consumidor, así que su comportamiento no cambia. |

No hay cambios en el worker, la cola ni el replay: un job por evento, como hoy. El replay por consumidor ya reencola el evento entero, y los demás consumidores devuelven `duplicate`.

## 2b. Productor y consumidor de milestones (PR `feat/event-backbone-f2-milestones`)

| Pieza | Cambio |
|---|---|
| Flag (D1) | `SEMSE_MILESTONE_EVENTS_V2_MODE` (`off` \| `shadow` \| `on`) y `SEMSE_MILESTONE_EVENTS_V2_TENANT_IDS`, con la misma semántica que en disputas. |
| Eventos v2 | Nuevos: `milestone.created.v1`, `milestone.submitted.v1` y `milestone.revision_requested.v1`. Se reutilizan `milestone.approved.v1` y `milestone.rejected.v1` con el payload de SAT-007 sin cambios (D4). |
| Productor | `MilestonesRepository` (`create`, `transitionStatus`) acepta un hook `withinTx`. En `shadow`/`on`, los 5 eventos se escriben en la transacción del cambio de estado, y la escritura best-effort de SAT-007 para `approved`/`rejected` pasa a ser transaccional (D4). En `off`, todo queda como hoy, incluida la escritura best-effort. |
| Consumidor | `milestone-effects.v1` para los 5 tipos, con `appliesTo` = evento con `metadata.effectsMode`. Reconstruye el evento legacy y, en `on`, dispara agentes (`evidence-coach` en `submitted`, `risk` en `rejected`) y notificaciones. Esto incluye la notificación directa al profesional en `approved`, que hoy el servicio envía aparte con `proUserId`. En `shadow`, solo registro de paridad. |
| Degradación | Si el repositorio no ejecuta el hook (persistencia en memoria) o falta Prisma/outbox, la llamada se trata como `off`: bus completo, escritura best-effort de SAT-007 y notificación directa. Ningún efecto se pierde. |
| Motivo | `reject` y `requestChanges` rechazan con 400, antes de escribir, un motivo de más de 2000 caracteres (el límite de `rejectionReason`/`instructions`). Antes, `reject` confirmaba la transición y fallaba con 500 al construir el evento de SAT-007. |
| Fuera de alcance | La evaluación de BuildOps Intelligence, la liberación automática de escrow y el autocompletado del job tras `approved` siguen en el servicio. No son efectos del bus (spec §3). |

### Decisión D5 (resuelta por el dueño el 2026-11-10: **instrucciones en el payload**)

`reject` y `requestChanges` **no persisten el motivo**: solo lo devuelven en la respuesta. El consumidor no puede releerlo.

- `milestone.rejected.v1` ya lleva `rejectionReason` en el payload (contrato SAT-007 vigente), así que no hay problema.
- `milestone.revision_requested.v1` necesita las instrucciones para la notificación. Hay dos opciones:
  1. **Llevarlas en el payload**, con la misma excepción que ya tiene `rejected.v1`.
  2. **Persistirlas** en `MilestoneReview` (el modelo existe y hoy no se escribe) dentro de la misma transacción, para que el payload lleve solo referencias.

**Decisión:** opción 1. `milestone.revision_requested.v1` lleva `instructions` en el payload, con la misma excepción documentada que `rejected.v1`. No se añaden escrituras.

## Riesgos

- **Reintentos en fan-out:** si falla un consumidor, el job se reintenta para todos. Los completados responden `duplicate` desde su recibo, sin repetir efectos, a costa de una lectura extra por consumidor y reintento.
- **503 por un consumidor no habilitado:** con fan-out, si un consumidor aplicable no está en la allowlist, el job se reintenta aunque los demás terminaron. Es el mismo comportamiento que hoy tiene un consumidor único no habilitado, y `appliesTo` evita que afecte a eventos que no le corresponden.
- **Brechas legacy heredadas (no corregidas, la paridad las reproduce):** el esquema v1 de `milestone.submitted` no declara `clientUserId`, así que zod lo descarta y el cliente nunca recibe el aviso de entrega. `milestone.rejected` busca `proUserId`, que el payload no lleva, y `milestone.created`/`revision_requested` no tienen plantilla de notificación. Hoy, en la práctica, solo notifica la llamada directa de `approved`.
