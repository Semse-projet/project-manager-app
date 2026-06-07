import { Injectable } from "@nestjs/common";
import type { InvoiceRecord } from "../../modules/finance/finance.repository.js";
import { buildInvoicePdf, type PdfBuildOptions } from "./build-pdf.js";

@Injectable()
export class PdfService {
  generateInvoicePdf(invoice: InvoiceRecord, options?: PdfBuildOptions): Promise<Buffer> {
    return buildInvoicePdf(invoice, "invoice", options);
  }

  generateEstimatePdf(invoice: InvoiceRecord, options?: PdfBuildOptions): Promise<Buffer> {
    return buildInvoicePdf(invoice, "estimate", options);
  }
}
