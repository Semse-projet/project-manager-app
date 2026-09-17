---
name: semse-domain-events
description: How SEMSE's domain-event system actually works — the aggregate.action naming convention, the EVENT_CATALOG.md discipline (never invent an event name), and the fact that the outbox pattern is NOT applied uniformly across bounded contexts. Use when emitting an audit/domain event for a material state change, or debugging why an event never reached the worker/notifications/trust pipeline.
---

# SEMSE domain events

## The rule that governs this

`AGENTS.md`: "Inventar nombres de eventos fuera de EVENT_CATALOG.md" is on the NUNCA list, and "Emitir eventos de audit para cambios materiales" is on the SIEMPRE list. `docs/foundation/EVENT_CATALOG.md` states the underlying reason directly: "Si una acción importante no produce evento ni deja audit log, está incompleta" — an event exists for audit, workers, notifications, trust, agents, reconciliation, or observability; if a mutation doesn't serve one of those, it may not need an event at all.

## Naming and payload convention

- Format: `aggregate.action` (e.g. `job.created`, `milestone.approved`).
- Minimum payload fields: `eventId`, `eventType`, `aggregateType`, `aggregateId`, `actorType`, `actorId`, `timestamp`, `requestId`, `metadata`.
- Some event names are **reserved and versioned by spec** (`docs/specs/platform/event-backbone.spec.md` for the F1 contracts) — check `EVENT_CATALOG.md`'s "Contratos F1 versionados" section before assuming you can freely rename or reshape an existing event's payload.

**Before adding a new event name, read `docs/foundation/EVENT_CATALOG.md` in full for the target bounded context's section** (it's organized by domain: Auth/Identity, Jobs & Bids, Reservations, Contracts, Milestones, Evidence, Payments/Escrow, Disputes, Trust, Agents, Satellite Webhooks, etc.) — a near-equivalent event usually already exists.

## The outbox pattern is not uniform — check the catalog before assuming

This is the single most important nuance for a new agent: **not every domain event goes through the same delivery mechanism**, and the catalog documents the exceptions inline:

- The canonical path is: atomic outbox write in the same DB transaction as the mutation → `DomainOutboxEvent` → BullMQ dispatcher → idempotent consumer.
- **Jobs & Bids** events are emitted "vía `DomainEventBus` (no outbox) desde `jobs.service.ts`" — a different, non-transactional path.
- **Evidence** (F3) writes its outbox entry in the same transaction as the mutation, but the catalog notes other producers aren't required to adopt transactional outbox until their bounded context does.
- **Prometeo live sessions** publish over a pub/sub channel (`live-session:<tenantId>:<sessionId>`), explicitly **not** the F1 atomic outbox — only when the session result needs to feed analytics (`ObservationMission`) does a producer get added to the outbox separately.
- **Satellite Webhooks (SAT-007)** added "best-effort" outbox producers on top of a per-webhook path that predates the outbox — so a webhook event may exist in two places with different guarantees.

**If an event you expect never shows up downstream (worker never picks it up, notification never fires), don't assume the outbox is broken — first confirm which mechanism that specific bounded context actually uses**, per the catalog section for that domain. `grep -rn "outbox" apps/api/src/modules/<module>/` will show whether that module's service module wires an outbox producer at all.

## Notas para futuros agentes / hallazgos abiertos

- El catálogo documenta explícitamente varios casos "no instrumentado todavía" (ej. un evento de Jobs & Bids en outbox) — no asumas que la ausencia de un evento en el outbox es un bug nuevo; puede ser una brecha ya conocida y aceptada. Buscá el texto exacto en `EVENT_CATALOG.md` antes de reportarlo como hallazgo.
- No se armó en esta skill un mapa completo de "qué bounded context usa qué mecanismo" — el catálogo tiene la información pero está narrativa, no tabulada. Si esto se vuelve una fuente frecuente de confusión, valdría la pena pedirle a una sesión futura que arme esa tabla explícita como mejora del catálogo mismo (fuera de alcance acá, es un cambio a `EVENT_CATALOG.md`, no a esta skill).
- Esta skill no cubre el consumer/dispatcher del worker en sí (`apps/worker`) en detalle — solo el lado productor. Si el bug está del lado del consumo, `semse-local-observability-testing` (para correr worker+API juntos) es el mejor punto de partida.
