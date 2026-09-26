---
id: "agro.domain-events"
title: "Agro — eventos de dominio agro.* en EVENT_CATALOG + Notifications (T-052)"
domain: "agro"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "low"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - packages/schemas/src/domain-events.schema.ts
  - apps/api/src/modules/agro/agro-domain-events.ts
  - apps/api/src/modules/agro/agro-incident.service.ts
  - apps/api/src/modules/agro/agro-workforce.service.ts
  - apps/api/src/modules/agro/agro-farm-access.service.ts
  - apps/api/src/modules/notifications/notifications.service.ts
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - apps/api/test/agro-incident.service.test.ts
  - apps/api/test/agro-workforce.service.test.ts
  - apps/api/test/agro-domain-events-notifications-integration.test.ts
related_endpoints:
  - farms/:farmId/incidents
  - incidents/:incidentId/transition
  - farms/:farmId/worker-capabilities/:workerCapabilityId/verify
related_events:
  - agro.incident.created
  - agro.incident.resolved
  - agro.worker_capability.verified
related_agents: []
last_verified: "2026-09-26"
---

# Spec: eventos de dominio `agro.*` (T-052)

## 1. Resultado

Tres acciones de Agro —reportar una incidencia, resolverla, verificar una
capacidad de un trabajador— ahora emiten un evento de dominio consumido por
Notifications, además de seguir auditándose en `AgroAuditEvent` como siempre.
Alcance aprobado por el usuario antes de implementar (el backlog marcaba
T-052 como "requiere aprobación de catálogo"):

- `agro.incident.created`
- `agro.incident.resolved`
- `agro.worker_capability.verified` (ampliado desde la propuesta inicial de
  solo incidencias, a pedido del usuario)
- Consumidor real de Notifications, no solo el productor (a pedido del
  usuario).

## 2. Por qué esta forma, no otra (diagnóstico antes de tocar código)

**Agro no estaba incompleto por la regla del catálogo** ("si una acción
importante no produce evento ni deja audit log, está incompleta",
`EVENT_CATALOG.md` §Regla): `AgroAuditEvent` ya audita todo. Estos 3 eventos
son para consumo *cruzado* (Notifications), no para tapar un hueco de
auditoría.

**Dos mecanismos de eventos conviven en el repo** — se investigaron ambos
antes de elegir:

1. **Envelope v2 + `DomainOutboxEvent`** (`packages/schemas/src/
   domain-events-v2.schema.ts`, `OutboxRepository`, `DomainEventConsumerService`):
   el track versionado nuevo, hoy usado solo por Evidence F1-A..D, la
   proyección Jobs/Bids y Satellite Webhooks (`EVENT_CATALOG.md` §Contratos F1
   versionados) — cada consumidor es una entrada explícita en un registro con
   dead-letter, reintentos y `DomainEventConsumption` propio. Pesado y
   deliberadamente acotado a esos 3 consumidores; añadir Notifications ahí
   sería inventar un cuarto sin necesidad.
2. **Schema legacy sin versión + `DomainEventBus.emit()`** (`packages/schemas/
   src/domain-events.schema.ts`): el mecanismo real que ya usan
   disputes/jobs/payments/milestones, y por el que Notifications consume
   `dispute.opened`/`dispute.resolved` hoy mismo (`DomainEventBus.emit()` llama
   a `NotificationsService.handleEvent()` fire-and-forget, además de
   `AuditService.append()` y `AgentTriggerRouter.route()`).

Se eligió **(2)** porque es exactamente el mecanismo que ya resuelve "productor
+ consumidor de Notifications" en el resto del repo — el pedido concreto de
T-052 — sin inventar una segunda vía. `dispute.opened`/`dispute.resolved` son
el análogo elegido para incidencias (alguien reporta, alguien más resuelve);
`milestone.approved` lo es para `worker_capability.verified` (señal de
confianza).

**`semseEventSchema` es una unión discriminada estricta** — no acepta un
`type` fuera de la lista fija. Los 3 eventos se agregaron como entradas
nuevas (`domainEvent(...)` factory) en `domain-events.schema.ts`, la unión,
`SEMSE_EVENT_TYPES` y `EVENT_AGENT_MAP` — es la manera en que el propio
schema impide inventar nombres de evento fuera de catálogo (`AGENTS.md`
NUNCA: "Inventar nombres de eventos fuera de EVENT_CATALOG.md").

