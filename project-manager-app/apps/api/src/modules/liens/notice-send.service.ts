import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@semse/db';
import { LobClient } from '../../integrations/lob';

/**
 * NoticeSendService — envía notices vía Lob.com (correo certificado digital).
 */
@Injectable()
export class NoticeSendService {
  private readonly logger = new Logger(NoticeSendService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lobClient: LobClient
  ) {}

  /**
   * Enviar notice vía Lob.com.
   * Transición: DRAFT → NOTICE_SENT
   */
  async sendNotice(noticeId: string): Promise<any> {
    this.logger.log(`Sending notice: ${noticeId}`);

    const notice = await this.prisma.lienNotice.findUniqueOrThrow({
      where: { id: noticeId },
      include: { lienCalendar: { include: { project: true } } },
    });

    if (notice.status !== 'DRAFT') {
      throw new Error(`Cannot send notice with status ${notice.status}`);
    }

    // 1. Preparar datos para Lob.com
    const to = {
      name: this.getRecipientName(notice.recipientType),
      address_line1: notice.lienCalendar.project.address || '123 Main St',
      city: 'City',
      state: notice.lienCalendar.stateName,
      zip: '12345',
    };

    const from = {
      name: 'SEMSE Liens',
      address_line1: '1 Market St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94105',
    };

    // 2. Llamar Lob.com API
    let lobLetter: any;
    try {
      lobLetter = await this.lobClient.sendLetter({
        to,
        from,
        html: notice.noticeContent,
        subject: `Preliminary Notice - ${notice.lienCalendar.stateName}`,
        apiKey: process.env.LOB_API_KEY || '',
      });
    } catch (error) {
      this.logger.error(`Failed to send letter via Lob.com`, error);
      throw error;
    }

    // 3. Actualizar notice en BD
    const updated = await this.prisma.lienNotice.update({
      where: { id: noticeId },
      data: {
        status: 'NOTICE_SENT',
        sentAt: new Date(),
        lobLetterTrackingId: lobLetter.id,
        lobLetterUrl: lobLetter.url,
        sentBy: 'system',
      },
    });

    this.logger.log(`Notice sent successfully: ${noticeId}`, {
      lobLetterId: lobLetter.id,
      status: lobLetter.status,
    });

    return updated;
  }

  /**
   * Obtener nombre del recipient basado en tipo.
   */
  private getRecipientName(recipientType: string): string {
    const names: Record<string, string> = {
      owner: 'Property Owner',
      general_contractor: 'General Contractor',
      lender: 'Lender',
      architect: 'Architect',
    };

    return names[recipientType] || 'Recipient';
  }

  /**
   * Procesar webhook de Lob.com.
   * Transición: NOTICE_SENT → DELIVERY_PENDING → NOTICE_DELIVERED
   */
  async processLobWebhook(payload: any): Promise<void> {
    const { object, type, data } = payload;

    if (object !== 'event' || !type.startsWith('letter.')) {
      return; // Ignorar eventos no-letter
    }

    const letterId = data?.id;
    if (!letterId) {
      this.logger.warn(`Webhook missing letter ID`);
      return;
    }

    // 1. Encontrar notice por lobLetterTrackingId
    const notice = await this.prisma.lienNotice.findFirst({
      where: { lobLetterTrackingId: letterId },
    });

    if (!notice) {
      this.logger.warn(`Notice not found for letter ${letterId}`);
      return;
    }

    // 2. Mapear evento Lob → status notice
    let newStatus: string | null = null;

    if (type === 'letter.processed') {
      newStatus = 'DELIVERY_PENDING';
    } else if (type === 'letter.delivered') {
      newStatus = 'NOTICE_DELIVERED';
    } else if (type === 'letter.returned_to_sender' || type === 'letter.failed') {
      newStatus = 'DELIVERY_FAILED';
    }

    // 3. Actualizar status si hay transición
    if (newStatus && notice.status !== newStatus) {
      await this.prisma.lienNotice.update({
        where: { id: notice.id },
        data: {
          status: newStatus,
          deliveredAt: newStatus === 'NOTICE_DELIVERED' ? new Date() : undefined,
        },
      });

      this.logger.log(`Notice status updated: ${notice.id} → ${newStatus}`, {
        letterId,
        lobEvent: type,
      });
    }
  }
}
