---
type: plan
feature: "Sesiones en vivo (LiveSession)"
domain: "prometeo"
spec: "docs/specs/prometeo/live-sessions.spec.md"
version: "1.0"
status: "APPROVED"
branch: "feat/prometeo-live-sessions"
date: "2026-09-07"
---

# Plan técnico: Sesiones en vivo (LiveSession)

> Prerrequisito: spec `APPROVED` (firmado 2026-09-07 con las 4 decisiones de
> producto). El plan separa implementación, merge, despliegue y activación;
> ningún estado se infiere de otro. **No es alcance de la consolidación móvil
> PR #598** — este feature va en su propia rama `feat/prometeo-live-sessions`
> desde `origin/main`.

## 1. Snapshot de verdad

- `origin/main` SHA: `389aa748` (al 2026-09-07; verificar antes de ramificar).
- SHA desplegado API/Web: no confirmado (Railway MCP intermitente; healthcheck
  200 ≠ activación).
- Estado de migraciones: `main` al día; sin migración LiveSession aplicada en
  ningún entorno.
- Flags/allowlists: ninguno para este feature todavía.
- Drift/deuda previa: existe una implementación de referencia **fuera de Git**
  en `C:\Users\SEMSEproject\project-manager-app-main\...\apps/api/src/modules/
  live-sessions/*` + `packages/schemas/src/prometeo-live.schema.ts` + modelo
  Prisma. Se usa como diseño de partida; **no se copia sin corregir los 8
  huecos de spec §13**. CI real del repo no corre desde 2026-08-19
  (`IMPLEMENTATION_STATUS_MATRIX.md` §9) — los "PASS" serán verificación local.

## 2. Constitution check

- [x] Spec aprobado antes de código (2026-09-07).
- [x] Tenant/org/ownership y RBAC definidos — tenant + `LiveSessionParticipant`
  activa; permisos `live_sessions:read`/`:write`; recurso sin acceso → 404.
- [x] Evidence/Payment Governance revisados — **N/A**: `paymentGovernance` no
  aplica; no se graba ni retiene media en este corte (Evidence no interviene).
- [x] Audit/events definidos — `live_session.requested` / `live_session.<action>`
  en `AuditLog`; eventos `live_session.requested.v1` / `status_changed.v1` a
  catalogar en `EVENT_CATALOG.md`.
- [x] Tests preceden implementación — Fase A.
- [x] No se expone secreto ni backend paralelo — LiveKit es transporte de media
  (SFU), `apps/api` sigue siendo el único backend de dominio; tokens efímeros,
  no logueados.
- [x] Código, CI, merge, deploy y activación se miden por separado (Fases D-F).

## 3. Arquitectura y autoridad

- **Fuente de verdad de escritura:** tabla `live_session` (estado + `version`
  para concurrencia optimista) y `live_session_participant` (membresía).
- **Read models/proyecciones:** ninguna. El SSE se reconstruye con `snapshot`
  al conectar.
- **Módulos afectados:**
  - `apps/api/src/modules/live-sessions/` — nuevo módulo NestJS
    (`module`, `controller`, `service`, `repository`).
  - `apps/api/src/modules/live-sessions/livekit.service.ts` — firmado de token
    de participante (`livekit-server-sdk`).
  - `apps/api/src/modules/live-sessions/livekit-webhook.controller.ts` — recibe
    `room_started` / `room_finished` / error y dispara transiciones de FSM.
  - `apps/api/src/common/permissions` + seed RBAC — permisos nuevos.
  - `apps/worker` — job de barrido de `expiresAt` → terminal.
  - `packages/db/prisma/schema.prisma` — 2 modelos + 4 enums.
  - `packages/schemas/src/live-session.schema.ts` — nuevo, reimplementado
    desde `prometeo-live.schema.ts` **sin** `mediaClass` ni `observationMission`.
  - `apps/mobile/src/api/liveSessions.ts` + `apps/mobile/src/screens/live/*` —
    pantalla de sesión (development build, no Expo Go).
