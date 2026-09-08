import { z } from "zod";

/**
 * Contratos de LiveSession — ver `docs/specs/prometeo/live-sessions.spec.md`
 * (`APPROVED` 2026-09-07) y `docs/foundation/STATE_MACHINES.md` §LiveSession.
 *
 * Reimplementado desde la implementación de referencia
 * (`project-manager-app-main/.../prometeo-live.schema.ts`) SIN arrastrar
 * `mediaClass` ni `observationMission` (fuera de alcance del primer corte).
 * Añade el rol de participante y las vistas de record/participante/media-token.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const liveSessionStatusSchema = z.enum([
  "REQUESTED",
  "PERMISSION_PENDING",
  "CONNECTING",
  "ACTIVE",
  "PAUSED",
  "ENDING",
  "ENDED",
  "CANCELLED",
  "FAILED",
]);
export type LiveSessionStatus = z.infer<typeof liveSessionStatusSchema>;

export const liveSessionScopeTypeSchema = z.enum(["job", "project"]);
export type LiveSessionScopeType = z.infer<typeof liveSessionScopeTypeSchema>;

export const liveSessionPurposeSchema = z.enum(["inspection", "assist"]);
export type LiveSessionPurpose = z.infer<typeof liveSessionPurposeSchema>;

export const liveSessionParticipantRoleSchema = z.enum([
  "owner",
  "inspector",
  "assistant",
  "observer",
]);
export type LiveSessionParticipantRole = z.infer<
  typeof liveSessionParticipantRoleSchema
>;

export const liveSessionTransitionActionSchema = z.enum([
  "accept",
  "pause",
  "resume",
  "end",
  "cancel",
]);
export type LiveSessionTransitionAction = z.infer<
  typeof liveSessionTransitionActionSchema
>;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export const liveSessionCreateSchema = z.object({
  scopeType: liveSessionScopeTypeSchema,
  scopeId: z.string().min(1).max(200),
  purpose: liveSessionPurposeSchema,
  idempotencyKey: z.string().min(1).max(200),
});
export type LiveSessionCreateInput = z.infer<typeof liveSessionCreateSchema>;

export const liveSessionTransitionSchema = z.object({
  action: liveSessionTransitionActionSchema,
  expectedVersion: z.number().int().nonnegative(),
  reason: z.string().max(500).optional(),
});
export type LiveSessionTransitionInput = z.infer<
  typeof liveSessionTransitionSchema
>;

/** Driver de `PERMISSION_PENDING -> CONNECTING` (spec §6). */
export const liveSessionParticipantReadySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});
export type LiveSessionParticipantReadyInput = z.infer<
  typeof liveSessionParticipantReadySchema
>;

/**
 * Agregar un participante a una sesión (sólo el `owner`). `inspector`/
 * `assistant` sólo antes de conectar; `observer` en cualquier estado no
 * terminal. El backend revalida que `userId` tenga acceso al recurso.
 */
export const liveSessionAddParticipantSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["inspector", "assistant", "observer"]),
  expectedVersion: z.number().int().nonnegative(),
});
export type LiveSessionAddParticipantInput = z.infer<
  typeof liveSessionAddParticipantSchema
>;

// ---------------------------------------------------------------------------
// Views (respuesta de API — fechas como ISO string)
// ---------------------------------------------------------------------------

export const liveSessionRecordViewSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  scopeType: liveSessionScopeTypeSchema,
  scopeId: z.string(),
  purpose: liveSessionPurposeSchema,
  status: liveSessionStatusSchema,
  version: z.number().int().nonnegative(),
  createdById: z.string(),
  expiresAt: z.string().datetime().nullable(),
  endedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type LiveSessionRecordView = z.infer<typeof liveSessionRecordViewSchema>;

export const liveSessionParticipantViewSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  userId: z.string(),
  role: liveSessionParticipantRoleSchema,
  joinedAt: z.string().datetime().nullable(),
  leftAt: z.string().datetime().nullable(),
});
export type LiveSessionParticipantView = z.infer<
  typeof liveSessionParticipantViewSchema
>;

