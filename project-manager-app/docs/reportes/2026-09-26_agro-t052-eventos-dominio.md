# 2026-09-26 — Agro T-052: eventos `agro.*` en EVENT_CATALOG + Notifications

Spec: `docs/specs/agro/agro-domain-events.spec.md`. Continúa T-050 … T-053.

## Qué había

Agro auditaba todo internamente (`AgroAuditEvent`, append-only por finca) pero
no emitía ningún evento de dominio hacia el resto del sistema. El backlog
marcaba T-052 explícitamente como "requiere aprobación de catálogo" —
`AGENTS.md` prohíbe inventar nombres de eventos fuera de
`docs/foundation/EVENT_CATALOG.md`, así que antes de escribir código se
propuso el alcance al usuario y se esperó su aprobación explícita.

## Alcance aprobado

- `agro.incident.created`, `agro.incident.resolved` (análogo a
  `dispute.opened`/`dispute.resolved`, ya en el catálogo).
- `agro.worker_capability.verified` (ampliado a pedido del usuario, análogo a
  `milestone.approved`).
- Consumidor real de Notifications (a pedido del usuario, no solo el
  productor).

## Qué cambió

- **Mecanismo elegido**: el schema legacy sin versión + `DomainEventBus.emit()`
  (`packages/schemas/src/domain-events.schema.ts`) — el mismo que ya usan
  disputes/jobs/payments/milestones, y por el que Notifications ya consume
  `dispute.opened`/`dispute.resolved`. Se descartó el envelope v2 +
  `DomainOutboxEvent` (reservado hoy a Evidence F1-A..D, proyección Jobs/Bids
  y Satellite Webhooks) por ser una vía distinta y más pesada, sin necesidad
  para lo pedido.
- 3 schemas nuevos en `domain-events.schema.ts` (la unión discriminada es
  estricta — sin esto, `DomainEventBus.emit()` rechazaría cualquier `type`
  agro.* con un `ZodError`).
- `apps/api/src/modules/agro/agro-domain-events.ts` (nuevo): construye y emite
  cada evento, o no hace nada si la finca no tiene tenant (mismo criterio que
  el espejo a JobTask de T-051) o si `DomainEventBus` no está inyectado.
- `AgroIncidentService`/`AgroWorkforceService` reciben `DomainEventBus` como
  dependencia `@Optional()` (mismo patrón que `DisputesService`) — los tests
  unitarios existentes, que construyen ambos servicios a mano sin Nest,
  siguieron funcionando sin cambios.
- `NotificationsService`: 3 casos nuevos en el mapeo evento→notificación,
  mismo patrón que `dispute.opened`/`dispute.resolved`.
- `docs/foundation/EVENT_CATALOG.md`: sección Agro nueva + entradas en
  "Event consumers mínimos → Notifications" (no Trust — no fue parte del
  alcance aprobado).

## Hallazgo real durante la implementación

`DomainEventsModule` no puede cargarse aislado en un test — tiene una
dependencia circular ESM entre sus propios módulos (`JobsModule` importa
`DomainEventsModule` en el top level; `DomainEventsModule` termina
importando `JobsModule` transitivamente vía `NotificationsModule`/
`MatchingModule`) que solo el grafo completo de `AppModule` resuelve.
Confirmado con un `import()` directo del módulo sin Agro de por medio
(`ReferenceError: Cannot access 'DomainEventsModule' before initialization`).
Es preexistente, no introducido por este cambio, y es la razón real (más allá
del costo) por la que el resto de la suite Agro ya evita ese módulo. Se
descartó el test HTTP que lo cargaba y se verificó en 3 capas más livianas
(ver spec §6): productor con stub de bus, schema, y consumidor con
`NotificationsService` construido a mano.

## Verificación

- `agro-incident.service.test.ts`: 25/25 (5 nuevos — emite en create/resolve,
  no emite en otras transiciones ni sin tenant, funciona sin bus inyectado).
- `agro-workforce.service.test.ts`: 29/29 (3 nuevos — emite solo en
  APPROVED, no en REJECTED, funciona sin bus inyectado).
- `agro-domain-events-notifications-integration.test.ts` (nuevo, Postgres
  real): confirma la fila `Notification` correcta para cada destinatario y
  que quien reporta/resuelve/verifica no se autonotifica.
- `pnpm --filter @semse/api test:unit` con `DATABASE_URL` real: 2485 pass / 0
  fail. `pnpm --filter @semse/schemas build`, `pnpm --filter @semse/api
  build`, `pnpm typecheck`, `pnpm lint` (0 errores, mismos warnings
  preexistentes), `pnpm spec:validate:strict` (0 errores/warnings, 139
  specs) — todo limpio.

## Qué no se tocó

- **Trust como consumidor**: no fue parte del alcance aprobado.
- Las demás transiciones de incidente (TRIAGED, IN_PROGRESS, CANCELLED,
  DUPLICATE, CLOSED) y `update()`: solo CREATE y RESOLVED emiten.
- `revokeVerification`: no emite evento.
- El envelope v2 + `DomainOutboxEvent` (`OutboxRepository`,
  `DomainEventConsumerService`): no se tocó nada de ese track.

## Backlog restante

| Tarea | Estado |
|---|---|
| T-054 | ASR/visión para el intake (privacyCritical → Ollama/vision-service) |
| T-055 | Pantallas Agro en apps/mobile |

Además, sigue pendiente (no asignado a una tarea): **R8** — los controllers
Agro no capturan `ZodError` (500 en vez de 400 para cualquier body inválido),
documentado en T-053.