- **Contratos Zod:** `liveSessionCreateSchema`, `liveSessionTransitionSchema`,
  `liveSessionStatusSchema`, `liveSessionParticipantRoleSchema`,
  `liveSessionEventSchema`, `LiveSessionRecordView`,
  `LiveSessionParticipantView`.
- **API/BFF/UI:** 5 endpoints REST + SSE (spec §5); sin BFF (móvil habla
  directo a `/v1`); UI sólo móvil.
- **Worker/queues:** barrido de expiración (BullMQ o cron interno).
- **Agentes/tools:** Prometeo sólo **observa** los eventos en este corte;
  tools que actúan sobre la sesión = child spec vía Tool Registry F2.
- **ADR requerido:** sí — `docs/architecture/ADR-026-livekit-media-transport.md`
  (por qué LiveKit/SFU, alternativas descartadas, límites de retención). Se
  escribe junto con Fase A.

## 4. Datos y migración

- **Cambio Prisma:**
  - Enums: `LiveSessionStatus`, `LiveSessionScopeType`, `LiveSessionPurpose`,
    `LiveSessionParticipantRole` (`owner`|`inspector`|`assistant`|`observer`).
  - `LiveSession` (spec §1) + `LiveSessionParticipant` (spec §7) con sus
    índices y `@@unique`.
- **SQL y checksum:** `prisma migrate dev --name add_live_sessions`; sólo
  `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX`. Guardar el SQL generado sin
  editar.
- **Expand/contract:** sólo expand. Nada lee las tablas hasta activar el flag.
- **Backfill/shadow read:** ninguno.
- **Compatibilidad durante deploy:** total — tablas nuevas, aisladas.
- **Pre-deploy command:** `scripts/pre-migrate.mjs` (ya repara fantasmas) +
  `prisma migrate deploy`. **No** `db push`. **No** aplicar a producción hasta
  que el feature vaya a activarse.
- **Rollback/forward-fix:** `DROP TABLE live_session_participant, live_session;
  DROP TYPE ...` es seguro mientras el flag nunca se activó. Migración de
  reversa aditiva si ya hubiera datos.
- **Prueba de migración:** `migrate dev` en local + `information_schema`
  confirma 2 tablas, 4 enums, índices; test de `DROP` limpio.

## 5. Seguridad y política

- **Permisos:** `live_sessions:read` (get, media-token, SSE),
  `live_sessions:write` (create, transition, invitar `observer`). Añadir al
  seed RBAC para `CLIENT`, `PRO`, `WORKER`, `OPS_ADMIN` según spec §3.
- **Tenant/org/resource scope:** `tenantId` del token + fila activa en
  `LiveSessionParticipant`. `create` valida acceso al `scopeId` vía
  `JobsService`/`ProjectsService`. Recurso/sesión sin acceso → **404** en
  todos los endpoints (cuerpo idéntico a "no existe").
- **Step-up/aprobación:** ninguno.
- **Auditoría:** `AuditService.append` en create y cada transición
  (`beforeJson`/`afterJson`, `reason`); `live_session.media_token_issued`
  **sin** el token en el registro.
- **Riesgos de pagos/evidencia:** N/A — no toca escrow ni Evidence.
- **Abuse cases:**
  - Crear sesiones en masa sobre un recurso → rate-limit por
    `(tenantId, createdById, scopeId)` + `expiresAt` corto + tope de sesiones
    `ACTIVE` concurrentes por recurso.
  - Reusar `idempotencyKey` con otro payload → 409.
  - Pedir `media-token` para una sesión ajena o terminal → 404 / 409.
  - Mantener una sesión "colgada" en `CONNECTING`/`ENDING` → barrido a terminal.
  - `observer` invitado que no debería estar → sólo el `owner` invita, y sólo
    a usuarios con acceso al recurso; queda en `AuditLog`.

