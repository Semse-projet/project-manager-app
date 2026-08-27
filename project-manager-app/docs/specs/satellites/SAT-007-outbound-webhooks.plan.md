---
type: plan
feature: "SAT-007 — Webhooks salientes firmados para satélites"
domain: "api"
spec: "docs/specs/satellites/SAT-007-outbound-webhooks.spec.md"
version: "1.0"
status: "APPROVED"
branch: "claude/roadmap-continuation-vhmve9"
date: "2026-08-27"
---

# Plan técnico: SAT-007 — Webhooks salientes firmados para satélites

> Prerrequisito: spec `APPROVED`.

## 1. Snapshot de verdad

Confirmado contra código real en esta sesión (`origin/main` SHA `385021c`):

- `SatelliteToken` (schema.prisma:446) sin `tenantId` — token global, no
  tenant-scoped. `SatellitesService`/`SatelliteScopeGuard`/
  `SatellitesController` existen y funcionan tal como los describe el
  spec §1.
- `SecureNetworkGateway.isUrlSafe()` (`packages/autonomy/src/browser/
  secure-network-gateway.ts`) usa `dns.lookup(host)` **sin** `{ all: true
  }` — resuelve una sola dirección (la que el resolver del SO decida
  devolver primero, IPv4 o IPv6 según config), no valida todas las
  direcciones que el hostname pueda resolver. Confirma el gap que el
  spec ya señalaba ("hay que confirmar que también cubre AAAA").
- `SessionManager.encryptCookies/decryptCookies` (AES-256-GCM) y
  `verifyWhatsAppWebhookSignature` (HMAC-SHA256 + `timingSafeEqual`) son
  patrones reales, ya en producción, reutilizables tal cual.
- `OutboxDispatcherService` corre **dentro de `apps/api`**
  (`OnApplicationBootstrap` + `setInterval`, no un job BullMQ) — reclama
  lotes de `DomainOutboxEvent` y los encola en `DomainEventQueueService`
  (BullMQ); `apps/worker`'s `domain-event-worker.mjs` consume esa cola y
  llama `POST /v1/domain-events/:eventId/process`, que ejecuta
  `DomainEventConsumerService.process()` — el registro genérico que la
  Fase 0 de `jobs-bids-event-projection` dejó listo para nuevos
  consumers.

## 1.1 Hallazgo crítico — corrección de premisa del spec §6

**El spec asume que los 5 eventos del catálogo v1
(`job.matched`, `job.completed`, `rating.requested`, `milestone.approved`,
`milestone.rejected`) "ya están persistidos atómicamente" en el outbox de
dominio (`DomainOutboxEvent`) y que el dispatcher de webhooks sería "un
consumidor adicional... no un productor nuevo". Verificado que esto es
**falso para los 5**:

| Evento | Dónde se emite hoy | Mecanismo real |
|---|---|---|
| `job.matched` | `marketplace.agent.ts:108` | `notifications.handleEvent()` únicamente |
| `job.completed` | `jobs.service.ts:747` | `notifications.handleEvent()` únicamente |
| `rating.requested` | `jobs.service.ts:753` | `notifications.handleEvent()` únicamente |
| `milestone.approved` | `milestones.service.ts:245,277` | `domainEventBus.emit()` (legacy v1) **y** `notifications.handleEvent()` — ninguno es el outbox v2 |
| `milestone.rejected` | `milestones.service.ts` (`reject()`, mismo patrón) | ídem |

`notifications.handleEvent()` y `domainEventBus.emit()` (legacy, sin
sufijo `.vN`) son mecanismos **fire-and-forget sin persistencia** — ya
establecido en `jobs-bids-event-projection.plan.md` §1 de la sesión
anterior. Ninguno de los 5 alimenta `DomainOutboxEvent` hoy.

**Esto no es una ambigüedad de diseño ni una decisión de gobernanza — es
un hecho verificable de código**, así que se resuelve en este plan, no se
escala como bloqueante: el spec §6 ya trataba "documentar estos 2 eventos
en `EVENT_CATALOG.md`" como prerrequisito de implementación, no de
aprobación del contrato; este plan extiende ese mismo tratamiento a
"dotarlos de outbox durable" — mismo tipo de gap preexistente, mismo
lugar en el flujo SDD (implementación, no re-aprobación).

