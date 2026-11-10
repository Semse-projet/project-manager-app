# Event backbone F2 — fan-out del registro de consumidores (slice 2a)

**Fecha:** 2026-11-10 · **Rama:** `feat/event-backbone-f2-fanout` (apilada sobre #1138) · **Plan:** `docs/specs/platform/event-backbone-f2-milestones.plan.md` §2a

## Qué cambia

El registro de consumidores de eventos del outbox pasa de "un tipo → un consumidor" a "un tipo → N consumidores", cada uno con su recibo. Es el prerequisito del slice 2: `milestone.approved.v1` y `milestone.rejected.v1` ya pertenecen a `satellite-webhooks.v1`, y el consumidor de efectos de milestones tiene que convivir con él.

**Sin cambio de comportamiento hoy:** todos los tipos registrados tienen un solo consumidor, y para ese caso el despacho es idéntico al anterior (mismo 503 si no está en la allowlist, mismos resultados y errores).

Reglas con varios consumidores:

- Corren todos los habilitados aunque uno falle antes.
- Un fallo reintentable gana sobre uno terminal, para que la cola reintente; los ya completados responden `duplicate` desde su recibo.
- Si un consumidor aplicable no está en la allowlist, se devuelve 503 después de correr los demás, en lugar de saltarlo en silencio.
- `appliesTo` permite que un consumidor solo participe en los eventos que le corresponden.

## Archivos

- `apps/api/src/modules/domain-events/domain-event-fanout.ts` (nuevo, puro).
- `apps/api/src/modules/domain-events/domain-event-consumer.service.ts`: el registro agrupa por tipo, `process` usa `dispatchToConsumers` y se elimina `assertConsumerAllowlisted`, que absorbe el fan-out.
- `apps/api/test/domain-event-fanout.test.ts` (7 tests).
- Plan y tasks del slice 2; spec actualizada.

## Verificación

- `domain-event-fanout.test.ts` 7/7. Control por mutación: sin la precedencia reintentable ni el 503 final, fallan 2.
- Suites de consumidores existentes: `event-domain-consumer` 10/10, `satellite-webhooks-consumer` 3/3, `jobs-bids-projection-events` 6/6, `project-lifecycle-projection-events` 4/4, `agent-run-finalization-consumer` 1/1 y `dispute-events-v2` 15/15.
- `tsc --noEmit` sin errores.

## Hallazgo para 2b (decisión D5)

`MilestonesRepository.reject` y `requestChanges` no persisten el motivo: solo lo devuelven en la respuesta. `milestone.rejected.v1` ya lo lleva en el payload (contrato SAT-007), pero `milestone.revision_requested.v1` necesitará llevar las instrucciones en el payload o persistirlas en `MilestoneReview`. **Resuelta por el dueño el mismo día: las instrucciones viajan en el payload.**
