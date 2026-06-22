// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * ExportBundleService — generar PDF bundle con toda la evidencia.
 * Incluye: fotos, daily logs, change orders, metrics.
 */

@Injectable()
export class ExportBundleService {
  private readonly logger = new Logger(ExportBundleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generar PDF bundle con toda la evidencia.
   * Retorna HTML (en producción: usar pdfkit para PDF real).
   */
  async generateBundle(projectId: string): Promise<string> {
    this.logger.log(`Generating evidence bundle for project: ${projectId}`);

    // 1. Obtener proyecto
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    // 2. Obtener fotos
    const photos = await this.prisma.evidencePhoto.findMany({
      where: { projectId },
      orderBy: { exifTimestamp: 'asc' },
    });

    // 3. Obtener daily logs
    const dailyLogs = await this.prisma.evidenceLog.findMany({
      where: { projectId },
      orderBy: { logDate: 'asc' },
    });

    // 4. Obtener change orders
    const changeOrders = await this.prisma.changeOrder.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    // 5. Construir HTML del bundle
    const html = this.buildBundleHTML({
      project,
      photos,
      dailyLogs,
      changeOrders,
    });

    this.logger.log(`Bundle generated successfully: ${projectId}`, {
      photoCount: photos.length,
      logCount: dailyLogs.length,
      changeOrderCount: changeOrders.length,
    });

    return html;
  }

  /**
   * Construir HTML del bundle (estructura).
   */
  private buildBundleHTML(data: {
    project: any;
    photos: any[];
    dailyLogs: any[];
    changeOrders: any[];
  }): string {
    const { project, photos, dailyLogs, changeOrders } = data;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Evidence Bundle</title>
  <style>
    body { font-family: Arial; margin: 20px; }
    .cover { text-align: center; page-break-after: always; }
    .section { margin-top: 30px; page-break-before: always; }
    .title { font-size: 24px; font-weight: bold; }
    .subtitle { font-size: 14px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f0f0f0; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>EVIDENCE BUNDLE</h1>
    <p class="subtitle">Construction Project Evidence Report</p>
    <hr>
    <p><strong>Project:</strong> ${project.name}</p>
    <p><strong>Address:</strong> ${project.address}</p>
    <p><strong>Start Date:</strong> ${project.startDate?.toISOString().split('T')[0]}</p>
    <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
  </div>

  <div class="section">
    <h2>1. PHOTOS (${photos.length})</h2>
    <table>
      <tr>
        <th>Date/Time</th>
        <th>Location (GPS)</th>
        <th>Camera</th>
        <th>Status</th>
      </tr>
      ${photos
        .map(
          (p) => `
        <tr>
          <td>${p.exifTimestamp?.toISOString() || 'N/A'}</td>
          <td>${p.gpsLatitude?.toFixed(4)}, ${p.gpsLongitude?.toFixed(4)}</td>
          <td>${p.cameraModel || 'Unknown'}</td>
          <td>${p.status || 'VALIDATED'}</td>
        </tr>
      `
        )
        .join('')}
    </table>
  </div>

  <div class="section">
    <h2>2. DAILY LOGS (${dailyLogs.length})</h2>
    <table>
      <tr>
        <th>Date</th>
        <th>Photos</th>
        <th>Changes</th>
        <th>Status</th>
        <th>Signed By</th>
      </tr>
      ${dailyLogs
        .map(
          (l) => `
        <tr>
          <td>${l.logDate?.toISOString().split('T')[0]}</td>
          <td>${l.photoCount || 0}</td>
          <td>${l.changesCount || 0}</td>
          <td>${l.status}</td>
          <td>${l.signedBy || '—'}</td>
        </tr>
      `
        )
        .join('')}
    </table>
  </div>

  <div class="section">
    <h2>3. CHANGE ORDERS (${changeOrders.length})</h2>
    <table>
      <tr>
        <th>Date</th>
        <th>Description</th>
        <th>Amount</th>
        <th>Status</th>
      </tr>
      ${changeOrders
        .map(
          (co) => `
        <tr>
          <td>${co.createdAt?.toISOString().split('T')[0]}</td>
          <td>${co.description}</td>
          <td>$${co.amount?.toLocaleString() || '0'}</td>
          <td>${co.status}</td>
        </tr>
      `
        )
        .join('')}
    </table>
  </div>

  <div class="section">
    <h2>4. SUMMARY</h2>
    <p>Total Photos: ${photos.length}</p>
    <p>Total Daily Logs: ${dailyLogs.length}</p>
    <p>Total Change Orders: ${changeOrders.length}</p>
    <p>Approved Changes: $${changeOrders
      .filter((co) => co.status === 'APPROVED')
      .reduce((sum, co) => sum + (co.amount || 0), 0)
      .toLocaleString()}</p>
  </div>

  <div class="footer">
    <p>This document is an automated evidence bundle generated by SEMSE.</p>
    <p>For authenticity verification, check digital signatures on individual records.</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Generar PDF desde HTML (placeholder).
   * En producción: usar pdfkit para generar PDF real.
   */
  async generatePDFBuffer(html: string): Promise<Buffer> {
    this.logger.log('Converting HTML to PDF');

    // TODO: Usar pdfkit
    // import PDFDocument from 'pdfkit';
    // const doc = new PDFDocument();
    // doc.text(html);
    // return doc.getBuffer();

    // Por ahora: retornar HTML como Buffer
    return Buffer.from(html, 'utf-8');
  }
}
