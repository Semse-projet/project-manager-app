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
- [ ] [T-002] Registrar SHA de `origin/main` al ramificar, migraciones y flags
      actuales en el plan §1.
- [ ] [T-003] Completar `analyze` (spec↔plan↔constitución) y `checklist`.
- [ ] [T-004] `ADR-026-livekit-media-transport.md` escrito y en `REVIEW`.

## Fase 1 — Tests y contratos

- [ ] [T-010] Tests rojos: FSM (`canTransitionLiveSession` + `transitionTarget`,
      todas las combinaciones acción×estado, incluidas las ilegales); contrato
      de los 5 endpoints + SSE; **aislamiento**: no-participante y otro-tenant →
      **404** en get/media-token/transition/SSE; `media-token` fuera de
      `{CONNECTING,ACTIVE,PAUSED}` o vencido → 409; barrido de `expiresAt`.
- [ ] [T-011] [P] `packages/schemas/src/live-session.schema.ts` — `create`,
      `transition`, `status`, `participantRole`, `event`, `LiveSessionRecordView`,
      `LiveSessionParticipantView`. **Sin** `mediaClass` ni `observationMission`.
- [ ] [T-012] [P] Fixtures de idempotencia (`idempotencyKey` mismo/otro payload)
      y de concurrencia (dos `transition` con el mismo `expectedVersion`).
- [ ] [T-013] Confirmar que el fallo inicial demuestra cada gap de spec §13
      (en especial §13.1 ownership y §13.3 media-token).
- [ ] [T-014] Eventos `live_session.requested.v1` / `status_changed.v1` en
      `docs/foundation/EVENT_CATALOG.md`; FSM en `docs/foundation/STATE_MACHINES.md`.

## Fase 2 — Datos y dominio

- [ ] [T-020] Migración `prisma migrate dev --name add_live_sessions` — 4 enums
      (`LiveSessionStatus`, `LiveSessionScopeType`, `LiveSessionPurpose`,
      `LiveSessionParticipantRole`) + `live_session` + `live_session_participant`
      + índices + `@@unique([tenantId, idempotencyKey])` y
      `@@unique([sessionId, userId])`. Sólo `CREATE`. Guardar el SQL sin editar.
- [ ] [T-021] Verificar en local: `information_schema` muestra 2 tablas / 4
      enums / índices; test de `DROP` limpio (rollback). **No** `db push`, **no**
      aplicar a prod.
- [ ] [T-022] `LiveSessionsRepository` (Prisma): `create` (siembra `owner` +
      contraparte del recurso como participantes), `findById` (join con
      participante activo del actor — sin fila → devuelve `undefined` → 404),
      `findByIdempotency`, `transition` **atómico**
      (`updateMany where { id, version: expectedVersion }`; 0 filas → 409),
      `addObserver`.
- [ ] [T-023] `LiveSessionsService`: guard de participante en los 4 endpoints de
      lectura/transición; `create` valida acceso al `scopeId` vía
      `JobsService`/`ProjectsService`; FSM vía `canTransitionLiveSession` +
      `transitionTarget`; `AuditService.append` en create y cada transición
      (`beforeJson`/`afterJson`, `reason`); publicación best-effort de eventos
      al bus SSE (sin outbox — plan §6). Invariante: no escribe FSM de
      Job/Project/Milestone/Payment/Dispute.
- [ ] [T-024] Pasar unitarios de dominio y persistencia (T-010/T-012 en verde).

## Fase 3 — API/BFF/UI

- [ ] [T-030] `LiveSessionsController` — `POST /v1/prometeo/live-sessions`,
      `GET .../:id`, `GET .../:id/media-token`, `POST .../:id/transition`,
      `SSE GET .../:id/events`, `POST .../:id/participant-ready`. Todos con
      `@RequirePermissions(live_sessions:read|write)`. Permisos nuevos en el
      seed RBAC para `CLIENT`/`PRO`/`WORKER`/`OPS_ADMIN` (spec §3).
- [ ] [T-031] `LiveKitService.createParticipantToken` — TTL ≤ vida de sesión,
      grants acotados al room de la sesión; token **nunca** en logs ni audit.
      Testeable con claves de sandbox (no requiere LiveKit real).
- [ ] [T-032] `LiveKitWebhookController` — `room_started`/`room_finished`/error
      con verificación de firma → transiciones `CONNECTING→ACTIVE`,
      `ENDING→ENDED`, `CONNECTING→FAILED`. `participant-ready` → driver
      `PERMISSION_PENDING→CONNECTING` cuando todos los participantes activos
      reportaron permisos.
- [ ] [T-033] Worker: job de barrido de `expiresAt` → `CANCELLED`/`FAILED`
      según estado; TTL por defecto en `create`.
- [ ] [T-034] Móvil: `src/api/liveSessions.ts` + pantalla de sesión en el stack
      del job/project. Estados `loading/empty/ready/forbidden(404)/degraded/error`.
      `degraded` = Expo Go o permisos denegados; **import perezoso** del módulo
      nativo de LiveKit tras chequear plataforma/`appOwnership` — no se importa
      en Expo Go. Consentimiento de cámara/mic antes de `participant-ready`.
- [ ] [T-035] Actualizar `docs/architecture/SEMSE_API_SURFACE_V1.md` con los 6
      endpoints; `apps/mobile/README.md` con la pantalla nueva y el límite Expo Go.
- [ ] [T-036] Pasar contrato API + tests de UI móvil.

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
