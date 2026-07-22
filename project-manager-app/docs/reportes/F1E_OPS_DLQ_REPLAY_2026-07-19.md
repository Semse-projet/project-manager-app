# F1-E — Ops, DLQ y replay del Event Backbone

**Fecha:** 2026-07-19
**Ramas:** `feat/f1e-event-ops-replay` (#354), `test/f1-t073-redis-fault-evidence` (#355)
**Base:** `origin/main@b95c1a56`
**Scope:** T-016, T-060–T-066, T-070, T-071, T-073, T-074 de
`docs/specs/platform/event-backbone.tasks.md`; sin deploy, canary ni switches
en Railway (Fase 7 T-072/T-075–T-077 quedan pendientes, ver "Pendiente")

## Resultado

Ops ya puede listar, inspeccionar y reintentar entregas fallidas del Event
Backbone sin acceso directo a la base de datos, con RBAC, tenant scoping y
auditoría, tal como definía el spec (sección 11):

- `GET /v1/domain-events/outbox` — lista tenant-scoped con filtros
  `status/eventType/correlationId`, paginación por cursor, `counts` por status
  y `oldestPendingAgeMs`; nunca expone `payloadJson`.
- `GET /v1/domain-events/:eventId/deliveries` — detalle de outbox + recibos de
  consumer, tenant-scoped, 404 si el evento no existe en el tenant del actor.
- `POST /v1/domain-events/:eventId/replay` — solo acepta el estado terminal
  `DEAD_LETTER` (del outbox o de un `consumerName` específico), incrementa
  `replayCount`, deja auditoría (`ops.event_replay_requested.v1` como
  `AuditLog`) y devuelve 409 si el objetivo no está en estado terminal.
- `trace()` (`GET /v1/domain-events/:correlationId`) ahora agrega el estado de
  outbox y los recibos de consumer por evento, sin cruzar tenants.

Permisos nuevos: `domain-events:replay`, otorgado solo a `OPS_ADMIN` (además
del chequeo explícito de rol en el controller, en el mismo patrón que
`process()` exige `EVENT_CONSUMER`).

## Decisión técnica: jobId con generación de replay

El plan (`event-backbone.plan.md`, sección "Worker") ya anticipaba que el job
de BullMQ debía llevar "eventId y replay generation". Antes de este corte,
`toDomainEventJobId` era puramente `event-${eventId}` — determinístico, pero
con `removeOnComplete`/`removeOnFail` de retención larga, un replay podía
colisionar con un job completado/fallido retenido bajo el mismo `jobId` y no
disparar una nueva entrega. Se extendió a `event-${eventId}-g${generation}`,
usando `DomainOutboxEvent.replayCount` como generación compartida: el
dispatcher normal usa generación `0` (o la vigente si el evento ya fue
reintentado), y un replay a nivel de consumer re-encola explícitamente con la
generación recién incrementada. Un replay a nivel de outbox no necesita
re-encolar manualmente: al volver a `PENDING` queda dentro del `claimBatch`
normal del dispatcher, que ya lee `replayCount` en el mismo `RETURNING`.

## Ciclo TDD

### Rojo → Verde

- 34 pruebas nuevas/actualizadas en `apps/api/test/domain-events.controller.test.ts`,
  `event-outbox-ops-replay.test.ts`, `event-outbox-ops-replay-integration.test.ts`,
  `event-outbox-dispatcher.test.ts` y `event-outbox-queue-integration.test.ts`:
  - metadata `@RequirePermissions` de los 3 endpoints nuevos;
  - 403 sin rol `OPS_ADMIN` aunque el permiso esté mockeado;
  - 400 con `eventId` no-UUID o `reason` vacío/whitespace;
  - 404 cross-tenant (outbox-level y consumer-level, en integración contra
    PostgreSQL real);
  - 409 cuando el objetivo no está en `DEAD_LETTER`;
  - `replayCount` se incrementa y la auditoría lleva actor/reason/eventId/
    consumer/replayCount;
  - `list()`/`findDeliveryDetail()` tenant-scoped y sin `payloadJson` aun si
    se lo inyecta deliberadamente en un mock defensivo;
  - jobId con sufijo de generación, incluida la ruta de integración con Redis
    real (se salta sin `REDIS_URL`).
- T-073 (fault test: Redis OFF durante registro de Evidence) se cerró con un
  test de integración explícito que apunta `REDIS_URL` a un host inalcanzable
  y confirma que `EvidenceRepository.create()` igual commitea Evidence +
  outbox `PENDING` — la transacción del productor nunca toca Redis por
  construcción; el test fija esa invariante en vez de dejarla implícita.
- T-074 (fault test: crash después de enqueue antes de ack) ya estaba cubierto
  desde F1-C por "an expired lease becomes eligible for a new dispatcher"
  (`event-outbox-dispatcher-integration.test.ts`).
- Suite completa de `@semse/api` tras el merge: 1907/1908 passing. El único
  fallo es preexistente y ajeno (`graphify.service.test.ts`, una aserción de
  path POSIX que no aplica en Windows).

## T-070 — spec:validate:strict

Al correr `pnpm spec:validate:strict` sobre `main` post-merge de F1-E
aparecieron 15 errores, ninguno en `event-backbone.spec.md` — pertenecían a
10 specs no relacionados (referencias obsoletas, frontmatter incompleto, un
spec marcado `IMPLEMENTED` con código borrado). Se abrió el issue #356, se
despachó una cuadrilla de 4 agentes en worktrees aislados para triarlo y
corregirlo (PRs #357–#360, todos verificados y mergeados). `main` corre hoy
con **0 errores, 0 warnings** en `spec:validate:strict` sobre 90 specs.

## Seguridad e invariantes

- `replay` exige permiso + rol + `reason` no vacío; sin eso no llega a tocar
  el repository.
- El repository nunca lee/escribe fuera del `tenantId` del actor — probado en
  integración con dos tenants reales.
- `payloadJson`/`metadataJson`/`traceContextJson` nunca se serializan en las
  respuestas de list/detail; el tipo `OutboxListItem`/`OutboxDeliveryDetail`
  ni siquiera los incluye, así que no hay campo que "olvidar" de redactar.
- El registro de auditoría de replay reutiliza el mismo mecanismo
  (`AuditLog` con `action: domain.event.emit`) que ya usa `DomainEventBus`,
  por lo que aparece automáticamente en `trace()`/`list()` sin código nuevo
  de lectura.

## Pendiente

- **T-072** `pnpm verify:workspace` — no se corrió (incluye build completo de
  `apps/web` + `railway:preflight`; no se justificaba el costo solo para
  validar F1-E dado que `@semse/api` ya compiló limpio y su suite completa
  pasó).
- **T-075/T-076/T-077** — deploy con switches OFF, canary allowlist
  `evidence.uploaded.v1` y verificación de SLO/DLQ en Railway. Requieren
  acceso a producción y autorización explícita; no se intentaron en este
  corte.
- F1-F (canary y cierre) sigue siendo el gate final antes de marcar el spec
  `IMPLEMENTED`/`VERIFIED` en `event-backbone.spec.md`.
