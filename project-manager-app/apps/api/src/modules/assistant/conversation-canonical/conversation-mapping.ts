import { createHash } from "node:crypto";

/**
 * Conversation Intelligence · Ola 1 (spec `prometeo.conversation-intelligence`, §5 contrato de persistencia).
 *
 * Mapeo PURO de una `ConversationSession` del asistente (mensajes en un JSON `{ role, content }`) a un hilo y mensajes
 * canónicos (`CommunicationThread` / `Communication`). Sin I/O. Principio de la spec: **no se inventa nada** — lo que la
 * fuente no tiene (instante por mensaje, `orgId`) queda `null`, y el orden es la posición original en el array.
 */

export type ConversationIntelligenceMode = "off" | "shadow" | "canary" | "live";

/** `off` por defecto y ante cualquier valor desconocido. Con `shadow`/`canary`/`live` se escribe el hilo canónico (la lectura canónica llega en olas posteriores). */
export function resolveConversationIntelligenceMode(env: Record<string, string | undefined> = process.env): ConversationIntelligenceMode {
  const raw = env.SEMSE_CONVERSATION_INTELLIGENCE_MODE?.trim().toLowerCase();
  return raw === "shadow" || raw === "canary" || raw === "live" ? raw : "off";
}

/** El espejo escribe para TODOS los tenants cuando el modo no es `off`: la lista canary solo gobernará la lectura, y un tenant fuera de ella no debe quedarse con datos canónicos incompletos. */
export function isMirrorEnabled(mode: ConversationIntelligenceMode): boolean {
  return mode !== "off";
}

export type LegacyAssistantSession = {
  id: string;
  tenantId: string;
  userId: string;
  flow?: string | null;
  pageRoute?: string | null;
  messages: unknown;
};

export type CanonicalThreadInput = {
  tenantId: string;
  channel: "WEB_CHAT";
  externalThreadId: string;
  contactUserId: string;
  source: "assistant";
  /** Siempre null: `ConversationSession` no guarda `orgId` y de ella sola no hay una relación inequívoca. */
  orgId: null;
  metadataJson: { legacy: "conversation_session"; sessionId: string; flow: string | null; pageRoute: string | null };
};

export type CanonicalMessageInput = {
  tenantId: string;
  provider: "WEB_CHAT";
  externalMessageId: string;
  direction: "INBOUND" | "OUTBOUND";
  status: "RECEIVED" | "SENT";
  senderUserId: string | null;
  body: string;
  /** Posición ORIGINAL en `ConversationSession.messages` (se conserva aunque se salten entradas inválidas). */
  sequence: number;
  /** Siempre null: los mensajes legacy no tienen instante propio y no se inventa uno. */
  occurredAt: null;
  contentHash: string;
  /** Metadata legacy mínima, sin duplicar el cuerpo. */
  rawPayloadJson: { legacy: "conversation_session"; sessionId: string; role: "user" | "assistant"; legacyIndex: number };
};

export type CanonicalConversation = { thread: CanonicalThreadInput; messages: CanonicalMessageInput[] };

/** Huella del cuerpo original (UTF-8 exacto, sin normalizar): cambia si la fuente cambia. */
export function contentHashOf(body: string): string {
  return `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
}

export function externalThreadIdOf(sessionId: string): string {
  return `assistant:${sessionId}`;
}

export function externalMessageIdOf(sessionId: string, sequence: number): string {
  return `assistant:${sessionId}:${sequence}`;
}

/**
 * Tolera lo que la fuente pueda traer: `messages` vacío o que no sea un array, entradas que no son objetos, roles
 * desconocidos o `content` que no es texto. Esas entradas se saltan, pero **el `sequence` de las demás no se desplaza**.
 */
export function mapAssistantSession(session: LegacyAssistantSession): CanonicalConversation {
  const raw = Array.isArray(session.messages) ? session.messages : [];
  const messages: CanonicalMessageInput[] = [];

  raw.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) return;
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return;
    const inbound = role === "user";
    messages.push({
      tenantId: session.tenantId,
      provider: "WEB_CHAT",
      externalMessageId: externalMessageIdOf(session.id, index),
      direction: inbound ? "INBOUND" : "OUTBOUND",
      status: inbound ? "RECEIVED" : "SENT",
      senderUserId: inbound ? session.userId : null,
      body: content,
      sequence: index,
      occurredAt: null,
      contentHash: contentHashOf(content),
      rawPayloadJson: { legacy: "conversation_session", sessionId: session.id, role, legacyIndex: index },
    });
  });

  return {
    thread: {
      tenantId: session.tenantId,
      channel: "WEB_CHAT",
      externalThreadId: externalThreadIdOf(session.id),
      contactUserId: session.userId,
      source: "assistant",
      orgId: null,
      metadataJson: { legacy: "conversation_session", sessionId: session.id, flow: session.flow ?? null, pageRoute: session.pageRoute ?? null },
    },
    messages,
  };
}