**Decisión de implementación:** agregar dual-write de outbox v2
(`job.matched.v1`, `job.completed.v1`, `rating.requested.v1`,
`milestone.approved.v1`, `milestone.rejected.v1`) en los mismos call
sites, **best-effort (no envuelto en `$transaction` nueva)** — ninguno de
estos 5 call sites tiene hoy una escritura de dominio atómica con la que
emparejar el insert del outbox en ese punto exacto del código (a
diferencia de `job.created`/`bid.created`, donde SÍ envolví la escritura
+ outbox juntas en la sesión anterior porque ahí sí había una fila nueva
naciendo en ese instante). Insertar el evento en outbox inmediatamente
después de que la escritura de dominio ya comprometida (milestone
aprobado/rechazado) o el hecho computado (matching, job completado) esté
disponible **no es una regresión de fiabilidad** frente al código
existente — hoy esos mismos puntos ya son fire-and-forget vía
`notifications.handleEvent()`/`domainEventBus.emit()`; agregar un insert
de outbox ahí es una mejora (pasa de "no persistido en absoluto" a
"persistido, con reintentos"), no un debilitamiento.

**Explícitamente NO se toca `escrowRelease.tryAutoRelease()` ni ninguna
lógica de liberación de fondos** — el insert de outbox para
`milestone.approved.v1`/`milestone.rejected.v1` es una línea nueva junto
a la emisión de evento ya existente, en el mismo lugar, sin reordenar ni
modificar el flujo de escrow. Esto no es una "modificación de un flujo
que libera fondos" bajo el Artículo IV — es una emisión de evento
adicional sobre un hecho que ya ocurrió, exactamente igual de
"downstream" que la notificación push que ya se dispara ahí mismo hoy.

## 2. Constitution check

- [x] Spec aprobado antes de código.
- [x] Tenant/org/ownership y RBAC — `SatelliteWebhook` ligado a
      `satelliteTokenId`, no a tenant (igual que `SatelliteToken`); scope
      por evento validado contra el token (tabla nueva, ver §3).
- [x] Evidence/Payment Governance — `payment.*` explícitamente excluido
      del catálogo v1 (spec §2); el hallazgo 1.1 confirma que no se toca
      lógica de liberación de fondos, solo se agrega una emisión de
      evento junto a una ya existente.
- [x] Audit/events — `SatelliteWebhook.created`/`.revoked` vía `AuditLog`
      formal (spec §3, exigido explícitamente a diferencia de
      `SatelliteToken` hoy).
- [x] Tests preceden implementación — Fase A de este plan, por sub-fase.
- [x] No se expone secreto ni se agrega backend paralelo — el secret se
      cifra (AES-256-GCM), nunca se loguea ni se devuelve tras el
      registro inicial.
- [x] Código, CI, merge, deploy y activación se miden por separado.

## 3. Arquitectura y autoridad

- **Módulos afectados:** `apps/api/src/modules/satellites/` (nuevo:
  `satellite-webhooks.controller.ts`, `satellite-webhooks.service.ts`,
  `satellite-webhook-crypto.ts`, `satellite-webhook-delivery.ts`),
  `apps/api/src/modules/domain-events/domain-event-consumer.service.ts`
  (nuevo consumer `satellite-webhooks.v1`), `apps/api/src/modules/
  semse-agents/marketplace.agent.ts`, `apps/api/src/modules/jobs/
  jobs.service.ts`, `apps/api/src/modules/milestones/milestones.service.ts`
  (los 3 últimos: solo agregar el insert de outbox best-effort, sin
  tocar su lógica existente).
- **Contratos Zod nuevos:** eventos `job.matched.v1`, `job.completed.v1`,
  `rating.requested.v1`, `milestone.approved.v1`, `milestone.rejected.v1`
  en `packages/schemas/src/domain-events-v2.schema.ts`, mismo patrón que
  los 6 de `jobs-bids-event-projection`.
