---
id: "satellites.outbound-webhooks"
title: "SAT-007 — Webhooks salientes firmados para satélites"
domain: "api"
sdd_version: "2.0"
version: "2.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - "SATELLITE_WEBHOOKS_ENABLED"
production_evidence: []
related_files:
  - apps/api/src/modules/satellites/satellites.service.ts
  - apps/api/src/modules/satellites/satellites.controller.ts
  - apps/api/src/modules/satellites/satellites.module.ts
  - apps/api/src/modules/satellites/satellite-scope.guard.ts
  - apps/api/src/modules/satellites/satellite-webhooks.service.ts
  - apps/api/src/modules/satellites/satellite-webhooks.controller.ts
  - apps/api/src/modules/satellites/satellite-webhook-crypto.ts
  - apps/api/src/modules/satellites/satellite-webhook-delivery.ts
  - apps/api/src/modules/domain-events/domain-event-consumer.service.ts
  - apps/api/src/modules/domain-events/domain-events.module.ts
  - apps/api/src/modules/domain-events/outbox-dispatcher.service.ts
  - apps/api/src/modules/domain-events/outbox.repository.ts
  - apps/api/src/modules/semse-agents/marketplace.agent.ts
  - apps/api/src/modules/jobs/jobs.service.ts
  - apps/api/src/modules/milestones/milestones.service.ts
  - apps/api/src/modules/communications/providers/whatsapp-cloud.adapter.ts
  - packages/autonomy/src/browser/secure-network-gateway.ts
  - packages/autonomy/src/browser/session-manager.ts
  - packages/shared/src/safe-url.ts
  - packages/schemas/src/domain-events-v2.schema.ts
  - packages/db/prisma/schema.prisma
  - packages/db/prisma/migrations/20260827010000_satellite_webhook/migration.sql
  - docs/foundation/EVENT_CATALOG.md
related_tests:
  - apps/api/test/satellite-scope-guard.test.ts
  - apps/api/test/satellites-service.test.ts
  - apps/api/test/satellite-webhook-crypto.test.ts
  - apps/api/test/satellite-webhooks-service.test.ts
  - apps/api/test/satellite-webhooks-consumer.test.ts
  - apps/api/test/satellite-webhook-delivery.test.ts
  - apps/api/test/marketplace-agent-outbox.test.ts
  - apps/api/test/jobs-service-completion-outbox.test.ts
  - apps/api/test/milestones-service-outbox.test.ts
  - tests/unit/safe-url.test.ts
related_endpoints:
  - POST /v1/satellites/webhooks
  - GET /v1/satellites/webhooks
  - DELETE /v1/satellites/webhooks/:id
related_events:
  - job.matched
  - job.completed
  - rating.requested
  - milestone.approved
  - milestone.rejected
related_agents: []
last_verified: "2026-08-27"
---

# Spec: Webhooks salientes firmados para satélites

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

## 1. Problema y resultado

**Para quién:** satélites `VIVO`/`LATENTE` autenticados con un satellite
token (SAT-001, `satellites.semse-sdk`, `APPROVED`) — hoy sólo la app móvil
(mobile) y, si se retoma, Alexa.

**Problema (verificado contra código, 2026-08-17):** el flujo satélite→SEMSE
ya existe (SAT-001: `SatelliteToken` en Prisma —
`packages/db/prisma/schema.prisma:388-400` —, `SatellitesService`,
`SatelliteScopeGuard`, endpoints `v1/satellites/tokens|me`). El flujo
inverso no existe en absoluto: no hay modelo `SatelliteWebhook`, ningún
endpoint `v1/satellites/webhooks`, ningún dispatcher de entrega HTTP
saliente, y el único stream `Sse` real
(`apps/api/src/infrastructure/sse/sse.controller.ts`) se autentica por
`x-tenant-id`/sesión web — no acepta satellite tokens ni el scope
`events:subscribe` que ya existe reservado en el catálogo de scopes
(`satellites.service.ts:16-26`) pero que ningún código consume todavía. Un
satélite hoy sólo puede enterarse de cambios haciendo polling con su token,
lo que el catálogo de scopes ya anticipa pero no cumple.

**Resultado esperado:** un satélite con scope suficiente puede registrar una
URL HTTPS propia; cuando ocurre un evento de dominio ya real y ya emitido
hoy (`job.matched`, `job.completed`, `rating.requested`,
`milestone.approved`, `milestone.rejected` — ver §3 de este documento para
la verificación de cada uno), SEMSE le entrega un `POST` firmado con
reintentos, sin exponer datos sensibles en el payload (el satélite hace
`GET` de vuelta con su propio token y scope).

