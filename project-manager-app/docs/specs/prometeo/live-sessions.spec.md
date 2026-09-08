---
id: "prometeo.live-sessions"
title: "Sesiones en vivo (LiveSession) — inspección y asistencia asistidas por Prometeo"
domain: "prometeo"
sdd_version: "2.0"
version: "1.1"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: ["SEMSE_LIVE_SESSIONS_ENABLED", "SEMSE_LIVE_SESSIONS_CANARY_TENANT_IDS"]
production_evidence: []
related_files:
  - packages/db/prisma/schema.prisma
related_tests: []
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-09-07"
---

# Spec: Sesiones en vivo (LiveSession)

> Contrato ejecutable SDD 2.0. **`status: APPROVED`** — el propietario firmó el
> spec en sesión el 2026-09-07 con estas decisiones cerradas:
>
> | Gate | Decisión |
> |---|---|
> | Membresía de participantes | **Tabla `LiveSessionParticipant` explícita** (no derivada del recurso) |
> | Alcance del primer corte | **`inspection` + `assist`** ambos |
> | Recurso sin acceso | **404** (no filtrar la existencia de la sesión/recurso) |
> | LiveKit (cuenta/plan, `LIVEKIT_*` en Railway) | **Acción humana pendiente** — bloquea la fase de implementación de media, no el plan/tasks ni el modelo/FSM |
> | Outbox vs best-effort para `live_session.*` | Se decide en el plan §6 (recomendación: best-effort + snapshot al reconectar) |
>
> Sigue: plan → tasks → analyze → checklist → implement. Código, CI, merge,
> deploy y activación se registran por separado. La migración es aditiva y
> **no se aplica a producción** durante el desarrollo.
>
> **Origen del material.** Existe una implementación de referencia casi
> completa en el árbol sin Git `C:\Users\SEMSEproject\project-manager-app-main`
> (`apps/api/src/modules/live-sessions/*`, `packages/schemas/src/prometeo-live.schema.ts`,
> modelo `LiveSession` + enums en su `schema.prisma`). **No se copia tal cual**:
> este spec la audita, corrige los huecos identificados abajo (§13) y define
> el flujo de recuperación. Ver `docs/consolidation/LIVESESSION_RECOVERY_CONTRACT.md`
> y el programa transversal móvil en `ROADMAP.md`.

## 1. Problema y resultado

**Para quién:** un `CLIENT` que necesita ver el estado real de una obra sin
viajar, y el `PRO`/`WORKER` en sitio que hace el recorrido; Prometeo como
copiloto de la sesión.