- **Paquete compartido para SSRF:** `packages/shared` (no
  `packages/auth`) — ya es dependencia directa de `apps/api`,
  `packages/autonomy` y `apps/worker` (confirmado en los 3
  `package.json`), evita cualquier ciclo. Nuevo archivo
  `packages/shared/src/safe-url.ts` con la lógica endurecida
  (`{ all: true }` para cubrir A **y** AAAA, exporta también la IP
  resuelta para pinning). `packages/autonomy`'s `SecureNetworkGateway`
  se deja intacto (fuera de alcance de este spec tocar el browser
  agent) — no se migra su único call site en este cambio.
- **Mapa evento↔scope requerido** (nuevo, no existía ninguna tabla así
  hoy):

  ```ts
  const SATELLITE_WEBHOOK_EVENT_SCOPES: Record<string, SatelliteScope> = {
    "job.matched": "jobs:read",
    "job.completed": "jobs:read",
    "rating.requested": "jobs:read",
    "milestone.approved": "milestones:read",
    "milestone.rejected": "milestones:read",
  };
  ```

  Registrar CUALQUIER webhook exige además el scope `events:subscribe`
  (gate general) — cierra el gap que el spec §1 señala ("scope ya
  reservado... que ningún código consume todavía").
- **Traducción nombre-bare ↔ outbox `.v1`:** la API pública de
  registro/consulta usa los nombres bare del catálogo (`job.matched`,
  igual que en el spec §5 YAML); internamente el outbox usa
  `job.matched.v1`, etc. Una función pura de traducción vive junto al
  mapa de arriba — no se expone la distinción al satélite.
- **Dispatcher de entrega:** no es un servicio nuevo con su propio loop —
  es un handler más en el registro genérico de
  `DomainEventConsumerService` (mismo mecanismo que
  `evidence-readiness.v1`/`project-lifecycle-projection.v1`/
  `jobs-bids-projection.v1`). El retry/backoff/5-intentos/dead-letter ya
  construido en `domain-event-consumer.service.ts` para CUALQUIER
  consumer se reutiliza tal cual para reintentar la entrega HTTP —no se
  construye un scheduler de reintentos nuevo. Un evento puede tener 0..N
  webhooks suscritos; el consumer intenta la entrega a **todos** los
  webhooks `ACTIVE` que matcheen en cada invocación (incluida cada
  reintento del propio evento) — si CUALQUIERA falla, el consumer lanza
  (marca el intento como fallido a nivel evento, dispara el reintento
  estándar), lo que puede reenviar a un webhook que ya tuvo éxito en un
  intento previo — aceptado explícitamente por el spec (§4 P2, caso
  borde: "el satélite recibe la misma idempotencyKey, la deduplicación
  es su responsabilidad"). El contador de fallos consecutivos que
  suspende un webhook (5) vive en la fila `SatelliteWebhook` misma, no en
  `DomainEventConsumption` — son conceptos distintos (uno es por-evento,
  el otro por-webhook).
- **ADR requerido:** no — aplica outbox/HMAC/cifrado ya `ACCEPTED`/en
  producción; SSRF-hardening es endurecimiento de un guard ya existente.

## 4. Datos y migración

- Modelo nuevo `SatelliteWebhook` — shape del spec §7, con el ajuste de
  nombres de campo que el propio spec deja abierto a `plan`:
  `secretCiphertext`/`secretIv`/`secretTag` (cifrado AES-256-GCM) +
  `secretKeyVersion` (nuevo, no estaba en el borrador del spec — permite
  rotar `SATELLITE_WEBHOOK_SECRET_KEY` sin invalidar secrets ya
  cifrados; sin esto, rotar la clave maestra rompería todos los webhooks
  existentes de un día para otro). Se elimina el campo `secretHash` del
  borrador del spec — es redundante con `secretCiphertext` y el
  comentario del propio spec ("no es un hash de comparación, es una
  referencia a la clave cifrada") admite que su nombre es confuso; no
  cumple ninguna función que `secretCiphertext` no cumpla ya.
- Migración: `CREATE TABLE` aditiva, mismo patrón que
  `JobsBidsProjection`/`ProjectLifecycleProjection` — escrita a mano en
  esta sesión (sin Postgres disponible, mismo disclaimer que la spec
  anterior).
- Sin cambios a `Job`/`Bid`/`Milestone`/`SatelliteToken` existentes.

## 5. Seguridad y política

- **SSRF:** validación en registro y en cada intento de entrega (spec
  §8), con IP pinning real — el cliente de entrega conecta contra la IP
  ya validada, no vuelve a resolver DNS entre el chequeo y el connect
  (usa `net.connect`/opciones `family`+`lookup` fijadas del cliente HTTP
  de Node, no delega la resolución al propio `fetch`/`http.request` con
  el hostname crudo).
- **Redirects:** el cliente de entrega no sigue redirects — un 3xx es un
  fallo de entrega.
- **Secreto en reposo:** AES-256-GCM, clave maestra en
  `SATELLITE_WEBHOOK_SECRET_KEY` (32 bytes hex), nunca en el repo.
- **Firma:** HMAC-SHA256 sobre el body exacto, `timingSafeEqual` en la
  verificación del lado SEMSE (no aplica — SEMSE firma, no verifica en
  este spec; queda documentado para el SDK del lado satélite, fuera de
  este monorepo).
- **Revocación en cascada:** `SatellitesService.revokeToken()` gana un
  paso adicional: suspender (`status: SUSPENDED`) todos los
  `SatelliteWebhook` de ese token, en la misma operación (no por timeout
  de fallos) — cumple el caso borde de spec §4 P2.

## 6. Eventos, idempotencia y reconstrucción

- **Productores nuevos (best-effort, ver hallazgo 1.1):**
  `marketplace.agent.ts` (`job.matched.v1`), `jobs.service.ts`
  (`job.completed.v1`, `rating.requested.v1` — junto a las notificaciones
  ya existentes en `systemCompleteJob`), `milestones.service.ts`
  (`milestone.approved.v1`, `milestone.rejected.v1` — junto a
  `domainEventBus.emit(buildMilestone*Event(...))` ya existente,
  reusando el mismo payload shape que esas funciones ya construyen).
- **Idempotency key:** `"${eventType}:${primaryEntityId ?? "none"}:${eventId}"`
  — ancla al propio `eventId` (UUID fresco generado en cada emisión) en
  vez de un valor de negocio, porque estos 5 call sites no están dentro
  de un loop de reintento que pudiera re-emitir la misma llamada — no
  hay riesgo de colisión real que evitar, y anclar a un valor de negocio
  (p. ej. sólo `milestoneId`) bloquearía una segunda emisión legítima
  (re-rechazo tras nuevo envío) igual que el bug que se evitó con
  `bid.created.v1` en la spec anterior.
- **Consumer `satellite-webhooks.v1`:** registrado para los 5 `eventType`
  nuevos en `DomainEventConsumerService`'s `buildHandlerRegistry()` —
  mismo patrón exacto que los 5 tipos de `jobs-bids-projection.v1`.
  Busca `SatelliteWebhook` `ACTIVE` cuyo `events[]` incluya el nombre
  bare correspondiente, entrega a cada uno, actualiza
  `consecutiveFailures`/`lastDeliveryAt` por webhook, suspende al llegar
  a 5 consecutivos.
- **Replay:** `POST /v1/domain-events/:eventId/replay` (F1-E, ya
  existente) funciona igual para estos 5 tipos, sin cambio de contrato.
- **DLQ:** mismo mecanismo global — evento en `DEAD_LETTER` es señal de
  rollback documentada en el runbook (a crear en Fase F).

## 7. Estrategia de implementación

### Fase A — Prerrequisito: outbox durable para los 5 eventos + catálogo

- Tests rojos: cada uno de los 5 call sites escribe su outbox event con
  el payload correcto, sin romper el flujo existente
  (`notifications.handleEvent()`/`domainEventBus.emit()` siguen
  llamándose igual).
- 5 schemas Zod nuevos en `domain-events-v2.schema.ts`.
- Implementación en los 3 archivos de servicio.
- `EVENT_CATALOG.md`: nueva sección documentando los 5 nombres bare +
  sus `.v1`, cerrando el gap de documentación que el spec §6 señala.

### Fase B — SSRF hardening compartido + criptografía

- `packages/shared/src/safe-url.ts`: `resolveSafeUrl(url)` — valida
  esquema/host/todas las IPs resueltas (A y AAAA), devuelve la IP a
  pinnear o `null`.
- `apps/api/src/modules/satellites/satellite-webhook-crypto.ts`:
  `encryptSecret`/`decryptSecret` (AES-256-GCM, adaptado de
  `session-manager.ts`), `signWebhookPayload`/idempotency helpers,
  `generateWebhookSecret()`.

### Fase C — Modelo, migración, CRUD

- `SatelliteWebhook` en `schema.prisma` + migración escrita a mano.
- `satellite-webhooks.service.ts` + `.controller.ts`:
  `POST/GET/DELETE /v1/satellites/webhooks`, kill switch 503,
  validación SSRF en registro, scope↔evento, duplicado 409, `AuditLog`.
- `SatellitesService.revokeToken()`: cascada de suspensión.

### Fase D — Consumer de entrega

- `satellite-webhook-delivery.ts`: cliente HTTP con IP pinning, sin
  seguir redirects, timeout 10s.
- Handler `satellite-webhooks.v1` en `domain-event-consumer.service.ts`.
- Kill switch `SATELLITE_WEBHOOKS_ENABLED` — off ⇒ 503 en registro,
  consumer no entrega (evento queda disponible para reintento cuando se
  reactive, no se pierde — mismo criterio que otros kill switches del
  repo).

### Fase E — Verificación local

- `pnpm --filter @semse/schemas build`, `pnpm --filter @semse/shared
  build`, `pnpm --filter @semse/api build`.
- `node ./scripts/run-tests.mjs` — regresión completa.
- `pnpm spec:validate:strict`, `pnpm spec:index`.

### Fase F — Producción

- Migración real contra Postgres (bloqueado en esta sesión, sin DB).
- Canary: webhook real hacia un receptor de prueba en Railway.
- Runbook nuevo `docs/runbooks/SAT-007-outbound-webhooks-canary.md`
  (DRAFT hasta smoke real).

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| SSRF bypass vía DNS rebinding entre validación y entrega | media (vector conocido) | crítico | IP pinning real en el cliente de entrega — nunca se re-resuelve DNS entre el chequeo y el connect; validado en cada intento, no solo al registrar | Test de rebinding simulado fallando, o tráfico saliente hacia rango privado detectado en logs |
| Best-effort outbox en los 5 productores nuevos pierde un evento si el proceso muere justo después de la escritura de dominio y antes del insert de outbox | baja | medio (mismo riesgo que ya existe hoy con `notifications.handleEvent()`, no una regresión) | Documentado explícitamente como no-regresión (hallazgo 1.1); no se resuelve con `$transaction` porque no hay una escritura de dominio en ese instante con la que emparejar | Gap de entrega reportado por un satélite real vs. lo que muestra `GET /v1/domain-events/outbox` |
| Secret cifrado sin versión de clave — rotar `SATELLITE_WEBHOOK_SECRET_KEY` invalida todos los webhooks | alta si no se corrige | medio | `secretKeyVersion` agregado al modelo (ver §4), aunque esta fase solo soporta una clave activa — rotación real queda para un spec de mantenimiento futuro, documentado como deuda conocida, no oculta | Ninguna — es prevención, no detección |
| Confundir la suspensión por-webhook (5 fallos) con el retry por-evento de `DomainEventConsumption` | media | bajo | Documentado explícitamente en §3/§6 de este plan como dos mecanismos distintos; test dedicado que verifica que un webhook que falla 5 veces se suspende aunque otros webhooks del mismo evento sigan `ACTIVE` | Un test que espere que todo el evento se marque `DEAD_LETTER` cuando solo un webhook está fallando fallaría primero |

## 9. Investigación externa

No aplica — diseño derivado íntegramente de patrones ya verificados en
este repo (spec §11).

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§7).
- [x] Migración y rollback definidos (§4, spec §7).
- [x] Tests ordenados antes del código (Fase A/B/C/D, cada una con sus
      propios tests antes de la implementación).
- [x] Canary/feature flag definidos — `SATELLITE_WEBHOOKS_ENABLED`.
- [x] Evidencia requerida para cada estado de entrega definida.
- [x] Scope cabe en cambios reversibles — cada Fase (A-D) es su propio
      commit revertible independientemente; ninguna toca lógica de
      escrow/pagos.