## 2. Alcance

### Incluido

- Modelo `SatelliteWebhook` (Prisma) + endpoints CRUD bajo satellite token.
- Dispatcher de entrega HTTP saliente (firmado, con reintentos y
  suspensión tras fallos repetidos) colgado del outbox de dominio existente.
- Verificación SSRF de la URL registrada, en registro **y** en cada intento
  de entrega (no sólo una vez).
- Catálogo v1 de eventos exportables, acotado a eventos que el código ya
  emite hoy (ver §3).
- Kill switch `SATELLITE_WEBHOOKS_ENABLED`.

### Fuera de alcance

- **SSE autenticado por satellite token** (segunda mitad del SAT-007
  original, "flujo inverso vía stream"). Se separa a un spec propio porque
  toca `sse.controller.ts` (superficie ya con historial de bugs de
  aislamiento cross-tenant documentado en su propio comentario de cabecera,
  líneas 34-43) y el guard/scope necesario para satélites en SSE es un
  cambio de superficie distinto al de un dispatcher de entrega HTTP. No
  bloquea este spec: los webhooks no dependen de SSE.
- **Eventos de `payment.*`** — excluidos del catálogo v1 deliberadamente.
  Exponer eventos de pagos a un consumidor externo, aunque sea sólo una
  referencia sin payload, es una superficie que el Artículo IV de la
  constitución (`.specify/memory/constitution.md`) ata a revisión de
  Payment Governance; este spec no la incluye ni la asume aprobada.
- **`evidence.approved`/`intake.completed`/`docs.merged`** — el borrador
  original de este spec los listaba como exportables. Verificado: ninguno
  de los tres es un evento que el código emita hoy (evidencia sólo emite
  `evidence.uploaded.v1`, `evidence.repository.ts:135`; smart-intake no
  emite ningún `DomainEvent`; no existe productor de `docs.merged`). Quedan
  fuera del catálogo v1 hasta que exista el evento real que representen —
  añadirlos aquí sería inventar un nombre de evento fuera de
  `EVENT_CATALOG.md`, prohibido por `AGENTS.md` §"NUNCA".
- **Garantía exactly-once** — se garantiza at-least-once + `idempotencyKey`,
  igual que el borrador original.
- **Lado satélite** (cómo un satélite concreto procesa el webhook) — fuera
  del monorepo, por diseño del programa (SAT-000 §1.2).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Satélite con token `events:subscribe` (scope ya reservado, `satellites.service.ts:25`) | satellite-token vía `SatelliteScopeGuard` | eventos limitados a los scopes que ya tiene el token (p. ej. un token sólo `intake:*` no puede suscribirse a eventos `jobs:*`) | Registrar/listar/borrar sus propios webhooks | Suscribirse a un evento fuera de sus scopes, ni ver/gestionar webhooks de otro satélite |
| `OPS_ADMIN` | `satellites:admin` (ya existe, `packages/auth/src/rbac.ts:218`) | todos los webhooks registrados | Listar y revocar cualquier webhook (operación/incidentes) | Ver el `secret` en claro tras el registro inicial (mismo estándar que `SatelliteToken.token`, sólo una vez) |
| `EVENT_CONSUMER` (identidad de servicio ya usada en `domain-events.controller.ts:186`) | rol de servicio interno | el dispatcher de entrega en sí | Leer del outbox y ejecutar la entrega HTTP | Escribir eventos de dominio nuevos — sólo consume |

- **Tenant boundary:** un webhook se registra contra el token del satélite,
  no contra un tenant — los eventos que le llegan ya están filtrados por
  scope, y el payload no lleva datos tenant-scoped más allá de IDs de
  referencia (igual criterio que `evidence.uploaded.v1` hoy).
- **Ownership/resource policy:** un satélite sólo administra sus propios
  webhooks (`satelliteTokenId` como clave de propiedad).
- **Step-up o aprobación humana:** ninguno — registrar un webhook es una
  operación de satélite ya autenticado con token de scope suficiente.
- **Datos `privacyCritical`:** el payload de entrega nunca lleva datos
  `privacyCritical` — sólo `{ event, occurredAt, idempotencyKey, resource:
  { type, id, url } }`; el satélite hace `GET` autenticado con su propio
  token para el detalle, sujeto a los mismos permisos que ya aplican a ese
  `GET`.
