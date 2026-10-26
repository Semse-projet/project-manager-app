/**
 * BO-09 — decisión pura ante un evento de geocerca. Spec: docs/specs/core/geofence-policy.spec.md
 *
 * Tabla del plan (08_TIME_TRACKER_GEO_NOTIFICACIONES.md), con las decisiones del propietario:
 * ASK por defecto (OPEN-07); AUTO solo con consentimiento aparte; sin coordenadas (OPEN-10).
 * El servidor DECIDE, no actúa: nunca inicia ni termina un reloj ni inventa una hora.
 */
export type GeofenceType = "ARRIVAL" | "LEAVE" | "OFF_SITE_AT_SHIFT";
export type LocationMode = "ASK" | "AUTO" | "OFF";
export type GeofenceDecision = "PROMPT" | "AUTO_START_ALLOWED" | "MANUAL_ONLY" | "LEAVE_PROMPT" | "EXCEPTION" | "IGNORE";
export type AccuracyBucket = "GOOD" | "POOR" | "UNKNOWN";

export const GOOD_ACCURACY_METERS = 50;
export const MAX_EVENT_AGE_MS = 10 * 60_000;
export const MAX_FUTURE_SKEW_MS = 5 * 60_000;
export const COOLDOWN_MS = 10 * 60_000;

export function accuracyBucket(meters: number | undefined | null): AccuracyBucket {
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) return "UNKNOWN";
  return meters <= GOOD_ACCURACY_METERS ? "GOOD" : "POOR";
}

export type DecisionInput = {
  mode: LocationMode;
  /** Consentimiento específico de auto-inicio, vigente y no revocado. */
  autoConsent: boolean;
  type: GeofenceType;
  accuracy: AccuracyBucket;
  activeSession: boolean;
  siteAllowed: boolean;
  /** now - occurredAt en ms (negativo = evento en el futuro). */
  ageMs: number;
  recentDuplicate: boolean;
};

export type DecisionResult = { decision: GeofenceDecision; reason: string };

export function decide(input: DecisionInput): DecisionResult {
  if (!input.siteAllowed) return { decision: "IGNORE", reason: "obra no permitida para esta persona" };
  if (input.ageMs > MAX_EVENT_AGE_MS || input.ageMs < -MAX_FUTURE_SKEW_MS) {
    return { decision: "IGNORE", reason: "evento fuera de la ventana de tiempo válida" };
  }
  if (input.mode === "OFF") return { decision: "IGNORE", reason: "modo OFF: no se usa la ubicación" };
  if (input.recentDuplicate) return { decision: "IGNORE", reason: "evento repetido dentro del enfriamiento" };

  switch (input.type) {
    case "ARRIVAL": {
      if (input.activeSession) return { decision: "IGNORE", reason: "ya hay una sesión de trabajo activa" };
      if (input.accuracy !== "GOOD") return { decision: "MANUAL_ONLY", reason: "ubicación imprecisa: inicio manual" };
      if (input.mode === "AUTO" && input.autoConsent) {
        return { decision: "AUTO_START_ALLOWED", reason: "AUTO con consentimiento y ubicación fiable" };
      }
      return { decision: "PROMPT", reason: "preguntar antes de iniciar" };
    }
    case "OFF_SITE_AT_SHIFT": {
      if (input.activeSession) return { decision: "IGNORE", reason: "ya hay una sesión de trabajo activa" };
      if (input.mode === "AUTO" && input.autoConsent) {
        return { decision: "EXCEPTION", reason: "no se inicia por horario ni por ubicación ausente: queda como excepción" };
      }
      return { decision: "PROMPT", reason: "iniciar, explicar o indicar otra obra" };
    }
    case "LEAVE": {
      if (!input.activeSession) return { decision: "IGNORE", reason: "no hay sesión activa" };
      return { decision: "LEAVE_PROMPT", reason: "terminar, pausar o continuar: nunca se termina en silencio" };
    }
  }
}
