import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@semse/db';

/**
 * NoticeGeneratorService — genera notices HTML/PDF pre-poblados.
 *
 * Características:
 * - Template HTML reusable con variables {{variable}}
 * - Población automática con datos del proyecto
 * - Generación de PDF (usando pdfkit)
 * - State-specific language (de LienGrid data)
 * - Legal-grade templates (auditable)
 */

export interface GenerateNoticeInput {
  lienCalendarId: string;
  recipientType: 'owner' | 'general_contractor' | 'lender' | 'architect';
  createdBy: string;
}

export interface NoticeData {
  stateName: string;
  projectName: string;
  projectAddress: string;
  contractAmount: number;
  projectStartDate: string;
  recipientType: string;
  ownerName?: string;
  generalContractorName?: string;
  generatedDate: string;
}

@Injectable()
export class NoticeGeneratorService {
  private readonly logger = new Logger(NoticeGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generar HTML de preliminary notice.
   */
  async generateNoticeHtml(data: NoticeData): Promise<string> {
    this.logger.log(`Generating notice HTML: ${data.stateName} / ${data.recipientType}`);

    // Template base (hardcoded por ahora)
    const template = this.getNoticeTemplate(data.stateName);

    // Poblate variables
    const html = this.populateTemplate(template, data);

    return html;
  }

  /**
   * Template por estado (simplified - en producción sería más complejo).
   */
  private getNoticeTemplate(stateName: string): string {
    const baseTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preliminary Notice</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 20px; }
    .section { margin-bottom: 20px; }
    .label { font-weight: bold; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>PRELIMINARY NOTICE OF RIGHT TO LIEN</h1>
    <p>State of {{stateName}}</p>
  </div>

  <div class="section">
    <p><strong>TO:</strong> {{recipientType}}</p>
  </div>

  <div class="section">
    <p class="label">Project Information:</p>
    <p><strong>Project:</strong> {{projectName}}</p>
    <p><strong>Address:</strong> {{projectAddress}}</p>
    <p><strong>Contract Amount:</strong> ${{contractAmount}}</p>
    <p><strong>Work Start Date:</strong> {{projectStartDate}}</p>
  </div>

  <div class="section">
    <p>This is to notify you that {{recipientType}} may have lien rights on the property described above if we are not paid for labor, materials, or services provided. This notice is required by {{stateName}} law.</p>

    <p>The following persons or companies have an interest in the real property mentioned above and as such may have lien rights against the real property:</p>
    <p><strong>Contractor/Supplier:</strong> [To be filled by implementor]</p>
  </div>

  <div class="section">
    <p class="label">Important Information:</p>
    <ul>
      <li>This notice is provided to protect the lien rights of persons furnishing labor, materials, or services for the improvement of the real property.</li>
      <li>{{stateName}} law provides that those who help improve your property but who are not paid in full for their work or materials may file a lien against the property.</li>
      <li>This notice is being given to ensure you are aware of lien rights that may exist on the property.</li>
    </ul>
  </div>

  <div class="footer">
    <p>Generated: {{generatedDate}}</p>
    <p>This notice was generated automatically by SEMSE Liens system.</p>
  </div>
</body>
</html>
    `;

    return baseTemplate;
  }

  /**
   * Poblar template con datos.
   * Reemplaza {{variable}} con values.
   */
  private populateTemplate(template: string, data: NoticeData): string {
    let html = template;

    // Reemplazar todas las variables
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      html = html.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return html;
  }

  /**
   * Generar PDF desde HTML (usando pdfkit).
   * Por ahora retorna HTML base64 (futuro: generar PDF real).
   */
  async generatePdfFromHtml(html: string): Promise<Buffer> {
    this.logger.log('Generating PDF from HTML');

    // TODO: Implementar con pdfkit
    // import PDFDocument from 'pdfkit';
    // const doc = new PDFDocument();
    // const stream = fs.createWriteStream('output.pdf');
    // doc.pipe(stream);
    // doc.text(html);
    // doc.end();

    // Por ahora: retornar HTML como Buffer (placeholder)
    return Buffer.from(html, 'utf-8');
  }

  /**
   * Crear LienNotice automáticamente desde LienCalendar.
   * Llamado cuando se alcanza ALERTED_3D.
   */
  async generateNoticeFromCalendar(
    lienCalendarId: string,
    recipientType: 'owner' | 'general_contractor' | 'lender' | 'architect',
    createdBy: string
  ): Promise<any> {
    this.logger.log(`Generating notice for calendar: ${lienCalendarId} / ${recipientType}`);

    // 1. Obtener LienCalendar
    const calendar = await this.prisma.lienCalendar.findUniqueOrThrow({
      where: { id: lienCalendarId },
      include: { project: true },
    });

    // 2. Preparar datos
    const noticeData: NoticeData = {
      stateName: calendar.stateName,
      projectName: calendar.project.name || 'Untitled Project',
      projectAddress: calendar.project.address || 'Unknown Address',
      contractAmount: 0, // TODO: obtener del escrow/contrato
      projectStartDate: calendar.project.startDate?.toISOString().split('T')[0] || 'TBD',
      recipientType,
      generatedDate: new Date().toISOString().split('T')[0],
    };

    // 3. Generar HTML
    const noticeContent = await this.generateNoticeHtml(noticeData);

    // 4. Crear LienNotice en BD
    const notice = await this.prisma.lienNotice.create({
      data: {
        lienCalendarId,
        noticeType: 'preliminary',
        recipientType,
        noticeContent,
        generatedAt: new Date(),
        createdBy,
        status: 'DRAFT',
      },
    });

    this.logger.log(`Created notice: ${notice.id}`, { lienCalendarId, recipientType });

    return notice;
  }

  /**
   * Generar notices para todos los recipient types de un calendar.
   * Uso: cuando se alcanza ALERTED_3D.
   */
  async generateAllNoticesForCalendar(
    lienCalendarId: string,
    createdBy: string
  ): Promise<any[]> {
    const calendar = await this.prisma.lienCalendar.findUniqueOrThrow({
      where: { id: lienCalendarId },
      include: { notices: true },
    });

    // Recipient types según LienGrid response
    const recipientTypes: Array<'owner' | 'general_contractor' | 'lender' | 'architect'> = [
      'owner',
      'general_contractor',
    ];

    const notices: any[] = [];

    for (const recipientType of recipientTypes) {
      // Verificar si ya existe notice para este recipient
      const existing = await this.prisma.lienNotice.findFirst({
        where: { lienCalendarId, recipientType },
      });

      if (!existing) {
        const notice = await this.generateNoticeFromCalendar(
          lienCalendarId,
          recipientType,
          createdBy
        );
        notices.push(notice);
      }
    }

    return notices;
  }

  /**
   * Obtener preview de notice (para UI antes de envío).
   */
  async getNoticePreview(noticeId: string): Promise<{ html: string; pdf?: string }> {
    const notice = await this.prisma.lienNotice.findUniqueOrThrow({
      where: { id: noticeId },
    });

    return {
      html: notice.noticeContent,
      // pdf: si se genera, aquí iría la URL o base64
    };
  }

  /**
   * Actualizar status de notice (DRAFT → NOTICE_SENT, etc).
   */
  async updateNoticeStatus(noticeId: string, newStatus: string): Promise<any> {
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['NOTICE_SENT'],
      NOTICE_SENT: ['DELIVERY_PENDING', 'DELIVERY_FAILED'],
      DELIVERY_PENDING: ['NOTICE_DELIVERED', 'DELIVERY_FAILED'],
    };

    const notice = await this.prisma.lienNotice.findUniqueOrThrow({
      where: { id: noticeId },
    });

    const allowed = validTransitions[notice.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid transition: ${notice.status} → ${newStatus}`);
    }

    return await this.prisma.lienNotice.update({
      where: { id: noticeId },
      data: { status: newStatus, updatedAt: new Date() },
    });
  }
}
