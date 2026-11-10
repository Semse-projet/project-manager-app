# Event backbone F2 — slice 1: disputas

**Fecha:** 2026-11-10 · **Rama:** `feat/event-backbone-f2-disputes` (apilada sobre `docs/legacy-event-bus-outbox-spec`, PR #1137) · **Spec:** `platform.event-backbone-f2-legacy-producers` (APPROVED, D1–D4) · **Origen:** AUDIT_REMEDIATION_PLAN 0.49e

## Qué cambia

Los 5 eventos de disputas (`opened`, `assigned`, `evidence_submitted`, `under_review`, `resolved`) pueden escribirse en el outbox transaccional de F1, en la misma transacción que el cambio de estado, y un consumidor idempotente (`dispute-effects.v1`) puede hacerse cargo de las notificaciones y del trigger del agente `dispute`, con recibo, DLQ y replay.

Todo queda detrás de `SEMSE_DISPUTE_EVENTS_V2_MODE` (por defecto `off`) y `SEMSE_DISPUTE_EVENTS_V2_TENANT_IDS`. **Con el modo en `off`, el comportamiento es idéntico al de hoy**: sin transacción nueva, sin evento v2 y con el bus legacy completo.

| Modo | Outbox v2 | Bus legacy | Consumidor |
|---|---|---|---|
| `off` | No | Todo (auditoría, notificaciones, agentes) | — |
| `shadow` | Sí, en la transacción | Todo | No ejecuta; guarda en el recibo lo que habría hecho |
| `on` | Sí, en la transacción | Solo auditoría e invalidaciones (D3) | Trigger del agente y luego notificaciones |

El modo se sella en `metadata.effectsMode` de cada evento al producirlo, así que cambiar el flag no pierde ni duplica efectos de eventos ya escritos.

## Archivos

- `packages/schemas/src/domain-events-v2.schema.ts`: 5 esquemas v2; payload strict, solo referencias.
- `apps/api/src/modules/disputes/disputes.repository.ts`: hook `withinTx` opcional y `applyWrite`.
- `apps/api/src/modules/disputes/dispute-events-v2.ts` (nuevo): flag, builder v2 y reconstructor del evento legacy.
- `apps/api/src/modules/disputes/disputes.service.ts`: hook en `shadow`/`on`, emit `audit-only` en `on` y `OutboxRepository` opcional (sin él, `off`).
- `apps/api/src/modules/domain-events/domain-event-bus.service.ts`: opción `{ effects: "audit-only" }`.
- `apps/api/src/modules/domain-events/dispute-effects.consumer.ts` (nuevo), registrado en `domain-event-consumer.service.ts` y `domain-events.module.ts`.
- `apps/api/src/modules/notifications/notifications.service.ts`: `mapEventToNotifications` pasa a exportarse (el modo shadow la usa para el registro de paridad).
- Plan, tasks y spec actualizados; `docs/SPEC_INDEX.md` regenerado.

## Verificación

- `apps/api/test/dispute-events-v2.test.ts`: **15/15**. Cubre flag, envelope, atomicidad (hook que falla ⇒ estado revertido), off sin transacción nueva, modos de servicio, **paridad de los 5 tipos** (el evento legacy reconstruido es idéntico al emitido salvo `occurredAt`), bus `audit-only`, consumidor `shadow`/`on`/duplicado, disputa de otro tenant ⇒ terminal y registro ⇒ `DEAD_LETTER`.
- Control negativo: con servicio, bus y repositorio en su versión de `main`, fallan 6 de 15. Los otros 9 cubren archivos nuevos.
- `tsc --noEmit` de la API sin errores; build de paquetes y API OK.
- `spec:validate:strict` 0 errores; `spec:audit-plan-coverage` 0 faltantes; `spec:index:check` OK; tests de las herramientas spec 29/29.
- Suite unitaria de la API: ver la descripción del PR (fallos ambientales conocidos de Prisma engine/DNS aparte).

## Hallazgos (no corregidos: cambian qué se notifica, fuera de alcance de la spec §3)

1. `dispute.assigned` no tiene plantilla en `mapEventToNotifications`: nadie recibe aviso de una asignación.
2. `dispute.evidence_submitted` busca `assigneeUserId` en el payload, pero el servicio no lo envía: la persona asignada nunca recibe aviso de evidencia nueva.
3. `dispute.resolved` busca `raisedById`, pero `buildDisputeResolvedEvent` no lo incluye: quien abrió la disputa no recibe aviso de la resolución.

El modo `shadow` los reproduce a propósito (paridad). Arreglarlos es una decisión de producto, y conviene hacerlo **después** de pasar a `on`, en el consumidor, sin tocar el legacy.

## Pendiente

- CI del PR, revisión humana y merge **después** de #1137.
- Activación (dueño, Railway): allowlists del consumidor y de los tipos → `shadow` en un tenant → comparar los recibos → `on`.
- PR de cierre del slice: retirar el `emit()` legacy de disputas.
- Antes del slice 2: fan-out de varios consumidores por tipo en el registro.
- Cuando #1032 esté en `main`, actualizar la entrada 0.49e del plan de remediación con el avance del slice 1.