- **Requisitos de auditoría:** registro/revocación de webhook emite
  `AuditLog` (`actor` = satélite o `OPS_ADMIN`, `entidad` = `SatelliteWebhook`,
  `accion` = `created`/`revoked`), igual patrón que `SatelliteToken` hoy
  (`satellites.service.ts` loguea emisión/revocación, aunque no vía
  `AuditLog` formal — este spec sí lo exige explícitamente para webhooks,
  dado que hablan a un destino externo).

## 4. Escenarios y criterios de aceptación

### P1 — Registro de webhook

```gherkin
DADO un satélite con token válido y scope jobs:read
CUANDO hace POST /v1/satellites/webhooks con { url: "https://...", events: ["job.matched"], secret? }
ENTONCES se crea el registro, se genera un secret si no vino uno,
  y la respuesta devuelve el secret en claro una única vez
Y se registra un AuditLog de creación
```

Casos borde:

- [ ] `events` incluye un evento fuera del scope del token → 403.
- [ ] `url` no-https, con IP literal privada/loopback, o que resuelve por
      DNS a un rango privado (SSRF, ver §5) → 400.
- [ ] `url` duplicada para el mismo satélite → 409 (evita registrar el mismo
      destino dos veces sin darse cuenta).

### P2 — Entrega firmada con reintentos

```gherkin
DADO un webhook activo suscrito a job.matched
CUANDO el evento job.matched ocurre para un recurso dentro del scope del satélite
ENTONCES el dispatcher hace POST a la URL registrada con header
  x-semse-signature (HMAC-SHA256 del body con el secret)
Y el body es { event, occurredAt, idempotencyKey, resource }, sin datos sensibles
Y si el POST falla (timeout/5xx), reintenta según el schedule de §8
Y tras 5 fallos consecutivos el webhook pasa a SUSPENDED
```

Casos borde:

- [ ] Reintento de un evento ya entregado con éxito (reintento espurio del
      dispatcher, ej. tras perder el lease) — el satélite recibe la misma
      `idempotencyKey`, la deduplicación es su responsabilidad, documentada
      explícitamente en el contrato.
- [ ] Token del satélite revocado con webhooks activos — el dispatcher deja
      de entregar (no hay forma de firmar/autorizar sin el registro del
      token vivo); los webhooks del token revocado pasan a `SUSPENDED` en
      el mismo ciclo que la revocación, no por timeout de fallos.
- [ ] DNS rebinding entre el registro y una entrega posterior — ver §5,
      revalidación obligatoria en cada intento, no sólo al registrar.

### P3 — Kill switch

```gherkin
DADO SATELLITE_WEBHOOKS_ENABLED=false
CUANDO el dispatcher corre su ciclo
ENTONCES no se realiza ningún POST saliente
Y los eventos pendientes quedan encolados, no se pierden
Y POST /v1/satellites/webhooks devuelve 503 explícito (mismo patrón que
  satelliteTokensEnabled(), satellites.service.ts:36-38)
```

## 5. Contratos

### API — `POST /v1/satellites/webhooks`

```yaml
auth: satellite-token
permissions: [] # el scope del token limita `events`, no un permiso RBAC clásico
input_schema:
  url: string (https URL, validada por SSRF guard antes de aceptar)
  events: string[] (subconjunto no vacío de EVENT_CATALOG_V1, ver tabla §3-alcance)
  secret: string (opcional, min 32 chars; si se omite, SEMSE genera uno con crypto.randomBytes(32))
output_schema: { id, url, events, createdAt, secret } # secret sólo en esta respuesta
errors:
  400: url insegura (no-https / IP privada / DNS a rango privado) o evento fuera de EVENT_CATALOG_V1
  401: token inválido/revocado/expirado
  403: evento fuera de los scopes del token
  409: url duplicada para este satélite
effects:
  audit_log: SatelliteWebhook.created { actor: satellite.name, url, events }
  domain_event: ninguno (esto es un consumidor de eventos, no un productor)
  sse: no aplica
  payment_governance: no aplica (payment.* excluido del catálogo)
```

### API — `GET /v1/satellites/webhooks` (satellite-token: propios; `satellites:admin`: todos)

```yaml
auth: satellite-token | RBAC satellites:admin
output_schema: [{ id, url, events, status, lastDeliveryAt, consecutiveFailures, createdAt }] # sin secret
```

### API — `DELETE /v1/satellites/webhooks/:id` (satellite-token propio, o `satellites:admin`)

