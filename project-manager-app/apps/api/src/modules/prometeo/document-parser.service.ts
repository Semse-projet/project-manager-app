import { Injectable, Logger } from "@nestjs/common";

export type ParsedDocument = {
  text:          string;
  pageCount?:    number;
  sectionCount?: number;
  parser:        string;
  warnings:      string[];
  charCount:     number;
};

const MAX_CHARS = 400_000; // ~100k tokens — hard limit per document

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  async parseBuffer(buffer: Buffer, mimeType: string, filename?: string): Promise<ParsedDocument> {
    const mime = mimeType.toLowerCase();

    if (mime === "application/pdf" || filename?.endsWith(".pdf")) {
      return this.parsePdf(buffer);
    }
    if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "application/msword" ||
      filename?.endsWith(".docx") || filename?.endsWith(".doc")
    ) {
      return this.parseDocx(buffer);
    }
    if (mime.startsWith("text/") || filename?.endsWith(".md") || filename?.endsWith(".txt") || filename?.endsWith(".markdown")) {
      return this.parsePlainText(buffer);
    }

    throw new Error(`Formato no soportado: ${mimeType || filename}. Usa PDF, DOCX, TXT o Markdown.`);
  }

  private async parsePdf(buffer: Buffer): Promise<ParsedDocument> {
    try {
      // Dynamic import to avoid issues if pdf-parse is not installed
      // pdf-parse exports differ by resolution-mode; support both CJS default and named export
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import("pdf-parse") as any;
      const pdfParse = (mod.default ?? mod) as (buf: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
      const data = await pdfParse(buffer);
      const text = data.text?.trim() ?? "";

      if (!text || text.length < 10) {
        return {
          text: "", pageCount: data.numpages, parser: "pdf-parse",
          warnings: ["Este PDF parece escaneado o sin texto extraíble. El soporte para OCR queda para una fase futura."],
          charCount: 0,
        };
      }

      const truncated = text.slice(0, MAX_CHARS);
      return {
        text: truncated,
        pageCount: data.numpages,
        parser: "pdf-parse",
        warnings: text.length > MAX_CHARS ? [`Documento truncado (${text.length} → ${MAX_CHARS} chars)`] : [],
        charCount: truncated.length,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Error al parsear PDF: ${msg}`);
    }
  }

  private async parseDocx(buffer: Buffer): Promise<ParsedDocument> {
    try {
      const mammoth = await import("mammoth") as { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string; messages: Array<{ message: string }> }> };
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim() ?? "";
      const warnings = result.messages?.map((m) => m.message) ?? [];

      if (!text || text.length < 10) {
        return { text: "", parser: "mammoth", warnings: ["El DOCX no contiene texto extraíble."], charCount: 0 };
      }

      const truncated = text.slice(0, MAX_CHARS);
      if (text.length > MAX_CHARS) warnings.push(`Documento truncado (${text.length} → ${MAX_CHARS} chars)`);

      return { text: truncated, parser: "mammoth", warnings, charCount: truncated.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Error al parsear DOCX: ${msg}`);
    }
  }

  private parsePlainText(buffer: Buffer): ParsedDocument {
    const text = buffer.toString("utf-8").trim();
    if (!text || text.length < 5) {
      return { text: "", parser: "text", warnings: ["El archivo está vacío."], charCount: 0 };
    }
    const truncated = text.slice(0, MAX_CHARS);
    return {
      text: truncated,
      parser: "text",
      warnings: text.length > MAX_CHARS ? [`Documento truncado (${text.length} → ${MAX_CHARS} chars)`] : [],
      charCount: truncated.length,
    };
  }
}
