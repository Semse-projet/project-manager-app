/**
 * El widget flotante de Prometeo usa `POST /v1/prometeo/copilot/message`, que solo clasifica la intención por
 * palabras clave y devuelve un texto fijo ("Puedo ayudarte con presupuestos…") para toda pregunta general. Las
 * preguntas generales se responden ahora con el chat real de Prometeo (`/api/semse/cortex/chat`, que arma el
 * contexto operativo y llama al modelo). Estas funciones son puras para poder probarlas sin red.
 */

export type WidgetChatContext = {
  module: string;
  resource?: { id?: string | null; type?: string | null } | null;
} | null;

export type ChatHistoryTurn = { role: "user" | "assistant"; content: string };

const HISTORY_MAX_TURNS = 10;
const HISTORY_MAX_TURN_CHARS = 2000;

/**
 * Turnos previos que se reenvían a Prometeo: el servidor no conserva el texto de las conversaciones, así que sin esto
 * cada mensaje llega "sin memoria" ("no tengo memoria de conversaciones anteriores"). Se omiten los saludos de
 * bienvenida, los mensajes degradados y los errores (no son respuestas de Prometeo) y se acota tamaño y cantidad.
 */
export function buildChatHistory(
  messages: ReadonlyArray<{ id?: string; role: "user" | "assistant"; content: string; status?: string }>,
): ChatHistoryTurn[] {
  return messages
    .filter((m) => m.id !== "welcome" && m.status !== "degraded" && !m.content.startsWith("⚠"))
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, HISTORY_MAX_TURN_CHARS) }))
    .filter((m) => m.content.length > 0)
    .slice(-HISTORY_MAX_TURNS);
}

export type WidgetChatRequest = {
  message: string;
  history?: ChatHistoryTurn[];
  threadId?: string;
  projectId?: string;
  pageContext: { route?: string; module?: string };
};

export type RuntimeChatData = {
  /** Acciones propuestas por el servidor; las de `namespace: "chat"` se muestran como botones (ver `prometeo-chat-actions`). */
  proposedActions?: Array<{ id?: string; namespace?: string; tool?: string; label?: string; input?: Record<string, unknown> }>;
  threadId?: string;
  response?: string;
  message?: string;
  mode?: string;
};

/** `projectId` solo si la pantalla es de un proyecto: un id de trabajo o de otro recurso no es un proyecto. */
export function buildWidgetChatRequest(input: {
  message: string;
  history?: ChatHistoryTurn[];
  threadId?: string;
  context: WidgetChatContext;
  route?: string;
}): WidgetChatRequest {
  const { context } = input;
  const projectId =
    context?.resource?.type === "project" && context.resource.id ? context.resource.id : undefined;
  return {
    message: input.message,
    ...(input.history && input.history.length > 0 ? { history: input.history } : {}),
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(projectId ? { projectId } : {}),
    pageContext: {
      ...(input.route ? { route: input.route } : {}),
      ...(context?.module ? { module: context.module } : {}),
    },
  };
}

/** Respuestas válidas del chat real: el modelo (`runtime`) y las salidas deterministas del runtime (reportes y contexto). */
const VALID_REPLY_MODES = new Set(["runtime", "report", "context_only"]);

export type WidgetReply =
  | { kind: "answer"; text: string; mode: string }
  | { kind: "degraded"; reason: string };

/**
 * Distingue una respuesta real de una degradación. En modo demo el endpoint devuelve textos de muestra y en `fallback`
 * el modelo no respondió: ninguno es una respuesta de Prometeo y no debe mostrarse como tal. Los reportes y las
 * respuestas de solo contexto SÍ son válidos y se conservan (antes se descartaban junto con el modo demo).
 */
export function classifyChatReply(data: RuntimeChatData | null | undefined): WidgetReply {
  if (!data) return { kind: "degraded", reason: "No hubo respuesta del asistente." };
  const mode = data.mode ?? "";
  if (mode === "demo") return { kind: "degraded", reason: "El asistente está en modo demostración." };
  if (!VALID_REPLY_MODES.has(mode)) return { kind: "degraded", reason: "El modelo no pudo responder en este momento." };
  const text = (data.response ?? data.message ?? "").trim();
  if (text.length === 0) return { kind: "degraded", reason: "El asistente devolvió una respuesta vacía." };
  return { kind: "answer", text, mode };
}

/** Motivo legible de un fallo de red: un timeout o una cancelación no son lo mismo que un error del servidor. */
export function describeChatFailure(error: unknown): string {
  const name = (error as { name?: string } | null)?.name;
  if (name === "TimeoutError") return "Prometeo tardó demasiado en responder.";
  if (name === "AbortError") return "La consulta se canceló.";
  const message = error instanceof Error ? error.message.trim() : "";
  return message.length > 0 ? message : "No se pudo consultar a Prometeo.";
}

/** Compatibilidad: texto de la respuesta si es válida, `null` si es una degradación. */
export function pickRuntimeReply(data: RuntimeChatData | null | undefined): string | null {
  const reply = classifyChatReply(data);
  return reply.kind === "answer" ? reply.text : null;
}