```yaml
auth: satellite-token | RBAC satellites:admin
errors:
  403: intentar borrar el webhook de otro satélite sin satellites:admin
  404: webhook inexistente
effects:
  audit_log: SatelliteWebhook.revoked
```

### Entrega saliente (dispatcher, no es un endpoint HTTP público)

```yaml
method: POST <url registrada>
headers:
  x-semse-signature: "sha256=<hmac hex>"
  x-semse-event: "<event>"
  x-semse-delivery-id: "<uuid>"
  content-type: application/json
body:
  event: string
  occurredAt: ISO8601
  idempotencyKey: string
  resource: { type: string, id: string, url: string } # el satélite hace GET con su propio token
timeout: 10s por intento
```

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** ninguno de dominio — se agrega el FSM propio de
  `SatelliteWebhook`: `ACTIVE → SUSPENDED` (5 fallos consecutivos o
  revocación del token padre) `→ ACTIVE` (reactivación manual explícita por
  `OPS_ADMIN` o re-registro, nunca automática).
- **Invariantes:** `docs/foundation/DOMAIN_INVARIANTS.md` no cubre
  `SatelliteWebhook` hoy — se agrega una entrada nueva ahí mismo cuando este
  spec se implemente: *"un webhook `SUSPENDED` no se reactiva
  automáticamente; requiere acción explícita"*.
- **Eventos declarados:** este spec **consume** del catálogo existente
  (`docs/foundation/EVENT_CATALOG.md`); no declara eventos de dominio
  nuevos. Nota de mantenimiento: `job.matched`
  (`apps/api/src/modules/semse-agents/marketplace.agent.ts:108`) y
  `rating.requested` (`apps/api/src/modules/jobs/jobs.service.ts:744`) ya
  se emiten en producción pero **no están documentados en
  `EVENT_CATALOG.md`** — gap preexistente, no introducido por este spec,
  que debe cerrarse (añadir esas dos filas al catálogo) como prerrequisito
  de implementación, no de aprobación del contrato.
- **Productor + outbox atómico:** reutiliza el outbox de dominio ya
  existente y en producción (`outbox-dispatcher.service.ts`,
  `outbox.repository.ts`) — el dispatcher de webhooks es un **consumidor
  adicional** de esos mismos eventos ya persistidos atómicamente, no un
  productor nuevo.
- **Consumidores + idempotencia:** el dispatcher de webhooks reutiliza el
  patrón de `idempotencyKey` ya presente en el consumer de dominio
  (`domain-event-consumer.service.ts:146,262`) — la clave que ya identifica
  la entrega interna es la misma que via al satélite en el payload.
- **Replay/rebuild:** un webhook `SUSPENDED` reactivado no reproduce
  automáticamente eventos perdidos durante la suspensión — el satélite debe
  reconciliar vía polling con su token, mismo criterio que cualquier
  consumidor at-least-once con gaps.
- **DLQ/compensación:** tras 5 fallos y suspensión, no hay reintento
  automático adicional — el evento permanece disponible para consulta vía
  `GET /v1/domain-events/:eventId/deliveries` (ya existe,
  `domain-events.controller.ts:88-104`), reutilizado tal cual para
  inspeccionar entregas de webhook fallidas.

## 7. Datos y migración

- **Modelos Prisma (nuevo):**

```prisma
model SatelliteWebhook {
  id                  String    @id @default(cuid())
  satelliteTokenId    String
  url                 String
  events              String[]
  secretHash          String    // ver nota de cifrado abajo — no es un hash de comparación, es una referencia a la clave cifrada
  secretCiphertext     String    // AES-256-GCM, ver §5 "Secreto en reposo"
  secretIv            String
  secretTag           String
  status              String    @default("ACTIVE") // ACTIVE | SUSPENDED
  consecutiveFailures Int       @default(0)
  lastDeliveryAt      DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  satelliteToken      SatelliteToken @relation(fields: [satelliteTokenId], references: [id], onDelete: Cascade)

  @@index([satelliteTokenId, status])
  @@unique([satelliteTokenId, url])
}
```

  (Nombrar campos definitivo se resuelve en `plan`, no aquí — el punto de
  este spec es fijar que el secret se **cifra**, no se hashea: a diferencia
  de `SatelliteToken.tokenHash` — que sólo necesita comparación, nunca
  recuperación —, el secret de un webhook debe poder leerse en claro en
  cada entrega para firmar el HMAC. Hashear lo haría irrecuperable e
  inutilizable.)

