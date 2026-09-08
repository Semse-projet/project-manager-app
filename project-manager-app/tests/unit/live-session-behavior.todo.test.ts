import test from "node:test";

/**
 * T-010 — casos de comportamiento de LiveSession que Fase B/C debe volver
 * verdes. Se declaran como `test.todo` porque el módulo
 * `apps/api/src/modules/live-sessions/` todavía no existe (spec §13: la
 * implementación de referencia se audita, no se importa). Cuando exista el
 * servicio, cada `todo` se convierte en un test real en
 * `apps/api/test/live-sessions.service.test.ts` / `...ownership.test.ts`.
 *
 * Fuente: docs/specs/prometeo/live-sessions.spec.md §4/§5,
 * .plan.md §7 Fase A, .tasks.md T-010, .analyze.md.
 */

// ── Aislamiento (los huecos §13.1 / §13.3 de la referencia) ────────────────
test.todo("get: usuario del mismo tenant sin fila en LiveSessionParticipant -> 404");
test.todo("get: usuario de otro tenant -> 404 idéntico (no distingue de 'no existe')");
test.todo("transition: no-participante -> 404, no muta la sesión");
test.todo("SSE events: se cierra el stream al perder autorización (sesión termina / participante removido)");
test.todo("media-token: sólo para participante activo Y status in {CONNECTING,ACTIVE,PAUSED} Y no vencida");
test.todo("media-token: status terminal (ENDED/CANCELLED/FAILED) -> 409, sin token");
test.todo("media-token: la emisión se audita SIN el token en el registro");

// ── Autorización de recurso ───────────────────────────────────────────────
test.todo("create: scopeId de un job/project sin acceso -> 404 (valida vía JobsService/ProjectsService)");
test.todo("create: siembra participantes owner=creador + contraparte del recurso (inspector/assistant)");
test.todo("invite-observer: sólo el owner; sólo usuarios con acceso al recurso; queda en AuditLog");

// ── Idempotencia y concurrencia ──────────────────────────────────────────
test.todo("create: misma idempotencyKey + mismos scope/purpose/creador -> devuelve la sesión existente");
test.todo("create: misma idempotencyKey + atributos distintos -> 409");
test.todo("transition: expectedVersion desactualizado -> 409 (updateMany where {id, version} devuelve 0 filas)");
test.todo("transition: dos transiciones con el mismo expectedVersion -> sólo una gana");

// ── FSM y drivers ────────────────────────────────────────────────────────
test.todo("transition: acción ilegal desde el estado actual (pause desde REQUESTED) -> 409");
test.todo("participant-ready: PERMISSION_PENDING -> CONNECTING sólo cuando TODOS los participantes activos reportaron permisos");
test.todo("webhook LiveKit room_started/participant_joined (firma verificada) -> CONNECTING -> ACTIVE");
test.todo("webhook LiveKit room_finished -> ENDING -> ENDED; timeout de conexión -> CONNECTING -> FAILED");
test.todo("webhook con firma inválida -> 401, sin efecto en la FSM");

// ── Expiración ───────────────────────────────────────────────────────────
test.todo("create: setea expiresAt con el TTL por defecto");
test.todo("barrido: sesión vencida no-terminal -> CANCELLED/FAILED según estado");
test.todo("sesión vencida: media-token y transiciones no-terminales -> rechazadas");

// ── Auditoría y eventos ──────────────────────────────────────────────────
test.todo("create: AuditLog live_session.requested + evento live_session.requested.v1");
test.todo("transition: AuditLog live_session.<action> (beforeJson/afterJson/reason) + live_session.status_changed.v1");
test.todo("evento se publica al canal SSE live-session:<tenantId>:<sessionId> (best-effort, sin outbox)");

// ── Invariante de dominio ────────────────────────────────────────────────
test.todo("ninguna transición de LiveSession escribe FSM de Job/Project/Milestone/Payment/Dispute");

// ── UI móvil (Fase C) ────────────────────────────────────────────────────
test.todo("mobile: Expo Go -> estado 'degraded', no importa el módulo nativo de LiveKit");
test.todo("mobile: 404 del backend -> estado 'forbidden/not-found' sin exponer datos del recurso");
test.todo("mobile: el SSE se cierra y el room se abandona al desmontar la pantalla");
