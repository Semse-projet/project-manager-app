import test from "node:test";

/**
 * T-010 — casos de comportamiento de LiveSession.
 *
 * **La mayoría ya son tests reales** en
 * `apps/api/test/live-sessions.service.test.ts` (20 casos, verdes):
 * aislamiento 404 por tenant/no-participante, idempotencia + 409, FSM
 * (accept por la contraparte, cancel sólo owner, aristas ilegales),
 * concurrencia optimista, media-token gateado por estado/expiración,
 * driveFromWebhook ignora aristas inválidas, barrido de expiración
 * (CANCELLED / CONNECTING->FAILED), add-participant (sólo owner + acceso al
 * recurso del target).
 *
 * Lo que sigue como `todo` necesita superficie que todavía no se testea con
 * un doble en memoria:
 */

// ── Webhook de LiveKit (necesita el controller + firma) ───────────────────
test.todo("livekit-webhook: firma inválida -> 401, sin efecto en la FSM");
test.todo("livekit-webhook: room_finished con firma válida -> ENDING -> ENDED");
test.todo("livekit-webhook: room name no reconocido -> 400");

// ── SSE (necesita un test de integración del endpoint) ────────────────────
test.todo("SSE events: emite snapshot al conectar y status_changed en cada transición");
test.todo("SSE events: no-participante -> el stream emite live_session.error.v1 y no push");

// ── UI móvil (Fase C mobile) ─────────────────────────────────────────────
test.todo("mobile: Expo Go -> estado 'degraded', no importa el módulo nativo de LiveKit");
test.todo("mobile: 404 del backend -> 'esta sesión no está disponible', sin datos del recurso");
test.todo("mobile: el SSE se cierra y el room se abandona al desmontar la pantalla");

// ── Refinamiento pendiente (documentado en el controller) ─────────────────
test.todo("participant-ready: PERMISSION_PENDING -> CONNECTING sólo cuando TODOS los participantes activos reportaron permisos (v1 lo hace con el primero)");