- **Migración:** `ALTER TABLE` aditiva, tabla nueva — sin riesgo de drift en
  datos existentes.
- **Estrategia expand/contract:** N/A, tabla nueva.
- **Backfill:** ninguno.
- **Compatibilidad hacia atrás:** N/A.
- **Verificación de drift:** estándar (`prisma migrate diff` contra el
  schema antes de aplicar en producción).
- **Rollback de código:** revertir el módulo de webhooks no afecta al resto
  de `apps/api` — es aditivo.
- **Rollback/forward-fix de datos:** `DROP TABLE` reversible mientras no
  haya datos de producción (pre-`VERIFIED`); post-producción, desactivar via
  `SATELLITE_WEBHOOKS_ENABLED=false` en vez de borrar datos.

## 8. Observabilidad, despliegue y activación

- **Secreto en reposo:** cifrado AES-256-GCM con clave maestra de proceso
  (`SATELLITE_WEBHOOK_SECRET_KEY`, 32 bytes hex), mismo algoritmo/patrón ya
  usado en este monorepo para material sensible en reposo
  (`packages/autonomy/src/browser/session-manager.ts:1-45`,
  `encryptCookies`/`decryptCookies`) — se adapta, no se reinventa. La clave
  maestra vive sólo en variables de entorno de Railway, nunca en el
  repositorio.
- **Firma:** HMAC-SHA256 sobre el body exacto enviado, mismo patrón ya
  verificado en este repo para webhooks (`verifyWhatsAppWebhookSignature`,
  `whatsapp-cloud.adapter.ts:26-41`, incluyendo comparación
  `timingSafeEqual` — se reutiliza la misma construcción, invertida: SEMSE
  firma en vez de verificar).
- **SSRF en la URL del satélite:** validación en dos momentos, no uno:
  1. **Al registrar** — sólo `https:`, hostname no `localhost`/loopback, IP
     resuelta fuera de rangos privados/link-local/reservados. Se
     reutiliza/extrae `SecureNetworkGateway.isUrlSafe()`
     (`packages/autonomy/src/browser/secure-network-gateway.ts`) — hoy vive
     en `packages/autonomy` (browser agent); este spec requiere moverlo o
     re-exportarlo a un paquete compartido (`packages/shared` o
     `packages/auth`) para que `apps/api` lo consuma sin depender de
     `packages/autonomy` completo. Nota: la implementación actual sólo
     resuelve `A`/IPv4 vía `dns.lookup` — hay que confirmar que también
     cubre `AAAA` antes de darla por completa para este uso (gap conocido a
     cerrar en `plan`, no en este documento).
  2. **En cada intento de entrega** — no basta con validar una vez al
     registrar: un dominio puede cambiar su registro DNS después (DNS
     rebinding) para apuntar a una IP interna en el momento de la entrega
     real. El dispatcher resuelve y valida la IP **en cada intento**, y la
     conexión HTTP se abre contra esa IP resuelta (pinning), no permitiendo
     que una segunda resolución DNS ocurra dentro de la misma librería HTTP
     entre el chequeo y el connect.
  3. **Redirects:** el cliente HTTP de entrega no sigue redirects
     automáticamente — un 3xx del destino se trata como fallo de entrega,
     no como una URL alternativa a validar y seguir.
- **Métricas/SLO:** tasa de entrega exitosa por webhook, latencia de
  entrega, conteo de `SUSPENDED` por ventana — expuesto en el mismo
  `MetricsService` que ya instrumenta el outbox
  (`outbox-dispatcher.service.ts` usa `recordOutboxPublishLag`,
  `recordOutboxSnapshot`).
- **Logs/traces/correlation:** `idempotencyKey` y `correlationId` del
  evento de origen propagados en cada intento de entrega, igual criterio
  que el resto del outbox.
- **Health/readiness:** el dispatcher de webhooks reporta su propio estado
  (encolado/pausado por kill switch) en el healthcheck existente, mismo
  patrón que `isOutboxDispatchEnabled()` (`outbox-dispatcher.service.ts:15-19`).
- **Feature flags:** `SATELLITE_WEBHOOKS_ENABLED` — apagado, la cola queda
  pausada, no se pierde (mismo criterio que el kill switch de
  `SATELLITE_TOKENS_ENABLED`, `satellites.service.ts:36-38`).
- **Plan de canary:** un satélite real (o receptor de prueba controlado por
  el equipo) recibiendo entregas reales en Railway antes de `VERIFIED`.
