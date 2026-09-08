---
type: tasks
feature: "Sesiones en vivo (LiveSession)"
domain: "prometeo"
plan: "docs/specs/prometeo/live-sessions.plan.md"
version: "1.0"
status: "PENDING"
branch: "feat/prometeo-live-sessions"
date: "2026-09-07"
---

# Tareas: Sesiones en vivo (LiveSession)

> Prerrequisito: plan `APPROVED` y análisis spec↔plan↔constitución sin gaps.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.
>
> **Rama propia** `feat/prometeo-live-sessions` desde `origin/main`. **No** va
> en la consolidación móvil (PR #598). Ningún cambio de API/DB hasta que Fase 0
> cierre. Migración a producción **sólo** en Fase 6.
>
> **Split de PR** (plan §10): si el PR único no es reversible con comodidad,
> partir en **PR-1** (Fase 1-2: modelo + schemas + servicio + FSM + tests, sin
> LiveKit ni móvil) y **PR-2** (Fase 3+: LiveKit + webhook + móvil + canary).

## Fase 0 — SDD y verdad

- [x] [T-001] Spec `APPROVED` e indexado — firmado 2026-09-07; en `SPEC_INDEX.md`.
      #599 (spec+plan+tasks) mergeado a `main` como `831dc472` (2026-09-08 03:45 UTC);
      Fase 0 (analyze/checklist/ADR-026) + T-014 no entraron en ese squash y se
      recuperaron por cherry-pick a esta rama.
- [x] [T-002] Rama `feat/prometeo-live-sessions` creada desde `origin/main`
      `831dc472` (2026-09-08 04:34 UTC). Sin migración de LiveSession aplicada
      en ningún entorno. Flags `SEMSE_LIVE_SESSIONS_ENABLED` /
      `_CANARY_TENANT_IDS`: no existen todavía. `SseEventBusService` confirmado
      en `main` (ver T-014).
- [x] [T-003] `analyze` y `checklist` escritos —
      `docs/specs/prometeo/live-sessions.analyze.md` (consistencia
      spec↔plan↔tasks↔constitución: alineados; gaps de secuencia + dependencia
      humana, todos rastreados) y `docs/specs/prometeo/live-sessions.checklist.md`.
- [x] [T-004] `docs/architecture/ADR-026-livekit-media-transport.md` escrito,
      `PROPOSED` — 4 opciones evaluadas (LiveKit / P2P WebRTC / proveedor
      llave-en-mano / no-media), decisión LiveKit reusando la impl. de
      referencia, reversibilidad vía flag. Pendiente pre-`APPROVED` del ADR:
      decisión cloud-vs-self-host y revisión de seguridad del webhook.

## Fase 1 — Tests y contratos

- [~] [T-010] **Parte testeable ahora hecha:** `tests/unit/live-session-schema.test.ts`
      — FSM (`canTransitionLiveSession` para las 81 combinaciones estado×estado
      contra STATE_MACHINES.md; `liveSessionTransitionTarget` para cada
      acción×estado, legales e ilegales; toda acción-target es arista válida),
      estados terminales sin salida, estados de media-token, y parse/reject de
      todos los schemas y del `liveSessionEventSchema` (version literal 1,
      aggregateType literal). **Pendiente Fase B/C:** los casos de
      comportamiento del servicio/endpoints (aislamiento 404, media-token
      gate, version-conflict, barrido, webhooks) están declarados como
      `test.todo` en `tests/unit/live-session-behavior.todo.test.ts` — 29
      casos que Fase B/C convierte en tests reales en `apps/api/test/`.
- [x] [T-011] `packages/schemas/src/live-session.schema.ts` — enums
      (`status`/`scopeType`/`purpose`/`participantRole`/`transitionAction`),
      inputs (`create`/`transition`/`participantReady`/`inviteObserver`),
      vistas (`RecordView`/`ParticipantView`/`MediaTokenView`), `event`
      (`liveSessionEventSchema` + types), y los helpers de FSM
      (`canTransitionLiveSession`, `liveSessionTransitionTarget`,
      `isLiveSessionTerminal`, `LIVE_SESSION_TERMINAL_STATUSES`,
      `LIVE_SESSION_MEDIA_STATUSES`). Exportado en `packages/schemas/src/index.ts`.
      **Sin** `mediaClass` ni `observationMission`.
- [~] [T-012] Fixtures de idempotencia/concurrencia — los casos están en
      `live-session-behavior.todo.test.ts`; los fixtures concretos se crean con
      el servicio en Fase B (necesitan un repo/Prisma mock).
- [~] [T-013] Cada gap de spec §13 tiene su `test.todo` correspondiente en
      `live-session-behavior.todo.test.ts` (§13.1 ownership, §13.3 media-token,
      §13.2 drivers de FSM, §13.4 expiración). Se "confirman rojos" cuando el
      servicio exista y los todos se activen.
- [~] [T-014] **Catálogo/FSM hechos (2026-09-07):** eventos
      `live_session.requested.v1` / `status_changed.v1` en
      `docs/foundation/EVENT_CATALOG.md` (§Prometeo — Live Sessions,
      "productor pendiente", entrega best-effort al bus SSE in-process, no
      outbox); FSM completa en `docs/foundation/STATE_MACHINES.md`
      (§LiveSession, 9 estados / 13 transiciones / autorización por arista).
      **Verificado:** `SseEventBusService` existe en `main`
      (`apps/api/src/infrastructure/sse/`) con el API que usa la referencia —
      in-process only, aceptable para 1:1 por pod (ver `analyze.md` gap 2).
      Falta: el `liveSessionEventSchema` en `packages/schemas` (parte de T-011).

## Fase 2 — Datos y dominio

- [x] [T-020] `schema.prisma`: 4 enums + `LiveSession` + `LiveSessionParticipant`
      + índices (incl. `[status, expiresAt]` para el barrido) + los dos
      `@@unique` + inversas en `Tenant`/`User`. Migración **escrita a mano**
      `packages/db/prisma/migrations/20260908050000_add_live_sessions/migration.sql`
      (sólo `CREATE TYPE`/`CREATE TABLE`/`CREATE INDEX`/`ADD CONSTRAINT`).
- [~] [T-021] `prisma generate` valida el schema OK y genera el cliente con
      los 2 modelos. **Pendiente:** `prisma migrate dev`/`migrate diff` contra
      Postgres real + `information_schema` + test de `DROP` — esta máquina no
      tiene Docker/Postgres local.
- [x] [T-022] `live-sessions.repository.ts` — interfaz `LiveSessionsRepository`
      (puerto, para tests con doble en memoria) + `PrismaLiveSessionsRepository`:
      `create` (siembra `owner` en `$transaction`), `findByIdempotency`,
      `findById`/`findParticipant`/`listParticipants`, `addParticipant`,
      `transition` **atómico** (`updateMany where {id, version}`; 0 filas → 409),
      `listExpired`.
- [ ] [T-023] `LiveSessionsService`: guard de participante en los 4 endpoints de
      lectura/transición; `create` valida acceso al `scopeId` vía
      `JobsService`/`ProjectsService`; FSM vía `canTransitionLiveSession` +
      `transitionTarget`; `AuditService.append` en create y cada transición
      (`beforeJson`/`afterJson`, `reason`); publicación best-effort de eventos
      al bus SSE (sin outbox — plan §6). Invariante: no escribe FSM de
      Job/Project/Milestone/Payment/Dispute. Autorización de recurso en
      `live-sessions.resource-access.ts` (puerto + impl. Prisma: tenant +
      `job.clientOrgId==orgId` / `freeProject.createdBy==userId` / `OPS_ADMIN`;
      el resto se agrega explícito por el owner vía `POST .../:id/participants`).
- [x] [T-024] `apps/api/test/live-sessions.service.test.ts` — **20/20 verdes**
      con dobles en memoria; `tsc --noEmit` del API limpio.

## Fase 3 — API/BFF/UI

- [x] [T-030] `live-sessions.controller.ts` — 9 rutas (create, get,
      participants list/add, media-token, transition, participant-ready,
      sweep-expired, SSE events). Todas `@RequirePermissions(live_sessions:*)`.
      `live_sessions:read`/`:write` agregados al RBAC de
      CLIENT/PRO/WORKER/OPS_ADMIN. `LiveSessionsModule` en `app.module.ts`.
- [x] [T-031] `livekit.service.ts` — `createParticipantToken` firma un JWT
      HS256 a mano (sin `livekit-server-sdk`), grant `video` acotado al room,
      TTL clamp 60s..6h. Sin `LIVEKIT_*` → `ServiceUnavailableException`.
      Token nunca logueado/persistido. `verifyWebhook` (HMAC + sha256 body + exp).
- [x] [T-032] `livekit-webhook.controller.ts` — `POST .../webhooks/livekit`
      `@Public()`, verifica firma → `room_started`/`participant_joined` →
      ACTIVE, `room_finished` → ENDED. Firma inválida → 401.
      `driveFromWebhook` valida la arista contra la FSM. `participant-ready`
      v1: dispara `PERMISSION_PENDING→CONNECTING` con el primer participante
      listo (refinamiento "todos" = TODO documentado).
- [x] [T-033] Worker: `sweepExpiredLiveSessions()` en `apps/worker/src/main.mjs`
      llama `POST .../sweep-expired` cada 60s, gateado por
      `LIVE_SESSION_SWEEP_ENABLED=true` (default off). TTL 2h en `create`.
- [x] [T-034] Móvil: `src/api/liveSessions.ts` (create/get/participants/
      transition/participant-ready/media-token) + `src/screens/LiveSessionScreen.tsx`
      registrada en `WorkerMoreStackNavigator` como `LiveSession { sessionId }`.
      Estados loading/error/forbidden(404 → "esta sesión no está disponible")/
      terminal. Botones por estado y rol (accept sólo la contraparte; cancel
      sólo el owner). "Unirse al video" chequea `Constants.appOwnership === 'expo'`
      → Expo Go muestra degradado y NO importa ningún módulo nativo; fuera de
      Expo Go pide el `media-token` (el backend valida estado/expiración/
      participante) y muestra un placeholder — el componente `<LiveKitRoom>`
      real necesita `@livekit/react-native` + dev build (TODO). SSE: v1 usa
      polling de `GET .../:id` cada 4s (react-native-sse = follow-up); el poll
      se detiene al llegar a estado terminal. **Punto de entrada** (botón en
      job detail / deep-link de push) = follow-up chico.
- [x] [T-035] `docs/architecture/SEMSE_API_SURFACE_V1.md` → sección
      "Prometeo › Live Sessions" con las 9 rutas + webhook. `apps/mobile/README.md`
      actualizado con la pantalla y el límite Expo Go.
- [x] [T-036] Contrato API verde (20/20 + `tsc`). Móvil: `tsc --noEmit`
      limpio. Suite jest: 210/213 — los 3 rojos son suites preexistentes
      flaky (`JobDetailScreen`/`TimerScreen`) que pasan aisladas (5-6s) y
      revientan el timeout bajo carga full-suite en esta máquina; ninguna
      toca LiveSession. Tests de UI dedicados de `LiveSessionScreen` =
      follow-up.

## Fase 4 — Verificación local

- [ ] [T-040] `pnpm --filter @semse/api test` dirigido (FSM, ownership 404,
      idempotencia, versión, media-token, barrido).
- [ ] [T-041] `pnpm --filter @semse/mobile test` + `check`; regresión API/web
      (`build` + `tsc`), proporcional al riesgo.
- [ ] [T-042] `pnpm --filter @semse/mobile` `expo export --platform android --platform ios`.
- [ ] [T-043] `pnpm spec:validate:strict`.
- [ ] [T-044] `pnpm spec:coverage` y `pnpm spec:index`.
- [ ] [T-045] Spec a `code_status: COMPLETE`, `status: IMPLEMENTED`.

## Fase 5 — PR, CI y merge

- [ ] [T-050] Revisar diff completo y secretos antes de `git add` (sin
      `LIVEKIT_*` ni tokens en el árbol).
- [ ] [T-051] Abrir PR (o PR-1/PR-2 según el split) con la migración, su
      rollback y la evidencia de Fase 4.
- [ ] [T-052] Esperar CI terminal y registrar `ci_status` (o "verificación
      local" si el pipeline del repo sigue caído — matriz §9).
- [ ] [T-053] Resolver review sin ampliar scope (nada de grabación/retención,
      ObservationMission, screen share, >2 participantes, cliente web).
- [ ] [T-054] Fusionar y registrar SHA; `merge_status: MERGED`.

## Fase 6 — Deploy y activación

- [ ] [T-060] **Acción humana:** configurar `LIVEKIT_URL`/`LIVEKIT_API_KEY`/
      `LIVEKIT_API_SECRET` en Railway. Luego `scripts/pre-migrate.mjs` +
      `prisma migrate deploy`; `information_schema` confirma las 2 tablas/4 enums.
- [ ] [T-061] Esperar deployment terminal de API + Worker.
- [ ] [T-062] Health/readiness del módulo (env presente, firma de token OK) y logs.
- [ ] [T-063] `SEMSE_LIVE_SESSIONS_ENABLED=false` + `_CANARY_TENANT_IDS=<tenant interno>`.
- [ ] [T-064] Canary autenticado en **device nativo iOS + Android**: P1
      (inspection) + P2 (assist), 2 participantes reales, red interrumpida y
      regreso de background. **Prueba negativa:** 3er usuario del tenant sin
      fila de participante → 404 en get/media-token/SSE.
- [ ] [T-065] Métricas/SLO (creadas/activas/falladas, `REQUESTED→ACTIVE`,
      `CONNECTING→FAILED`, `version conflict`) y señal de rollback (fuga
      cross-recurso, token a no-participante, crash en el journey).
- [ ] [T-066] Ampliar `_CANARY_TENANT_IDS` o pausar/revertir; flag `false` como
      rollback inmediato.
- [ ] [T-067] `production_evidence`, `last_verified`, `status: VERIFIED`;
      actualizar `ROADMAP.md` (F7) e `IMPLEMENTATION_STATUS_MATRIX.md`.

## Criterio de Done

- [ ] Código completo y tests verdes (incl. aislamiento 404 y media-token gate).
- [ ] CI `PASS` (o verificación local documentada como tal).
- [ ] Merge `MERGED`.
- [ ] Deploy `DEPLOYED` con `LIVEKIT_*` configurado por un humano.
- [ ] Activación `CANARY` en ≥1 tenant, con prueba negativa de aislamiento.
- [ ] Migración `VERIFIED` (2 tablas / 4 enums / índices).
- [ ] Evidencia de producción enlazada (grabación del canary + prueba negativa).
- [ ] `SPEC_INDEX.md` / `IMPLEMENTATION_STATUS_MATRIX.md` / `ROADMAP.md` (F7)
      actualizados.
- [ ] `EVENT_CATALOG.md` y `STATE_MACHINES.md` incluyen LiveSession.