**Problema:** hoy la única forma de que un cliente "vea" el avance es la
evidencia asíncrona (fotos/estado de milestones). No hay un canal en vivo
gobernado para una inspección remota ("mostrame la instalación eléctrica
ahora") ni para una asistencia guiada ("¿cómo conecto esto?"). Cualquier
video hoy ocurre fuera de la plataforma, sin tenant boundary, sin registro de
auditoría, sin FSM y sin control de quién entra.

**Resultado esperado:** un participante autorizado abre una `LiveSession`
atada a un `Job` o `FreeProject` propio, con propósito `inspection` o
`assist`. La sesión tiene una máquina de estados explícita
(`REQUESTED → … → ENDED`), sólo la ven/operan los participantes autorizados de
ese recurso dentro del tenant, cada transición deja `AuditLog` y emite un
evento catalogado, el transporte de media usa un token efímero por
participante, y el estado se sigue por SSE autenticado que se cierra al salir.
No se graba ni se retiene media en este alcance.

## 2. Alcance

### Incluido

- **Modelo `LiveSession`** (aditivo): `tenantId`, `scopeType` (`job`|`project`),
  `scopeId`, `purpose` (`inspection`|`assist`), `status` (FSM §6), `version`
  (concurrencia optimista), `createdById`, `idempotencyKey`, `expiresAt`,
  `endedAt`. Enums `LiveSessionStatus`/`ScopeType`/`Purpose`.
- **Autorización por participante y por recurso** — nueva respecto a la
  implementación de referencia (§13.1). Sólo pueden crear/ver/transicionar/
  suscribirse los usuarios que ya tienen acceso a ese `job`/`project` según
  RBAC + ownership existentes (`JobsService`/`ProjectsService`), no cualquier
  usuario del tenant.
- **Endpoints** (auth requerida, permisos `live_sessions:read`/`live_sessions:write`):
  crear, obtener, `media-token` (token LiveKit efímero por participante,
  gateado por estado y membresía), `transition` (acciones
  `accept`/`pause`/`resume`/`end`/`cancel` con `expectedVersion`), y SSE de
  eventos (`snapshot` + `status_changed` + keepalive).
- **FSM completa con drivers definidos** (§6, §13.2): quién/qué dispara cada
  arista, incluidas las que la referencia deja huérfanas
  (`PERMISSION_PENDING → CONNECTING → ACTIVE`, `ENDING → ENDED`).
- **`expiresAt` con enforcement** (§13.4): TTL por defecto en `create`; una
  sesión vencida no acepta `media-token` ni transiciones que no sean a
  terminal, y un barrido la lleva a `CANCELLED`/`FAILED`.
- **Auditoría** — `live_session.requested` en create; `live_session.<action>`
  en cada transición, con `beforeJson`/`afterJson`.
- **Eventos catalogados** — `live_session.requested.v1` y
  `live_session.status_changed.v1` agregados a
  `docs/foundation/EVENT_CATALOG.md` con envelope, productor y consumidores.
- **Transporte**: LiveKit (SFU). API firma tokens de participante
  (`livekit-server-sdk`); cliente móvil se conecta con el SDK nativo de
  LiveKit, **sólo en development/production build, no en Expo Go**.
- **Cliente móvil**: pantalla de sesión (unirse, ver estado, pausar/terminar,
  cámara/mic), detrás del flag; degradado explícito "no disponible en Expo Go".
- **Feature flag + canary por tenant** — `SEMSE_LIVE_SESSIONS_ENABLED` +
  `_CANARY_TENANT_IDS`.

### Fuera de alcance

- **Grabación, retención y redacción de media.** El enum `mediaClass` de la
  referencia (`RING_BUFFER`, `FULL_SESSION_RECORDING`, `TRANSCRIPT`, …) y el
  lineage de archivos son el gate F7 "quotas, retention y redacción" — spec
  aparte. Este alcance es **live-only, efímero**.
- **`ObservationMission`** (capa de análisis IA sobre la sesión:
  `CAPTURING → ANALYZING → FINDINGS_READY → …`, también presente en
  `prometeo-live.schema.ts`) — child spec posterior; requiere Tool Registry F2
  y multimodal F7.
- **Compartir pantalla, salas multi-parte (> 2 participantes activos),
  cliente web.** Móvil-first, 1:1 (más Prometeo como observador lógico).
- **Acciones de dominio desde la sesión** — aprobar milestones, mover dinero,
  cambiar estado de job/dispute: nada de eso se dispara desde la LiveSession;
  se hace por sus flujos existentes. `paymentGovernance`: N/A.
- **Recuperación literal del árbol `project-manager-app-main`** — se toma el
  diseño (modelo, FSM, endpoints, eventos) como referencia y se reimplementa
  contra los contratos vigentes de `@semse/schemas` y el módulo Core.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `CLIENT` (dueño del job/project) | `live_sessions:write` + acceso al recurso | su `job`/`project`, su tenant | Crear sesión, aceptar, pausar/reanudar, terminar, cancelar; unirse; ver por SSE | Crear sesión sobre un recurso ajeno; ver sesiones de otro tenant/recurso |
| `PRO`/`WORKER` asignado al recurso | `live_sessions:write` + asignación al recurso | el `job`/`project` donde está asignado | Crear (`assist`), unirse, pausar/reanudar/terminar | Operar sesiones de recursos donde no está asignado |
| Cualquiera con `live_sessions:read` pero sin acceso al recurso o no participante | `live_sessions:read` | — | nada | Ver, obtener `media-token`, suscribirse — responde **404** (no revela que la sesión existe) |
| `OPS_ADMIN` | `live_sessions:read` (+ `:write` para `cancel`) | tenant | Ver/cancelar sesiones colgadas del tenant para operación | Unirse al media room sin ser participante |
| Prometeo (servicio) | — | la sesión | Observador lógico (recibe eventos), propone acciones sujetas a aprobación (Tool Registry F2) | Transicionar la FSM por su cuenta |

- **Tenant boundary:** `resolveRequestContext` inyecta `tenantId`/`orgId` del
  token; nunca viajan en body/query. `@@unique([tenantId, idempotencyKey])`.
- **Ownership/resource policy:** `get`/`media-token`/`transition`/SSE exigen
  `tenantId` del actor **y** una fila activa en `LiveSessionParticipant`
  (`sessionId, userId`, sin `leftAt`). Sin eso → **404** (no se distingue de
  "no existe"). En `create`, además de `tenantId`, se valida acceso al
  `scopeId` (job/project) vía el servicio dueño del recurso para sembrar los
  participantes iniciales. Este era el hueco principal de la referencia
  (§13.1); es requisito de cierre.
- **Step-up o aprobación humana:** ninguna acción de esta sesión requiere
  step-up; tampoco destraba ninguna acción que hoy lo requeriría.
- **Datos `privacyCritical`:** el stream de cámara/audio es contenido de obra,
  potencialmente sensible (rostros de terceros, documentos). No se enruta a
  Ollama ni se persiste en este alcance. El token LiveKit es efímero
  (TTL ≤ vida de la sesión), por participante, y **no se loguea**.
- **Requisitos de auditoría:** `AuditLog` en create y en cada transición
  (`beforeJson`/`afterJson` con `status`/`version`/`reason`). Sin secretos ni
  el token de media en el registro.

## 4. Escenarios y criterios de aceptación

### P1 — Inspección remota feliz

```gherkin
DADO un CLIENT autenticado dueño de un Job en estado in_progress
CUANDO crea una LiveSession {scopeType: job, scopeId: <suyo>, purpose: inspection, idempotencyKey: k1}
ENTONCES responde 200 con status REQUESTED, version 0
Y se emite live_session.requested.v1 y un AuditLog live_session.requested
CUANDO el PRO asignado hace transition {action: accept, expectedVersion: 0}
ENTONCES status pasa a PERMISSION_PENDING, version 1
CUANDO ambos conceden permisos de cámara/mic y el driver de conexión confirma
ENTONCES la sesión llega a ACTIVE (via CONNECTING) y ambos ven el video en vivo
CUANDO el CLIENT hace transition {action: end}
ENTONCES status ENDING → ENDED, endedAt seteado, el media room se cierra
Y el SSE emite status_changed en cada paso y luego se cierra
```

### P2 — Asistencia guiada (`assist`)

```gherkin
DADO un WORKER en sitio con un problema
CUANDO crea una LiveSession {purpose: assist} sobre el FreeProject donde está asignado
ENTONCES la sesión sigue la misma FSM; Prometeo recibe los eventos y puede
  proponer acciones (crear incidente, adjuntar evidencia) sujetas a aprobación
```

### P3 — Idempotencia y concurrencia

```gherkin
DADO una LiveSession creada con idempotencyKey k1
CUANDO se reintenta create con k1 y el MISMO scope/purpose/creador
ENTONCES devuelve la sesión existente (no crea otra)
CUANDO se reintenta con k1 pero distinto scope/purpose/creador
ENTONCES 409 "idempotency key bound to another command"
CUANDO dos transiciones llegan con expectedVersion 2
ENTONCES sólo una gana; la otra recibe 409 "version conflict"
```

Casos borde:

- [ ] Reintento de `create` (idempotente) y de `transition` (rechazo por versión).
- [ ] Recurso inexistente / sin acceso / no participante → **404** (idéntico a "no existe"), nunca fuga de datos de otro tenant ni confirmación de que la sesión existe.
- [ ] Aislamiento cross-tenant y cross-recurso: un usuario del mismo tenant sin acceso al job y no listado en `LiveSessionParticipant` NO ve la sesión ni obtiene `media-token` (404).
- [ ] `media-token` sobre sesión `ENDED`/`CANCELLED`/`FAILED` o `expiresAt` vencido → 409, no token.
- [ ] Transición ilegal (`pause` desde `REQUESTED`) → 409.
- [ ] SSE: al perder autorización (sesión termina, usuario removido) el stream se cierra; keepalive cada 20 s.
- [ ] Expo Go: la pantalla carga y muestra "no disponible", sin intentar importar el módulo nativo de LiveKit.

## 5. Contratos

### API — `POST /v1/prometeo/live-sessions`

```yaml
auth: required
permissions: ["live_sessions:write"]
input_schema: liveSessionCreateSchema  # { scopeType: job|project, scopeId, purpose: inspection|assist, idempotencyKey }
output_schema: LiveSessionRecordView   # { id, tenantId, scopeType, scopeId, purpose, status, version, createdById, expiresAt, endedAt, createdAt }
errors:
  400: input inválido
  401: sin sesión
  404: scopeId inexistente O el actor no tiene acceso al recurso (mismo cuerpo — no se distingue)
  409: idempotencyKey ligada a otro comando
effects:
  audit_log: live_session.requested
  domain_event: live_session.requested.v1
  sse: n/a (el productor emite al canal; los consumidores son el endpoint SSE)
  payment_governance: N/A
```

### API — `GET /v1/prometeo/live-sessions/:sessionId`

```yaml
auth: required
permissions: ["live_sessions:read"]
output_schema: LiveSessionRecordView
errors: { 401, 404 (no existe, o el actor no es participante — mismo cuerpo) }
effects: {}
```

### API — `GET /v1/prometeo/live-sessions/:sessionId/media-token`

```yaml
auth: required
permissions: ["live_sessions:read"]
precondition: actor es participante autorizado del recurso Y status in [CONNECTING, ACTIVE, PAUSED] Y no vencida
output_schema: { token: string, url: string, room: string, expiresAt: string }  # token efímero LiveKit, TTL <= vida de sesión
errors: { 401, 404 (no existe / no participante), 409 (estado/expiración no permite media) }
effects: { audit_log: live_session.media_token_issued (sin el token en el registro) }
```

### API — `POST /v1/prometeo/live-sessions/:sessionId/transition`

```yaml
auth: required
permissions: ["live_sessions:write"]
input_schema: liveSessionTransitionSchema  # { action: accept|pause|resume|end|cancel, expectedVersion: int>=0, reason?: string<=500 }
output_schema: LiveSessionRecordView
errors:
  400: input inválido
  404: sesión inexistente O el actor no es participante (mismo cuerpo)
  409: version conflict | transición ilegal desde el estado actual
effects:
  audit_log: live_session.<action> (beforeJson/afterJson)
  domain_event: live_session.status_changed.v1
  payment_governance: N/A
```

### API — `GET /v1/prometeo/live-sessions/:sessionId/events` (SSE)

```yaml
auth: required
permissions: ["live_sessions:read"]
stream:
  - event: live_session.snapshot.v1   (al conectar)
  - event: live_session.status_changed.v1  (en cada transición)
  - event: keepalive  (cada 20 s)
close_on: sesión terminal | pérdida de autorización | cierre del cliente
```

### UI

```yaml
surfaces: ["apps/mobile: LiveSessionScreen (dentro del stack del job/project)"]
states: [loading, empty, ready, forbidden, degraded, error]
required_behavior:
  - "degraded = Expo Go / sin permisos de cámara/mic: explica y ofrece la acción para concederlos, no crashea"
  - "forbidden/not-found = 404 del backend: 'esta sesión no está disponible', sin exponer nada del recurso"
  - "el SSE se cierra al salir de la pantalla; el media room se abandona en unmount"
```

### Agente/Prometeo

```yaml
tools: []   # en este alcance Prometeo sólo OBSERVA (recibe live_session.*). Tools que actúan sobre la sesión -> child spec via Tool Registry F2.
approval_policy: human_required para cualquier acción propuesta durante la sesión
forbidden_behavior:
  - "transicionar la FSM"
  - "emitir media-token"
  - "persistir frames/audio"
```

## 6. FSM, eventos y reconstrucción

- **Estado/FSM:** `LiveSessionStatus`.

```
REQUESTED ──accept──▶ PERMISSION_PENDING ──(permisos OK, driver)──▶ CONNECTING ──(SFU room join)──▶ ACTIVE
   │                       │                                             │                            │
 cancel                  cancel                                        cancel/FAILED             pause ⇄ resume
   ▼                       ▼                                             ▼                            │
CANCELLED               CANCELLED                                     CANCELLED/FAILED               PAUSED
                                                                                                     │
                                                          ACTIVE/PAUSED ──end──▶ ENDING ──▶ ENDED / FAILED
```

- **Drivers por arista** (§13.2 — la referencia deja varias sin dueño):
  | Arista | Driver |
  |---|---|
  | `REQUESTED→PERMISSION_PENDING` | `transition{accept}` del contraparte |
  | `PERMISSION_PENDING→CONNECTING` | el backend, cuando **todos** los participantes reportan permisos concedidos (endpoint `POST .../participant-ready` o campo en `transition`) |
  | `CONNECTING→ACTIVE` | webhook de LiveKit `room_started` / primer `participant_joined` verificado contra la sesión |
  | `CONNECTING→FAILED` | timeout de conexión (p. ej. 60 s) o webhook de error |
  | `ACTIVE⇄PAUSED` | `transition{pause|resume}` |
  | `ACTIVE/PAUSED→ENDING` | `transition{end}` |
  | `ENDING→ENDED` | webhook LiveKit `room_finished` o barrido tras N s |
  | `*→CANCELLED` | `transition{cancel}` (sólo desde `REQUESTED`/`PERMISSION_PENDING`/`CONNECTING`) o barrido de `expiresAt` |
- **Invariantes:** `docs/foundation/DOMAIN_INVARIANTS.md`. No se crean
  transiciones de `Job`/`Project`/`Milestone`/`Payment`/`Dispute` desde aquí.
- **Eventos declarados:** agregar a `docs/foundation/EVENT_CATALOG.md`
  (hoy NO están):
  - `live_session.requested.v1` — productor: `LiveSessionsService.create`.
  - `live_session.status_changed.v1` — productor: `LiveSessionsService.transition`
    (payload con `previousStatus`, `status`, `sessionVersion`).
- **Productor + outbox:** evaluar si estos eventos van por el outbox atómico
  del Event Backbone F1 o quedan post-commit best-effort como los hooks F3
  no-Evidence. Para el SSE en vivo basta best-effort + snapshot al reconectar;
  si algún consumidor downstream necesita garantía, va por outbox.
- **Consumidores + idempotencia:** el endpoint SSE (efímero, sin estado).
  Prometeo como consumidor lógico. Cualquier consumidor persistente debe ser
  idempotente por `eventId`.
- **Replay/rebuild:** el estado vive en la fila `LiveSession`; el SSE se
  reconstruye con `snapshot` al conectar. No hay proyección a reconstruir.
- **DLQ/compensación:** una sesión atascada en `CONNECTING`/`ENDING` la
  resuelve el barrido de `expiresAt` a `FAILED`/`ENDED`.

## 7. Datos y migración

- **Modelos Prisma:**
  - `LiveSession` + enums `LiveSessionStatus`, `LiveSessionScopeType`,
    `LiveSessionPurpose` (como en §1 / la referencia).
  - **`LiveSessionParticipant`** (decisión del propietario 2026-09-07 — membresía
    explícita, no derivada del recurso):
    ```prisma
    model LiveSessionParticipant {
      id            String   @id @default(cuid())
      tenantId      String
      sessionId     String
      userId        String
      role          LiveSessionParticipantRole   // owner | inspector | assistant | observer
      invitedById   String
      joinedAt      DateTime?
      leftAt        DateTime?
      createdAt     DateTime @default(now())
      session       LiveSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
      @@unique([sessionId, userId])
      @@index([tenantId, userId])
      @@index([sessionId])
    }
    ```
    En `create`, el backend inserta al creador como `owner` y a la contraparte
    del recurso (p. ej. el `PRO` asignado al job, o el `CLIENT` dueño) como
    `inspector`/`assistant`. `assist` puede añadir un `observer` invitado
    **sólo** por el `owner`, sujeto a `live_sessions:write` + acceso al recurso.
- **Autorización = tenant + fila en `LiveSessionParticipant`.** Todo `get`/
  `media-token`/`transition`/SSE exige `tenantId` del actor **y** una fila
  `(sessionId, userId)` sin `leftAt`. Sin eso → 404.
- **Migración:** **aditiva** — `CREATE TYPE` para los 4 enums (`LiveSessionStatus`,
  `LiveSessionScopeType`, `LiveSessionPurpose`, `LiveSessionParticipantRole`) +
  `CREATE TABLE live_session` + `CREATE TABLE live_session_participant` + índices
  + `@@unique([tenantId, idempotencyKey])` y `@@unique([sessionId, userId])`.
  Cero `ALTER`/`DROP` sobre tablas existentes.
  `prisma migrate dev --name add_live_sessions`.
- **Estrategia expand/contract:** sólo expand; nada consume la tabla hasta que
  el flag se active.
- **Backfill:** ninguno.
- **Compatibilidad hacia atrás:** total — feature nueva, aislada.
- **Verificación de drift:** `information_schema` confirma tabla + enums +
  índices tras `migrate deploy`; `scripts/pre-migrate.mjs` (repair de
  fantasmas) cubre el caso de fila registrada sin SQL aplicado.
- **Rollback de código:** revertir los commits / no activar el flag.
- **Rollback/forward-fix de datos:** `DROP TABLE live_session` + `DROP TYPE`
  es seguro mientras el flag nunca se activó y no hay filas de negocio que
  dependan. Nunca `prisma db push` a producción; nunca editar una migración
  aplicada.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** sesiones creadas/activas/falladas por tenant; tiempo
  `REQUESTED→ACTIVE`; tasa `CONNECTING→FAILED`; duración media; nº de
  `version conflict`.
- **Logs/traces/correlation:** `requestId` como `correlationId` en eventos y
  audit; nunca el token LiveKit en logs.
- **Health/readiness:** dependencia de LiveKit — readiness del módulo chequea
  que `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` están y que el
  firmado de token funciona (no que el SFU esté up).
- **Feature flags/allowlists:** `SEMSE_LIVE_SESSIONS_ENABLED` (global) +
  `SEMSE_LIVE_SESSIONS_CANARY_TENANT_IDS` (allowlist). Off por defecto.
- **Plan de canary:** activar para 1 tenant interno; recorrer P1 y P2 reales
  en device nativo (iOS + Android), 2 participantes, con red interrumpida y
  regreso de background; verificar aislamiento con un 3er usuario sin acceso.
- **Evidencia de producción requerida:** grabación del canary + logs de las
  transiciones + prueba negativa del 3er usuario (404).
- **Señal de rollback:** cualquier fuga cross-recurso/cross-tenant, media-token
  emitido a un no-participante, o crash en el journey → flag off.
- **Owner operativo:** semse-core / equipo Prometeo.

## 9. Tests requeridos

- [ ] Unitarios FSM: `canTransitionLiveSession` + `transitionTarget` para las
      20+ combinaciones acción×estado, incluidas las ilegales.
- [ ] Contrato API de los 5 endpoints contra `@semse/schemas`.
- [ ] **Ownership/aislamiento**: usuario del mismo tenant sin acceso al job y
      no listado en `LiveSessionParticipant` → **404** en get/media-token/
      transition/SSE; usuario de otro tenant → 404 idéntico.
- [ ] Validación y conflicto de estado: transición ilegal → 409; `expectedVersion`
      desactualizado → 409.
- [ ] Idempotencia: `create` con misma key/atributos → misma fila; con key y
      atributos distintos → 409.
- [ ] `media-token`: sólo en estados válidos y no vencida; nunca en terminal.
- [ ] Migración aditiva reproducible + `DROP` seguro (rollback).
- [ ] UI móvil: `loading/empty/forbidden/degraded(Expo Go)/error`.
- [ ] Canary autenticado en device nativo (P1 + P2 + prueba negativa).

## 10. Mapa de implementación

### API

- `apps/api/src/modules/live-sessions/{live-sessions.module,controller,service,repository}.ts`
  — reimplementar desde la referencia, **añadiendo** el guard de ownership y
  los drivers de FSM faltantes.
- `apps/api/src/modules/live-sessions/livekit.service.ts` — firmado de token.
- Webhook receiver LiveKit (`room_started`/`room_finished`/error) → transiciones
  `CONNECTING→ACTIVE`, `ENDING→ENDED`, `CONNECTING→FAILED`.
- Barrido de `expiresAt` (worker o cron) → terminal.
- `apps/api/src/common/permissions` — permisos `live_sessions:read`/`:write`
  en el seed RBAC para los roles del §3.

### Web

- Ninguno en este alcance (móvil-first).

### Worker/Packages/DB

- `packages/db/prisma/schema.prisma` — modelo + enums (migración aditiva).
- `packages/schemas/src/live-session.schema.ts` — reimplementar desde
  `prometeo-live.schema.ts` de la referencia (create/transition/status/event
  + `LiveSessionRecordView`), sin arrastrar `mediaClass`/`observationMission`
  (fuera de alcance).
- `apps/worker` — job de barrido de `expiresAt`.

### Tests

- `apps/api/test/live-sessions.service.test.ts`, `...ownership.test.ts`,
  `...fsm.test.ts`.

## 11. Investigación externa

- **LiveKit** (SFU + `livekit-server-sdk` + client SDKs):
  https://docs.livekit.io/ — modelo de rooms, tokens de participante con
  grants, webhooks. Aplicado: firmado server-side, token efímero por
  participante, webhooks como drivers de FSM. Backlog: egress/grabación
  (fuera de alcance). Descartado: WebRTC peer-to-peer directo (no escala a
  Prometeo como observador ni a >2, y no da webhooks de ciclo de vida).
- **LiveKit en Expo / React Native**:
  https://docs.livekit.io/home/quickstarts/react-native/ y
  https://docs.expo.dev/develop/development-builds/introduction/ — el SDK
  nativo **no** funciona en Expo Go; requiere development build (config
  plugin). Aplicado: gate de Expo Go explícito, estado `degraded`.
- **Expo SDK 57 permisos cámara/micrófono**:
  https://docs.expo.dev/versions/v57.0.0/sdk/camera/ — flujo de request de
  permisos antes de `PERMISSION_PENDING→CONNECTING`.

## 12. Gates de cierre

- [x] Sign-off humano del spec (`DRAFT → APPROVED`) — el propietario firmó en
      sesión 2026-09-07. Revisión formal contra `STATE_MACHINES.md` /
      `DOMAIN_INVARIANTS.md` se hace al escribir el plan.
- [x] Decisión de producto: **tabla `LiveSessionParticipant` explícita**;
      **`inspection` + `assist`** en el primer corte; **404** (no 403) para
      recurso/sesión sin acceso.
- [ ] Eventos `live_session.*` agregados a `EVENT_CATALOG.md` (en el plan/tasks).
- [ ] Decisión de infra: cuenta/plan LiveKit, `LIVEKIT_*` en Railway
      (acción humana — agentes no tocan env de producción). **Bloquea la fase
      de media, no el modelo/FSM/tests.**
- [ ] Plan → tasks → checklist → analyze.
- [ ] Migración aditiva verificada en local (nunca `db push`).
- [ ] Implementación con guard de ownership y drivers de FSM completos.
- [ ] Suite verde + `spec:validate:strict`.
- [ ] Canary autenticado en device nativo iOS + Android con prueba negativa
      de aislamiento.
- [ ] Evidencia de producción y activación registradas por separado.

## 13. Huecos identificados en la implementación de referencia

> Esto NO se copia tal cual. Cada punto es requisito de corrección antes de `APPROVED`.

1. **Sin autorización por recurso.** `create` acepta cualquier `scopeId`;
   `get`/`transition`/SSE filtran sólo por `tenantId`. `repository.transition`
   recibe `roles` pero nadie los evalúa. → Añadir guard que valide acceso al
   `job`/`project` vía su servicio dueño, en los 5 endpoints.
2. **FSM con aristas huérfanas.** `transitionTarget` sólo cubre
   `accept/pause/resume/end/cancel`. Nada mueve `PERMISSION_PENDING→CONNECTING`,
   `CONNECTING→ACTIVE`, ni `ENDING→ENDED`. → Definir drivers (webhooks LiveKit +
   endpoint `participant-ready` + barrido), como en §6.
3. **`media-token` sin gate de estado ni de participante.** Emite token para
   cualquier sesión del tenant que el actor pueda `read`, en cualquier estado
   (incluido `ENDED`). → Gatear por membresía + `status ∈ {CONNECTING, ACTIVE,
   PAUSED}` + no vencida; auditar la emisión sin registrar el token.
4. **`expiresAt` declarado y nunca usado.** No se setea en `create` ni se
   chequea. → TTL por defecto + enforcement + barrido a terminal.
5. **Sin modelo de participantes.** Sólo `createdById`. → **Resuelto:** se
   añade `LiveSessionParticipant` (§7). La autorización es tenant + fila de
   participante activa; nada se deriva del recurso en runtime salvo para
   sembrar los participantes en `create`.
6. **Eventos no catalogados.** `live_session.requested.v1` /
   `status_changed.v1` no están en `EVENT_CATALOG.md` (viola regla de AGENTS.md).
7. **Acoplamiento de nombres.** El schema de referencia se llama
   `prometeo-live.schema.ts` y mezcla `LiveSession`, `ObservationMission` y
   `mediaClass`. → Separar: `live-session.schema.ts` sólo con lo de este spec.
8. **`SseEventBusService` vs Event Backbone.** La referencia usa un bus SSE
   in-process (`sse-event-bus.service`). Confirmar que ese bus existe en
   `main` o reemplazarlo por el mecanismo SSE vigente; decidir si además va
   por el outbox F1.
