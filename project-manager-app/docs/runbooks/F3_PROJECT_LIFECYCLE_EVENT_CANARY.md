# F3 Project Lifecycle Event Canary

**Estado:** VERIFICADO EN CANARY
**Corte:** 2026-07-31
**Scope:** `tenant_default`
**Spec:** [`../specs/operations/project-lifecycle-projection.spec.md`](../specs/operations/project-lifecycle-projection.spec.md)

## Propósito

Operar y recuperar el flujo:

```text
source mutation
  -> project.lifecycle-source-changed.v1
  -> DomainOutboxEvent
  -> BullMQ semse-domain-events
  -> project-lifecycle-projection.v1
  -> rebuild tenant-scoped + CAS
  -> AuditLog + DomainEventConsumption
```

La proyección nunca es autoridad de escritura de Project, Milestone, Evidence,
Payment, Expense, Dispute o Risk.

## Configuración segura

API:

- `SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED=true`
- `SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED=true`
- `SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS=tenant_default`
- `SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED=true`
- `SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED=true`
- `SEMSE_EVENT_CONSUMERS_ENABLED=true`
- `SEMSE_EVENT_CONSUMER_ALLOWLIST` incluye
  `project-lifecycle-projection.v1`
- `SEMSE_EVENT_TYPE_ALLOWLIST` incluye
  `project.lifecycle-source-changed.v1`

Worker:

- `SEMSE_EVENT_CONSUMERS_ENABLED=true`
- `SEMSE_ROLES` incluye exactamente la capacidad de servicio
  `EVENT_CONSUMER` además de sus roles operativos.

No retirar `evidence-readiness.v1` ni `evidence.uploaded.v1` de los allowlists
si el canary F1 comparte las mismas variables.

## Verificación

1. Confirmar deployments terminales `SUCCESS` de API y Worker.
2. Confirmar que el Worker registra `domain event consumer worker enabled` para
   la cola `semse-domain-events`.
3. Provocar una mutación permitida del proyecto canario.
4. Consultar `GET /v1/domain-events/outbox` con `domain-events:read`.
5. Confirmar `PUBLISHED` y después consultar
   `GET /v1/domain-events/:eventId/deliveries`.
6. Confirmar receipt `COMPLETED`, consumer
   `project-lifecycle-projection.v1`, `lastError=null` y revisión F3.
7. Repetir la entrega y confirmar `duplicate=true`, sin segundo efecto.
8. Para un receipt terminal autorizado, usar
   `POST /v1/domain-events/:eventId/replay` con motivo operativo; confirmar
   `replayCount` incremental y efecto `no_op`.

El endpoint interno `POST /v1/domain-events/:eventId/process` sólo acepta
identidad de servicio con rol `EVENT_CONSUMER` y permiso
`domain-events:consume`; no se usa como endpoint de usuario.

## Evidencia del canary

- Código F3 events: PR `#477`, merge
  `f1234291fc190c6611d3f2258630ac08315bd060`.
- Workflow de deploy: `30542950757`, éxito.
- API activación: `d896be44-4b27-48b8-8324-159599ab8e1a`, éxito,
  `62c69537f62515bbaabbfa0b29d2750d9d9c5b0e`.
- Worker corregido: `d706d7ad-3661-437c-8492-18b7791a0345`, éxito,
  `62c69537f62515bbaabbfa0b29d2750d9d9c5b0e`.
- Producción acumulada actual: `3c2ac45d4f5d3c43a081767c54405eb08d31c788`,
  cuatro servicios `SUCCESS`; contiene F3 y conserva su configuración canary.
- Resultado: 5 outbox `PUBLISHED`, 5 receipts `COMPLETED`, cero
  pending/claimed/failed/dead-letter.
- Evento de replay:
  `5173120d-f312-4d8e-880e-2d2adee8d3b8`.
- Proyecto canario: `cmrsjhzgh007nps01r6gnx090`.
- Replay: `replayCount=1`, `attempts=1`, `duplicate=true`, `effect=no_op`,
  `lastError=null`.
- Revisión:
  `project-lifecycle.v1:0f8f7c9fb7c45d9fbd55bb733bb3b06e5265782b6113a1e622a675679a7d244d`.

## Incidente conocido y recuperación

Los dos primeros jobs alcanzaron el endpoint interno con 403 porque el Worker
tenía `OPS_ADMIN,WORKER`, pero no `EVENT_CONSUMER`. Los outbox ya estaban
`PUBLISHED`; no se perdieron. Después de corregir el rol y desplegar el Worker,
los eventos:

- `f893805f-6cd9-4ded-8a75-c3ee58dd4a37`
- `dab442a8-c747-45c2-9f5a-fef3869fd935`

se procesaron una sola vez y terminaron `COMPLETED`. Tres eventos posteriores
se consumieron automáticamente. Antes de reencolar por 403, verificar siempre
roles de servicio para evitar reintentos inútiles.

## Atomicidad y recuperación

Evidence registra su cambio y outbox F3 en la misma transacción. Los hooks de
Project, Milestone, Dispute, Payment, Finance, Risk y promoción BuildOps se
emiten post-commit y son best-effort. Si uno falla, la fuente canónica no se
revierte: el endpoint read-through recalcula, el rebuild es idempotente y un
evento posterior puede converger la proyección.

No presentar esos hooks como outbox atómica hasta que cada bounded context
adopte el patrón transaccional.

## Rollback

Orden recomendado:

1. `SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED=false` para detener nuevos eventos
   F3.
2. Retirar `project.lifecycle-source-changed.v1` del type allowlist o
   `project-lifecycle-projection.v1` del consumer allowlist para pausar sólo
   este flujo.
3. Si el problema es transversal, apagar dispatcher/consumers; esto afecta
   también otros consumidores allowlisted y requiere evaluación.
4. Si la lectura F3 falla, apagar persistencia y después proyección.

No borrar outbox, receipts ni `ProjectLifecycleProjection`. Conservarlos para
diagnóstico, forward-fix y replay auditado.

## Promoción global

El canary verificado no autoriza quitar el tenant allowlist. Antes de promoción
global se requiere una ventana sostenida con P95 del endpoint, error 5xx,
consumer lag, retries, dead-letter y mismatch durable/calculado dentro del SLO.

## Dominio público

Al corte, el health por dominio Railway de API responde 200. El dominio
`api.semseproject.com` figura sincronizado en Railway, pero el cliente TLS
todavía recibe un certificado cuyo nombre no coincide. Usar el dominio Railway
para probes operativos hasta corregir la emisión TLS en la sesión dedicada de
dominio/DNS documentada en
[`API_CUSTOM_DOMAIN_TLS_HANDOFF.md`](API_CUSTOM_DOMAIN_TLS_HANDOFF.md).
`app.semseproject.com` y su health responden 200.