**Mismo problema de tenancy que T-051/T-058b:** `DomainEventBus.emit()` exige
`tenantId`/`orgId` no nulos (los usa para auto-provisionar Tenant/Org antes de
escribir AuditLog). `AgroFarm.tenantId` es opcional desde T-051; Agro no
tiene concepto de Org en absoluto. Se resolvió igual que el espejo a
`JobTask` (`agro-jobtask-mirror.ts`): **sin tenant en la finca, no se emite
nada** — `AgroAuditEvent` sigue siendo el único registro. Para `orgId` se
sintetiza uno estable por finca (`agro:<farmId>`, `agroOrgId()` en
`agro-domain-events.ts`): `ActorContextService.ensureOrg` hace upsert de
cualquier `orgId` nuevo, no exige que preexista, así que es tan válido como
cualquier otro id.

## 3. Qué cambió

- **`packages/schemas/src/domain-events.schema.ts`**: 3 schemas nuevos
  (`agroIncidentCreatedEventSchema`, `agroIncidentResolvedEventSchema`,
  `agroWorkerCapabilityVerifiedEventSchema`), agregados a la unión
  discriminada, `SEMSE_EVENT_TYPES` y `EVENT_AGENT_MAP` (triggers
  `["notification", "audit"]` — sin agentType real, así que
  `AgentTriggerRouter` no dispara ningún agente).
- **`apps/api/src/modules/agro/agro-domain-events.ts`** (nuevo): helper
  compartido — construye el evento y hace `DomainEventBus.emit()`, o no hace
  nada si la finca no tiene tenant o si `domainEventBus` no está inyectado.
- **`agro-farm-access.service.ts`**: `getFarmContext(farmId)` — tenant +
  owner de la finca, para no repetir la consulta en cada emisor.
- **`agro-incident.service.ts`** / **`agro-workforce.service.ts`**: reciben
  `DomainEventBus` como dependencia `@Optional()` (mismo patrón que
  `operationalContext`/`lifecycleProjectionEvents` en `DisputesService`) —
  así los tests unitarios existentes de ambos servicios, que los construyen a
  mano sin Nest, siguen funcionando sin cambios.
  - `AgroIncidentService.create()`: emite `agro.incident.created` tras crear
    la incidencia (y su evidencia inline).
  - `AgroIncidentService.transition()`: emite `agro.incident.resolved` solo
    cuando la transición es a `RESOLVED` (no en TRIAGED/IN_PROGRESS/etc.).
  - `AgroWorkforceService.verifyCapability()`: emite
    `agro.worker_capability.verified` solo cuando `result === "APPROVED"`
    (un `REJECTED` no es una capacidad verificada).
- **`notifications.service.ts`**: 3 casos nuevos en `mapEventToNotifications`
  (la función real que `DomainEventBus.emit()` invoca vía
  `NotificationsService.handleEvent()`), mismo patrón que
  `dispute.opened`/`dispute.resolved`:
  - `agro.incident.created` → notifica al `assignedToId` (si difiere del
    reportante) y al dueño de la finca (`ownerId`, si difiere de ambos).
  - `agro.incident.resolved` → notifica al reportante (`reportedById`), no a
    quien resuelve.
  - `agro.worker_capability.verified` → notifica al trabajador (`workerId`),
    no a quien verifica.

## 4. Fuera de alcance

- **Trust como consumidor**: el usuario aprobó explícitamente "también el
  consumidor de Notifications", no Trust — `EVENT_CATALOG.md` §Event
  consumers mínimos → Trust no incluye estos 3 eventos. Si se necesita más
  adelante, es una entrada nueva ahí, no un cambio de este spec.
  `AgroIncidentService.update()` (severidad, tipo, relaciones) y las demás
  transiciones de incidente (TRIAGED, IN_PROGRESS, CANCELLED, DUPLICATE,
  CLOSED) — solo CREATE y RESOLVED, que son las dos que se aprobaron.
- **Revocación de capacidad** (`revokeVerification`): no emite evento — no
  estaba en el alcance aprobado (solo la verificación positiva).
- **Envelope v2 + `DomainOutboxEvent`**: se consideró y se descartó (§2) —
  no se tocó `OutboxRepository`/`DomainEventConsumerService`/
  `DomainOutboxEvent` en absoluto.