## 6. Eventos, idempotencia y reconstrucción

- **Productores:** `LiveSessionsService.create` → `live_session.requested.v1`;
  `LiveSessionsService.transition` → `live_session.status_changed.v1`
  (payload con `previousStatus`, `status`, `sessionVersion`).
- **Outbox atómico:** **no** en este corte — best-effort post-commit al bus SSE
  in-process; el SSE entrega `snapshot` al (re)conectar, así que una pérdida de
  evento no deja al cliente inconsistente. Si más adelante un consumidor
  durable necesita estos eventos (analítica, ObservationMission), se agrega el
  productor al outbox F1 en su propio incremento.
- **Consumers/receipts:** el endpoint SSE (efímero, sin estado). Prometeo como
  consumidor lógico. Cualquier consumidor persistente futuro: idempotente por
  `eventId`.
- **Replay:** N/A — el estado vive en la fila; no hay proyección.
- **DLQ:** el barrido de `expiresAt` es la compensación de sesiones atascadas.
- **Rebuild:** `snapshot` on-connect.
- **Correlation/traces:** `requestId` como `correlationId` en audit y eventos;
  nunca el token LiveKit en logs.
- **Catálogo:** agregar ambos eventos a `docs/foundation/EVENT_CATALOG.md`
  (envelope, productor, consumidores, versión) — tarea de Fase A.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- ADR-026 (LiveKit) escrito.
- `packages/schemas/src/live-session.schema.ts` + tipos exportados.
- Eventos en `EVENT_CATALOG.md`; FSM en `STATE_MACHINES.md`.
- Tests rojos: FSM (`canTransition` + `transitionTarget`, todas las combinaciones),
  contrato de los 5 endpoints, idempotencia, versión-conflict, **aislamiento
  (404) por tenant y por no-participante**, `media-token` gateado por estado,
  barrido de expiración.

### Fase B — Datos y dominio

- Migración aditiva (`add_live_sessions`) verificada en local + `DROP` limpio.
- `LiveSessionsRepository` (Prisma) con `transition` atómico
  (`updateMany` con `where: { id, version: expectedVersion }` → 0 filas = 409).
- `LiveSessionsService`: create (siembra participantes: `owner` + contraparte
  del recurso), transition (guard de participante + FSM + audit + evento),
  get, invite-observer.
- Invariante: nunca escribe FSM de `Job`/`Project`/`Milestone`/`Payment`/`Dispute`.

### Fase C — API/BFF/UI

- `LiveSessionsController` (5 rutas + SSE) con `@RequirePermissions`.
- `LiveKitService.createParticipantToken` (TTL ≤ vida de sesión, grants por
  room de la sesión).
- `LiveKitWebhookController` → transiciones `CONNECTING→ACTIVE`,
  `ENDING→ENDED`, `CONNECTING→FAILED` (verifica firma del webhook).
- Endpoint `POST .../participant-ready` → driver `PERMISSION_PENDING→CONNECTING`
  cuando **todos** los participantes activos reportaron permisos.
- Worker: job de barrido `expiresAt`.
- Móvil: `src/api/liveSessions.ts` + pantalla de sesión con estados
  `loading/empty/ready/forbidden(404)/degraded(Expo Go / permisos)/error`;
  gate explícito de Expo Go (no importa el módulo nativo de LiveKit).

### Fase D — Verificación local/CI

- `pnpm --filter @semse/api test` dirigido (FSM, ownership, idempotencia).
- `pnpm --filter @semse/mobile test` + `check`.
- Regresión API/web (`build` + `tsc`).
- `pnpm spec:validate:strict` + `spec:index`.
- `expo export` móvil.

### Fase E — Integración

- PR desde `feat/prometeo-live-sessions` a `main`, con evidencia de Fase D.
- CI: registrar estado real (o "verificación local" si el pipeline sigue caído).
- Merge SHA registrado; `merge_status`.
- Config pre-deploy: `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` en
  Railway — **acción humana**; el agente no toca env de producción. Migración
  `add_live_sessions` se aplica recién en esta fase.