- **Evidencia de producción requerida:** entrega real desde Railway hacia un
  receptor externo, suspensión verificada tras fallos forzados, evidencia
  pegada en `docs/reportes/` con fecha.
- **Señal de rollback:** `SATELLITE_WEBHOOKS_ENABLED=false` desconecta sin
  deploy.
- **Owner operativo:** `semse-core`.

### Anillos de verificación (SAT-000 §2)

- **Anillo 1:** firma HMAC verificable con vector de prueba fijo; suscripción
  fuera de scope → 403; URL privada/no-https → 400 (SSRF, en registro y en
  reintento simulado con DNS rebinding).
- **Anillo 2:** `sdk.events` (helper de registro + verificación de firma del
  lado satélite) testeado contra un mock del contrato del Anillo 1.
- **Anillo 3 — E2E local:** registrar webhook, disparar `job.matched` real,
  recibir POST firmado en un receptor local, verificar `idempotencyKey` en
  una re-entrega forzada.
- **Anillo 4 — Smoke en Railway:** webhook real desde Railway hacia un
  receptor externo; suspensión tras fallos verificada; evidencia en
  `docs/reportes/`.
- **Kill switch:** `SATELLITE_WEBHOOKS_ENABLED` verificado — OFF ⇒ cola
  pausada, no perdida.

## 9. Tests requeridos

- [ ] Unitarios: firma HMAC (generación + verificación con vector fijo),
      cifrado/descifrado del secret (AES-256-GCM roundtrip).
- [ ] Contrato API: `POST/GET/DELETE /v1/satellites/webhooks` — 400/401/403
      /409 explícitos.
- [ ] Permiso denegado y aislamiento: un satélite no puede leer/borrar el
      webhook de otro; token revocado suspende sus webhooks.
- [ ] SSRF: URL privada/loopback/no-https rechazada en registro; DNS
      rebinding simulado rechazado en el momento de entrega (no sólo en
      registro).
- [ ] Idempotencia/reintento/concurrencia: reintento tras fallo respeta el
      schedule; `idempotencyKey` estable entre reintentos del mismo evento.
- [ ] Migración: `SatelliteWebhook` aditiva, sin efecto sobre datos
      existentes.
- [ ] Kill switch: `SATELLITE_WEBHOOKS_ENABLED=false` ⇒ 503 en registro, cola
      pausada sin pérdida.
- [ ] Canary o smoke autenticado en producción antes de `VERIFIED`.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/satellites/` — nuevo `satellite-webhooks.controller.ts`,
  `satellite-webhooks.service.ts`.
- `apps/api/src/modules/domain-events/` — nuevo consumidor de outbox para
  despachar hacia `SatelliteWebhook`, reutilizando `outbox.repository.ts`.
- `packages/db/prisma/schema.prisma` — modelo `SatelliteWebhook` + migración.
- `packages/auth/src/rbac.ts` — sin permiso RBAC nuevo (el CRUD de webhooks
  usa satellite-token, no rol humano, salvo la vista admin que ya tiene
  `satellites:admin`).

### Worker/Packages/DB

- `packages/autonomy/src/browser/secure-network-gateway.ts` → extraer a
  ubicación compartida consumible desde `apps/api` (decisión de paquete
  destino en `plan`, no aquí).
- `apps/worker` — si el dispatcher corre como job BullMQ en vez de loop en
  `apps/api` (decisión de `plan`, consistente con que `apps/worker` ya es
  donde vive el resto de fan-out asíncrono).

### Tests

- `apps/api/test/satellite-webhooks.test.ts` — nuevo.
- `apps/api/test/satellite-webhooks-dispatcher.test.ts` — nuevo.

## 11. Investigación externa

- **Reporte con tres búsquedas primarias:** no realizado en esta revisión —
  el diseño se apoya enteramente en patrones ya existentes y verificados en
  este mismo repositorio (HMAC de `whatsapp-cloud.adapter.ts`, cifrado de
  `session-manager.ts`, SSRF guard de `secure-network-gateway.ts`, outbox de
  `outbox-dispatcher.service.ts`) en vez de introducir una librería o
  convención externa nueva.
- **Aplicado ahora:** ninguno — pendiente de `implement`.
- **Backlog:** evaluar si conviene una librería de webhooks estándar
  (p. ej. `svix`-style) en vez de dispatcher propio, si el volumen de
  satélites crece más allá de mobile/Alexa.
- **Descartado:** exactly-once delivery (excluido explícitamente, at-least-once
  + idempotencyKey es el estándar ya usado en el resto del outbox).

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