## 5. Campos SEMSE

```yaml
privacyCritical: false
auditLog: "sin cambios de fondo: AgroAuditEvent sigue auditando incident.created/incident.*resolved/capability.verified con el mismo detalle de siempre; estos eventos son *además*, para Notifications"
sse: true # NotificationsService.handleEvent emite por SSE al crear cada notificación, como cualquier otro tipo
fsmTransicion: "agro.incident.resolved solo se emite en la transición OPEN/TRIAGED/IN_PROGRESS → RESOLVED (ver agro-incident.domain.ts)"
paymentGovernance: false
```

## 6. Verificación

**No se cargó `DomainEventsModule` en un test HTTP** — se intentó
(`agro-domain-events-integration.test.ts`, descartado) y reveló que ese
módulo no puede cargarse aislado: tiene una dependencia circular ESM entre
sus propios módulos (`jobs.module.js` importa `DomainEventsModule`
directamente en el top level, y `DomainEventsModule` termina importando
`JobsModule` transitivamente vía `NotificationsModule`/`MatchingModule`) que
solo el grafo completo de `AppModule` resuelve; cargarlo solo (con o sin
Agro) revienta con `ReferenceError: Cannot access 'DomainEventsModule' before
initialization`, confirmado también con un `import()` directo sin Agro de
por medio. Es una fragilidad preexistente del propio `DomainEventsModule`,
no algo que este cambio haya introducido — y es exactamente el motivo por el
que el resto de la suite Agro ya evita ese módulo (`domainEventBus` es
`@Optional()` en todos los servicios Agro).

Se verificó en 3 capas, cada una con la pieza real de producción, sin la
cadena Agents/AiModels/Matching:

1. **Productor** (`agro-incident.service.test.ts`, `agro-workforce.service.
   test.ts`) — stub de `DomainEventBus` (`{emit: async (event, ctx) => ...}`)
   inyectado en el servicio real: confirma que `create()`/`transition(to:
   RESOLVED)`/`verifyCapability(APPROVED)` llaman a `emit()` con el `type`,
   `payload` y `ctx.{tenantId,orgId}` correctos; que una finca sin tenant
   (T-051) no emite nada pero sigue auditando en `AgroAuditEvent`; que un
   `REJECTED` o una transición a otro estado no emiten; y que el servicio
   sigue funcionando sin ningún `DomainEventBus` inyectado (dependencia
   `@Optional()`).
2. **Schema**: la unión discriminada `semseEventSchema` acepta los 3
   `type` nuevos (si no los aceptara, `DomainEventBus.emit()` fallaría con
   `ZodError` en el primer `.parse()` — los tests del punto 1 ya lo ejercitan
   indirectamente porque el stub de bus no valida, así que se confirmó aparte
   con `pnpm --filter @semse/schemas build` limpio y `SEMSE_EVENT_TYPES`
   actualizado).
3. **Consumidor** (`agro-domain-events-notifications-integration.test.ts`,
   Postgres real) — `NotificationsService` construido a mano (solo
   `NotificationsRepository`, el resto de sus colaboradores son
   `@Optional()`) y `handleEvent()` llamado directamente con los 3 payloads
   reales: confirma que se crea la fila `Notification` correcta para el
   destinatario correcto (`assignedToId`/`ownerId` en incident.created,
   `reportedById` en incident.resolved, `workerId` en
   worker_capability.verified) y que quien reporta/resuelve/verifica no se
   autonotifica.

Suites: `agro-incident.service.test.ts` 25/25, `agro-workforce.service.
test.ts` 29/29, `agro-domain-events-notifications-integration.test.ts` 1/1.
Suite completa de API (`pnpm --filter @semse/api test:unit`, con
`DATABASE_URL` real): 2485 pass / 0 fail. `pnpm --filter @semse/schemas
build` y `pnpm --filter @semse/api build` limpios.

**No verificado end-to-end contra el `DomainEventBus` real dentro del
`AppModule` completo** (arranque en Railway/producción) — el mecanismo en sí
(`DomainEventBus.emit()`) es preexistente y ya usado en producción por
disputes/jobs/payments; este cambio solo agrega 3 entradas al schema y 3
puntos de llamada nuevos, ambos cubiertos arriba. Confirmarlo en producción
requeriría una incidencia/verificación real post-deploy — no se hizo en esta
sesión.
