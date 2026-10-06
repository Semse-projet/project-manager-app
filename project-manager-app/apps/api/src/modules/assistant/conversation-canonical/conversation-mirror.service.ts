import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  isMirrorEnabled,
  mapAssistantSession,
  resolveConversationIntelligenceMode,
  type ConversationIntelligenceMode,
  type LegacyAssistantSession,
} from "./conversation-mapping.js";

export type MirrorResult = { threadId: string; attempted: number; inserted: number };

/**
 * Dual-write temporal (spec `prometeo.conversation-intelligence`, §7 paso 2): cada turno del asistente refleja la
 * `ConversationSession` en `CommunicationThread` / `Communication` sin cambiar nada de lo que ve el usuario.
 *
 * - **Apagado por defecto** (`SEMSE_CONVERSATION_INTELLIGENCE_MODE=off`): no toca la base.
 * - **Idempotente:** el hilo se resuelve por su clave única `(tenantId, channel, externalThreadId)` y los mensajes por
 *   `(tenantId, provider, externalMessageId)` con `skipDuplicates`: reintentar o reflejar el mismo turno dos veces no duplica.
 * - **Fail-open:** un fallo se registra y se cuenta, pero NUNCA rompe la respuesta al usuario.
 * - **Sin contenido en logs ni métricas:** solo ids y cantidades.
 * - **Aislamiento:** `tenantId` en la clave del hilo y en cada mensaje; una sesión de un tenant no puede escribir en otro.
 */
@Injectable()
export class ConversationMirrorService {
  private readonly logger = new Logger(ConversationMirrorService.name);

  /** Métricas de la spec §8 (dual-write success/failure); en proceso, sin contenido. */
  readonly stats = { success: 0, failure: 0, messagesInserted: 0 };

  constructor(private readonly prisma: PrismaService) {}

  async mirrorSession(session: LegacyAssistantSession, mode: ConversationIntelligenceMode = resolveConversationIntelligenceMode()): Promise<MirrorResult | null> {
    if (!isMirrorEnabled(mode)) return null;

    try {
      const { thread, messages } = mapAssistantSession(session);
      const stored = await this.prisma.communicationThread.upsert({
        where: {
          tenantId_channel_externalThreadId: {
            tenantId: thread.tenantId,
            channel: thread.channel,
            externalThreadId: thread.externalThreadId,
          },
        },
        create: thread,
        update: {},
        select: { id: true },
      });

      const written = messages.length
        ? await this.prisma.communication.createMany({
            data: messages.map((message) => ({ ...message, threadId: stored.id })),
            skipDuplicates: true,
          })
        : { count: 0 };

      this.stats.success += 1;
      this.stats.messagesInserted += written.count;
      this.logger.log(`conversation_mirror_success session=${session.id} thread=${stored.id} attempted=${messages.length} inserted=${written.count}`);
      return { threadId: stored.id, attempted: messages.length, inserted: written.count };
    } catch (error) {
      this.stats.failure += 1;
      this.logger.warn(`conversation_mirror_failure session=${session.id} error=${error instanceof Error ? error.name : "unknown"}`);
      return null;
    }
  }
}
