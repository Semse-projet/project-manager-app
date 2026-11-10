# Recuperación de agentes — reintento directo sin éxito falso

**Corte:** 2026-11-07. **Alcance:** bugfix de la API canónica, sin cambios en Railway, Omniverse ni pagos.

## Defecto observado en el código de main

`apps/api/src/modules/agents/agents.service.ts` recibía
`POST /v1/agents/runs/:runId/retry` y llamaba a `AgentQueueService.enqueueRun`
**sin** `{ mode: "retry" }`.

El modo por defecto es `create`. Para una ejecución con un job de BullMQ
fallido/completado aún retenido con el mismo `jobId`, `queue.add` puede no
añadir trabajo nuevo. El resultado del método no se devolvía al cliente, de
modo que el endpoint podía informar la transición de BD a `QUEUED` sin
explicar que el job no estaba efectivamente encolado.

`OpsService.retryAgentRun()` y `requeueAgentRun()` ya utilizan el modo
`retry` desde la corrección aprobada y fusionada del contrato
`docs/specs/agents/agent-queue-retry-idempotency.spec.md` (PR #886).
El endpoint directo también existe en `docs/specs/api/agents.spec.md`,
que ya tiene estado `VERIFIED` como contrato del runtime de agentes.

## Corrección acotada

- Reutilizar la ruta existente `enqueueRun(input, { mode: "retry" })`, que
  rechaza trabajos activos y trata correctamente los retenidos.
- Devolver la misma información de encolado mediante campos **aditivos**
  `enqueued` y, si falla, `reason` (`JOB_ACTIVE`,
  `QUEUE_UNAVAILABLE`, `QUEUE_ERROR`).
- Conservar el run y su estado de persistencia. Si `enqueued:false`, el
  resultado **no** debe interpretarse como ejecución programada.
- No cambiar permisos, rollback, la FSM ni la semántica de pagos, y no
  crear otro scheduler ni introducir dependencias externas.

## Regresiones unitarias añadidas

Archivo: `apps/api/test/agents-direct-retry-queue.test.ts`.

- P1: usa `mode:"retry"` y el identificador del tenant correcto.
- P2: propaga `QUEUE_UNAVAILABLE` sin reportar `enqueued:true`.
- P3: propaga `JOB_ACTIVE` y `QUEUE_ERROR`.
- P4: mantiene la auditoría `agent.run.retry`.

Las pruebas son mocks dirigidos y **no** demuestran por sí solas
recuperación de una misión de Hermes, una caída real de Redis ni ausencia de
duplicación de efectos externos.

## Estados y gates

- Código en rama/PR: **propuesto**.
- Pruebas unitarias y CI: **pendientes de ejecución y verificación**.
- Merge, despliegue, activación y prueba en producción: **no realizados**.
- No se usan credenciales productivas ni se ejecutan reintentos reales.

## Siguiente slice, independiente

Prueba de recuperación de una tarea inofensiva en un staging aislado con
PostgreSQL + Redis + Worker: crear trabajo con identificador idempotente,
detener el worker, verificar reclaim y el estado del job, reiniciar el
consumidor y comprobar salida única, audit trail y separación por tenant.
No confundir un `AgentRun` reintentado con una misión de múltiples
pasos recuperada: el estado de cada paso debe verificarse aparte.

Además, auditar el camino de `AgentsService.reclaimStale()`: hoy cambia
el registro de BD de `RUNNING` a `QUEUED`, pero no invoca directamente
`enqueueRun`. No añadir auto-reencolado a ciegas; primero correlacionar
el job BullMQ, que podría seguir activo o ser recuperado por su propio
mecanismo de stalled jobs, y diseñar un reconciliador sin doble ejecución.
