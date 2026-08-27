// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { LobClient } from '../../integrations/lob.js';

/**
 * Parses "123 Main St, San Francisco, CA 94102" into its mail-API components.
 * Same format `ProjectLiensService.extractStateFromAddress()` already
 * assumes elsewhere in this module — not a new assumption. Returns null if
 * the string isn't in that shape (missing city/state/zip, freeform text,
 * etc.) so the caller can fail closed instead of mailing to a guess.
 */
export function parseMailAddress(
  fullAddress: string | null | undefined
): { addressLine1: string; city: string; state: string; zip: string } | null {
  if (!fullAddress) return null;
  const parts = fullAddress.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  const stateZip = parts[parts.length - 1];
  const match = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!match) return null;

  const city = parts[parts.length - 2];
  const addressLine1 = parts.slice(0, parts.length - 2).join(', ');
  if (!addressLine1 || !city) return null;

  return { addressLine1, city, state: match[1], zip: match[2] };
}

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
      // Project itself has no address field — the location lives on its
      // parent Job (checked against packages/db/prisma/schema.prisma
      // 2026-08-27).
      include: { lienCalendar: { include: { project: { include: { job: true } } } } },
    });

    if (notice.status !== 'DRAFT') {
      throw new Error(`Cannot send notice with status ${notice.status}`);
    }

    // 1. Preparar datos para Lob.com
    // This mails a real, physical, legally-significant letter — refuse to
    // send it to a guessed/placeholder address rather than silently
    // producing an undeliverable (or wrongly-delivered) certified letter.
    const parsedAddress = parseMailAddress(notice.lienCalendar.project.job.location);
    if (!parsedAddress) {
      throw new Error(
        `Cannot send notice ${noticeId}: project job location is missing or not in ` +
          `"street, city, ST zip" format (got: ${notice.lienCalendar.project.job.location ?? 'none'}) — ` +
          `refusing to mail a legal notice to a guessed address.`
      );
    }
    const to = {
      name: this.getRecipientName(notice.recipientType),
      address_line1: parsedAddress.addressLine1,
      city: parsedAddress.city,
      state: parsedAddress.state,
      zip: parsedAddress.zip,
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
