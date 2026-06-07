import PDFDocument from "pdfkit";
import type { InvoiceLineItem, InvoiceRecord } from "../../modules/finance/finance.repository.js";

const BRAND_COLOR = "#4f46e5";
const TEXT_COLOR = "#1f2937";
const MUTED_COLOR = "#6b7280";
const BORDER_COLOR = "#e5e7eb";

function fmtMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function drawHRule(doc: PDFKit.PDFDocument, y: number, color = BORDER_COLOR): void {
  doc.save().strokeColor(color).lineWidth(0.5).moveTo(50, y).lineTo(545, y).stroke().restore();
}

export type PdfBuildOptions = {
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
};

export function buildInvoicePdf(invoice: InvoiceRecord, docType: "invoice" | "estimate", options?: PdfBuildOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const bizName = options?.businessName ?? "SEMSE Contractor Services";
    const bizAddress = options?.businessAddress ?? "";
    const bizPhone = options?.businessPhone ?? "";
    const docLabel = docType === "estimate" ? "ESTIMATE" : "INVOICE";
    const coloredLabel = docType === "estimate" ? "#0d9488" : BRAND_COLOR;

    // ── Header ────────────────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(22).fillColor(coloredLabel).text("SEMSE", 50, 50, { continued: true });
    doc.font("Helvetica").fontSize(22).fillColor(TEXT_COLOR).text(` ${bizName.replace(/^SEMSE\s*/i, "")}`);

    if (bizAddress) doc.fontSize(9).fillColor(MUTED_COLOR).text(bizAddress, 50, doc.y + 2);
    if (bizPhone) doc.fontSize(9).fillColor(MUTED_COLOR).text(bizPhone, 50, doc.y + 1);

    doc.font("Helvetica-Bold").fontSize(28).fillColor(coloredLabel).text(docLabel, 350, 50, { align: "right", width: 195 });
    doc.fontSize(10).fillColor(TEXT_COLOR).font("Helvetica-Bold").text(`#${invoice.number}`, 350, doc.y + 4, { align: "right", width: 195 });

    const topY = Math.max(doc.y, 110);
    drawHRule(doc, topY + 8);

    // ── Dates ─────────────────────────────────────────────────────────────────────
    let row = topY + 18;
    doc.fontSize(9).font("Helvetica-Bold").fillColor(MUTED_COLOR).text("DATE ISSUED", 50, row).text("DUE DATE", 350, row);
    row += 13;
    doc.fontSize(10).font("Helvetica").fillColor(TEXT_COLOR).text(fmtDate(invoice.createdAt), 50, row).text(fmtDate(invoice.dueDate), 350, row);
    row += 25;
    drawHRule(doc, row);

    // ── Bill-to ───────────────────────────────────────────────────────────────────
    row += 12;
    doc.fontSize(9).font("Helvetica-Bold").fillColor(MUTED_COLOR).text("BILL TO", 50, row);
    row += 13;
    doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT_COLOR).text(invoice.clientOrgId ?? "Client", 50, row);
    row += 13;
    if (invoice.projectId) { doc.fontSize(9).font("Helvetica").fillColor(MUTED_COLOR).text(`Project: ${invoice.projectId}`, 50, row); row += 12; }
    if (invoice.jobId) { doc.fontSize(9).font("Helvetica").fillColor(MUTED_COLOR).text(`Job: ${invoice.jobId}`, 50, row); row += 12; }

    row += 16;
    doc.fontSize(11).font("Helvetica-Bold").fillColor(TEXT_COLOR).text(invoice.title, 50, row);
    row += 20;
    drawHRule(doc, row);

    // ── Line items ────────────────────────────────────────────────────────────────
    row += 10;
    doc.fontSize(9).font("Helvetica-Bold").fillColor(MUTED_COLOR)
      .text("DESCRIPTION", 50, row)
      .text("QTY", 330, row, { width: 55, align: "right" })
      .text("UNIT PRICE", 390, row, { width: 90, align: "right" })
      .text("TOTAL", 490, row, { width: 55, align: "right" });
    row += 15;
    drawHRule(doc, row, "#d1d5db");

    const lineItems = Array.isArray(invoice.lineItems) ? (invoice.lineItems as InvoiceLineItem[]) : [];
    let isAlt = false;
    for (const item of lineItems) {
      row += 4;
      if (isAlt) doc.save().rect(50, row - 2, 495, 20).fill("#f9fafb").restore();
      const descH = doc.heightOfString(item.description, { width: 270 });
      doc.fontSize(9).font("Helvetica").fillColor(TEXT_COLOR)
        .text(item.description, 50, row, { width: 270 })
        .text(String(item.qty ?? 1), 330, row, { width: 55, align: "right" })
        .text(fmtMoney(item.unitPrice ?? 0, invoice.currency), 390, row, { width: 90, align: "right" })
        .text(fmtMoney(item.total ?? 0, invoice.currency), 490, row, { width: 55, align: "right" });
      row += Math.max(descH, 16) + 4;
      isAlt = !isAlt;
      if (row > 680) { doc.addPage(); row = 50; }
    }

    drawHRule(doc, row + 4);
    row += 18;

    // ── Totals ────────────────────────────────────────────────────────────────────
    doc.fontSize(9).font("Helvetica").fillColor(MUTED_COLOR).text("Subtotal", 360, row, { width: 120, align: "right" });
    doc.fontSize(9).font("Helvetica").fillColor(TEXT_COLOR).text(fmtMoney(invoice.subtotal, invoice.currency), 490, row, { width: 55, align: "right" });
    row += 14;

    if (invoice.taxAmount > 0) {
      doc.fontSize(9).font("Helvetica").fillColor(MUTED_COLOR).text("Tax", 360, row, { width: 120, align: "right" });
      doc.fontSize(9).font("Helvetica").fillColor(TEXT_COLOR).text(fmtMoney(invoice.taxAmount, invoice.currency), 490, row, { width: 55, align: "right" });
      row += 14;
    }

    drawHRule(doc, row, "#9ca3af");
    row += 8;
    doc.fontSize(12).font("Helvetica-Bold").fillColor(TEXT_COLOR)
      .text("TOTAL", 360, row, { width: 120, align: "right" })
      .text(fmtMoney(invoice.total, invoice.currency), 490, row, { width: 55, align: "right" });
    row += 30;

    // ── Status badge ──────────────────────────────────────────────────────────────
    if (invoice.status === "paid") {
      doc.save().roundedRect(50, row, 90, 22, 4).fill("#d1fae5").restore();
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#065f46").text("PAID ✓", 50, row + 5, { width: 90, align: "center" });
    } else if (docType === "estimate") {
      doc.save().roundedRect(50, row, 120, 22, 4).fill("#e0f2fe").restore();
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#075985").text("ESTIMATE", 50, row + 5, { width: 120, align: "center" });
    }
    row += 40;

    // ── Notes & Terms ─────────────────────────────────────────────────────────────
    if (invoice.notes) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(MUTED_COLOR).text("NOTES", 50, row);
      row += 12;
      doc.fontSize(9).font("Helvetica").fillColor(TEXT_COLOR).text(invoice.notes, 50, row, { width: 495 });
      row += doc.heightOfString(invoice.notes, { width: 495 }) + 12;
    }
    if (invoice.terms) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(MUTED_COLOR).text("TERMS & CONDITIONS", 50, row);
      row += 12;
      doc.fontSize(9).font("Helvetica").fillColor(MUTED_COLOR).text(invoice.terms, 50, row, { width: 495 });
    }

    // ── Footer ────────────────────────────────────────────────────────────────────
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font("Helvetica").fillColor(MUTED_COLOR)
        .text(`Generated by SEMSE OS • ${new Date().toLocaleDateString("en-US")} • Page ${i + 1} of ${pageCount}`, 50, 740, { width: 495, align: "center" });
    }

    doc.end();
  });
}
