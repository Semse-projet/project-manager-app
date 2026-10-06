import { z } from "zod";
import { communicationProviderSchema } from "./communication.schema.js";

/**
 * Conversation Intelligence (spec `prometeo.conversation-intelligence`, Wave 0 · CI-002).
 *
 * Contratos de PROVENANCE y de salida de lectura. Principio de la spec: hecho ≠ finding ≠ propuesta ≠ decisión ≠
 * acción ≠ outcome. Esta capa solo devuelve hechos y findings; ningún finding autoriza nada, y estos esquemas son
 * `.strict()` para que no puedan transportar campos de decisión, acción u outcome.
 */

/** Referencia a la fuente cruda: siempre un hilo canónico y, cuando aplica, el mensaje (`Communication.id`). */
export const conversationSourceRefSchema = z
  .object({
    kind: z.literal("communication"),
    threadId: z.string().trim().min(1),
    /** `Communication.id`; null en una referencia a nivel de hilo. */
    messageId: z.string().trim().min(1).nullable(),
    provider: communicationProviderSchema,
    /** Posición original del mensaje; null si la fuente no la conserva. */
    sequence: z.number().int().nonnegative().nullable(),
    /** Instante del mensaje; null cuando la fuente (p. ej. `ConversationSession.messages`) no lo tiene: no se inventa. */
    occurredAt: z.string().datetime().nullable(),
    /** Huella del cuerpo original, para detectar que la fuente cambió desde que se citó. */
    contentHash: z.string().trim().min(1).nullable(),
  })
  .strict();

/** Un hecho: un fragmento literal de la fuente, con su provenance. No interpreta nada. */
export const conversationFactSchema = z
  .object({
    kind: z.literal("fact"),
    sourceRef: conversationSourceRefSchema,
    snippet: z.string().min(1).max(500),
  })
  .strict();

/**
 * Un finding: una observación DERIVADA de uno o más mensajes. Exige provenance (al menos una fuente) y declara
 * explícitamente que no tiene autoridad.
 */
export const intelligenceFindingSchema = z
  .object({
    kind: z.literal("finding"),
    id: z.string().trim().min(1),
    category: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(500),
    confidence: z.number().min(0).max(1),
    sourceRefs: z.array(conversationSourceRefSchema).min(1),
    /** Derivado de la fuente, no es la fuente. */
    derived: z.literal(true),
    /** Un finding nunca es una decisión, aprobación ni acción. */
    authority: z.literal("none"),
    /** Para encadenar conversación → finding → futura decisión; solo si existe un valor real, nunca inventado. */
    correlationId: z.string().trim().min(1).optional(),
  })
  .strict();

export type ConversationSourceRef = z.infer<typeof conversationSourceRefSchema>;
export type ConversationFact = z.infer<typeof conversationFactSchema>;
export type IntelligenceFinding = z.infer<typeof intelligenceFindingSchema>;
