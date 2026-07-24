# Remediación de carreras en barridos programados

**Fecha:** 2026-07-23

**Rama:** `fix/audit-money-security-batch-v2`

**Plan:** `0.22`

**Specs:** `api-reservations`, `api-agents-runtime`,
`fsm-reservation-lifecycle` y `fsm-agent-run-lifecycle` v1.1 (`VERIFIED`)

## Resultado

Los barridos de reservas vencidas y agent runs stale ya no tratan el resultado
de un `findMany` como autorización permanente para mutar.

Ambos flujos ahora:

- seleccionan y mutan dentro de una transacción;
- repiten estado, tenant y condición temporal en el `WHERE` de `updateMany`;
- interpretan `count=0` como una carrera perdida y omiten la fila;
- reportan únicamente mutaciones realmente aplicadas.

## Reservas vencidas

`sweepExpired()` repite `status=ACTIVE` y `expiresAt<=cutoff` al expirar. Una
reserva aceptada o liberada después de la selección no se sobrescribe ni se
cuenta.

La reapertura del job usa otro compare-and-set: solo permite
`RESERVED -> POSTED` cuando el job sigue en `RESERVED`, no fue borrado y la
relación confirma que ya no existe ninguna reserva `ACTIVE`.

## Agent runs stale

`reclaimStale()` filtra el cutoff desde la selección y lo vuelve a aplicar en
cada mutación:

- `heartbeatAt<=cutoff`; o
- sin heartbeat, `startedAt<=cutoff`; o
- sin heartbeat/start, `updatedAt<=cutoff`.

También repite `tenantId` y `status=RUNNING`. Si un heartbeat, complete o fail
ganó la carrera, el run queda intacto. Solo una mutación exitosa relee la fila
dentro de la misma transacción para formar la respuesta.

El estado lógico `dead_lettered` continúa representado físicamente por
`status=FAILED` y `deadLettered=true`, ahora documentado en la spec FSM.

## Regresiones

- reserva aceptada entre selección y mutación permanece `ACCEPTED`;
- esa carrera devuelve `expiredCount=0` y no reabre el job;
- el filtro de reapertura exige `status=RESERVED` y ausencia de reservas
  activas;
- run cambiado después de selección produce `count=0` y se omite;
- run stale con intentos disponibles vuelve a `QUEUED`;
- run stale sin intentos queda `FAILED` + `deadLettered=true`;
- `correlationId` permanece estable.

## Validación local

- reservations contract/race: 6/6 pasan.
- agent reclaim + FSM: 8/8 pasan.
- `pnpm --filter @semse/api build`: pasa.
- `pnpm --filter @semse/api lint`: pasa.
- SDD estricto: 104 specs, 0 errores, 0 warnings.
- cobertura del plan: 157/157.
- `git diff --check`: pasa.

## Gate operativo

Antes de confirmar el comportamiento en producción:

1. ejecutar dos workers de sweep en paralelo sobre candidatos controlados;
2. intercalar accept/release con el sweep de reservas;
3. intercalar heartbeat/complete/fail con reclaim de agent runs;
4. comprobar que métricas y audit logs usan los conteos efectivamente mutados;
5. observar conflictos/reintentos de transacción y duración del lote máximo.

Este lote no fue desplegado ni probado contra producción.

## Rollback

Un rollback no puede volver a actualizar por `id` sin estado/cutoff ni reportar
como procesados candidatos que perdieron el compare-and-set.