/** Token efímero de LiveKit — nunca se persiste ni se loguea (spec §3). */
export const liveSessionMediaTokenViewSchema = z.object({
  token: z.string().min(1),
  url: z.string().url(),
  room: z.string().min(1),
  expiresAt: z.string().datetime(),
});
export type LiveSessionMediaTokenView = z.infer<
  typeof liveSessionMediaTokenViewSchema
>;

// ---------------------------------------------------------------------------
// Domain events (catálogo: EVENT_CATALOG.md §Prometeo — Live Sessions)
// ---------------------------------------------------------------------------

export const liveSessionEventTypeSchema = z.enum([
  "live_session.requested.v1",
  "live_session.status_changed.v1",
]);
export type LiveSessionEventType = z.infer<typeof liveSessionEventTypeSchema>;

export const liveSessionEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: liveSessionEventTypeSchema,
  version: z.literal(1),
  tenantId: z.string().min(1),
  aggregateType: z.literal("LiveSession"),
  aggregateId: z.string().min(1),
  actorType: z.enum(["user", "platform"]),
  actorId: z.string().min(1),
  correlationId: z.string().min(1),
  occurredAt: z.string().datetime(),
  payload: z.object({
    sessionId: z.string().min(1),
    scopeType: liveSessionScopeTypeSchema,
    scopeId: z.string().min(1),
    previousStatus: liveSessionStatusSchema.optional(),
    status: liveSessionStatusSchema,
    sessionVersion: z.number().int().nonnegative(),
  }),
});
export type LiveSessionEvent = z.infer<typeof liveSessionEventSchema>;

// ---------------------------------------------------------------------------
// FSM — la fuente de verdad es STATE_MACHINES.md §LiveSession
// ---------------------------------------------------------------------------

const LIVE_SESSION_TRANSITIONS: Record<
  LiveSessionStatus,
  readonly LiveSessionStatus[]
> = {
  REQUESTED: ["PERMISSION_PENDING", "CANCELLED"],
  PERMISSION_PENDING: ["CONNECTING", "CANCELLED"],
  CONNECTING: ["ACTIVE", "FAILED", "CANCELLED"],
  ACTIVE: ["PAUSED", "ENDING"],
  PAUSED: ["ACTIVE", "ENDING"],
  ENDING: ["ENDED", "FAILED"],
  ENDED: [],
  CANCELLED: [],
  FAILED: [],
};

export const LIVE_SESSION_TERMINAL_STATUSES: readonly LiveSessionStatus[] = [
  "ENDED",
  "CANCELLED",
  "FAILED",
];

/** Estados en los que se puede emitir un `media-token` (spec §5). */
export const LIVE_SESSION_MEDIA_STATUSES: readonly LiveSessionStatus[] = [
  "CONNECTING",
  "ACTIVE",
  "PAUSED",
];

export function isLiveSessionTerminal(status: LiveSessionStatus): boolean {
  return LIVE_SESSION_TERMINAL_STATUSES.includes(status);
}

/** ¿La arista `from -> to` está permitida por la FSM? */
export function canTransitionLiveSession(
  from: LiveSessionStatus,
  to: LiveSessionStatus,
): boolean {
  return LIVE_SESSION_TRANSITIONS[from].includes(to);
}

/**
 * Estado destino de una acción de usuario desde `status`, o `undefined` si la
 * acción no aplica en ese estado. Las aristas movidas por webhooks de LiveKit
 * (`CONNECTING->ACTIVE`, `ENDING->ENDED`, `CONNECTING->FAILED`) y por el
 * driver `participant-ready` (`PERMISSION_PENDING->CONNECTING`) no pasan por
 * aquí — ver STATE_MACHINES.md §LiveSession "Autorización por transición".
 */
export function liveSessionTransitionTarget(
  status: LiveSessionStatus,
  action: LiveSessionTransitionAction,
): LiveSessionStatus | undefined {
  if (action === "accept" && status === "REQUESTED") return "PERMISSION_PENDING";
  if (action === "pause" && status === "ACTIVE") return "PAUSED";
  if (action === "resume" && status === "PAUSED") return "ACTIVE";
  if (action === "end" && (status === "ACTIVE" || status === "PAUSED"))
    return "ENDING";
  if (
    action === "cancel" &&
    (status === "REQUESTED" ||
      status === "PERMISSION_PENDING" ||
      status === "CONNECTING")
  )
    return "CANCELLED";
  return undefined;
}