### Fase F — Producción

- `migrate deploy` + verificación de `information_schema`.
- Health/readiness del módulo (firma de token OK, env presente).
- Flag `SEMSE_LIVE_SESSIONS_ENABLED=false` + `_CANARY_TENANT_IDS=<tenant interno>`.
- Canary: spec §8 — P1 (inspection) + P2 (assist) en **device nativo iOS +
  Android**, 2 participantes reales, con red interrumpida y regreso de
  background; **prueba negativa**: 3er usuario del tenant sin fila de
  participante → 404 en get/media-token/SSE.
- Métricas/SLO: creadas/activas/falladas, `REQUESTED→ACTIVE`, `CONNECTING→FAILED`,
  `version conflict`.
- Activación gradual: ampliar `_CANARY_TENANT_IDS`.
- Rollback: flag `false`; si hace falta, revertir merge; `DROP` de tablas sólo
  si nunca se activó.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Copiar la referencia sin cerrar el guard de ownership | media | alto (fuga cross-recurso) | Fase A: test de aislamiento 404 antes del código; guard de participante en repo, no solo en controller | cualquier `get`/token servido a un no-participante |
| FSM con aristas sin driver deja sesiones colgadas | media | medio | drivers explícitos (webhook + participant-ready + barrido) + tests de timeout | sesiones `CONNECTING`/`ENDING` que no llegan a terminal |
| LiveKit no configurado en Railway | alta | bloquea Fase F | Fases A-E no dependen de LiveKit real (token se testea con claves de sandbox); gate de infra explícito | readiness del módulo falla |
| `media-token` emitido para sesión terminal/ajena | baja | alto | precondición estado ∈ {CONNECTING,ACTIVE,PAUSED} + fila de participante; test dedicado | token emitido fuera de esos estados |
| Expo Go carga el módulo nativo y crashea | media | medio | import perezoso tras chequeo de `Constants.appOwnership`/plataforma; estado `degraded` | crash al abrir la pantalla en Expo Go |
| CI del repo sigue caído → merge sin verificación real | alta | medio | verificación local documentada como tal; no declarar "PASS" de pipeline | — |
| Contenido sensible en el stream (rostros, docs) | media | alto (privacidad) | `privacyCritical`: no se graba ni persiste; token efímero; consentimiento de cámara/mic antes de `CONNECTING` | — |

## 9. Investigación externa

| Búsqueda primaria | Fuente | Decisión |
|---|---|---|
| LiveKit rooms, tokens de participante con grants, webhooks de ciclo de vida | https://docs.livekit.io/ | Firmado server-side; token efímero por participante; webhooks como drivers de FSM. Egress/grabación → fuera de alcance. |
| LiveKit en React Native / Expo | https://docs.livekit.io/home/quickstarts/react-native/ + https://docs.expo.dev/develop/development-builds/introduction/ | SDK nativo no funciona en Expo Go → development build + config plugin; estado `degraded` en Expo Go. |
| Permisos cámara/micrófono Expo SDK 57 | https://docs.expo.dev/versions/v57.0.0/sdk/camera/ | Request de permisos antes de `PERMISSION_PENDING→CONNECTING`; sin permisos → `degraded`. |

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§3).
- [x] Migración y rollback definidos (§4).
- [x] Tests ordenados antes del código (§7 Fase A).
- [x] Canary/feature flag definidos (§7 Fase F, spec §8).
- [x] Evidencia requerida para cada estado de entrega (§7 D-F).
- [~] Scope en un PR reversible — **grande**. Si el PR único queda inmanejable,
  partir en 2: (PR-1) modelo + schemas + servicio + tests + FSM, sin LiveKit
  ni móvil; (PR-2) LiveKit + webhook + móvil + canary. Decidir al escribir
  tasks.
